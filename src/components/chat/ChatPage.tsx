import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Phone, MoreVertical, Play, Pause, File, MapPin, UserPlus, X } from 'lucide-react';
import InputArea from './InputArea';
import { useSettings } from '../../contexts/SettingsContext';

const API = '';

interface Msg { id: number; text: string; isMine: boolean; time: string; isVoice?: boolean; voiceDuration?: number; voiceUrl?: string; isImage?: boolean; imageData?: string; isFile?: boolean; fileName?: string; isLocation?: boolean; lat?: number; lng?: number; mediaCacheKey?: string; _error?: boolean; is_ai?: boolean }

function fmt(t: number) { return new Date(t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); }

const fontSizeMap: Record<string, number> = { small: 13, normal: 14, large: 16 };

function getThemeColors(theme: string) {
  const dark = theme === 'dark';
  return {
    bg: dark ? '#1a1a2e' : '#F7F3EE',
    surface: dark ? '#252540' : 'rgba(255,255,255,0.9)',
    text: dark ? '#e0e0e0' : '#3E2723',
    textSec: dark ? '#a0a0b0' : '#8D6E63',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(234,224,213,0.6)',
    bubbleOther: dark ? '#2e2e4a' : '#EAE0D5',
    dateChip: dark ? 'rgba(255,255,255,0.08)' : 'rgba(234,224,213,0.6)',
    emptyBg: dark ? 'rgba(200,159,126,0.08)' : 'rgba(200,159,126,0.12)',
  };
}

interface Props { userId?: string | null }

