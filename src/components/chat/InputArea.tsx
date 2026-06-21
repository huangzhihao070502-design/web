import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Keyboard, Plus, Send, Image, FileText, Camera, MapPin } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { t } from '../../lib/i18n';

// InkOS palette
const ink = '#2D2A24';
const softInk = '#6B6560';
const mist = '#E0DDD5';
const warmWhite = '#F8F6F1';
const copper = '#C17F4B';
const paper = '#F8F6F1';

interface Props {
  onSendText: (text: string) => void;
  onSendVoice: (blob?: Blob) => void;
  onSendImage: (file: File) => void;
  onSendFile: (file: File) => void;
  onSendLocation: (lat: number, lng: number) => void;
  isDark?: boolean;
}

export default function InputArea({ onSendText, onSendVoice, onSendImage, onSendFile, onSendLocation }: Props) {
  const { lang } = useSettings();
  const [mode, setMode] = useState<'text'|'voice'>('text');
  const [text, setText] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const imgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => { if (!text.trim()) return; onSendText(text.trim()); setText(''); }, [text, onSendText]);
  const handleKey = useCallback((e: React.KeyboardEvent) => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); handleSend(); } }, [handleSend]);

  const startRecording = useCallback(async () => {
    timer.current = setTimeout(() => setRecording(true), 200);
    try {
      if (!navigator.mediaDevices?.getUserMedia) { console.warn('[VOICE] getUserMedia not available'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported('audio/webm')) { console.warn('[VOICE] MediaRecorder not available'); stream.getTracks().forEach(t => t.stop()); return; }
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = mr; chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks.current, { type: 'audio/webm' }); if (blob.size > 0) onSendVoice(blob); };
      mr.start();
    } catch (e) { console.warn('[VOICE] start failed:', (e as any)?.message || e); }
  }, [onSendVoice]);

  const stopRecording = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (recording && mediaRecorder.current?.state === 'recording') { mediaRecorder.current.stop(); }
    setRecording(false);
  }, [recording]);

  const handleImagePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; onSendImage(f); setShowMore(false); e.target.value = ''; }, [onSendImage]);
  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; onSendFile(f); setShowMore(false); e.target.value = ''; }, [onSendFile]);
  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; onSendImage(f); setShowMore(false); e.target.value = ''; }, [onSendImage]);
  const handleLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { onSendLocation(pos.coords.latitude, pos.coords.longitude); setShowMore(false); },
        () => alert(t('input.location_error', lang)),
      );
    } else alert(t('input.no_geolocation', lang));
  }, [onSendLocation, lang]);

  const moreItems = [
    { icon: Image, label: t('input.photo', lang), color: copper, action: () => imgInput.current?.click() },
    { icon: FileText, label: t('input.file', lang), color: softInk, action: () => fileInput.current?.click() },
    { icon: Camera, label: t('input.camera', lang), color: '#9A8B7A', action: () => cameraInput.current?.click() },
    { icon: MapPin, label: t('input.location', lang), color: copper, action: handleLocation },
  ];

  return (<>
    <input ref={imgInput} type="file" accept="image/*" onChange={handleImagePick} style={{display:'none'}}/>
    <input ref={fileInput} type="file" onChange={handleFilePick} style={{display:'none'}}/>
    <input ref={cameraInput} type="file" accept="image/*" capture="camera" onChange={handleCameraCapture} style={{display:'none'}}/>

    {/* Input bar — InkOS: h-14 rounded-[28px] border-mist bg-warm-white */}
    <div style={{padding:'8px 12px 12px',flexShrink:0,background:warmWhite}}>
      <div style={{display:'flex',alignItems:'center',gap:8,height:56,borderRadius:28,border:`1px solid ${mist}`,background:'white',padding:'0 4px 0 12px'}}>
        <button onClick={() => setShowMore(s => !s)}
          style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:'none',background:'transparent',cursor:'pointer',color:softInk,flexShrink:0}}>
          <Plus size={22} strokeWidth={2}/></button>

        {mode === 'text' ? (
          <div style={{flex:1,display:'flex',alignItems:'center',borderRadius:24,padding:'0 4px',height:40}}>
            <input className="input-placeholder" value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
              placeholder={t('input.placeholder', lang)}
              style={{flex:1,border:'none',background:'transparent',padding:0,fontSize:14,fontWeight:400,fontFamily:'"Noto Sans SC", system-ui, sans-serif',color:ink,outline:'none'}}/></div>
        ) : (
          <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
            style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:24,height:40,fontSize:14,fontWeight:400,fontFamily:'"Noto Sans SC", system-ui, sans-serif',color:softInk,border:'none',cursor:'pointer',userSelect:'none',background:'transparent'}}>
            {t('input.hold_talk', lang)}</button>)}

        {mode === 'text' ? (
          text.trim() ? (
            <motion.button onClick={handleSend} whileHover={{scale:1.05}} whileTap={{scale:0.95}}
              style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:'none',cursor:'pointer',flexShrink:0,background:ink,boxShadow:'0 2px 8px rgba(45,42,36,0.2)'}}>
              <Send size={18} strokeWidth={2} color={paper}/></motion.button>
          ) : (
            <button onClick={() => setMode('voice')}
              style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:`1px solid ${mist}`,background:'transparent',cursor:'pointer',color:softInk,flexShrink:0}}>
              <Mic size={20} strokeWidth={2}/></button>)
        ) : (
          <button onClick={() => setMode('text')}
            style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:'none',background:'transparent',cursor:'pointer',color:softInk,flexShrink:0}}>
            <Keyboard size={20} strokeWidth={2}/></button>)}
      </div>

      <AnimatePresence>{showMore && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden'}}>
        <div style={{display:'flex',gap:20,padding:'8px 4px 4px',justifyContent:'center'}}>
          {moreItems.map((item,i)=>(<button key={i} onClick={item.action} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,border:'none',background:'none',cursor:'pointer'}}>
            <div style={{width:48,height:48,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',color:'white',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',background:item.color}}>
              <item.icon size={20} strokeWidth={1.5}/></div>
            <span style={{fontSize:11,fontWeight:400,color:softInk}}>{item.label}</span></button>))}</div>
      </motion.div>}</AnimatePresence>
    </div>

    <AnimatePresence>{recording && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.2)',backdropFilter:'blur(4px)'}}
      onMouseUp={stopRecording} onTouchEnd={stopRecording}>
      <motion.div initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}}
        style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,borderRadius:32,background:'white',padding:'40px 48px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'flex-end',gap:4,height:48}}>
          {[4,8,14,20,26,20,14,8,4].map((h,i)=>(<motion.div key={i} animate={{height:[6,h,6]}} transition={{repeat:Infinity,duration:0.6,delay:i*0.08}}
            style={{width:6,borderRadius:3,background:`linear-gradient(180deg,${copper},${ink})`}}/>))}</div>
        <p style={{fontSize:16,fontWeight:400,color:ink}}>{t('input.recording', lang)}</p>
        <p style={{fontSize:13,color:softInk}}>{t('input.release_end', lang)}</p>
      </motion.div></motion.div>}</AnimatePresence>
  </>);
}
