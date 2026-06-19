import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MoreVertical, Play, Pause, File, MapPin, UserPlus, X } from 'lucide-react';
import InputArea from './InputArea';
import { useSettings } from '../../contexts/SettingsContext';

const API = '';

interface Msg { id: number; text: string; isMine: boolean; time: string; isVoice?: boolean; voiceDuration?: number; voiceUrl?: string; isImage?: boolean; imageData?: string; isFile?: boolean; fileName?: string; isLocation?: boolean; lat?: number; lng?: number; mediaCacheKey?: string; _error?: boolean; is_ai?: boolean }

function fmt(t: number) { return new Date(t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); }

interface Props { userId?: string | null; onBack?: () => void }

export default function ChatPage({ userId, onBack }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [connected, setConnected] = useState(false);
  const [playingId, setPlayingId] = useState<number|null>(null);
  const [showAddQr, setShowAddQr] = useState(false);
  const [addQrImg, setAddQrImg] = useState('');
  const [addQrStatus, setAddQrStatus] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const msgIdCounter = useRef(0);
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', notify_quiet_enabled: false, notify_quiet_start: '22:00', notify_quiet_end: '08:00', notify_sound: true, notify_desktop: true, notify_ai_indicator: true };
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}) }, [msgs]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const playNotifySound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
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

  const isQuietHours = useCallback(() => {
    if (!(settings as any).notify_quiet_enabled) return false;
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    const start = (settings as any).notify_quiet_start || "22:00";
    const end = (settings as any).notify_quiet_end || "08:00";
    if (start <= end) return hhmm >= start && hhmm < end;
    return hhmm >= start || hhmm < end;
  }, [(settings as any).notify_quiet_enabled, (settings as any).notify_quiet_start, (settings as any).notify_quiet_end]);

  const notifyIncoming = useCallback((text: string, fromUser: string) => {
    if (isQuietHours()) return;
    if ((settings as any).notify_sound) playNotifySound();
    if ((settings as any).notify_desktop && "Notification" in window && Notification.permission === "granted") {
      const label = fromUser ? fromUser.slice(0, 8) + "..." : "新消息";
      new Notification(label, { body: text.slice(0, 80), icon: "/favicon.ico" });
    }
  }, [(settings as any).notify_sound, (settings as any).notify_desktop, isQuietHours, playNotifySound]);

  // Message polling
  useEffect(() => {
    let lastId = 0;
    let isMounted = true;
    const poll = setInterval(async () => {
      try {
        const [sRes, mRes] = await Promise.all([
          fetch(`${API}/api/status`), fetch(`${API}/api/messages?since=${lastId}&user=${userId||''}`),
        ]);
        if (!isMounted) return;
        const sData = await sRes.json(); setConnected(sData.connected);
        const mData = await mRes.json();
        if (!isMounted) return;
        if (mData.messages?.length) {
          for (const m of mData.messages) if (m.id > lastId) lastId = m.id;
          setMsgs(prev => {
            const n = prev.filter(msg => !msg._error);
            mData.messages.forEach((m: any) => {
              if (!n.some(x => x.id === m.id)) {
                n.push({
                  id: m.id, text: m.text, isMine: m.dir === 'out',
                  time: fmt(m.time||Date.now()),
                  isImage: m.media?.type === 'image', isVoice: m.media?.type === 'voice',
                  isFile: m.media?.type === 'file', mediaCacheKey: m.media?.cache_key || '',
                  is_ai: m.is_ai || false,
                });
                if (m.dir === 'in' && m.text) notifyIncoming(m.text, m.from || '');
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

  // Send handlers
  const handleSendText = useCallback(async (text: string) => {
    if (!userId) { addMsg({ id: Date.now(), text: '❌ 未选择联系人', isMine: true, time: fmt(Date.now()), _error: true }); return; }
    const localId = ++msgIdCounter.current;
    addMsg({ id: localId, text, isMine: true, time: fmt(Date.now()) });
    try {
      const r = await fetch(`${API}/api/send-text`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: `❌ 发送失败${d.error ? ': ' + d.error : ''}`, _error: true } : m));
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 发送失败：网络错误', _error: true } : m)); }
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
      } else { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '❌ 图片发送失败', _error: true } : m)); }
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

  const handleAddFriend = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/add-friend-qrcode`); const d = await r.json();
      if (d.success) { setAddQrImg(`data:image/png;base64,${d.qrcode_image}`); setAddQrStatus('waiting'); setShowAddQr(true); }
      else { addMsg({ id:Date.now(), text: d.error === 'Not connected' ? '❌ 请先连接微信' : '❌ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
    } catch { addMsg({ id:Date.now(), text: '❌ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
  }, [addMsg]);

  useEffect(() => {
    if (!showAddQr || addQrStatus === 'confirmed') return;
    const t = setInterval(async () => {
      try { const r = await fetch(`${API}/api/add-friend-status`); const d = await r.json(); if (d.status === 'confirmed') setAddQrStatus('confirmed'); } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [showAddQr, addQrStatus]);

  // Spec colors
  const HEADER_BG = '#94C1D6';
  const CHAT_BG = '#F6F6F6';
  const BUBBLE_MINE = '#747CBB';
  const BUBBLE_OTHER = '#BBA2CA';
  const TEXT_COLOR = '#343030';
  const TIME_COLOR = '#B1BQB8';

  return (
    <div style={{display:'flex',flexDirection:'column' as const,height:'100%',minHeight:0,background:CHAT_BG,fontFamily:'"Noto Sans SC", system-ui, sans-serif'}}>
      {/* Header — 56px, bg #94C1D6 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:56,flexShrink:0,padding:'0 12px',background:HEADER_BG}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {onBack && <button onClick={onBack} style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:'none',background:'transparent',cursor:'pointer'}}>
            <ArrowLeft size={20} strokeWidth={2} color="white"/>
          </button>}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:14,fontWeight:500,background:'rgba(255,255,255,0.25)'}}>
              {userId ? userId.slice(0,2).toUpperCase() : 'B'}
            </div>
            <div>
              <div style={{fontSize:18,fontWeight:500,color:'white'}}>{userId ? userId.slice(0,8)+'...' : '微信 Bot'}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.75)'}}>{!connected?'未连接':userId?'在线':'等待消息'}</div>
            </div>
          </div>
        </div>
        <button style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:'none',background:'transparent',cursor:'pointer'}}>
          <MoreVertical size={20} strokeWidth={2} color="white"/>
        </button>
      </div>

      {/* Message list — bg #F6F6F6 */}
      <div className="chat-scroll" style={{flex:1,minHeight:0,overflowY:'auto' as const,padding:'12px 16px'}}>
        {msgs.length === 0 && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center',padding:'0 32px'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(148,193,214,0.15)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:28}}>💬</div>
            {!connected ? (
              <><p style={{fontSize:16,fontWeight:500,color:TEXT_COLOR}}>未连接到微信</p><p style={{marginTop:6,fontSize:12,color:TIME_COLOR,lineHeight:1.5}}>请先退出到登录页<br/>扫码连接微信后再使用</p></>
            ) : userId ? (
              <p style={{fontSize:14,color:TIME_COLOR}}>暂无消息</p>
            ) : (
              <><p style={{fontSize:16,fontWeight:500,color:TEXT_COLOR,marginBottom:8}}>已连接到微信</p><p style={{fontSize:12,color:TIME_COLOR,lineHeight:1.8}}>
                Bot 已连接，等待消息中...<br/><br/>
                <span style={{color:'#747CBB',fontWeight:500}}>方式一：</span>用好友给你的微信号发一条消息<br/>消息会自动出现在这里<br/><br/>
                <span style={{color:'#747CBB',fontWeight:500}}>方式二：</span>点击下方按钮生成二维码<br/>用微信扫描后即可建立会话</p>
                <button onClick={handleAddFriend} style={{marginTop:20,display:'flex',alignItems:'center',gap:8,padding:'12px 24px',borderRadius:12,border:'none',background:'#747CBB',color:'white',fontSize:14,fontWeight:500,cursor:'pointer',boxShadow:'0 4px 16px rgba(116,124,187,0.3)'}}>
                  <UserPlus size={18} strokeWidth={1.5}/> 生成添加好友二维码</button></>
            )}
          </div>
        )}
        {msgs.map((msg, i) => {
          const mine = msg.isMine;
          const isPlaying = playingId === msg.id;
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const showDate = i === 0 || prev.time.slice(0, 5) !== msg.time.slice(0, 5);
          const sameSenderNext = next && next.isMine === mine;
          const sameSenderPrev = prev && prev.isMine === mine;
          const isFirst = !sameSenderPrev;
          const isLast = !sameSenderNext;
          const bubbleBg = mine ? BUBBLE_MINE : BUBBLE_OTHER;
          const bubbleTextColor = mine ? '#FFFFFF' : TEXT_COLOR;
          const bubbleTimeColor = mine ? 'rgba(255,255,255,0.7)' : TIME_COLOR;
          const br = isFirst && isLast ? '20px' : isFirst ? (mine ? '20px 20px 4px 20px' : '20px 20px 20px 4px') : isLast ? (mine ? '4px 20px 20px 20px' : '20px 4px 20px 20px') : (mine ? '4px 20px 4px 20px' : '20px 4px 20px 4px');

          return (
            <div key={msg.id}>
              {showDate && <div style={{display:'flex',alignItems:'center',gap:12,margin:'16px 0 12px'}}><div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.06)'}}/><span style={{fontSize:12,color:TIME_COLOR,whiteSpace:'nowrap'}}>{msg.time}</span><div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.06)'}}/></div>}
              <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.25, ease:'easeOut'}}
                style={{display:'flex',flexDirection:mine?'row-reverse':'row',alignItems:'flex-end',marginBottom:sameSenderNext?4:8,gap:8}}>
                {!mine && isLast ? (
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:BUBBLE_OTHER,fontSize:11,fontWeight:500,background:'rgba(187,162,202,0.2)'}}>
                    {userId ? userId.slice(0,1).toUpperCase() : 'B'}</div>) : (!mine && <div style={{width:28,flexShrink:0}}/>)}
                <div style={{display:'flex',flexDirection:'column',alignItems:mine?'flex-end':'flex-start',maxWidth:'68%'}}>
                  <div style={{borderRadius:br,padding:'10px 14px',fontSize:14,fontWeight:400,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap',color:bubbleTextColor,background:bubbleBg,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                    {msg.isImage && (msg.imageData || msg.mediaCacheKey) && <img src={msg.imageData || `/api/media/${msg.mediaCacheKey}`} alt="" style={{maxWidth:'100%',borderRadius:12,marginBottom:4,display:'block'}} loading="lazy"/>}
                    {msg.isVoice ? (
                      <button onClick={()=>playVoice(msg)} disabled={!msg.voiceUrl} style={{display:'flex',alignItems:'center',gap:8,border:'none',background:'none',cursor:msg.voiceUrl?'pointer':'default',padding:0,color:bubbleTextColor,width:'100%',fontSize:14}}>
                        {isPlaying?<Pause size={16} strokeWidth={1.8}/>:<Play size={16} strokeWidth={1.8}/>}<span style={{fontSize:12,color:bubbleTimeColor}}>{msg.voiceDuration||3}"</span></button>
                    ) : msg.isLocation ? (
                      <div style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={15} strokeWidth={1.8}/><span style={{fontSize:14}}>{msg.text}</span></div>
                    ) : msg.isFile ? (
                      <div style={{display:'flex',alignItems:'center',gap:6}}><File size={15} strokeWidth={1.8}/>{msg.mediaCacheKey ? <a href={`/api/media/${msg.mediaCacheKey}`} download style={{color:bubbleTextColor,textDecoration:'underline',textUnderlineOffset:3,fontSize:14}}>{msg.text}</a> : <span style={{fontSize:14}}>{msg.text}</span>}</div>
                    ) : (<span style={{fontSize:14}}>{msg.text}</span>)}
                  </div>
                  {isLast && <div style={{marginTop:4,marginRight:mine?4:0,marginLeft:mine?0:4}}><span style={{fontSize:12,color:TIME_COLOR}}>{msg.time}{mine && ' · ✓ 已读'}</span></div>}
                </div>
              </motion.div>
            </div>);
        })}
        {isTyping && (
          <div style={{display:'flex',gap:8,marginBottom:8}}><div style={{width:28,flexShrink:0}}/>
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{display:'flex',alignItems:'center',gap:5,padding:'12px 16px',borderRadius:'20px 20px 20px 4px',background:BUBBLE_OTHER,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              {[0,1,2].map(j=><motion.div key={j} animate={{y:[0,-4,0]}} transition={{repeat:Infinity,duration:1.2,delay:j*0.2,ease:'easeInOut'}} style={{width:7,height:7,borderRadius:'50%',background:'rgba(255,255,255,0.6)'}}/>)}</motion.div></div>)}
        <div ref={endRef}/>
      </div>

      {userId && <InputArea onSendText={handleSendText} onSendVoice={handleSendVoice} onSendImage={handleSendImage} onSendFile={handleSendFile} onSendLocation={handleSendLocation} isDark={isDark}/>}

      {/* Add friend QR overlay */}
      {showAddQr && <div style={{position:'fixed',inset:0,zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>setShowAddQr(false)}>
        <div style={{background:'white',borderRadius:24,padding:'32px 28px',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',maxWidth:320}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddQr(false)} style={{position:'absolute',top:12,right:12,border:'none',background:'none',cursor:'pointer',padding:4}}><X size={18} color='#747CBB'/></button>
          <h3 style={{fontSize:16,fontWeight:600,color:'#343030',marginBottom:4}}>{addQrStatus==='confirmed'?'已添加':'添加好友'}</h3>
          <p style={{fontSize:12,color:'#B1BQB8',marginBottom:20}}>{addQrStatus==='confirmed'?'好友已添加，可以开始聊天了':'用微信扫描此二维码添加好友'}</p>
          {addQrStatus==='confirmed' ? <div style={{width:200,height:200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(116,124,187,0.1)',borderRadius:16}}><span style={{fontSize:48}}>✅</span></div>
          : <img src={addQrImg} alt="添加好友" style={{width:200,height:200,margin:'0 auto',display:'block'}}/>}
          <button onClick={()=>setShowAddQr(false)} style={{marginTop:16,padding:'8px 24px',borderRadius:12,border:'none',background:'#F6F6F6',color:'#343030',fontSize:13,cursor:'pointer'}}>关闭</button>
        </div>
      </div>}
    </div>
  );
}
