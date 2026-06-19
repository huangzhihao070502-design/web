import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, User, Settings } from 'lucide-react';
import ChatPage from './chat/ChatPage';
import UserPage from './chat/UserPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';
import Live2DWidget from './Live2DWidget';

const API = '';

type Tab = 'chat' | 'user' | 'settings';
interface Props { onLogout: () => void }

const tabs = [
  { key: 'chat' as Tab, icon: MessageCircle, labelKey: 'nav.chat' },
  { key: 'user' as Tab, icon: User, labelKey: 'nav.user' },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' },
];

export default function Dashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<Set<string>>(new Set());
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_font_size: 'normal', general_language: 'zh-CN', general_theme: 'auto' };
  const lang = settingsCtx?.lang || 'zh-CN';

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

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#F6F6F6',fontFamily:'"Noto Sans SC", system-ui, sans-serif',fontSize:14}}>
      <div style={{width:'100%',maxWidth:430,height:'100%',maxHeight:'100vh',background:'#F6F6F6',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 25px 50px rgba(0,0,0,0.1)'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:tab==='chat'?'flex':'none',flex:1,flexDirection:'column',overflow:'hidden',position:'relative'}}>
            {activeChatUsers.size === 0 ? (
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#B1BQB8',fontSize:14}}>{t('dashboard.no_users', lang)}</div>
            ) : Array.from(activeChatUsers).map(uid => (
              <div key={uid} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',overflow:'hidden',visibility:uid===currentUserId?'visible':'hidden',pointerEvents:uid===currentUserId?'auto':'none'}}>
                <ChatPage userId={uid}/></div>
            ))}
          </div>
          <div style={{display:tab==='user'?'flex':'none',flex:1,overflow:'auto',width:'100%',flexDirection:'column'}}>
            <UserPage onSwitchUser={handleSwitchUser}/></div>
          <div style={{display:tab==='settings'?'flex':'none',flex:1,overflow:'auto',width:'100%',flexDirection:'column'}}>
            <SettingsPage onLogout={onLogout}/></div>
        </div>

        {/* Bottom nav — 56px, white bg, per spec */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-around',height:56,borderTop:'1px solid rgba(0,0,0,0.06)',background:'#FFFFFF',flexShrink:0,paddingBottom:'env(safe-area-inset-bottom, 0px)'}}>
          {tabs.map(tabItem => {
            const active = tab === tabItem.key;
            return (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'4px 16px',border:'none',background:'none',cursor:'pointer',position:'relative'}}>
                <tabItem.icon size={22} strokeWidth={active?2:1.5} color={active?'#747CBB':'#B1BQB8'}/>
                <span style={{fontSize:12,fontWeight:active?500:400,color:active?'#747CBB':'#B1BQB8'}}>{t(tabItem.labelKey, lang)}</span>
                {active && <div style={{position:'absolute',top:-1,width:24,height:3,borderRadius:'0 0 3px 3px',background:'#747CBB'}}/>}
              </button>);
          })}
        </div>
      </div>
      <Live2DWidget/>
    </div>
  );
}
