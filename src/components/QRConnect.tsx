import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CheckCircle, Loader, RefreshCw, Bot, ScanLine, ArrowRight, ShieldCheck, Wifi, Sparkles } from 'lucide-react';
import MeshBackground from './MeshBackground';
import { t, Lang } from '../lib/i18n';

function useLocalLang(): Lang {
  try { const s = JSON.parse(localStorage.getItem('webchat_settings') || '{}'); return s.general_language === 'en' ? 'en' : 'zh-CN'; } catch { return 'zh-CN'; }
}

const API = '';

interface Props { onConnected: () => void; onLogout: () => void }

/* ---- shared spring variants ---- */
const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 80, damping: 16, mass: 0.8 } } };
const scaleIn = { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 14 } } };

export default function QRConnect({ onConnected, onLogout }: Props) {
  const lang = useLocalLang();
  const [qrUrl, setQrUrl] = useState('');
  const [qrKey, setQrKey] = useState('');
  const [qrImgUrl, setQrImgUrl] = useState('');
  const [status, setStatus] = useState<'loading'|'already'|'waiting'|'scaned'|'connected'|'error'>('loading');
  const [botId, setBotId] = useState('');

  const checkConnection = useCallback(async () => {
    try { const r = await fetch(`${API}/api/status`); const d = await r.json(); if (d.connected) { setBotId(d.bot_id||''); setStatus('already'); return true } } catch {}
    return false;
  }, []);

  const fetchQr = useCallback(async () => {
    setStatus('loading');
    try { const r = await fetch(`${API}/api/qrcode`); const d = await r.json(); if (d.success) { setQrUrl(d.qrcode_img_url); setQrKey(d.qrcode_key); setQrImgUrl(`/api/qrcode-image?t=${Date.now()}`); setStatus('waiting') } else setStatus('error') }
    catch { setStatus('error') }
  }, []);

  useEffect(() => { checkConnection().then(a => { if (!a) fetchQr() }) }, [checkConnection, fetchQr]);

  useEffect(() => {
    if (!qrKey || status === 'connected' || status === 'already' || status === 'error') return;
    const t = setInterval(async () => {
      try { const r = await fetch(`${API}/api/qrcode-status?key=${qrKey}`); const d = await r.json();
        if (d.status === 'scaned') setStatus('scaned');
        else if (d.connected) { setBotId(d.bot_id||''); setStatus('connected'); setTimeout(()=>onConnected(), 1200) }
        else if (d.status === 'expired') setStatus('error');
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [qrKey, status, onConnected]);

  const shortId = (s: string) => s.length > 12 ? s.slice(0,8)+'...'+s.slice(-6) : s;

  /* ---- shared icon box style ---- */
  const iconBox = (colors: string, shadow: string) => ({
    background: colors,
    boxShadow: shadow,
  });

  return (
    <div className="relative min-h-screen overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #FFF8F6 0%, #F6F4F7 40%, #F4F3F8 100%)' }}>

      {/* Floating ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, #E8D5F5 0%, transparent 70%)', filter: 'blur(120px)' }} />
        <motion.div animate={{ x: [0, -25, 35, 0], y: [0, 30, -25, 0], scale: [1, 0.9, 1.05, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-35"
          style={{ background: 'radial-gradient(circle, #D5E8F0 0%, transparent 70%)', filter: 'blur(120px)' }} />
        <motion.div animate={{ x: [0, 20, -30, 0], y: [0, -20, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-1/4 h-[350px] w-[350px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #F0E0D5 0%, transparent 70%)', filter: 'blur(120px)' }} />
        <motion.div animate={{ x: [0, -15, 25, 0], y: [0, 25, -15, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 left-1/5 h-[280px] w-[280px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #D5F0E8 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0" aria-hidden="true" />

      {/* ---- Logout ---- */}
      <motion.button onClick={onLogout} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
        className="fixed right-7 top-7 z-50 flex items-center gap-2 rounded-2xl border border-white/40 bg-white/30 px-5 py-2.5 text-[13px] font-medium text-[#6B7280] shadow-sm backdrop-blur-xl transition-all hover:bg-white/60 hover:text-[#111827] hover:shadow-md active:scale-[0.97]">
        {t('qr.logout', lang)}
      </motion.button>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">

        {/* ====== ALREADY CONNECTED ====== */}
        <AnimatePresence mode="wait">
        {status === 'already' && (
          <motion.div key="already" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[420px] flex-col items-center text-center">

            {/* ---- AI Logo ---- */}
            <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }}
              className="relative mb-10">
              {/* Outer glow ring */}
              <motion.div animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-[40px]"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.1))', filter: 'blur(20px)' }} />
              {/* Glass logo container */}
              <div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-[36px] border border-white/50"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 100%)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(30px)',
                }}>
                {/* Inner glow */}
                <div className="absolute inset-0 rounded-[36px] opacity-60"
                  style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, transparent 50%)' }} />
                <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <ShieldCheck size={48} strokeWidth={1.2} className="text-emerald-500" />
                </motion.div>
              </div>
              {/* Sparkle accent */}
              <motion.div animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5], rotate: [0, 15, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -right-2 -top-2">
                <Sparkles size={18} strokeWidth={1.5} className="text-amber-400" />
              </motion.div>
            </motion.div>

            {/* ---- Title ---- */}
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-[48px] font-bold tracking-[-0.03em] text-[#111827]"
              style={{ fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif" }}>
              {t('qr.already_connected', lang)}
            </motion.h1>

            {/* ---- Subtitle ---- */}
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-3 text-[16px] font-normal tracking-wide text-[#6B7280]">
              {t('qr.bot_running', lang)}
            </motion.p>

            {/* ---- Bot info card ---- */}
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 w-full max-w-[340px] rounded-[32px] border border-white/50 p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 100%)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.6)',
                backdropFilter: 'blur(30px)',
              }}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2D3748] shadow-lg shadow-gray-900/10">
                  <Bot size={22} strokeWidth={1.5} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9CA3AF]">Bot ID</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#111827] tracking-wide">{shortId(botId)}</p>
                </div>
                <div className="ml-auto flex items-center gap-2.5">
                  <div className="relative">
                    <motion.div animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full bg-emerald-400 blur-md" />
                    <motion.div animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                  </div>
                  <span className="text-[12px] font-medium text-emerald-600">在线</span>
                </div>
              </div>
            </motion.div>

            {/* ---- Enter chat button ---- */}
            <motion.button onClick={onConnected}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
              className="btn-shine relative mt-10 flex h-[64px] w-full max-w-[320px] items-center justify-center gap-3 overflow-hidden rounded-[24px] text-[16px] font-semibold text-white shadow-xl shadow-gray-900/15 transition-shadow hover:shadow-2xl hover:shadow-gray-900/20"
              style={{ background: 'linear-gradient(135deg, #111827 0%, #2D3748 100%)' }}>
              <span className="relative z-10 flex items-center gap-3">
                {t('qr.enter_chat', lang)}
                <ArrowRight size={18} strokeWidth={2} />
              </span>
            </motion.button>

            {/* ---- Footer ---- */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}
              className="mt-14 text-[11px] font-medium uppercase tracking-[0.2em] text-[#C4C4C4]">
              Aperture · WeChat Bot
            </motion.p>
          </motion.div>
        )}

        {/* ====== LOADING ====== */}
        {status === 'loading' && (
          <motion.div key="loading" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
              style={iconBox('linear-gradient(135deg, #2d2b55 0%, #4a488a 50%, #625f9a 100%)', '0 8px 32px rgba(45,43,85,0.3)')}>
              <Loader size={26} className="animate-spin text-white" />
            </div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-[#1a1a2e]">{t('qr.connect_wechat', lang)}</h1>
            <p className="mt-2 text-[15px] text-[#8a8a9a]">{t('qr.preparing', lang)}</p>
          </motion.div>
        )}

        {/* ====== QR CODE ====== */}
        {status === 'waiting' && (
          <motion.div key="waiting" {...scaleIn} className="w-full max-w-[400px]">
            <div className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 12 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
                style={iconBox('linear-gradient(135deg, #2d2b55 0%, #4a488a 50%, #625f9a 100%)', '0 8px 32px rgba(45,43,85,0.3)')}>
                <ScanLine size={26} className="text-white" />
              </motion.div>
              <h1 className="text-[26px] font-light tracking-[-0.02em] text-[#1a1a2e]">{t('qr.connect_wechat', lang)}</h1>
              <p className="mt-2 text-[15px] text-[#8a8a9a]">{t('qr.scan_hint', lang)}</p>
            </div>

            {/* QR card */}
            <div className="mx-auto mt-8 w-[260px]">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg backdrop-blur-xl"
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04), 0 32px 64px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.6)' }}>
                <img src={qrImgUrl} alt="微信二维码" className="block h-full w-full" />
              </div>
            </div>

            {/* Steps */}
            <div className="mx-auto mt-8 max-w-[280px] space-y-3">
              {[{ n: '1', t: t('qr.step1', lang) }, { n: '2', t: t('qr.step2', lang) }, { n: '3', t: t('qr.step3', lang) }].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.12, type: 'spring', stiffness: 120, damping: 14 }}
                  className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2d2b55]/10 text-[12px] font-semibold text-[#2d2b55]">{s.n}</span>
                  <span className="text-[13px] text-[#8a8a9a]">{s.t}</span>
                </motion.div>
              ))}
            </div>

            <motion.button onClick={fetchQr} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="mt-8 text-[12px] text-[#b0b0ba] underline underline-offset-4 decoration-dotted transition-colors hover:text-[#8a8a9a]">
              {t('qr.expired', lang)}
            </motion.button>
          </motion.div>
        )}

        {/* ====== SCANED ====== */}
        {status === 'scaned' && (
          <motion.div key="scaned" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
              style={iconBox('linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', '0 8px 32px rgba(217,119,6,0.3)')}>
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center justify-center">
                <Smartphone size={26} className="text-white" />
              </motion.div>
            </div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-[#1a1a2e]">{t('qr.scanned', lang)}</h1>
            <p className="mt-2 text-[15px] text-[#8a8a9a]">{t('qr.confirm_on_phone', lang)}</p>
            <div className="mx-auto mt-10 flex items-center justify-center gap-3">
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.3 }}
                  className="h-3 w-3 rounded-full bg-amber-400" />
              ))}
            </div>
          </motion.div>
        )}

        {/* ====== CONNECTED ====== */}
        {status === 'connected' && (
          <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-[400px] text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 12 }}
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[32px]"
              style={iconBox('linear-gradient(135deg, #059669 0%, #10b981 100%)', '0 12px 40px rgba(5,150,105,0.35)')}>
              <CheckCircle size={40} className="text-white" />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[28px] font-light text-[#1a1a2e]">{t('qr.connected', lang)}</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 text-[15px] text-[#8a8a9a]">{t('qr.entering_chat', lang)}</motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mx-auto mt-10 flex gap-2">
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18 }}
                  className="h-3 w-3 rounded-full bg-emerald-500" />
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ====== ERROR ====== */}
        {status === 'error' && (
          <motion.div key="error" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-red-200 bg-red-50/60 shadow-sm">
              <Wifi size={26} className="text-red-400" />
            </div>
            <h1 className="text-[26px] font-light text-[#1a1a2e]">{t('qr.error', lang)}</h1>
            <p className="mt-2 text-[15px] text-[#8a8a9a]">{t('qr.error_desc', lang)}</p>
            <button onClick={fetchQr} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="mx-auto mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-[#2d2b55] px-6 text-[14px] font-medium text-white shadow-lg shadow-[#2d2b55]/20 transition-all hover:bg-[#4a488a]">
              <RefreshCw size={15} /> {t('qr.retry', lang)}
            </button>
          </motion.div>
        )}
        </AnimatePresence>

      </main>
    </div>
  );
}
