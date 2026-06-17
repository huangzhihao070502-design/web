import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, User, Settings } from 'lucide-react';
import ChatPage from './chat/ChatPage';
import UserPage from './chat/UserPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';

const API = '';

type Tab = 'chat' | 'user' | 'settings';
interface Props { onLogout: () => void }

const tabs = [
  { key: 'chat' as Tab, icon: MessageCircle, labelKey: 'nav.chat' },
  { key: 'user' as Tab, icon: User, labelKey: 'nav.user' },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' },
];

const fontSizeMap: Record<string, number> = { small: 13, normal: 14, large: 16 };

function getThemeColors(theme: string) {
  const dark = theme === 'dark';
  return {
    outerBg: dark ? '#12122a' : '#E8E0D8',
    bg: dark ? '#1a1a2e' : '#F7F3EE',
    surface: dark ? '#252540' : '#ffffff',
    text: dark ? '#e0e0e0' : '#3E2723',
    textSec: dark ? '#a0a0b0' : '#8D6E63',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(234,224,213,0.6)',
    accent: '#C89F7E',
    accentActive: '#B08968',
    tabBg: dark ? '#252540' : 'white',
  };
}

export default function Dashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<Set<string>>(new Set());
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', general_language: 'zh-CN', general_theme: 'auto' };
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const lang = settingsCtx?.lang || 'zh-CN';
  const c = getThemeColors(resolvedTheme);
  const baseFontSize = fontSizeMap[settings.general_font_size] || 14;

  // 轮询获取用户列表和当前选中用户
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/users`);
        const d = await r.json();
        // 函数式更新避免闭包陷阱
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
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // 用户切换：立即更新 currentUserId（不等轮询）
  const handleSwitchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    setTab('chat');
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.outerBg, fontFamily: 'Inter, system-ui, sans-serif', fontSize: baseFontSize,
    }}>
      <div style={{
        width: '100%', maxWidth: 430, height: '100%', maxHeight: '100vh',
        background: c.bg, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            display: tab === 'chat' ? 'flex' : 'none', flex: 1,
            flexDirection: 'column', overflow: 'hidden', position: 'relative',
          }}>
            {activeChatUsers.size === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSec, fontSize: baseFontSize }}>
                {t('dashboard.no_users', lang)}
              </div>
            ) : Array.from(activeChatUsers).map(uid => (
              <div key={uid} style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                visibility: uid === currentUserId ? 'visible' : 'hidden',
                pointerEvents: uid === currentUserId ? 'auto' : 'none',
              }}>
                <ChatPage userId={uid} />
              </div>
            ))}
          </div>

          <div style={{
            display: tab === 'user' ? 'flex' : 'none', flex: 1,
            overflow: 'auto', width: '100%', flexDirection: 'column',
          }}>
            <UserPage onSwitchUser={handleSwitchUser} />
          </div>

          <div style={{
            display: tab === 'settings' ? 'flex' : 'none', flex: 1,
            overflow: 'auto', width: '100%', flexDirection: 'column',
          }}>
            <SettingsPage onLogout={onLogout} />
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          borderTop: `1px solid ${c.border}`, background: c.surface,
          padding: '8px 8px calc(env(safe-area-inset-bottom, 8px))', flexShrink: 0,
        }}>
          {tabs.map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 2, padding: '4px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                <tabItem.icon size={22} strokeWidth={active ? 2 : 1.5} color={active ? c.accentActive : c.textSec + '80'} />
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? c.accentActive : c.textSec + '80' }}>{t(tabItem.labelKey, lang)}</span>
                {active && <div style={{
                  position: 'absolute', top: -8, height: 3, width: 32, borderRadius: 2,
                  background: `linear-gradient(135deg, ${c.accent}, ${c.accentActive})`,
                }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