export default function ChatPage({ userId }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [connected, setConnected] = useState(false);
  const [playingId, setPlayingId] = useState<number|null>(null);
  const [showAddQr, setShowAddQr] = useState(false);
  const [addQrImg, setAddQrImg] = useState('');
  const [addQrStatus, setAddQrStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const msgIdCounter = useRef(0);
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', notify_quiet_enabled: false, notify_quiet_start: '22:00', notify_quiet_end: '08:00', notify_sound: true, notify_desktop: true, notify_ai_indicator: true };
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const tc = getThemeColors(resolvedTheme);
  const baseFontSize = fontSizeMap[settings.general_font_size] || 14;
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}) }, [msgs]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Play notification sound using Web Audio API
  const playNotifySound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  // Check if current time is within quiet hours
  const isQuietHours = useCallback(() => {
    if (!(settings as any).notify_quiet_enabled) return false;
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    const start = (settings as any).notify_quiet_start || "22:00";
    const end = (settings as any).notify_quiet_end || "08:00";
    if (start <= end) return hhmm >= start && hhmm < end;
    return hhmm >= start || hhmm < end;
  }, [(settings as any).notify_quiet_enabled, (settings as any).notify_quiet_start, (settings as any).notify_quiet_end]);

  // Trigger notification for incoming message
  const notifyIncoming = useCallback((text: string, fromUser: string) => {
    if (isQuietHours()) return;
    if ((settings as any).notify_sound) playNotifySound();
    if ((settings as any).notify_desktop && "Notification" in window && Notification.permission === "granted") {
      const label = fromUser ? fromUser.slice(0, 8) + "..." : "新消息";
      new Notification(label, { body: text.slice(0, 80), icon: "/favicon.ico" });
    }
  }, [(settings as any).notify_sound, (settings as any).notify_desktop, isQuietHours, playNotifySound]);

  // ── 消息轮询（每个用户独立实例） ──
  useEffect(() => {
    let lastId = 0;
    let isMounted = true;
    const poll = setInterval(async () => {
      try {
        const [sRes, uRes, mRes] = await Promise.all([
          fetch(`${API}/api/status`), fetch(`${API}/api/users`), fetch(`${API}/api/messages?since=${lastId}&user=${userId||''}`),
        ]);
        if (!isMounted) return;
        const sData = await sRes.json(); setConnected(sData.connected);
        // userId 由 Dashboard 通过 prop 传入，不再内部管理
        const mData = await mRes.json();
        if (!isMounted) return;
        if (mData.messages?.length) {
          for (const m of mData.messages) if (m.id > lastId) lastId = m.id;
          setMsgs(prev => {
            const n = prev.filter(msg => !msg._error); // 只保留非错误消息
            mData.messages.forEach((m: any) => {
              if (!n.some(x => x.id === m.id)) {
                n.push({
                  id: m.id, text: m.text, isMine: m.dir === 'out',
                  time: fmt(m.time||Date.now()),
                  isImage: m.media?.type === 'image',
                  isVoice: m.media?.type === 'voice',
                  isFile: m.media?.type === 'file',
                  mediaCacheKey: m.media?.cache_key || '',
                  is_ai: m.is_ai || false,
                });
                // Notify for incoming messages (not our own)
                if (m.dir === 'in' && m.text) {
                  notifyIncoming(m.text, m.from || '');
                }
              }
            });
            return n;
          });
        }
      } catch {}
    }, 1500);
    return () => { isMounted = false; clearInterval(poll); };
  }, [userId]);

  const addMsg = useCallback((m: Msg) => setMsgs(p => [...p, m]), []);

  const playVoice = useCallback((msg: Msg) => {
    if (!msg.voiceUrl) return;
    if (playingId === msg.id && audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); setPlayingId(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(msg.voiceUrl); audioRef.current = a; a.onended = () => setPlayingId(null); a.play().then(() => setPlayingId(msg.id)).catch(() => {});
  }, [playingId]);
  useEffect(() => { return () => { audioRef.current?.pause(); }; }, []);

  const toBase64 = async (blob: Blob) => {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  // ── 发送消息 ──
  const handleSendText = useCallback(async (text: string) => {
    if (!userId) {
      addMsg({ id: Date.now(), text: '❌ 未选择联系人', isMine: true, time: fmt(Date.now()), _error: true });
      return;
    }
    const localId = ++msgIdCounter.current;
    addMsg({ id: localId, text, isMine: true, time: fmt(Date.now()) });
    try {
      const r = await fetch(`${API}/api/send-text`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, to_user_id: userId}) });
      const d = await r.json();
      if (d.success) {
      } else {
        setMsgs(p => p.map(m => m.id === localId ? { ...m, text: `❌ 发送失败${d.error ? ': ' + d.error : ''}`, _error: true } : m));
      }
    } catch {
      setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 发送失败：网络错误', _error: true } : m));
    }
  }, [userId, addMsg]);
  const handleSendVoice = async (blob?: Blob) => {
    if (!blob || !userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({ id:localId, text:`[语音] voice.mp3 (${(blob.size/1024).toFixed(1)}KB)`, isMine:true, time:fmt(Date.now()), isFile:true, fileName:'voice.mp3' });
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'voice', file_data:await toBase64(blob), filename:'voice.webm', to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 语音发送失败', _error: true } : m));
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 语音发送失败', _error: true } : m)); }
  };
  const handleSendImage = async (file: File) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({id:localId,text:'[图片发送中...]',isMine:true,time:fmt(Date.now())});
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'image', file_data:await toBase64(file), filename:file.name, to_user_id: userId}) });
      const d = await r.json();
      if (d.success) {
        const reader = new FileReader();
        reader.onload = () => setMsgs(p => p.map(m => m.id === localId ? { ...m, text:'[图片]', isImage:true, imageData:reader.result as string } : m));
        reader.readAsDataURL(file);
      } else {
        setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 图片发送失败', _error: true } : m));
      }
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 图片发送失败', _error: true } : m)); }
  };
  const handleSendFile = async (file: File) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({id:localId,text:`${file.name} (${(file.size/1024).toFixed(1)}KB)`,isMine:true,time:fmt(Date.now()),isFile:true,fileName:file.name});
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'file', file_data:await toBase64(file), filename:file.name, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 文件发送失败', _error: true } : m));
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 文件发送失败', _error: true } : m)); }
  };
  const handleSendLocation = async (lat: number, lng: number) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    const text = `位置: https://maps.google.com/?q=${lat},${lng}`;
    addMsg({id:localId,text,isMine:true,time:fmt(Date.now()),isLocation:true,lat,lng});
    try {
      const r = await fetch(`${API}/api/send-text`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 位置发送失败', _error: true } : m));
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 位置发送失败', _error: true } : m)); }
  };

  // 加好友二维码
  const handleAddFriend = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/add-friend-qrcode`); const d = await r.json();
      if (d.success) { setAddQrImg(`data:image/png;base64,${d.qrcode_image}`); setAddQrStatus('waiting'); setShowAddQr(true); }
      else { addMsg({ id:Date.now(), text: d.error === 'Not connected' ? '❌ 请先连接微信' : '❌ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
    } catch { addMsg({ id:Date.now(), text: '❌ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
  }, [addMsg]);

  // Poll add-friend status
  useEffect(() => {
    if (!showAddQr || addQrStatus === 'confirmed') return;
    const t = setInterval(async () => {
      try { const r = await fetch(`${API}/api/add-friend-status`); const d = await r.json(); if (d.status === 'confirmed') setAddQrStatus('confirmed'); } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [showAddQr, addQrStatus]);

  return (
    <div style={{display:'flex',flexDirection:'column' as const,height:'100%',minHeight:0}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${tc.border}`,background:tc.surface,padding:'12px 16px',backdropFilter:'blur(12px)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:baseFontSize,fontWeight:500,background:'linear-gradient(135deg,#C89F7E,#B08968)',boxShadow:'0 2px 8px rgba(192,159,126,0.3)'}}>{userId?userId.slice(0,2).toUpperCase():'B'}</div>
          <div><div style={{fontSize:baseFontSize+1,fontWeight:600,color:tc.text}}>{userId?userId.slice(0,8)+'...':'微信 Bot'}</div><div style={{fontSize:11,color:connected?'#10b981':tc.textSec}}>{!connected?'未连接':userId?'在线':'等待消息'}</div></div>
        </div>
        <div style={{display:'flex',gap:4}}>{[Phone,MoreVertical].map((Icon,i)=>(
          <button key={i} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,border:'none',background:'none',cursor:'pointer'}}><Icon size={17} strokeWidth={1.5} color={tc.textSec}/></button>
        ))}</div>
      </div>
      {/* Search bar */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${tc.border}`,background:tc.surface,flexShrink:0}}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索消息..." style={{width:'100%',padding:'6px 12px',borderRadius:8,border:'none',background:tc.bg,color:tc.text,fontSize:13,outline:'none'}} />
      </div>
      <div style={{flex:1,minHeight:0,overflowY:'auto' as const,padding:'16px',fontSize:baseFontSize}}>
        {msgs.length === 0 && <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center',padding:'0 32px'}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:tc.emptyBg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:28}}>💬</div>
          {!connected ? (
            <><p style={{fontSize:baseFontSize+1,fontWeight:500,color:tc.text}}>未连接到微信</p><p style={{marginTop:6,fontSize:baseFontSize-1,color:tc.textSec,lineHeight:1.6}}>请先退出到登录页<br/>扫码连接微信后再使用</p></>
          ) : userId ? (
            <p style={{fontSize:baseFontSize-1,color:tc.textSec}}>暂无消息</p>
          ) : (
            <><p style={{fontSize:baseFontSize+1,fontWeight:500,color:tc.text,marginBottom:8}}>已连接到微信</p>
            <p style={{fontSize:baseFontSize-1,color:tc.textSec,lineHeight:1.8}}>
              Bot 已连接，等待消息中...
              <br/><br/>
              <span style={{color:'#B08968',fontWeight:500}}>方式一：</span>用好友给你的微信号发一条消息
              <br/>消息会自动出现在这里
              <br/><br/>
              <span style={{color:'#B08968',fontWeight:500}}>方式二：</span>点击下方按钮生成二维码
              <br/>用微信扫描后即可建立会话
            </p>
            <button onClick={handleAddFriend}
              style={{marginTop:20,display:'flex',alignItems:'center',gap:8,padding:'12px 24px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#C89F7E,#B08968)',color:'white',fontSize:baseFontSize,fontWeight:500,cursor:'pointer',boxShadow:'0 4px 16px rgba(200,159,126,0.3)'}}>
              <UserPlus size={18} strokeWidth={1.5}/> 生成添加好友二维码
            </button>
          </>
          )}
        </div>}
        {msgs.filter(msg => !searchQuery || (msg.text || '').toLowerCase().includes(searchQuery.toLowerCase())).map((msg, i) => {
          const mine = msg.isMine;
          const isPlaying = playingId === msg.id;
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const showDate = i === 0 || prev.time.slice(0, 5) !== msg.time.slice(0, 5);
          const sameSenderNext = next && next.isMine === mine;
          const sameSenderPrev = prev && prev.isMine === mine;
          const isFirst = !sameSenderPrev;
          const isLast = !sameSenderNext;

          // 方案规格：AI 32/32/32/10，用户 32/32/10/32
          const br = mine
            ? (isFirst&&isLast?'32px':isFirst?'32px 32px 10px 32px':isLast?'10px 32px 32px 32px':'10px 32px 10px 32px')
            : (isFirst&&isLast?'32px':isFirst?'32px 32px 32px 10px':isLast?'32px 10px 32px 32px':'32px 10px 32px 10px');

          const showAvatar = !mine && isLast;
          const showName = !mine && isFirst;

          return (<div key={msg.id}>
            {/* 日期分隔线 */}
            {showDate && <div style={{display:'flex',alignItems:'center',gap:12,margin:'24px 0 32px',padding:'0 24px'}}>
              <div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.04)'}} />
              <span style={{fontSize:12,color:'#8D8D8D',whiteSpace:'nowrap',fontWeight:450,letterSpacing:'1px'}}>{msg.time}</span>
              <div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.04)'}} />
            </div>}

            <motion.div
              initial={{opacity:0, y:12, filter:'blur(10px)'}}
              animate={{opacity:1, y:0, filter:'blur(0px)'}}
              transition={{duration:0.45, ease:[0.22,0.61,0.36,1]}}
              style={{
                display:'flex',
                flexDirection: mine ? 'row-reverse' : 'row',
                alignItems:'flex-end',
                marginBottom: sameSenderNext ? (isLast ? 32 : 4) : 32,
                paddingLeft: 24,
                paddingRight: 24,
                gap: 12,
              }}
            >
              {/* 头像 — Pearl Gradient */}
              {showAvatar ? (
                <div style={{
                  width:42,height:42,borderRadius:'50%',flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'#B08968',fontSize:14,fontWeight:500,
                  background:'radial-gradient(#FFFFFF,#EDE9E4)',
                  boxShadow:'0 4px 12px rgba(0,0,0,0.04)',
                }}>
                  {userId ? userId.slice(0,1).toUpperCase() : 'B'}
                </div>
              ) : !mine && <div style={{width:42,flexShrink:0}} />}

              {/* 气泡 */}
              <div style={{display:'flex',flexDirection:'column',alignItems:mine?'flex-end':'flex-start',maxWidth:'700px'}}>
                {showName && !mine && <div style={{fontSize:12,color:'#8D8D8D',marginBottom:6,marginLeft:4,fontWeight:450,letterSpacing:'0.3px'}}>{userId ? userId.slice(0,8)+'...' : '好友'}</div>}

                <div style={{
                  borderRadius: br,
                  padding:'20px',
                  fontSize:16,fontWeight:450,lineHeight:1.85,letterSpacing:'0.2px',
                  wordBreak:'break-word',whiteSpace:'pre-wrap',
                  color:'#202124',
                  background: mine ? '#FAF5EF' : 'rgba(255,255,255,0.96)',
                  boxShadow: mine ? '0 12px 35px rgba(0,0,0,0.05)' : '0 15px 40px rgba(0,0,0,0.05)',
                  border: mine ? 'none' : '1px solid rgba(255,255,255,0.6)',
                  transition:'transform 0.3s cubic-bezier(.22,.61,.36,1)',
                }}
                  onMouseEnter={e=>{if(!mine)(e.currentTarget as HTMLElement).style.transform='translateY(-1px)'}}
                  onMouseLeave={e=>{if(!mine)(e.currentTarget as HTMLElement).style.transform='translateY(0)'}}
                >
                  {msg.isImage && (msg.imageData || msg.mediaCacheKey) && (
                    <img src={msg.imageData || `/api/media/${msg.mediaCacheKey}`} alt=""
                      style={{maxWidth:'100%',borderRadius:24,marginBottom:8,display:'block',boxShadow:'0 4px 12px rgba(0,0,0,0.04)'}} loading="lazy"/>
                  )}
                  {msg.isVoice ? (
                    <button onClick={()=>playVoice(msg)} disabled={!msg.voiceUrl}
                      style={{display:'flex',alignItems:'center',gap:10,border:'none',background:'none',cursor:msg.voiceUrl?'pointer':'default',padding:0,color:'#202124',width:'100%',fontSize:16,fontWeight:450}}>
                      {isPlaying ? <Pause size={16} strokeWidth={1.8}/> : <Play size={16} strokeWidth={1.8}/>}
                      <span style={{fontSize:14,color:'#8D8D8D'}}>{msg.voiceDuration||3}"</span>
                    </button>
                  ) : msg.isLocation ? (
                    <div style={{display:'flex',alignItems:'center',gap:8}}><MapPin size={16} strokeWidth={1.8}/><span>{msg.text}</span></div>
                  ) : msg.isFile ? (
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <File size={16} strokeWidth={1.8}/>
                      {msg.mediaCacheKey ? (
                        <a href={`/api/media/${msg.mediaCacheKey}`} download style={{color:'#202124',textDecoration:'underline',textUnderlineOffset:3}}>{msg.text}</a>
                      ) : <span>{msg.text}</span>}
                    </div>
                  ) : msg.text}
                </div>

                {mine && isLast && <div style={{marginTop:4,marginRight:2}}>
                  <span style={{fontSize:10,color:'#BFB8B0',letterSpacing:'0.5px'}}>✓ 已读</span>
                </div>}
              </div>
            </motion.div>
          </div>);
        })}
        <div ref={endRef}/>
      </div>
      {userId && <InputArea onSendText={handleSendText} onSendVoice={handleSendVoice} onSendImage={handleSendImage} onSendFile={handleSendFile} onSendLocation={handleSendLocation}/>}

      {/* Add friend QR overlay */}
      {showAddQr && <div style={{position:'fixed',inset:0,zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>setShowAddQr(false)}>
        <div style={{background:'white',borderRadius:24,padding:'32px 28px',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',maxWidth:320}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddQr(false)} style={{position:'absolute',top:12,right:12,border:'none',background:'none',cursor:'pointer',padding:4}}><X size={18} color='#8D6E63'/></button>
          <h3 style={{fontSize:16,fontWeight:600,color:'#3E2723',marginBottom:4}}>{addQrStatus==='confirmed'?'已添加':'添加好友'}</h3>
          <p style={{fontSize:12,color:'#8D6E63',marginBottom:20}}>{addQrStatus==='confirmed'?'好友已添加，可以开始聊天了':'用微信扫描此二维码添加好友'}</p>
          {addQrStatus==='confirmed' ? (
            <div style={{width:200,height:200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(16,185,129,0.1)',borderRadius:16}}>
              <span style={{fontSize:48}}>✅</span>
            </div>
          ) : (
            <img src={addQrImg} alt="添加好友" style={{width:200,height:200,margin:'0 auto',display:'block'}} />
          )}
          <button onClick={()=>setShowAddQr(false)} style={{marginTop:16,padding:'8px 24px',borderRadius:12,border:'none',background:'#F7F3EE',color:'#8D6E63',fontSize:13,cursor:'pointer'}}>关闭</button>
        </div>
      </div>}
    </div>
  );
}
