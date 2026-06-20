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
  const chatRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const msgIdCounter = useRef(0);
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', notify_quiet_enabled: false, notify_quiet_start: '22:00', notify_quiet_end: '08:00', notify_sound: true, notify_desktop: true, notify_ai_indicator: true };
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

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

  return (
    <div className="flex flex-col bg-warm-white font-sans" style={{height:'100%', minHeight:0, fontFamily:'"Noto Sans SC", system-ui, sans-serif'}}>
      {/* Header — InkOS paper bg, subtle mist border */}
      <div className="flex items-center justify-between bg-paper flex-shrink-0" style={{height:56, padding:'0 12px', borderBottom:'1px solid var(--color-mist)'}}>
        <div className="flex items-center gap-2">
          {onBack && <button onClick={onBack} className="flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer" style={{width:36,height:36}}>
            <ArrowLeft size={20} strokeWidth={2} style={{color:'var(--color-ink)'}}/>
          </button>}
          <div className="flex items-center gap-2.5">
            <div className="rounded-full overflow-hidden" style={{width:36,height:36,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
              <img src="/avatar.jpg" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            <div>
              <div style={{fontSize:18,fontWeight:500,color:'var(--color-ink)'}}>{userId ? userId.slice(0,8)+'...' : '微信 Bot'}</div>
              <div style={{fontSize:12,color:'var(--color-soft-ink)'}}>{!connected?'未连接':userId?'在线':'等待消息'}</div>
            </div>
          </div>
        </div>
        <button className="flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer" style={{width:36,height:36}}>
          <MoreVertical size={20} strokeWidth={2} style={{color:'var(--color-ink)'}}/>
        </button>
      </div>

      {/* Message list — warm-white bg */}
      <div ref={chatRef} className="chat-scroll" style={{flex:1,minHeight:0,overflowY:'auto',padding:'12px 16px',backgroundColor:'var(--color-warm-white)'}}>
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center" style={{height:'100%',textAlign:'center',padding:'0 32px'}}>
            <div className="flex items-center justify-center rounded-full" style={{width:56,height:56,background:'rgba(168,135,86,0.12)',marginBottom:16,fontSize:28}}>💬</div>
            {!connected ? (
              <><p style={{fontSize:16,fontWeight:500,color:'var(--color-deep-ink)'}}>未连接到微信</p><p style={{marginTop:6,fontSize:12,color:'var(--color-soft-ink)',lineHeight:1.5}}>请先退出到登录页<br/>扫码连接微信后再使用</p></>
            ) : userId ? (
              <p style={{fontSize:14,color:'var(--color-soft-ink)'}}>暂无消息</p>
            ) : (
              <><p style={{fontSize:16,fontWeight:500,color:'var(--color-deep-ink)',marginBottom:8}}>已连接到微信</p><p style={{fontSize:12,color:'var(--color-soft-ink)',lineHeight:1.8}}>
                Bot 已连接，等待消息中...<br/><br/>
                <span style={{color:'var(--color-copper)',fontWeight:500}}>方式一：</span>用好友给你的微信号发一条消息<br/>消息会自动出现在这里<br/><br/>
                <span style={{color:'var(--color-copper)',fontWeight:500}}>方式二：</span>点击下方按钮生成二维码<br/>用微信扫描后即可建立会话</p>
                <button onClick={handleAddFriend} className="flex items-center gap-2 rounded-xl border-none text-white cursor-pointer" style={{marginTop:20,padding:'12px 24px',background:'var(--color-copper)',fontSize:14,fontWeight:500,boxShadow:'0 4px 16px rgba(168,135,86,0.3)'}}>
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
          // InkOS: user messages get mist bg, AI/other messages get paper bg
          const bubbleBg = mine ? 'var(--color-mist)' : 'var(--color-paper)';
          const bubbleTextColor = 'var(--color-ink)';
          const bubbleTimeColor = 'var(--color-soft-ink)';
          const bubbleShadow = mine ? 'none' : 'var(--shadow-paper-sm, 0 1px 3px rgba(0,0,0,0.04))';
          // Rounded-2xl (28px) with contextual pointed corners for message groups
          const br = isFirst && isLast ? '28px' : isFirst ? (mine ? '28px 28px 4px 28px' : '28px 28px 28px 4px') : isLast ? (mine ? '4px 28px 28px 28px' : '28px 4px 28px 28px') : (mine ? '4px 28px 4px 28px' : '28px 4px 28px 4px');

          return (
            <div key={msg.id}>
              {/* Date divider — centered, soft-ink at 50% opacity */}
              {showDate && (
                <div className="flex items-center justify-center" style={{margin:'16px 0 12px'}}>
                  <span style={{fontSize:11,color:'var(--color-soft-ink)',opacity:0.5,whiteSpace:'nowrap'}}>{msg.time}</span>
                </div>
              )}
              <motion.div initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} transition={{duration:0.3, ease:'easeOut'}}
                className="flex items-end" style={{flexDirection:mine?'row-reverse':'row',marginBottom:sameSenderNext?4:8,gap:8}}>
                {!mine && isLast ? (
                  <div className="rounded-full flex-shrink-0 overflow-hidden" style={{width:32,height:32,boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}}>
                    <img src="/avatar.jpg" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>) : (!mine && <div className="flex-shrink-0" style={{width:32}}/>)}
                <div className="flex flex-col" style={{alignItems:mine?'flex-end':'flex-start',maxWidth:'75%'}}>
                  <div className="rounded-2xl" style={{borderRadius:br,padding:'10px 14px',fontSize:14,fontWeight:400,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap',color:bubbleTextColor,background:bubbleBg,boxShadow:bubbleShadow}}>
                    {msg.isImage && (msg.imageData || msg.mediaCacheKey) && <img src={msg.imageData || `/api/media/${msg.mediaCacheKey}`} alt="" style={{maxWidth:'100%',borderRadius:12,marginBottom:4,display:'block'}} loading="lazy"/>}
                    {msg.isVoice ? (
                      <button onClick={()=>playVoice(msg)} disabled={!msg.voiceUrl} className="flex items-center gap-2 border-none cursor-pointer" style={{background:'none',padding:0,color:bubbleTextColor,width:'100%',fontSize:14}}>
                        {isPlaying?<Pause size={16} strokeWidth={1.8}/>:<Play size={16} strokeWidth={1.8}/>}<span style={{fontSize:12,color:bubbleTimeColor}}>{msg.voiceDuration||3}"</span></button>
                    ) : msg.isLocation ? (
                      <div className="flex items-center gap-1.5"><MapPin size={15} strokeWidth={1.8}/><span style={{fontSize:14}}>{msg.text}</span></div>
                    ) : msg.isFile ? (
                      <div className="flex items-center gap-1.5"><File size={15} strokeWidth={1.8}/>{msg.mediaCacheKey ? <a href={`/api/media/${msg.mediaCacheKey}`} download style={{color:bubbleTextColor,textDecoration:'underline',textUnderlineOffset:3,fontSize:14}}>{msg.text}</a> : <span style={{fontSize:14}}>{msg.text}</span>}</div>
                    ) : (<span style={{fontSize:14}}>{msg.text}</span>)}
                  </div>
                  {isLast && <div style={{marginTop:4,marginRight:mine?4:0,marginLeft:mine?0:4}}><span style={{fontSize:12,color:'var(--color-soft-ink)'}}>{msg.time}{mine && ' · ✓ 已读'}</span></div>}
                </div>
              </motion.div>
            </div>);
        })}
        {/* Typing indicator — three bouncing ink-colored dots on paper bg */}
        {isTyping && (
          <div className="flex gap-2" style={{marginBottom:8}}><div className="flex-shrink-0" style={{width:28}}/>
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="flex items-center gap-1.5" style={{padding:'12px 16px',borderRadius:'28px 28px 28px 4px',background:'var(--color-paper)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
              {[0,1,2].map(j=><motion.div key={j} animate={{y:[0,-4,0]}} transition={{repeat:Infinity,duration:1.2,delay:j*0.2,ease:'easeInOut'}} className="rounded-full" style={{width:7,height:7,background:'var(--color-ink)'}}/>)}</motion.div></div>)}
        <div style={{height:1}}/>
      </div>

      {userId && <InputArea onSendText={handleSendText} onSendVoice={handleSendVoice} onSendImage={handleSendImage} onSendFile={handleSendFile} onSendLocation={handleSendLocation} isDark={isDark}/>}

      {/* Add friend QR overlay — InkOS styled */}
      {showAddQr && <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>setShowAddQr(false)}>
        <div className="relative text-center" style={{background:'var(--color-warm-white)',borderRadius:24,padding:'32px 28px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',maxWidth:320}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddQr(false)} className="absolute border-none bg-transparent cursor-pointer" style={{top:12,right:12,padding:4}}><X size={18} style={{color:'var(--color-soft-ink)'}}/></button>
          <h3 style={{fontSize:16,fontWeight:600,color:'var(--color-ink)',marginBottom:4}}>{addQrStatus==='confirmed'?'已添加':'添加好友'}</h3>
          <p style={{fontSize:12,color:'var(--color-soft-ink)',marginBottom:20}}>{addQrStatus==='confirmed'?'好友已添加，可以开始聊天了':'用微信扫描此二维码添加好友'}</p>
          {addQrStatus==='confirmed' ? <div className="mx-auto flex items-center justify-center rounded-2xl" style={{width:200,height:200,background:'rgba(168,135,86,0.1)'}}><span style={{fontSize:48}}>✅</span></div>
          : <img src={addQrImg} alt="添加好友" className="mx-auto block" style={{width:200,height:200}}/>}
          <button onClick={()=>setShowAddQr(false)} className="rounded-xl border-none cursor-pointer" style={{marginTop:16,padding:'8px 24px',background:'var(--color-mist)',color:'var(--color-ink)',fontSize:13}}>关闭</button>
        </div>
      </div>}
    </div>
  );
}
