import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, Trash2, Check, RefreshCw } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { t } from '../../lib/i18n';

const API = '';

interface Props { onSwitchUser?: (userId: string) => void }

export default function UserPage({ onSwitchUser }: Props) {
  const settingsCtx = useSettings();
  const resolvedTheme = settingsCtx?.resolvedTheme || 'light';
  const lang = settingsCtx?.lang || 'zh-CN';
  const isDark = resolvedTheme === 'dark';
  const [users, setUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrImg, setQrImg] = useState('');
  const [qrStatus, setQrStatus] = useState('idle');
  const [loaded, setLoaded] = useState(0);

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/users`);
      const d = await r.json();
      if (d.users) setUsers(d.users);
      if (d.current_user) setCurrentUser(d.current_user);
    } catch {}
  }, []);

  useEffect(() => { loadUsers(); const t = setInterval(loadUsers, 3000); return () => clearInterval(t); }, [loadUsers]);
  useEffect(() => { loadUsers(); }, [loaded, loadUsers]);

  const switchUser = useCallback(async (id: string) => {
    try { await fetch(`${API}/api/switch-user`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id: id}) }); setCurrentUser(id); loadUsers(); onSwitchUser?.(id); } catch {}
  }, [loadUsers, onSwitchUser]);

  const deleteUser = useCallback(async (id: string) => {
    if (!confirm(`确认删除 ${id.slice(0,8)}... 吗？`)) return;
    try { await fetch(`${API}/api/delete-user`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id: id}) }); loadUsers(); } catch {}
  }, [loadUsers]);

  const handleAddFriend = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/add-friend-qrcode`);
      const d = await r.json();
      if (d.success && d.qrcode_image) {
        setQrImg(`data:image/png;base64,${d.qrcode_image}`);
        setQrStatus('waiting'); setShowQr(true);
        const t = setInterval(async () => {
          try {
            const s = await fetch(`${API}/api/add-friend-poll`);
            const sd = await s.json();
            if (sd.status === 'confirmed' || sd.user_id) { setQrStatus('confirmed'); clearInterval(t); loadUsers(); setTimeout(() => { setShowQr(false); setQrStatus('idle'); }, 1500); }
            if (sd.status === 'expired') { setQrStatus('expired'); clearInterval(t); }
          } catch {}
        }, 2000);
      }
    } catch {}
  }, [loadUsers]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background: isDark ? '#1a1a2e' : '#F7F3EE' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 8px' }}>
        <h2 style={{ fontSize:18, fontWeight:600, color: isDark ? '#e0e0e0' : '#3E2723' }}>
          {t('user.title', lang)} <span style={{ fontSize:13, fontWeight:400, color: isDark ? '#a0a0b0' : '#8D6E63' }}>({users.length})</span>
        </h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setLoaded(n => n+1)}
            style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:12, border:'none', background:'rgba(200,159,126,0.12)', color:'#C89F7E', cursor:'pointer' }}>
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button onClick={handleAddFriend}
            style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:12, border:'none', background:'linear-gradient(135deg,#C89F7E,#B08968)', color:'white', cursor:'pointer', boxShadow:'0 2px 8px rgba(200,159,126,0.3)' }}>
            <Plus size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'8px 16px' }}>
        {users.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', textAlign:'center', padding:'0 32px' }}>
            <Users size={40} strokeWidth={1} color="#8D6E6340" />
            <p style={{ marginTop:12, fontSize:15, fontWeight:500, color: isDark ? '#a0a0b0' : '#8D6E63' }}>{t('user.empty', lang)}</p>
            <p style={{ marginTop:4, fontSize:13, color: isDark ? '#a0a0b080' : '#8D6E6380', lineHeight:1.6 }}>
              {t('user.empty_desc', lang)}
            </p>
          </div>
        ) : users.map((uid) => {
          const isActive = uid === currentUser;
          return (
            <div key={uid}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:8, borderRadius:14, cursor:'pointer', transition:'all 0.15s', background: isActive ? (isDark ? '#252540' : 'white') : 'transparent', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.06)' : 'none' }}
              onClick={() => switchUser(uid)}>
              <div style={{ width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16, fontWeight:600, background:'linear-gradient(135deg,#C89F7E,#B08968)', flexShrink:0 }}>
                {uid.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:600, color: isDark ? '#e0e0e0' : '#3E2723' }}>{uid.slice(0,8)}...</span>
                  {isActive && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:999, background:'rgba(16,185,129,0.12)', color:'#10b981', fontWeight:500 }}>{t('user.chatting', lang)}</span>}
                </div>
                <span style={{ fontSize:12, color: isDark ? '#a0a0b0' : '#8D6E63', wordBreak:'break-all' }}>{uid}</span>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteUser(uid); }}
                style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10, border:'none', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', opacity:0.6, flexShrink:0 }}>
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>

      {showQr && (
        <div style={{ position:'fixed', inset:0, zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }}
          onClick={() => { setShowQr(false); setQrStatus('idle'); }}>
          <div style={{ background:'white', borderRadius:24, padding:'32px 28px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.15)', maxWidth:320, position:'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowQr(false); setQrStatus('idle'); }}
              style={{ position:'absolute', top:12, right:12, border:'none', background:'none', cursor:'pointer', padding:4, color:'#8D6E63' }}>
              <X size={18} strokeWidth={1.5} />
            </button>
            <h3 style={{ fontSize:16, fontWeight:600, color:'#3E2723', marginBottom:4 }}>
              {qrStatus === 'confirmed' ? `✅ ${t('chat.added', lang)}` : t('chat.add_friend', lang)}
            </h3>
            <p style={{ fontSize:12, color:'#8D6E63', marginBottom:20, lineHeight:1.6 }}>
              {qrStatus === 'confirmed' ? t('user.added_toast', lang) : t('chat.add_friend_desc', lang)}
            </p>
            {qrStatus === 'confirmed' ? (
              <div style={{ width:200, height:200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(16,185,129,0.1)', borderRadius:16 }}>
                <Check size={48} color="#10b981" />
              </div>
            ) : (
              <img src={qrImg} alt="添加好友" style={{ width:200, height:200, margin:'0 auto', display:'block', borderRadius:8 }} />
            )}
            <button onClick={() => { setShowQr(false); setQrStatus('idle'); }}
              style={{ marginTop:16, padding:'8px 24px', borderRadius:12, border:'none', background:'#F7F3EE', color:'#8D6E63', fontSize:13, cursor:'pointer' }}>
              {t('common.close', lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
