import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MoreVertical, Play, Pause, File, MapPin, UserPlus, X, Check, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import InputArea from './InputArea';
import { useSettings } from '../../contexts/SettingsContext';
import { saveMessage } from '../../lib/chatHistory';

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
                if (m.dir === 'in' && m.text) {
                  notifyIncoming(m.text, m.from || '');
                  saveMessage(userId || '', 'ai', m.text);
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

  // Send handlers
  const handleSendText = useCallback(async (text: string) => {
    if (!userId) { addMsg({ id: Date.now(), text: '✕ 未选择联系人', isMine: true, time: fmt(Date.now()), _error: true }); return; }
    const localId = ++msgIdCounter.current;
    addMsg({ id: localId, text, isMine: true, time: fmt(Date.now()) });
    try {
      const r = await fetch(`${API}/api/send-text`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: `✕ 发送失败${d.error ? ': ' + d.error : ''}`, _error: true } : m));
      else saveMessage(userId || '', 'user', text);
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 发送失败：网络错误', _error: true } : m)); }
  }, [userId, addMsg]);

  const handleSendVoice = async (blob?: Blob) => {
    if (!blob || !userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({ id:localId, text:`[语音] voice.mp3 (${(blob.size/1024).toFixed(1)}KB)`, isMine:true, time:fmt(Date.now()), isFile:true, fileName:'voice.mp3' });
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'voice', file_data:await toBase64(blob), filename:'voice.webm', to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 语音发送失败', _error: true } : m));
      else saveMessage(userId || '', 'user', '[语音]');
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 语音发送失败', _error: true } : m)); }
  };

  const handleSendImage = async (file: File) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({id:localId,text:'[图片发送中...]',isMine:true,time:fmt(Date.now())});
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'image', file_data:await toBase64(file), filename:file.name, to_user_id: userId}) });
      const d = await r.json();
      if (d.success) {
        saveMessage(userId || '', 'user', '[图片] ' + file.name);
        const reader = new FileReader();
        reader.onload = () => setMsgs(p => p.map(m => m.id === localId ? { ...m, text:'[图片]', isImage:true, imageData:reader.result as string } : m));
        reader.readAsDataURL(file);
      } else { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 图片发送失败', _error: true } : m)); }
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 图片发送失败', _error: true } : m)); }
  };

  const handleSendFile = async (file: File) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    addMsg({id:localId,text:`${file.name} (${(file.size/1024).toFixed(1)}KB)`,isMine:true,time:fmt(Date.now()),isFile:true,fileName:file.name});
    try {
      const r = await fetch(`${API}/api/send-media`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({media_type:'file', file_data:await toBase64(file), filename:file.name, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 文件发送失败', _error: true } : m));
      else saveMessage(userId || '', 'user', '[文件] ' + file.name);
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 文件发送失败', _error: true } : m)); }
  };

  const handleSendLocation = async (lat: number, lng: number) => {
    if (!userId) return;
    const localId = ++msgIdCounter.current;
    const text = `位置: https://maps.google.com/?q=${lat},${lng}`;
    addMsg({id:localId,text,isMine:true,time:fmt(Date.now()),isLocation:true,lat,lng});
    try {
      const r = await fetch(`${API}/api/send-text`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, to_user_id: userId}) });
      const d = await r.json();
      if (!d.success) setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 位置发送失败', _error: true } : m));
      else saveMessage(userId || '', 'user', text);
    } catch { setMsgs(p => p.map(m => m.id === localId ? { ...m, text: '✕ 位置发送失败', _error: true } : m)); }
  };

  const handleAddFriend = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/add-friend-qrcode`); const d = await r.json();
      if (d.success) { setAddQrImg(`data:image/png;base64,${d.qrcode_image}`); setAddQrStatus('waiting'); setShowAddQr(true); }
      else { addMsg({ id:Date.now(), text: d.error === 'Not connected' ? '✕ 请先连接微信' : '✕ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
    } catch { addMsg({ id:Date.now(), text: '✕ 获取二维码失败', isMine: true, time: fmt(Date.now()), _error: true }); }
  }, [addMsg]);

  useEffect(() => {
    if (!showAddQr || addQrStatus === 'confirmed') return;
    const t = setInterval(async () => {
      try { const r = await fetch(`${API}/api/add-friend-status`); const d = await r.json(); if (d.status === 'confirmed') setAddQrStatus('confirmed'); } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [showAddQr, addQrStatus]);

  // Helper: avatar initial from userId
  const displayName = userId ? userId.slice(0, 8) + '...' : '微信 Bot';
  const avatarChar = userId ? userId[0].toUpperCase() : 'B';

  return (
    <div className="flex flex-col font-sans" style={{height:'100%', minHeight:0, backgroundColor:'var(--paper-white, #F5F2ED)', fontFamily:'"Noto Serif SC", "MiSans", system-ui, sans-serif'}}>
      {/* Header — warm-white bg, ink-white border */}
      <div className="flex items-center justify-between bg-warm-white flex-shrink-0" style={{height:56, padding:'0 12px', borderBottom:'1px solid var(--ink-white, #E8E8E8)'}}>
        <div className="flex items-center gap-2">
          {onBack && <button onClick={onBack} className="flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer" style={{width:36,height:36}}>
            <ArrowLeft size={20} strokeWidth={2} className="text-ink-black" />
          </button>}
          <div className="flex items-center gap-2.5">
            {/* Avatar: 36px circle, ink-white bg, character inside */}
            <div className="rounded-full flex items-center justify-center bg-ink-white text-ink-black font-semibold flex-shrink-0" style={{width:36,height:36,fontSize:15}}>
              {avatarChar}
            </div>
            <div>
              <div className="font-medium" style={{fontSize:16,color:'var(--ink-black, #1A1A1A)'}}>{displayName}</div>
              <div style={{fontSize:12,color:'var(--ink-light, #9E9E9E)'}}>{!connected?'未连接':userId?'在线':'等待消息'}</div>
            </div>
          </div>
        </div>
        <button className="flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer" style={{width:36,height:36}}>
          <MoreVertical size={20} strokeWidth={2} className="text-ink-black" />
        </button>
      </div>

      {/* Message list — paper-white bg */}
      <div ref={chatRef} className="chat-scroll" style={{flex:1,minHeight:0,overflowY:'auto',padding:'12px 16px',backgroundColor:'var(--paper-white, #F5F2ED)'}}>
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center" style={{height:'100%',textAlign:'center',padding:'0 32px'}}>
            <div className="flex items-center justify-center rounded-full" style={{width:56,height:56,backgroundColor:'var(--ink-white, #E8E8E8)',marginBottom:16}}>
              <MessageCircle size={28} strokeWidth={1.5} style={{color:'var(--ink-light, #9E9E9E)'}} />
            </div>
            {!connected ? (
              <><p style={{fontSize:16,fontWeight:500,color:'var(--ink-black, #1A1A1A)'}}>未连接到微信</p><p style={{marginTop:6,fontSize:12,color:'var(--ink-gray, #6B6B6B)',lineHeight:1.5}}>请先退出到登录页<br/>扫码连接微信后再使用</p></>
            ) : userId ? (
              <p style={{fontSize:14,color:'var(--ink-gray, #6B6B6B)'}}>暂无消息</p>
            ) : (
              <><p style={{fontSize:16,fontWeight:500,color:'var(--ink-black, #1A1A1A)',marginBottom:8}}>已连接到微信</p><p style={{fontSize:12,color:'var(--ink-gray, #6B6B6B)',lineHeight:1.8}}>
                Bot 已连接，等待消息中...<br/><br/>
                <span style={{fontWeight:500}} className="text-ochre">方式一：</span>用好友给你的微信号发一条消息<br/>消息会自动出现在这里<br/><br/>
                <span style={{fontWeight:500}} className="text-ochre">方式二：</span>点击下方按钮生成二维码<br/>用微信扫描后即可建立会话</p>
                <button onClick={handleAddFriend} className="flex items-center gap-2 rounded-xl border-none text-white cursor-pointer" style={{marginTop:20,padding:'12px 24px',backgroundColor:'var(--ochre, #C4A574)',fontSize:14,fontWeight:500,boxShadow:'0 4px 16px rgba(196, 165, 116, 0.3)'}}>
                  <UserPlus size={18} strokeWidth={1.5}/> 生成添加好友二维码</button></>
            )}
          </div>
        )}
        {msgs.map((msg, i) => {
          const mine = msg.isMine;
          const ai = msg.is_ai;
          const isPlaying = playingId === msg.id;
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const showDate = i === 0 || prev.time.slice(0, 5) !== msg.time.slice(0, 5);
          const sameSenderNext = next && next.isMine === mine;
          const sameSenderPrev = prev && prev.isMine === mine;
          const isFirst = !sameSenderPrev;
          const isLast = !sameSenderNext;

          // New design:
          // User (mine): ink-black bg, paper-white text, rounded-[16px_4px_16px_16px]
          // AI/other (!mine): warm-white bg, ink-black text, rounded-[4px_16px_16px_16px], shadow-paper-sm
          const bubbleBg = mine ? '#1A1A1A' : 'var(--warm-white, #FAF8F5)';
          const bubbleText = mine ? '#F5F2ED' : 'var(--ink-black, #1A1A1A)';
          const bubbleRadius = mine ? '16px 4px 16px 16px' : '4px 16px 16px 16px';
          const bubbleShadow = mine ? 'none' : '0 1px 4px rgba(0,0,0,0.04)';

          return (
            <div key={msg.id}>
              {/* Date divider — centered tiny text in ink-light */}
              {showDate && (
                <div className="flex items-center justify-center" style={{margin:'16px 0 12px'}}>
                  <span style={{fontSize:11,color:'var(--ink-light, #9E9E9E)'}}>{msg.time}</span>
                </div>
              )}
              <motion.div initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} transition={{duration:0.3, ease:'easeOut'}}
                className="flex items-end" style={{flexDirection:mine?'row-reverse':'row',marginBottom:sameSenderNext?4:8,gap:8}}>
                {/* Avatar for non-mine messages — shown on last message of group */}
                {!mine && isLast ? (
                  <div className="rounded-full flex items-center justify-center bg-ink-white text-ink-black font-semibold flex-shrink-0" style={{width:36,height:36,fontSize:14}}>
                    {avatarChar}
                  </div>
                ) : (!mine && <div className="flex-shrink-0" style={{width:36}}/>)}
                {/* Spacer for mine messages to balance layout */}
                {mine && <div className="flex-shrink-0" style={{width:36}}/>}
                <div className="flex flex-col" style={{alignItems:mine?'flex-end':'flex-start',maxWidth:'70%'}}>
                  <div className="leading-relaxed" style={{
                    borderRadius: bubbleRadius,
                    padding: '10px 14px',
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    color: bubbleText,
                    backgroundColor: bubbleBg,
                    boxShadow: bubbleShadow,
                  }}>
                    {msg.isImage && (msg.imageData || msg.mediaCacheKey) && <img src={msg.imageData || `/api/media/${msg.mediaCacheKey}`} alt="" style={{maxWidth:'100%',borderRadius:12,marginBottom:4,display:'block'}} loading="lazy"/>}
                    {msg.isVoice ? (
                      <button onClick={()=>playVoice(msg)} disabled={!msg.voiceUrl} className="flex items-center gap-2 border-none cursor-pointer" style={{background:'none',padding:0,color:bubbleText,width:'100%',fontSize:14}}>
                        {isPlaying?<Pause size={16} strokeWidth={1.8}/>:<Play size={16} strokeWidth={1.8}/>}<span style={{fontSize:12}}>{msg.voiceDuration||3}"</span></button>
                    ) : msg.isLocation ? (
                      <div className="flex items-center gap-1.5"><MapPin size={15} strokeWidth={1.8}/><span style={{fontSize:14}}>{msg.text}</span></div>
                    ) : msg.isFile ? (
                      <div className="flex items-center gap-1.5"><File size={15} strokeWidth={1.8}/>{msg.mediaCacheKey ? <a href={`/api/media/${msg.mediaCacheKey}`} download style={{color:bubbleText,textDecoration:'underline',textUnderlineOffset:3,fontSize:14}}>{msg.text}</a> : <span style={{fontSize:14}}>{msg.text}</span>}</div>
                    ) : (
                      <span style={{fontSize:14}}>{msg.text}</span>
                    )}
                  </div>
                  {isLast && (
                    <div style={{marginTop:4,marginRight:mine?4:0,marginLeft:mine?0:4}}>
                      <span style={{fontSize:12,color:'var(--ink-light, #9E9E9E)'}}>{msg.time}{mine && ' · ✓ 已读'}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>);
        })}
        {/* Typing indicator — three bouncing dots on warm-white bg */}
        {isTyping && (
          <div className="flex gap-2" style={{marginBottom:8}}><div className="flex-shrink-0" style={{width:36}}/>
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="flex items-center gap-1.5" style={{padding:'12px 16px',borderRadius:'4px 16px 16px 16px',backgroundColor:'var(--warm-white, #FAF8F5)',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              {[0,1,2].map(j=><motion.div key={j} animate={{y:[0,-4,0]}} transition={{repeat:Infinity,duration:1.2,delay:j*0.2,ease:'easeInOut'}} className="rounded-full" style={{width:7,height:7,backgroundColor:'var(--ink-black, #1A1A1A)'}}/>)}</motion.div></div>)}
        <div style={{height:1}}/>
      </div>

      {/* Divider between messages and input */}
      {userId && <div style={{height:1,backgroundColor:'var(--ink-white, #E8E8E8)'}} />}

      {userId && <InputArea onSendText={handleSendText} onSendVoice={handleSendVoice} onSendImage={handleSendImage} onSendFile={handleSendFile} onSendLocation={handleSendLocation} isDark={isDark}/>}

      {/* Add friend QR overlay */}
      {showAddQr && <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>setShowAddQr(false)}>
        <div className="relative text-center" style={{backgroundColor:'var(--warm-white, #FAF8F5)',borderRadius:24,padding:'32px 28px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',maxWidth:320}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddQr(false)} className="absolute border-none bg-transparent cursor-pointer" style={{top:12,right:12,padding:4}}><X size={18} style={{color:'var(--ink-light, #9E9E9E)'}}/></button>
          <h3 style={{fontSize:16,fontWeight:600,color:'var(--ink-black, #1A1A1A)',marginBottom:4}}>{addQrStatus==='confirmed'?'已添加':'添加好友'}</h3>
          <p style={{fontSize:12,color:'var(--ink-gray, #6B6B6B)',marginBottom:20}}>{addQrStatus==='confirmed'?'好友已添加，可以开始聊天了':'用微信扫描此二维码添加好友'}</p>
          {addQrStatus==='confirmed' ? (
            <div className="mx-auto flex items-center justify-center rounded-2xl" style={{width:200,height:200,backgroundColor:'var(--ink-white, #E8E8E8)'}}>
              <Check size={48} strokeWidth={1.5} style={{color:'var(--ink-black, #1A1A1A)'}} />
            </div>
          ) : (
            <img src={addQrImg} alt="添加好友" className="mx-auto block" style={{width:200,height:200}}/>
          )}
          <button onClick={()=>setShowAddQr(false)} className="rounded-xl border-none cursor-pointer" style={{marginTop:16,padding:'8px 24px',backgroundColor:'var(--ink-white, #E8E8E8)',color:'var(--ink-black, #1A1A1A)',fontSize:13}}>关闭</button>
        </div>
      </div>}
    </div>
  );
}
