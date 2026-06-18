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
    bg: dark ? '#1A1A1A' : '#F2F0EB',
    surface: dark ? '#2A2A2A' : '#FFFFFF',
    text: dark ? '#F0F0F0' : '#1A1A1A',
    textSec: dark ? '#888888' : '#888888',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    bubbleOther: dark ? '#2A2A2A' : '#FFFFFF',
    dateChip: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    emptyBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
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
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const msgIdCounter = useRef(0);
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', notify_quiet_enabled: false, notify_quiet_start: '22:00', notify_quiet_end: '08:00', notify_sound: true, notify_desktop: true, notify_ai_indicator: true };
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const tc = getThemeColors(resolvedTheme);
  const baseFontSize = fontSizeMap[settings.general_font_size] || 14;
  const isDark = resolvedTheme === 'dark';
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
    <div style={{display:'flex',flexDirection:'column' as const,height:'100%',minHeight:0,background:tc.bg,position:'relative'}}>
      {/* Noise overlay — 2% across entire chat */}
      <div style={{
        position:'fixed',inset:0,pointerEvents:'none',zIndex:0,
        opacity:0.02,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize:'256px 256px',
      }} />
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #E8E2DA; border-radius: 2px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #D7CEC5; }
        .chat-scroll { scrollbar-width: thin; scrollbar-color: #E8E2DA transparent; }
      `}</style>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${tc.border}`,background:tc.surface,padding:'12px 16px',height:64,boxSizing:'border-box' as const,backdropFilter:'blur(12px)',flexShrink:0,position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:baseFontSize,fontWeight:450,background:'linear-gradient(135deg,#C89F7E,#B08968)',boxShadow:'0 2px 8px rgba(192,159,126,0.3)'}}>{userId?userId.slice(0,2).toUpperCase():'B'}</div>
          <div><div style={{fontSize:baseFontSize+1,fontWeight:450,color:tc.text}}>{userId?userId.slice(0,8)+'...':'微信 Bot'}</div><div style={{fontSize:11,color:connected?'#10b981':tc.textSec}}>{!connected?'未连接':userId?'在线':'等待消息'}</div></div>
        </div>
        <div style={{display:'flex',gap:4}}>{[Phone,MoreVertical].map((Icon,i)=>(
          <button key={i} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,border:'none',background:'none',cursor:'pointer'}}><Icon size={17} strokeWidth={1.5} color={tc.textSec}/></button>
        ))}</div>
      </div>
      {/* Search bar */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${tc.border}`,background:tc.surface,flexShrink:0,position:'relative',zIndex:1}}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索消息..." style={{width:'100%',padding:'6px 12px',borderRadius:8,border:'none',background:tc.bg,color:tc.text,fontSize:13,outline:'none'}} />
      </div>
      <div className="chat-scroll" style={{flex:1,minHeight:0,overflowY:'auto' as const,padding:'16px',position:'relative',zIndex:1}}>
        {msgs.length === 0 && <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center',padding:'0 32px'}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:tc.emptyBg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:28}}>💬</div>
          {!connected ? (
            <><p style={{fontSize:baseFontSize+1,fontWeight:450,color:tc.text,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>未连接到微信</p><p style={{marginTop:6,fontSize:baseFontSize-1,color:tc.textSec,lineHeight:1.5,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>请先退出到登录页<br/>扫码连接微信后再使用</p></>
          ) : userId ? (
            <p style={{fontSize:baseFontSize-1,color:tc.textSec,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>暂无消息</p>
          ) : (
            <><p style={{fontSize:baseFontSize+1,fontWeight:450,color:tc.text,marginBottom:8,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>已连接到微信</p>
            <p style={{fontSize:baseFontSize-1,color:tc.textSec,lineHeight:1.8,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>
              Bot 已连接，等待消息中...
              <br/><br/>
              <span style={{color:'#B08968',fontWeight:450}}>方式一：</span>用好友给你的微信号发一条消息
              <br/>消息会自动出现在这里
              <br/><br/>
              <span style={{color:'#B08968',fontWeight:450}}>方式二：</span>点击下方按钮生成二维码
              <br/>用微信扫描后即可建立会话
            </p>
            <button onClick={handleAddFriend}
              style={{marginTop:20,display:'flex',alignItems:'center',gap:8,padding:'12px 24px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#C89F7E,#B08968)',color:'white',fontSize:baseFontSize,fontWeight:450,cursor:'pointer',boxShadow:'0 4px 16px rgba(200,159,126,0.3)'}}>
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

          // 18px base radius, 4px connecting corners for grouped messages
          const br = mine
            ? (isFirst&&isLast?'18px':isFirst?'18px 18px 4px 18px':isLast?'4px 18px 18px 18px':'4px 18px 4px 18px')
            : (isFirst&&isLast?'18px':isFirst?'18px 18px 18px 4px':isLast?'18px 4px 18px 18px':'18px 4px 18px 4px');

          const showAvatar = !mine && isLast;
          const showName = !mine && isFirst;

          // Exact spec colors
          const bubbleBg = mine
            ? (isDark ? '#3A3028' : '#F5EAE2')
            : (isDark ? '#2A2A2A' : '#FFFFFF');
          const textColor = isDark ? '#F0F0F0' : '#1A1A1A';
          const secColor = isDark ? '#888888' : '#888888';

          return (<div key={msg.id}>
            {/* Date separator */}
            {showDate && <div style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0 24px',padding:'0 16px'}}>
              <div style={{flex:1,height:'1px',background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'}} />
              <span style={{fontSize:11,color:secColor,whiteSpace:'nowrap',fontWeight:400,letterSpacing:'0.5px'}}>{msg.time}</span>
              <div style={{flex:1,height:'1px',background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'}} />
            </div>}

            <motion.div
              initial={{opacity:0, y:8}}
              animate={{opacity:1, y:0}}
              transition={{duration:0.3, ease:[0.16,1,0.3,1]}}
              style={{
                display:'flex',
                flexDirection: mine ? 'row-reverse' : 'row',
                alignItems:'flex-end',
                marginBottom: sameSenderNext ? 4 : 24,
                paddingLeft: 16,
                paddingRight: 16,
                gap: 10,
              }}
            >
              {/* Avatar — 32px circle, neutral warm gray */}
              {showAvatar ? (
                <div style={{
                  width:32,height:32,borderRadius:'50%',flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:isDark?'#C0B0A0':'#8D7B6B',fontSize:13,fontWeight:400,
                  background:'#e8e2dc',
                }}>
                  {userId ? userId.slice(0,1).toUpperCase() : 'B'}
                </div>
              ) : !mine && <div style={{width:32,flexShrink:0}} />}

              {/* Bubble */}
              <div style={{display:'flex',flexDirection:'column',alignItems:mine?'flex-end':'flex-start',maxWidth:'68%'}}>
                {showName && !mine && <div style={{fontSize:12,color:secColor,marginBottom:4,marginLeft:4,fontWeight:400,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>{userId ? userId.slice(0,8)+'...' : '好友'}</div>}

                <div style={{
                  borderRadius: br,
                  padding:'10px 14px',
                  fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  fontSize:15,fontWeight:400,lineHeight:1.5,letterSpacing:'0.2px',
                  wordBreak:'break-word',whiteSpace:'pre-wrap',
                  color: textColor,
                  background: bubbleBg,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}>
                  {msg.isImage && (msg.imageData || msg.mediaCacheKey) && (
                    <img src={msg.imageData || `/api/media/${msg.mediaCacheKey}`} alt=""
                      style={{maxWidth:'100%',borderRadius:12,marginBottom:4,display:'block'}} loading="lazy"/>
                  )}
                  {msg.isVoice ? (
                    <button onClick={()=>playVoice(msg)} disabled={!msg.voiceUrl}
                      style={{display:'flex',alignItems:'center',gap:8,border:'none',background:'none',cursor:msg.voiceUrl?'pointer':'default',padding:0,color:textColor,width:'100%',fontSize:15,fontWeight:400,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>
                      {isPlaying ? <Pause size={16} strokeWidth={1.8}/> : <Play size={16} strokeWidth={1.8}/>}
                      <span style={{fontSize:13,color:secColor}}>{msg.voiceDuration||3}"</span>
                    </button>
                  ) : msg.isLocation ? (
                    <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}><MapPin size={15} strokeWidth={1.8}/><span style={{fontSize:15}}>{msg.text}</span></div>
                  ) : msg.isFile ? (
                    <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>
                      <File size={15} strokeWidth={1.8}/>
                      {msg.mediaCacheKey ? (
                        <a href={`/api/media/${msg.mediaCacheKey}`} download style={{color:textColor,textDecoration:'underline',textUnderlineOffset:3,fontSize:15}}>{msg.text}</a>
                      ) : <span style={{fontSize:15}}>{msg.text}</span>}
                    </div>
                  ) : (
                    <span style={{fontSize:15}}>{msg.text}</span>
                  )}
                </div>

                {mine && isLast && <div style={{marginTop:4,marginRight:2}}>
                  <span style={{fontSize:10,color:secColor,letterSpacing:'0.5px',fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}}>✓ 已读</span>
                </div>}
              </div>
            </motion.div>
          </div>);
        })}

        {/* Typing indicator — 3 bouncing dots */}
        {isTyping && (
          <div style={{display:'flex',paddingLeft:16,gap:10,marginTop:0,marginBottom:4}}>
            <div style={{width:32,flexShrink:0}} />
            <motion.div
              initial={{opacity:0, y:8}}
              animate={{opacity:1, y:0}}
              transition={{duration:0.3, ease:[0.16,1,0.3,1]}}
              style={{
                display:'flex',alignItems:'center',gap:5,
                padding:'12px 16px',
                borderRadius:'18px 18px 18px 4px',
                background: isDark ? '#2A2A2A' : '#FFFFFF',
                boxShadow:'0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {[0,1,2].map(i => (
                <motion.div
                  key={i}
                  animate={{y:[0,-4,0]}}
                  transition={{repeat:Infinity,duration:1.2,delay:i*0.2,ease:'easeInOut'}}
                  style={{width:8,height:8,borderRadius:'50%',background:'#d7c7b8'}}
                />
              ))}
            </motion.div>
          </div>
        )}

        <div ref={endRef}/>
      </div>
      {userId && <InputArea onSendText={handleSendText} onSendVoice={handleSendVoice} onSendImage={handleSendImage} onSendFile={handleSendFile} onSendLocation={handleSendLocation} isDark={isDark}/>}

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
