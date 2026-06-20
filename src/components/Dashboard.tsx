import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component, type ReactNode } from 'react';
import { MessageCircle, User, Settings, Brain, Heart, Clock, BookOpen } from 'lucide-react';
import Lenis from 'lenis';
import ChatPage from './chat/ChatPage';
import UserPage from './chat/UserPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';
import Live2DWidget from './Live2DWidget';

// Lazy-load Three.js mist with error boundary (Android WebView may not support WebGL)
const MistScene = lazy(() => import('./ink/MistScene'));
class ThreeErrorBoundary extends Component<{children: ReactNode}, {error: boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? null : this.props.children; }
}

const API = '';

type Tab = 'chat' | 'user' | 'settings';
interface Props { onLogout: () => void }

const tabs = [
  { key: 'chat' as Tab, icon: MessageCircle, labelKey: 'nav.chat' },
  { key: 'user' as Tab, icon: User, labelKey: 'nav.user' },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' },
];

const INKOS_PERSONA_NAME = 'Mo Ran';
const INKOS_PERSONA_TITLE = 'InkOS — Living Interface';

/* ─── Right Panel: AI Status ─── */
function AIPanel() {
  const emotions = [
    { label: 'calm', icon: Heart, value: 0.85, color: 'text-jade' },
    { label: 'curious', icon: Brain, value: 0.72, color: 'text-copper' },
    { label: 'present', icon: Clock, value: 0.91, color: 'text-jade' },
  ];
  const memories = [
    { key: 'short-term', count: 24 },
    { key: 'long-term', count: 156 },
    { key: 'core', count: 7 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Persona Header */}
      <div className="p-ink-5 border-b border-mist">
        <div className="flex items-center gap-ink-3">
          <div className="w-10 h-10 rounded-full bg-copper/10 flex items-center justify-center">
            <Brain size={20} className="text-copper" />
          </div>
          <div>
            <div className="text-body font-medium text-ink">{INKOS_PERSONA_NAME}</div>
            <div className="text-tiny text-soft-ink">{INKOS_PERSONA_TITLE}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-ink-5 space-y-ink-6">
        {/* Emotional State */}
        <section>
          <h3 className="text-caption font-medium text-soft-ink tracking-wider uppercase mb-ink-3">Emotional State</h3>
          <div className="space-y-ink-3">
            {emotions.map((em) => (
              <div key={em.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <em.icon size={14} className={em.color} />
                    <span className="text-body-sm text-deep-ink">{em.label}</span>
                  </div>
                  <span className="text-tiny text-soft-ink">{Math.round(em.value * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-mist overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${em.color.replace('text-', 'bg-')}/60`} style={{ width: `${em.value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Memory Status */}
        <section>
          <h3 className="text-caption font-medium text-soft-ink tracking-wider uppercase mb-ink-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-soft-ink" />
              <span>Memory</span>
            </div>
          </h3>
          <div className="space-y-ink-2">
            {memories.map((m) => (
              <div key={m.key} className="flex items-center justify-between py-1.5 px-ink-3 rounded-xs bg-paper">
                <span className="text-body-sm text-deep-ink capitalize">{m.key.replace('-', ' ')}</span>
                <span className="text-body-sm text-soft-ink font-mono">{m.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* System Status */}
        <section>
          <h3 className="text-caption font-medium text-soft-ink tracking-wider uppercase mb-ink-3">System</h3>
          <div className="space-y-ink-2">
            <div className="flex items-center justify-between py-1.5 px-ink-3 rounded-xs bg-paper">
              <span className="text-body-sm text-deep-ink">Status</span>
              <span className="text-body-sm text-jade flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-jade animate-breathe" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-ink-3 rounded-xs bg-paper">
              <span className="text-body-sm text-deep-ink">Uptime</span>
              <span className="text-body-sm text-soft-ink">02:34:17</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-ink-3 rounded-xs bg-paper">
              <span className="text-body-sm text-deep-ink">Context</span>
              <span className="text-body-sm text-soft-ink">64% used</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Dashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<Set<string>>(new Set());
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', general_language: 'zh-CN', general_theme: 'auto' };
  const lang = settingsCtx?.lang || 'zh-CN';

  // Lenis smooth scroll
  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 1 });
    lenisRef.current = lenis;
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

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
          setActiveChatUsers(prev => { let changed = false; const next = new Set(prev); for (const u of d.users) { if (!next.has(u)) { next.add(u); changed = true; } } return changed ? next : prev; });
        }
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const handleSwitchUser = useCallback((userId: string) => { setCurrentUserId(userId); setTab('chat'); }, []);

  /* ─── shared content blocks ─── */

  const chatContent = activeChatUsers.size === 0 ? (
    <div className="flex-1 flex items-center justify-center text-soft-ink text-body-sm">{t('dashboard.no_users', lang)}</div>
  ) : (
    Array.from(activeChatUsers).map(uid => (
      <div key={uid} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', visibility: uid === currentUserId ? 'visible' : 'hidden', pointerEvents: uid === currentUserId ? 'auto' : 'none' }}>
        <ChatPage userId={uid} />
      </div>
    ))
  );

  /* ─── Desktop: 3-column InkOS layout ─── */
  const desktopView = (
    <div className="hidden md:flex w-full h-full">
      {/* LEFT — User list sidebar (320px) */}
      <aside className="w-[320px] shrink-0 bg-warm-white border-r border-mist flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <UserPage onSwitchUser={handleSwitchUser} />
        </div>
      </aside>

      {/* CENTER — Chat area (flex-1) */}
      <main className="flex-1 flex flex-col overflow-hidden bg-paper relative">
        {/* Desktop tab bar */}
        {tab === 'chat' && chatContent}
        {tab === 'settings' && (
          <div className="flex-1 overflow-auto">
            <SettingsPage onLogout={onLogout} />
          </div>
        )}
      </main>

      {/* RIGHT — AI Status panel (360px) */}
      <aside className="w-[360px] shrink-0 bg-warm-white border-l border-mist flex flex-col overflow-hidden">
        <AIPanel />
      </aside>
    </div>
  );

  /* ─── Mobile: Single column with bottom tabs ─── */
  const mobileView = (
    <div className="md:hidden flex flex-col w-full h-full">
      {/* Tab content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div style={{ display: tab === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {chatContent}
        </div>
        <div style={{ display: tab === 'user' ? 'flex' : 'none', flex: 1, overflow: 'auto', width: '100%', flexDirection: 'column' }}>
          <UserPage onSwitchUser={handleSwitchUser} />
        </div>
        <div style={{ display: tab === 'settings' ? 'flex' : 'none', flex: 1, overflow: 'auto', width: '100%', flexDirection: 'column' }}>
          <SettingsPage onLogout={onLogout} />
        </div>
      </div>

      {/* Bottom navigation — 56px */}
      <div className="flex items-center justify-around h-14 border-t border-mist bg-white shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map(tabItem => {
          const active = tab === tabItem.key;
          return (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
              className="flex flex-col items-center gap-0.5 px-4 py-1 border-none bg-transparent cursor-pointer relative">
              <tabItem.icon size={22} strokeWidth={active ? 2 : 1.5} className={active ? 'text-copper' : 'text-soft-ink'} />
              <span className={`text-tiny ${active ? 'font-medium text-copper' : 'font-normal text-soft-ink'}`}>{t(tabItem.labelKey, lang)}</span>
              {active && <div className="absolute -top-px w-6 h-0.5 rounded-b bg-copper" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <ThreeErrorBoundary><Suspense fallback={null}><MistScene /></Suspense></ThreeErrorBoundary>
      <div className="relative z-10 flex h-screen w-screen overflow-hidden bg-paper font-sans text-body-sm text-ink">
        {desktopView}
        {mobileView}
      </div>
      <Live2DWidget />
    </>
  );
}
