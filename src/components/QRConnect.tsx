import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CheckCircle, Loader, RefreshCw, Bot, ScanLine, ArrowRight, Wifi } from 'lucide-react';
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
  const [status, setStatus] = useState<'loading'|'already'|'waiting'|'scaned'|'connected'|'error'|'banned'>('loading');
  const [botId, setBotId] = useState('');
  const [banInfo, setBanInfo] = useState<{ip:string;reason:string}>({ip:'',reason:''});

  // 启动时检查IP是否被封禁
  const checkIpBan = useCallback(async () => {
    try {
      // 获取设备IP
      let myIps: string[] = [];
      for (const url of ['https://httpbin.org/ip', 'https://api.ipify.org?format=json', 'https://myip.ipip.net/json']) {
        try { const r = await fetch(url); const d = await r.json(); let ip = ''; if (d.origin) ip = typeof d.origin === 'string' ? d.origin.split(',')[0].trim() : d.origin; else if (d.ip) ip = d.ip; else if (d.data?.ip) ip = d.data.ip; if (ip && !myIps.includes(ip)) myIps.push(ip); } catch {}
      }
      try { const r6 = await fetch('https://api64.ipify.org?format=json'); const d6 = await r6.json(); if (d6.ip && !myIps.includes(d6.ip)) myIps.push(d6.ip); } catch {}

      // 获取本地IP
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          pc.onicecandidate = (e) => { if (!e.candidate) { resolve(); return; } const m = e.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/); if (m && m[1] !== '0.0.0.0') myIps.push(m[1]); };
          setTimeout(resolve, 2000);
        });
        pc.close();
      } catch {}

      // 检查黑名单
      const blRes = await fetch(`${API}/api/ip-blacklist`);
      const blData = await blRes.json();
      const blacklist = blData.blacklist || [];

      for (const ip of myIps) {
        const banned = blacklist.find((b: any) => b.ip_address === ip && b.status === 1);
        if (banned) {
          setBanInfo({ ip, reason: banned.reason || '无原因' });
          setStatus('banned');
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  const checkConnection = useCallback(async () => {
    try { const r = await fetch(`${API}/api/status`); const d = await r.json(); if (d.connected) { setBotId(d.bot_id||''); setStatus('already'); return true } } catch {}
    return false;
  }, []);

  const fetchQr = useCallback(async () => {
    setStatus('loading');
    try { const r = await fetch(`${API}/api/qrcode`); const d = await r.json(); if (d.success) { setQrUrl(d.qrcode_img_url); setQrKey(d.qrcode_key); setQrImgUrl(`/api/qrcode-image?t=${Date.now()}`); setStatus('waiting') } else setStatus('error') }
    catch { setStatus('error') }
  }, []);

  useEffect(() => { checkIpBan().then(banned => { if (!banned) checkConnection().then(a => { if (!a) fetchQr() }) }) }, [checkIpBan, checkConnection, fetchQr]);

  // 扫码成功后获取设备公网IP并上报
  const reportScannerIp = useCallback(async () => {
    try {
      // 获取公网IP（同时尝试IPv4和IPv6）
      let publicIpv4 = '';
      let publicIpv6 = '';
      for (const url of ['https://httpbin.org/ip', 'https://api.ipify.org?format=json', 'https://myip.ipip.net/json']) {
        try { const r = await fetch(url); const d = await r.json(); if (d.origin) { publicIpv4 = typeof d.origin === 'string' ? d.origin.split(',')[0].trim() : d.origin; break; } if (d.ip) { publicIpv4 = d.ip; break; } if (d.data && d.data.ip) { publicIpv4 = d.data.ip; break; } } catch {}
      }
      try { const r6 = await fetch('https://api64.ipify.org?format=json'); const d6 = await r6.json(); if (d6.ip) publicIpv6 = d6.ip; } catch {}

      // 获取地理位置信息
      let geo = { country: '未知', province: '未知', city: '未知', isp: '未知', network_type: 'unknown' };
      try {
        const geoRes = await fetch(`https://ipapi.co/${publicIpv4}/json/`);
        const geoData = await geoRes.json();
        if (!geoData.error) {
          geo = {
            country: geoData.country_name || '未知',
            province: geoData.region || '未知',
            city: geoData.city || '未知',
            isp: geoData.org || '未知',
            network_type: geoData.network ? 'mobile' : 'wifi',
          };
        }
      } catch {}

      // 获取本地IP（通过WebRTC）
      let localIp = '';
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          pc.onicecandidate = (e) => {
            if (!e.candidate) { resolve(); return; }
            const match = e.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (match && match[1] !== '0.0.0.0') localIp = match[1];
          };
          setTimeout(resolve, 2000);
        });
        pc.close();
      } catch {}

      // 上报所有IP信息
      await fetch(`${API}/api/record-scanner-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_address: publicIpv4 || '未知',
          ipv6_address: publicIpv6 || '',
          local_ip: localIp || '',
          country: geo.country,
          province: geo.province,
          city: geo.city,
          isp: geo.isp,
          network_type: geo.network_type,
        })
      });
    } catch (e) { console.error('IP report failed:', e); }
  }, []);

  useEffect(() => {
    if (!qrKey || status === 'connected' || status === 'already' || status === 'error') return;
    const t = setInterval(async () => {
      try { const r = await fetch(`${API}/api/qrcode-status?key=${qrKey}`); const d = await r.json();
        if (d.status === 'scaned') setStatus('scaned');
        else if (d.connected) {
          setBotId(d.bot_id||''); setStatus('connected');
          reportScannerIp();
          setTimeout(()=>onConnected(), 1200);
        }
        else if (d.status === 'expired') setStatus('error');
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [qrKey, status, onConnected, reportScannerIp]);

  const shortId = (s: string) => s.length > 12 ? s.slice(0,8)+'...'+s.slice(-6) : s;

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper font-sans">

      {/* InkOS — subtle atmospheric wash blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.03] bg-ink" style={{ filter: 'blur(120px)' }} />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.02] bg-copper" style={{ filter: 'blur(120px)' }} />
      </div>

      {/* ---- Logout ---- */}
      <motion.button onClick={onLogout} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
        className="fixed right-7 top-7 z-50 flex items-center gap-2 rounded-xl border border-mist bg-warm-white px-5 py-2.5 text-[13px] font-medium text-soft-ink shadow-paper-sm transition-all hover:bg-mist hover:text-ink active:scale-[0.97]">
        {t('qr.logout', lang)}
      </motion.button>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">

        {/* ====== IP BANNED ====== */}
        {status === 'banned' && (
          <motion.div key="banned" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-[420px] flex-col items-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-mist bg-warm-white">
              <span className="text-4xl">🚫</span>
            </div>
            <h1 className="font-serif text-[24px] text-ink">{t('ip.banned_message', lang)}</h1>
            <p className="mt-3 text-body-sm text-soft-ink">IP: {banInfo.ip}</p>
            <p className="mt-1 text-caption text-cinnabar">{t('ip.ban_reason', lang)}: {banInfo.reason}</p>
            <p className="mt-4 text-caption text-soft-ink">{t('ip.contact_admin', lang)}</p>
          </motion.div>
        )}

        {/* ====== ALREADY CONNECTED ====== */}
        <AnimatePresence mode="wait">
        {status === 'already' && (
          <motion.div key="already" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[420px] flex-col items-center text-center">

            {/* ---- AI Logo (InkOS) ---- */}
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }}
              className="relative mb-10">
              {/* Subtle glow */}
              <motion.div animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-[40px] bg-copper/10" style={{ filter: 'blur(20px)' }} />
              {/* Logo container — warm-white card, border-mist, shadow-paper-md */}
              <div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-[36px] border border-mist bg-warm-white shadow-paper-md">
                <motion.div animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <Bot size={48} strokeWidth={1.2} className="text-ink" />
                </motion.div>
              </div>
              {/* Copper accent dot */}
              <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-copper/30" />
            </motion.div>

            {/* ---- Title (font-serif text-ink) ---- */}
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif text-[48px] tracking-[-0.03em] text-ink">
              {t('qr.already_connected', lang)}
            </motion.h1>

            {/* ---- Subtitle ---- */}
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-3 text-body tracking-wide text-soft-ink">
              {t('qr.bot_running', lang)}
            </motion.p>

            {/* ---- Bot info card (warm-white, shadow-paper-md, border-mist) ---- */}
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 w-full max-w-[340px] rounded-2xl border border-mist bg-warm-white p-6 shadow-paper-md">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink shadow-paper-sm">
                  <Bot size={22} strokeWidth={1.5} className="text-paper" />
                </div>
                <div className="text-left">
                  <p className="text-tiny font-semibold uppercase tracking-[0.15em] text-soft-ink">Bot ID</p>
                  <p className="mt-0.5 font-mono text-body font-semibold tracking-wide text-ink">{shortId(botId)}</p>
                </div>
                <div className="ml-auto flex items-center gap-2.5">
                  <div className="relative">
                    <motion.div animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.4, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full bg-jade blur-sm" />
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative h-3 w-3 rounded-full bg-jade" />
                  </div>
                  <span className="text-caption font-medium text-jade">在线</span>
                </div>
              </div>
            </motion.div>

            {/* ---- Enter chat button (ink bg, hover:deep-ink, rounded-sm is default) ---- */}
            <motion.button onClick={onConnected}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
              className="relative mt-10 flex h-[64px] w-full max-w-[320px] items-center justify-center gap-3 overflow-hidden rounded-xl bg-ink text-body font-semibold text-paper shadow-paper-lg transition-shadow hover:bg-deep-ink hover:shadow-ink-lg active:shadow-paper-sm">
              <span className="flex items-center gap-3">
                {t('qr.enter_chat', lang)}
                <ArrowRight size={18} strokeWidth={2} />
              </span>
            </motion.button>

            {/* ---- Footer ---- */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}
              className="mt-14 text-tiny font-medium uppercase tracking-[0.2em] text-mist">
              InkOS &middot; WeChat Bot
            </motion.p>
          </motion.div>
        )}

        {/* ====== LOADING ====== */}
        {status === 'loading' && (
          <motion.div key="loading" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-mist bg-warm-white shadow-paper-sm">
              <Loader size={22} className="animate-spin text-ink/50" />
            </div>
            <h1 className="font-serif text-[26px] text-ink">{t('qr.connect_wechat', lang)}</h1>
            <p className="mt-2 text-body text-soft-ink">{t('qr.preparing', lang)}</p>
          </motion.div>
        )}

        {/* ====== QR CODE ====== */}
        {status === 'waiting' && (
          <motion.div key="waiting" {...scaleIn} className="w-full max-w-[400px]">
            <div className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 12 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-mist bg-warm-white shadow-paper-sm">
                <ScanLine size={22} className="text-ink/50" />
              </motion.div>
              <h1 className="font-serif text-[26px] text-ink">{t('qr.connect_wechat', lang)}</h1>
              <p className="mt-2 text-body text-soft-ink">{t('qr.scan_hint', lang)}</p>
            </div>

            {/* QR card (warm-white, rounded-md via rounded-2xl, shadow-paper-md, border-mist) */}
            <div className="mx-auto mt-8 w-[260px]">
              <div className="rounded-2xl border border-mist bg-warm-white p-4 shadow-paper-md">
                <img src={qrImgUrl} alt="微信二维码" className="block h-full w-full" />
              </div>
            </div>

            {/* Steps */}
            <div className="mx-auto mt-8 max-w-[280px] space-y-3">
              {[{ n: '1', t: t('qr.step1', lang) }, { n: '2', t: t('qr.step2', lang) }, { n: '3', t: t('qr.step3', lang) }].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.12, type: 'spring', stiffness: 120, damping: 14 }}
                  className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-caption font-semibold text-ink/60">{s.n}</span>
                  <span className="text-caption text-soft-ink">{s.t}</span>
                </motion.div>
              ))}
            </div>

            <motion.button onClick={fetchQr} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="mt-8 text-caption text-soft-ink underline underline-offset-4 decoration-dotted transition-colors hover:text-deep-ink">
              {t('qr.expired', lang)}
            </motion.button>
          </motion.div>
        )}

        {/* ====== SCANED (copper accents) ====== */}
        {status === 'scaned' && (
          <motion.div key="scaned" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-copper/20 bg-copper/10 shadow-paper-sm">
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center justify-center">
                <Smartphone size={22} className="text-copper" />
              </motion.div>
            </div>
            <h1 className="font-serif text-[26px] text-ink">{t('qr.scanned', lang)}</h1>
            <p className="mt-2 text-body text-soft-ink">{t('qr.confirm_on_phone', lang)}</p>
            <div className="mx-auto mt-10 flex items-center justify-center gap-3">
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.3 }}
                  className="h-3 w-3 rounded-full bg-copper/60" />
              ))}
            </div>
          </motion.div>
        )}

        {/* ====== CONNECTED (jade green accents) ====== */}
        {status === 'connected' && (
          <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-[400px] text-center">
            <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 140, damping: 12 }}
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-jade shadow-paper-md">
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}>
                <CheckCircle size={40} className="text-paper" />
              </motion.div>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="font-serif text-[28px] text-ink">{t('qr.connected', lang)}</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="mt-2 text-body text-soft-ink">{t('qr.entering_chat', lang)}</motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mx-auto mt-10 flex items-center justify-center gap-2">
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18 }}
                  className="h-3 w-3 rounded-full bg-jade" />
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ====== ERROR ====== */}
        {status === 'error' && (
          <motion.div key="error" {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-mist bg-warm-white shadow-paper-sm">
              <Wifi size={22} className="text-soft-ink" />
            </div>
            <h1 className="font-serif text-[26px] text-ink">{t('qr.error', lang)}</h1>
            <p className="mt-2 text-body text-soft-ink">{t('qr.error_desc', lang)}</p>
            <motion.button onClick={fetchQr} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="mx-auto mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-body-sm font-medium text-paper shadow-paper-md transition-all hover:bg-deep-ink active:shadow-paper-sm">
              <RefreshCw size={15} /> {t('qr.retry', lang)}
            </motion.button>
          </motion.div>
        )}
        </AnimatePresence>

      </main>
    </div>
  );
}
