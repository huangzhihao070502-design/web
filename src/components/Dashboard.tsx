import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component, type ReactNode } from 'react';
import { MessageCircle, Bell, User, Settings, Search, Plus, ArrowLeft, ChevronRight, LogOut, Star, Clock, Heart, BookOpen, Users, Check, X, type LucideIcon } from 'lucide-react';
import Lenis from 'lenis';
import ChatPage from './chat/ChatPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';
import Live2DWidget from './Live2DWidget';

const MistScene = lazy(() => import('./ink/MistScene'));
class ThreeErrorBoundary extends Component<{children: ReactNode}, {error: boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? null : this.props.children; }
}

const API = '';
type Tab = 'home' | 'message' | 'profile' | 'settings';
interface Props { onLogout: () => void }
const navItems = [
  { key: 'home' as Tab, icon: MessageCircle, labelKey: 'nav.home' },
  { key: 'message' as Tab, icon: Bell, labelKey: 'nav.message' },
  { key: 'profile' as Tab, icon: User, labelKey: 'nav.profile' },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' },
];
interface Notif { id: string; text: string; time: string; read: boolean }

function MessagesPanel({ notifications, lang }: { notifications: Notif[]; lang: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-ink-white">
        <h1 className="text-lg font-semibold text-ink-black">{t('nav.message', lang)}</h1>
      </div>
      <div className="flex-1 overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm">
            <Bell size={40} strokeWidth={1} className="text-ink-light/30" />
            <p className="mt-3">{t('dashboard.no_notifications', lang)}</p>
          </div>
        ) : notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3.5 border-b border-ink-white/50">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-ink-white' : 'bg-cinnabar'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-black">{n.text}</div>
              <div className="text-xs text-ink-light mt-1">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel({ email, userCount, onLogout }: { email: string; userCount: number; onLogout: () => void }) {
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  return (
    <div className="flex flex-col h-full">
      <div className="relative bg-gradient-to-b from-ink-black/5 to-transparent px-4 pt-10 pb-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-2xl font-bold shadow-paper-md">
            {email ? email[0].toUpperCase() : '?'}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink-black">{email || t('settings.not_logged_in', lang)}</h2>
          <p className="text-xs text-ink-light mt-0.5">{t('settings.wechat_bot', lang)}</p>
        </div>
      </div>
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-2xl bg-warm-white p-4 shadow-paper-sm">
            <span className="text-xl font-bold text-ink-black">{userCount}</span>
            <span className="mt-1 text-xs text-ink-gray">{t('profile.friends', lang)}</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-warm-white p-4 shadow-paper-sm">
            <span className="text-xl font-bold text-ink-black">--</span>
            <span className="mt-1 text-xs text-ink-gray">{t('profile.messages', lang)}</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-warm-white p-4 shadow-paper-sm">
            <span className="text-xl font-bold text-cinnabar">--</span>
            <span className="mt-1 text-xs text-ink-gray">{t('profile.days_online', lang)}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto mt-4 px-4">
        <MenuSection items={[
          { icon: BookOpen, label: t('settings.personas', lang), subtitle: t('profile.personas_desc', lang) },
          { icon: Users, label: t('profile.contacts', lang), subtitle: `${userCount} ${t('profile.friends', lang)}` },
          { icon: Star, label: t('profile.favorites', lang), subtitle: t('profile.favorites_desc', lang) },
        ]} />
        <div className="mt-3"><MenuSection items={[
          { icon: Clock, label: t('profile.chat_history', lang), subtitle: t('profile.history_desc', lang) },
          { icon: Heart, label: t('profile.affection', lang), subtitle: t('profile.affection_desc', lang) },
        ]} /></div>
        <div className="mt-3"><MenuSection items={[
          { icon: LogOut, label: t('settings.logout', lang), danger: true, onClick: onLogout },
        ]} /></div>
      </div>
    </div>
  );
}

function MenuSection({ items }: { items: Array<{ icon: any; label: string; subtitle?: string; danger?: boolean; onClick?: () => void }> }) {
  return (
    <div className="rounded-2xl bg-warm-white shadow-paper-sm overflow-hidden">
      {items.map((item, i) => (
        <div key={i} onClick={item.onClick}
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-paper-white/50 transition-colors border-b border-ink-white/50 last:border-b-0">
          <item.icon size={20} strokeWidth={1.5} className={`shrink-0 ${item.danger ? 'text-cinnabar' : 'text-ink-gray'}`} />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium ${item.danger ? 'text-cinnabar' : 'text-ink-black'}`}>{item.label}</span>
            {item.subtitle && <div className="text-xs text-ink-light mt-0.5 truncate">{item.subtitle}</div>}
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-light/30" />
        </div>
      ))}
    </div>
  );
}

function QrModal({ qrImg, qrStatus, onClose }: { qrImg: string; qrStatus: string; onClose: () => void }) {
  const lang = useSettings()?.lang || 'zh-CN';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-warm-white rounded-[24px] p-8 text-center shadow-paper-lg max-w-[320px] w-[85vw] relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 border-none bg-transparent cursor-pointer p-1 text-ink-gray"><X size={18} strokeWidth={1.5} /></button>
        <h3 className="text-base font-semibold text-ink-black mb-1">{qrStatus === 'confirmed' ? '已确认' : '添加好友'}</h3>
        <p className="text-xs text-ink-gray mb-5 leading-relaxed">{qrStatus === 'confirmed' ? '好友已添加' : '用微信扫描二维码添加好友'}</p>
        {qrStatus === 'confirmed' ? (
          <div className="w-[200px] h-[200px] mx-auto flex items-center justify-center bg-emerald-500/10 rounded-[16px]"><Check size={48} className="text-emerald-500" strokeWidth={2} /></div>
        ) : <img src={qrImg} alt="QR" className="w-[200px] h-[200px] mx-auto block rounded-[8px]" />}
        <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl border border-ink-white bg-transparent text-ink-gray text-xs cursor-pointer">关闭</button>
      </div>
    </div>
  );
}

export default function Dashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrImg, setQrImg] = useState('');
  const [qrStatus, setQrStatus] = useState('idle');
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  const [email, setEmail] = useState('');
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem('aperture_session') || '{}'); if (s.email) setEmail(s.email); } catch {} }, []);

  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => { const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 1 }); lenisRef.current = lenis; const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf); return () => lenis.destroy(); }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/users`); const d = await r.json();
        setCurrentUserId(prev => { if (d.current_user) return d.current_user; if (d.users?.length && !prev) return d.users[0]; return prev; });
        if (d.users) setActiveChatUsers(prev => { let changed = false; const next = new Set(prev); for (const u of d.users) { if (!next.has(u)) { next.add(u); changed = true; } } return changed ? next : prev; });
        if (d.users?.length) { try { const logsR = await fetch(`${API}/api/logs`); const logsD = await logsR.json(); if (Array.isArray(logsD) && logsD.length > 0) setNotifications(logsD.slice(0, 20).map((l: any) => ({ id: `${l.time}-${l.msg}`, text: l.msg || `${l.level}: ${l.tag || 'system'}`, time: l.time || new Date().toLocaleTimeString(), read: true }))); } catch {} }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleSwitchUser = useCallback((userId: string) => { setCurrentUserId(userId); setChatOpen(true); setTab('home'); }, []);
  const handleAddFriend = useCallback(async () => {
    try { const r = await fetch(`${API}/api/add-friend-qrcode`); const d = await r.json(); if (d.success && d.qrcode_image) { setQrImg(`data:image/png;base64,${d.qrcode_image}`); setQrStatus('waiting'); setShowQr(true); const pollId = setInterval(async () => { try { const s = await fetch(`${API}/api/add-friend-poll`); const sd = await s.json(); if (sd.status === 'confirmed' || sd.user_id) { setQrStatus('confirmed'); clearInterval(pollId); setTimeout(() => { setShowQr(false); setQrStatus('idle'); }, 1500); } if (sd.status === 'expired') { setQrStatus('expired'); clearInterval(pollId); } } catch {} }, 2000); } } catch {} }, []);

  const filteredUsers = searchQuery ? Array.from(activeChatUsers).filter(uid => uid.toLowerCase().includes(searchQuery.toLowerCase())) : Array.from(activeChatUsers);

  const chatContent = activeChatUsers.size === 0
    ? <div className="flex-1 flex items-center justify-center text-ink-gray text-sm">{t('dashboard.no_users', lang)}</div>
    : Array.from(activeChatUsers).map(uid => (
        <div key={uid} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', visibility: uid === currentUserId ? 'visible' : 'hidden', pointerEvents: uid === currentUserId ? 'auto' : 'none' }}>
          <ChatPage userId={uid} />
        </div>
      ));

  const homeContent = chatOpen && currentUserId ? (
    <div className="flex flex-col h-full bg-warm-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-white shrink-0 bg-warm-white">
        <button onClick={() => setChatOpen(false)} className="flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-ink-gray hover:bg-paper-white transition-colors"><ArrowLeft size={20} strokeWidth={1.5} /></button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-xs font-semibold">{currentUserId.slice(0, 2).toUpperCase()}</div>
          <div><div className="text-sm font-medium text-ink-black">{currentUserId.slice(0, 8)}...</div><div className="text-[11px] text-ink-light">在线</div></div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-paper-white">{chatContent}</div>
    </div>
  ) : (
    <div className="flex flex-col h-full bg-warm-white">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink-black tracking-wider">墨语</h1>
        <button onClick={handleAddFriend} className="w-9 h-9 rounded-full bg-ink-black flex items-center justify-center text-warm-white shadow-paper-sm text-lg">+</button>
      </div>
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 rounded-[20px] bg-paper-white px-4 py-2.5">
          <Search size={16} strokeWidth={1.5} className="text-ink-light shrink-0" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索对话..." className="flex-1 bg-transparent text-sm text-ink-black outline-none placeholder:text-ink-light/60" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-ink-light"><X size={14} strokeWidth={1.5} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm px-8">
            <Users size={40} strokeWidth={1} className="text-ink-light/30" />
            <p className="mt-3 font-medium">{searchQuery ? '未找到匹配的对话' : '暂无联系人'}</p>
            <p className="mt-1 text-xs text-ink-light text-center">{searchQuery ? '请尝试其他关键词' : '点击右上角 + 添加好友开始聊天'}</p>
          </div>
        ) : filteredUsers.map(uid => (
          <div key={uid} onClick={() => { setCurrentUserId(uid); setChatOpen(true); }}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-paper-white/50 transition-colors border-b border-ink-white/30">
            <div className="w-12 h-12 rounded-full bg-ink-white flex items-center justify-center text-ink-black text-sm font-semibold shrink-0">{uid.slice(0, 2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-black">{uid.slice(0, 10)}...</div>
              <div className="text-xs text-ink-light mt-0.5 truncate">{uid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <ThreeErrorBoundary><Suspense fallback={null}><MistScene /></Suspense></ThreeErrorBoundary>
      <div className="relative z-10 flex justify-center w-screen h-screen overflow-hidden bg-paper-white font-sans text-ink-black">
        <div className="flex flex-col w-full max-w-[420px] h-full bg-warm-white shadow-paper-lg relative overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0" style={{ display: tab === 'home' ? 'block' : 'none' }}>{homeContent}</div>
            <div className="absolute inset-0" style={{ display: tab === 'message' ? 'block' : 'none' }}><MessagesPanel notifications={notifications} lang={lang} /></div>
            <div className="absolute inset-0" style={{ display: tab === 'profile' ? 'block' : 'none' }}><ProfilePanel email={email} userCount={activeChatUsers.size} onLogout={onLogout} /></div>
            <div className="absolute inset-0" style={{ display: tab === 'settings' ? 'block' : 'none' }}><div className="flex flex-col h-full"><div className="flex-1 overflow-auto"><SettingsPage onLogout={onLogout} /></div></div></div>
          </div>
          <div className="flex items-center justify-around h-14 shrink-0 bg-warm-white border-t border-ink-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {navItems.map(item => {
              const active = tab === item.key;
              return (
                <button key={item.key} onClick={() => { setTab(item.key); if (item.key !== 'home') setChatOpen(false); }}
                  className="flex flex-col items-center gap-0.5 px-4 py-1 border-none bg-transparent cursor-pointer relative min-w-0">
                  <item.icon size={22} strokeWidth={active ? 2 : 1.5} className={active ? 'text-ink-black' : 'text-ink-light'} />
                  <span className={`text-[10px] leading-tight ${active ? 'font-medium text-ink-black' : 'text-ink-light'}`}>{t(item.labelKey, lang)}</span>
                  {active && <div className="absolute -top-px w-6 h-0.5 rounded-b bg-ink-black" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {showQr && <QrModal qrImg={qrImg} qrStatus={qrStatus} onClose={() => { setShowQr(false); setQrStatus('idle'); }} />}
      <Live2DWidget />
    </>
  );
}
export type { Tab };
