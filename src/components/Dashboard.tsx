import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component, type ReactNode } from 'react';
import {
  MessageCircle, Bell, User, Settings, Search, Plus, ArrowLeft,
  ChevronRight, LogOut, Star, Clock, Heart, BookOpen,
  Users, Check, X, type LucideIcon
} from 'lucide-react';
import Lenis from 'lenis';
import ChatPage from './chat/ChatPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';
import Live2DWidget from './Live2DWidget';

/* ─── Lazy-loaded Three.js mist with error boundary ─── */
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
  { key: 'home' as Tab, icon: MessageCircle, labelKey: 'nav.home' as const },
  { key: 'message' as Tab, icon: Bell, labelKey: 'nav.message' as const },
  { key: 'profile' as Tab, icon: User, labelKey: 'nav.profile' as const },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' as const },
];

/* ─── Notification type for message tab ─── */
interface Notif {
  id: string;
  text: string;
  time: string;
  read: boolean;
}

/* ─── Profile Stats Card ─── */
function StatCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-warm-white p-4 shadow-paper-sm">
      <span className={`text-xl font-bold ${color || 'text-ink-black'}`}>{value}</span>
      <span className="mt-1 text-xs text-ink-gray">{label}</span>
    </div>
  );
}

/* ─── Profile Menu Item ─── */
function MenuItem({ icon: Icon, label, onClick, badge, danger, subtitle }: {
  icon: LucideIcon; label: string; onClick?: () => void; badge?: string | number; danger?: boolean; subtitle?: string;
}) {
  return (
    <div onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-paper-white/50 transition-colors border-b border-ink-white/50 last:border-b-0">
      <Icon size={20} strokeWidth={1.5} className={`shrink-0 ${danger ? 'text-cinnabar' : 'text-ink-gray'}`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${danger ? 'text-cinnabar' : 'text-ink-black'}`}>{label}</span>
        {subtitle && <div className="text-xs text-ink-light mt-0.5 truncate">{subtitle}</div>}
      </div>
      {badge !== undefined && (
        <span className="rounded-full bg-paper-white px-2 py-0.5 text-xs text-ink-light font-medium shrink-0">{badge}</span>
      )}
      <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-light/30" />
    </div>
  );
}

/* ─── QR Modal (reused from original UserPage) ─── */
function QrModal({ qrImg, qrStatus, onClose }: { qrImg: string; qrStatus: string; onClose: () => void }) {
  const lang = useSettings()?.lang || 'zh-CN';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-warm-white rounded-[24px] p-8 text-center shadow-paper-lg max-w-[320px] w-[85vw] relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-3 right-3 border-none bg-transparent cursor-pointer p-1 text-ink-gray">
          <X size={18} strokeWidth={1.5} />
        </button>
        <h3 className="text-base font-semibold text-ink-black mb-1">
          {qrStatus === 'confirmed'
            ? `QR Code Confirmed`
            : 'Add Friend'}
        </h3>
        <p className="text-xs text-ink-gray mb-5 leading-relaxed">
          {qrStatus === 'confirmed'
            ? 'Friend added successfully'
            : 'Scan the QR code with WeChat to add a friend'}
        </p>
        {qrStatus === 'confirmed' ? (
          <div className="w-[200px] h-[200px] mx-auto flex items-center justify-center bg-emerald-500/10 rounded-[16px]">
            <Check size={48} className="text-emerald-500" strokeWidth={2} />
          </div>
        ) : (
          <img src={qrImg} alt="QR Code" className="w-[200px] h-[200px] mx-auto block rounded-[8px]" />
        )}
        <button onClick={onClose}
          className="mt-4 px-6 py-2 rounded-xl border border-ink-white bg-transparent text-ink-gray text-xs cursor-pointer">
          {t('common.close', lang)}
        </button>
      </div>
    </div>
  );
}

/* ─── Message Tab: Notifications ─── */
function MessagesPanel({ notifications, lang }: { notifications: Notif[]; lang: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-ink-white">
        <h1 className="text-lg font-semibold text-ink-black">Messages</h1>
        <p className="text-xs text-ink-light mt-0.5">Notifications and updates</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm">
            <Bell size={40} strokeWidth={1} className="text-ink-light/30" />
            <p className="mt-3">No notifications yet</p>
            <p className="mt-1 text-xs text-ink-light">Messages and updates will appear here</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id}
              className="flex items-start gap-3 px-4 py-3.5 border-b border-ink-white/50">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-ink-white' : 'bg-cinnabar'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-black">{n.text}</div>
                <div className="text-xs text-ink-light mt-1">{n.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Profile Tab ─── */
function ProfilePanel({ email, userCount, onLogout }: {
  email: string; userCount: number; onLogout: () => void;
}) {
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';

  return (
    <div className="flex flex-col h-full">
      {/* Gradient Header */}
      <div className="relative bg-gradient-to-b from-ink-black/5 to-transparent px-4 pt-10 pb-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-2xl font-bold shadow-paper-md">
            {email ? email[0].toUpperCase() : '?'}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink-black">{email || 'Not logged in'}</h2>
          <p className="text-xs text-ink-light mt-0.5">WeChat Bot Account</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={userCount} label="Friends" />
          <StatCard value="--" label="Messages" />
          <StatCard value="--" label="Days Online" color="text-cinnabar" />
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-auto mt-4 px-4">
        <div className="rounded-2xl bg-warm-white shadow-paper-sm overflow-hidden">
          <MenuItem icon={BookOpen} label="Personas" subtitle="Character cards and skills" />
          <MenuItem icon={Users} label="Contacts" subtitle={`${userCount} friends`} />
          <MenuItem icon={Star} label="Favorites" subtitle="Starred messages" />
        </div>

        <div className="mt-3 rounded-2xl bg-warm-white shadow-paper-sm overflow-hidden">
          <MenuItem icon={Clock} label="Chat History" subtitle="Conversation records" />
          <MenuItem icon={Heart} label="AI Affection" subtitle="Relationship status" />
        </div>

        <div className="mt-3 rounded-2xl bg-warm-white shadow-paper-sm overflow-hidden">
          <MenuItem icon={LogOut} label="Log Out" onClick={onLogout} danger />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════ */
export default function Dashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // QR modal state
  const [showQr, setShowQr] = useState(false);
  const [qrImg, setQrImg] = useState('');
  const [qrStatus, setQrStatus] = useState('idle');

  // Notification state
  const [notifications, setNotifications] = useState<Notif[]>([]);

  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';

  // Resolve email from localStorage session
  const [email, setEmail] = useState('');
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('aperture_session') || '{}');
      if (s.email) setEmail(s.email);
    } catch {}
  }, []);

  /* ─── Lenis smooth scroll ─── */
  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 1 });
    lenisRef.current = lenis;
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  /* ─── User polling (every 2s) ─── */
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/users`);
        const d = await r.json();
        setCurrentUserId(prev => {
          if (d.current_user) return d.current_user;
          if (d.users?.length && !prev) return d.users[0];
          return prev;
        });
        if (d.users) {
          setActiveChatUsers(prev => {
            let changed = false;
            const next = new Set(prev);
            for (const u of d.users) {
              if (!next.has(u)) { next.add(u); changed = true; }
            }
            return changed ? next : prev;
          });
        }
        // Refresh notifications from logs
        if (d.users?.length) {
          try {
            const logsR = await fetch(`${API}/api/logs`);
            const logsD = await logsR.json();
            if (Array.isArray(logsD) && logsD.length > 0) {
              setNotifications(logsD.slice(0, 20).map((l: any) => ({
                id: `${l.time}-${l.msg}`,
                text: l.msg || `${l.level}: ${l.tag || 'system'}`,
                time: l.time || new Date().toLocaleTimeString(),
                read: true,
              })));
            }
          } catch {}
        }
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const handleSwitchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    setChatOpen(true);
    setTab('home');
  }, []);

  /* ─── Add Friend (QR code flow from UserPage) ─── */
  const handleAddFriend = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/add-friend-qrcode`);
      const d = await r.json();
      if (d.success && d.qrcode_image) {
        setQrImg(`data:image/png;base64,${d.qrcode_image}`);
        setQrStatus('waiting');
        setShowQr(true);
        const pollId = setInterval(async () => {
          try {
            const s = await fetch(`${API}/api/add-friend-poll`);
            const sd = await s.json();
            if (sd.status === 'confirmed' || sd.user_id) {
              setQrStatus('confirmed');
              clearInterval(pollId);
              setTimeout(() => { setShowQr(false); setQrStatus('idle'); }, 1500);
            }
            if (sd.status === 'expired') {
              setQrStatus('expired');
              clearInterval(pollId);
            }
          } catch {}
        }, 2000);
      }
    } catch {}
  }, []);

  /* ─── Filtered user list for search ─── */
  const filteredUsers = searchQuery
    ? Array.from(activeChatUsers).filter(uid => uid.toLowerCase().includes(searchQuery.toLowerCase()))
    : Array.from(activeChatUsers);

  /* ─── Chat content (preserved from original) ─── */
  const chatContent = activeChatUsers.size === 0 ? (
    <div className="flex-1 flex items-center justify-center text-ink-gray text-sm">
      No users connected
    </div>
  ) : (
    Array.from(activeChatUsers).map(uid => (
      <div key={uid}
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          visibility: uid === currentUserId ? 'visible' : 'hidden',
          pointerEvents: uid === currentUserId ? 'auto' : 'none'
        }}>
        <ChatPage userId={uid} />
      </div>
    ))
  );

  /* ════════════════════════════════════════
     RENDER: Home Tab
     ════════════════════════════════════════ */
  const renderHomeTab = () => {
    if (chatOpen && currentUserId) {
      return (
        <div className="flex flex-col h-full bg-warm-white">
          {/* Chat header with back button */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-white shrink-0 bg-warm-white z-10">
            <button onClick={() => setChatOpen(false)}
              className="flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-ink-gray hover:bg-paper-white transition-colors">
              <ArrowLeft size={20} strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-xs font-semibold">
                {currentUserId.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-ink-black">{currentUserId.slice(0, 8)}...</div>
                <div className="text-[11px] text-ink-light">online</div>
              </div>
            </div>
          </div>
          {/* Messages */}
          <div className="flex-1 relative overflow-hidden" style={{ background: '#F5F2ED' }}>
            {chatContent}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-warm-white relative">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink-black">Chats</h1>
          <button onClick={() => { setChatOpen(false); handleAddFriend(); }}
            className="w-9 h-9 rounded-full bg-ink-black flex items-center justify-center text-warm-white shadow-paper-sm">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-[20px] bg-paper-white px-4 py-2.5">
            <Search size={16} strokeWidth={1.5} className="text-ink-light shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 bg-transparent text-sm text-ink-black outline-none placeholder:text-ink-light/60"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-ink-light">
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-auto">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm px-8">
              <Users size={40} strokeWidth={1} className="text-ink-light/30" />
              <p className="mt-3 font-medium">No contacts</p>
              <p className="mt-1 text-xs text-ink-light text-center">
                {searchQuery ? 'No results found' : 'Add friends via QR code to get started'}
              </p>
            </div>
          ) : (
            filteredUsers.map(uid => (
              <div key={uid}
                onClick={() => { setCurrentUserId(uid); setChatOpen(true); }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-paper-white/50 transition-colors border-b border-ink-white/30">
                <div className="w-12 h-12 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-sm font-semibold shrink-0 shadow-paper-sm">
                  {uid.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-black">{uid.slice(0, 10)}...</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-xs text-ink-light mt-0.5 truncate">{uid}</div>
                </div>
                <div className="text-[11px] text-ink-light shrink-0">Now</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <>
      <ThreeErrorBoundary>
        <Suspense fallback={null}>
          <MistScene />
        </Suspense>
      </ThreeErrorBoundary>

      <div className="relative z-10 flex justify-center w-screen h-screen overflow-hidden bg-paper-white font-sans text-body-sm text-ink-black">
        {/* Mobile-style container */}
        <div className="flex flex-col w-full max-w-[420px] h-full bg-warm-white shadow-paper-lg relative overflow-hidden">
          {/* ─── Tab Content ─── */}
          <div className="flex-1 overflow-hidden relative">
            {/* Home */}
            <div className="absolute inset-0" style={{ display: tab === 'home' ? 'block' : 'none' }}>
              {renderHomeTab()}
            </div>

            {/* Message */}
            <div className="absolute inset-0" style={{ display: tab === 'message' ? 'block' : 'none' }}>
              <MessagesPanel notifications={notifications} lang={lang} />
            </div>

            {/* Profile */}
            <div className="absolute inset-0" style={{ display: tab === 'profile' ? 'block' : 'none' }}>
              <ProfilePanel email={email} userCount={activeChatUsers.size} onLogout={onLogout} />
            </div>

            {/* Settings — uses full SettingsPage with all sub-pages */}
            <div className="absolute inset-0" style={{ display: tab === 'settings' ? 'block' : 'none' }}>
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto">
                  <SettingsPage onLogout={onLogout} />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Bottom Navigation ─── */}
          <div className="flex items-center justify-around h-14 shrink-0 bg-warm-white border-t border-ink-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {navItems.map(item => {
              const active = tab === item.key;
              return (
                <button key={item.key} onClick={() => { setTab(item.key); if (item.key !== 'home') setChatOpen(false); }}
                  className="flex flex-col items-center gap-0.5 px-4 py-1 border-none bg-transparent cursor-pointer relative min-w-0">
                  <item.icon size={22} strokeWidth={active ? 2 : 1.5}
                    className={active ? 'text-ink-black' : 'text-ink-light'} />
                  <span className={`text-[10px] leading-tight ${active ? 'font-medium text-ink-black' : 'font-normal text-ink-light'}`}>
                    {t(item.labelKey as string, lang)}
                  </span>
                  {active && <div className="absolute -top-px w-6 h-0.5 rounded-b bg-ink-black" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQr && (
        <QrModal qrImg={qrImg} qrStatus={qrStatus} onClose={() => { setShowQr(false); setQrStatus('idle'); }} />
      )}

      <Live2DWidget />
    </>
  );
}

// Re-export unused icon imports for tree-shaking compatibility
export type { Tab };
