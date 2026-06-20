import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component, type ReactNode } from 'react';
import { MessageCircle, Bell, User, Settings, Search, Plus, ArrowLeft, ChevronRight, LogOut, Clock, Heart, BookOpen, Users, Check, X, Edit3, Trash2, Download, Trash } from 'lucide-react';
import Lenis from 'lenis';
import ChatPage from './chat/ChatPage';
import SettingsPage from './chat/SettingsPage';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../lib/i18n';
import Live2DWidget from './Live2DWidget';
import { loadChatHistory, clearChatHistory, exportChatHistory, getTotalMessages } from '../lib/chatHistory';
import CharacterChat from './character/CharacterChat';

const MistScene = lazy(() => import('./ink/MistScene'));
class ThreeErrorBoundary extends Component<{children: ReactNode}, {error: boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? null : this.props.children; }
}

const API = '';
type Tab = 'home' | 'message' | 'profile' | 'settings';
type ProfilePage = 'main' | 'personas' | 'affection' | 'chatHistory' | 'character';
interface Props { onLogout: () => void }
const navItems = [
  { key: 'home' as Tab, icon: MessageCircle, labelKey: 'nav.home' },
  { key: 'message' as Tab, icon: Bell, labelKey: 'nav.message' },
  { key: 'profile' as Tab, icon: User, labelKey: 'nav.profile' },
  { key: 'settings' as Tab, icon: Settings, labelKey: 'nav.settings' },
];
interface Notif { id: string; text: string; time: string; read: boolean }

function getDaysOnline(): number {
  try {
    const key = 'inkos_first_login';
    const stored = localStorage.getItem(key);
    if (!stored) {
      localStorage.setItem(key, String(Date.now()));
      return 1;
    }
    return Math.max(1, Math.floor((Date.now() - Number(stored)) / 86400000) + 1);
  } catch { return 1; }
}

function getRelationshipStage(affection: number): string {
  if (affection >= 0.7) return 'lover';
  if (affection >= 0.5) return 'close_friend';
  if (affection >= 0.3) return 'friend';
  if (affection >= 0.1) return 'acquaintance';
  return 'stranger';
}

const stageLabels: Record<string, string> = {
  stranger: '陌生人', acquaintance: '相识', friend: '朋友', close_friend: '密友', lover: '恋人',
};

const stageColors: Record<string, string> = {
  stranger: 'text-gray-400', acquaintance: 'text-blue-400', friend: 'text-emerald-400',
  close_friend: 'text-amber-400', lover: 'text-rose-400',
};

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

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-gray transition-colors hover:bg-ink-white/50 active:bg-ink-white/80">
      <ArrowLeft size={20} strokeWidth={1.5} />
    </button>
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

function ProfilePanel({ email, userCount, totalMessages, daysOnline, onLogout, onOpenPage, onSwitchTab }: {
  email: string; userCount: number; totalMessages: number; daysOnline: number;
  onLogout: () => void; onOpenPage: (page: string) => void; onSwitchTab: () => void;
}) {
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
            <span className="text-xl font-bold text-ink-black">{totalMessages}</span>
            <span className="mt-1 text-xs text-ink-gray">{t('profile.messages', lang)}</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-warm-white p-4 shadow-paper-sm">
            <span className="text-xl font-bold text-cinnabar">{daysOnline}</span>
            <span className="mt-1 text-xs text-ink-gray">{t('profile.days_online', lang)}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto mt-4 px-4">
        <MenuSection items={[
          { icon: BookOpen, label: '角色卡', subtitle: t('profile.personas_desc', lang), onClick: () => onOpenPage('personas') },
          { icon: Heart, label: '好感度', subtitle: t('profile.affection_desc', lang), onClick: () => onOpenPage('affection') },
          { icon: Clock, label: '聊天记录', subtitle: t('profile.history_desc', lang), onClick: () => onOpenPage('chatHistory') },
          { icon: Heart, label: '老板娘', subtitle: 'AI 驱动 · 角色对话', onClick: () => onOpenPage('character') },
        ]} />
        <div className="mt-3"><MenuSection items={[
          { icon: Users, label: t('profile.contacts', lang), subtitle: `${userCount} ${t('profile.friends', lang)}`, onClick: onSwitchTab },
        ]} /></div>
        <div className="mt-3"><MenuSection items={[
          { icon: LogOut, label: t('settings.logout', lang), danger: true, onClick: onLogout },
        ]} /></div>
      </div>
    </div>
  );
}

function PersonaManagementPage({ onBack }: { onBack: () => void }) {
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [personas, setPersonas] = useState<any[]>([]);
  const [personaMap, setPersonaMap] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<string[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<any>({ name: '', personality: '', style: '', background: '', details: '', mes_example: '' });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const loadPersonas = useCallback(async () => {
    try { const r = await fetch(`${API}/api/personas`); const d = await r.json(); if (d.personas) setPersonas(d.personas); if (d.user_map) setPersonaMap(d.user_map); } catch {}
  }, []);
  const loadUsers = useCallback(async () => {
    try { const r = await fetch(`${API}/api/users`); const d = await r.json(); if (d.users) { const allUsers = [...d.users]; if (!allUsers.includes('character_boss')) allUsers.push('character_boss'); setUsers(allUsers); } } catch { setUsers(['character_boss']); }
  }, []);
  const loadSkills = useCallback(async () => {
    try { const r = await fetch(`${API}/api/skills`); const d = await r.json(); if (d.skills) { setAllSkills(d.skills); } } catch {}
  }, []);

  useEffect(() => { if (view !== 'list') return; loadPersonas(); loadUsers(); loadSkills(); }, [view, loadPersonas, loadUsers, loadSkills]);

  const startCreate = () => {
    setEditingPersona({ name: '', personality: '', style: '', background: '', details: '', mes_example: '' });
    setSelectedSkills(allSkills.map((s: any) => s.id));
    setView('edit');
  };
  const startEdit = (p: any) => {
    setEditingPersona(p);
    setSelectedSkills(p.skills && p.skills.length > 0 ? p.skills : allSkills.map((s: any) => s.id));
    setView('edit');
  };

  if (view === 'edit') {
    return (
      <div className="flex flex-col h-full bg-paper-white">
        <div className="flex-1 overflow-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-5">
            <BackBtn onClick={() => setView('list')} />
            <h1 className="text-lg font-semibold text-ink-black">{editingPersona.id ? '编辑角色卡' : '创建角色卡'}</h1>
          </div>
          <div className="rounded-2xl bg-ink-white p-4 shadow-paper-sm mb-4">
            <div className="grid grid-cols-1 gap-4">
              {[{ key: 'name', label: '名称' }, { key: 'personality', label: '性格' }, { key: 'style', label: '做事风格' }, { key: 'background', label: '背景故事' }].map(f => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-xs font-medium text-ink-gray">{f.label}</label>
                  <input value={(editingPersona as any)[f.key] || ''} onChange={e => setEditingPersona((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ink-black/30 focus:ring-2 focus:ring-ink-black/5" />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-gray">其他设定</label>
                <textarea value={editingPersona.details || ''} onChange={e => setEditingPersona((p: any) => ({ ...p, details: e.target.value }))} rows={3}
                  className="w-full resize-y rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ink-black/30 focus:ring-2 focus:ring-ink-black/5" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-gray">对话示例 (mes_example)</label>
                <textarea value={editingPersona.mes_example || ''} onChange={e => setEditingPersona((p: any) => ({ ...p, mes_example: e.target.value }))} rows={5}
                  placeholder={'示例格式：\n用户：今天好累\n你：抱抱~ 辛苦了，快去休息会儿\n\n用户：晚安\n你：晚安~ 做个好梦'}
                  className="w-full resize-y rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ink-black/30 focus:ring-2 focus:ring-ink-black/5" />
              </div>
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-xs font-medium text-ink-gray">绑定技能</label>
              <div className="grid grid-cols-1 gap-2">
                {allSkills.map(s => {
                  const isSelected = selectedSkills.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => setSelectedSkills(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors ${isSelected ? 'border border-ink-black/20 bg-ink-black/5' : 'border border-transparent bg-paper-white/50'}`}>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold ${isSelected ? 'bg-ink-black text-white' : 'border-2 border-ink-white text-transparent'}`}>{isSelected ? '✓' : ''}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-ink-black">{s.name}</div>
                        <div className="mt-0.5 text-[11px] text-ink-gray">{s.description}</div>
                      </div>
                    </div>
                  );
                })}
                {allSkills.length === 0 && <p className="text-xs text-ink-gray">加载中...</p>}
              </div>
            </div>
          </div>
          <button onClick={async () => {
            if (!editingPersona.name) { alert('请输入名称'); return; }
            await fetch(`${API}/api/personas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editingPersona, skills: selectedSkills }) });
            setView('list'); loadPersonas();
          }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-black px-4 py-3 text-sm font-medium text-white transition-all hover:brightness-105 active:brightness-95">
            <Check size={16} strokeWidth={2} /> 保存角色卡
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-paper-white">
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3"><BackBtn onClick={onBack} /><h1 className="text-lg font-semibold text-ink-black">角色卡 <span className="text-sm font-normal text-ink-gray">({personas.length})</span></h1></div>
          <button onClick={startCreate} className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-black text-white shadow-sm transition-all hover:brightness-105">+</button>
        </div>
        {personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen size={48} strokeWidth={1} className="text-ink-light/25" />
            <p className="mt-3 text-sm text-ink-gray">暂无角色卡</p>
            <p className="mt-1 text-xs text-ink-light/60">点击右上角 + 创建角色卡</p>
          </div>
        ) : (
          <div className="space-y-3">
            {personas.map(p => {
              const isExpanded = expandedPersona === p.id;
              const assignedUserId = Object.entries(personaMap).find(([, pid]) => pid === p.id)?.[0] || '';
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-3 rounded-2xl bg-ink-white p-3.5 shadow-paper-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-black text-sm font-semibold text-white">{p.name ? p.name[0].toUpperCase() : '?'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink-black">{p.name || '未命名'}</div>
                      <div className="mt-0.5 truncate text-xs text-ink-gray">{p.personality || p.background || '无描述'}</div>
                      {assignedUserId && <div className="mt-1 text-[11px] text-emerald-500">已分配给: {assignedUserId.slice(0, 12)}...</div>}
                      {p.skills && p.skills.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{p.skills.map((sid: string) => { const skill = allSkills.find((s: any) => s.id === sid); return skill ? <span key={sid} className="rounded bg-ink-black/10 px-1.5 py-0.5 text-[10px] font-medium text-ink-gray">{skill.name}</span> : null; })}</div>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => startEdit(p)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-black/10 text-ink-gray transition-colors hover:bg-ink-black/20"><Edit3 size={14} strokeWidth={1.5} /></button>
                      <button onClick={async () => { if (confirm(`删除角色卡「${p.name}」？`)) { await fetch(`${API}/api/personas/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }); loadPersonas(); } }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/8 text-red-500 transition-colors hover:bg-red-500/15"><Trash2 size={14} strokeWidth={1.5} /></button>
                      <button onClick={() => setExpandedPersona(isExpanded ? null : p.id)} className="flex h-8 items-center justify-center rounded-lg bg-ink-black/10 px-2 text-[11px] font-semibold text-ink-gray transition-colors hover:bg-ink-black/20">管理</button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-0 rounded-b-2xl border-t border-ink-white/30 bg-paper-white/80 p-3">
                      <div className="mb-2 text-xs font-medium text-ink-gray">选择要分配的用户：</div>
                      {users.length === 0 ? <div className="py-3 text-xs text-ink-gray">暂无用户</div> : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {users.map(uid => {
                            const isAssigned = personaMap[uid] === p.id;
                            return (
                              <div key={uid} onClick={async () => {
                                const newMap = { ...personaMap };
                                if (isAssigned) { delete newMap[uid]; } else {
                                  for (const u of Object.keys(newMap)) { if (newMap[u] === p.id) delete newMap[u]; }
                                  newMap[uid] = p.id;
                                }
                                await fetch(`${API}/api/personas/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid, persona_id: isAssigned ? '' : p.id }) });
                                setPersonaMap(newMap);
                              }} className={`flex cursor-pointer items-center gap-2.5 rounded-xl p-2.5 transition-colors ${isAssigned ? 'border border-ink-black/20 bg-ink-black/5' : 'border border-transparent bg-ink-white'}`}>
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-black text-[11px] font-semibold text-white">{uid === 'character_boss' ? '娘' : uid.slice(0, 2).toUpperCase()}</div>
                                <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-ink-black">{uid === 'character_boss' ? '老板娘 · AI驱动' : uid.slice(0, 14) + '...'}</div></div>
                                {isAssigned && <span className="shrink-0 rounded-full bg-ink-black/10 px-2 py-0.5 text-[10px] font-medium text-ink-gray">已分配</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AffectionControlPage({ onBack, users }: { onBack: () => void; users: string[] }) {
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  const [selectedUser, setSelectedUser] = useState('');
  const [currentAffection, setCurrentAffection] = useState<number | null>(null);
  const [affectionInput, setAffectionInput] = useState(50);
  const [affectionSaved, setAffectionSaved] = useState(false);

  useEffect(() => {
    if (!selectedUser) return;
    setCurrentAffection(null);
    fetch(`${API}/api/emotion/get?userId=${encodeURIComponent(selectedUser)}`)
      .then(r => r.json()).then(d => {
        if (d.success && d.emotion) {
          const aff = d.emotion.affection;
          setCurrentAffection(aff);
          setAffectionInput(Math.round(aff * 100));
        }
      }).catch(() => {});
  }, [selectedUser]);

  return (
    <div className="flex flex-col h-full bg-paper-white">
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <BackBtn onClick={onBack} />
          <h1 className="text-lg font-semibold text-ink-black">好感度</h1>
        </div>
        <div className="rounded-2xl bg-ink-white p-4 shadow-paper-sm mb-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-gray">选择用户</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            className="w-full appearance-none rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-sm text-ink-black outline-none transition-colors focus:border-ink-black/30">
            <option value="">-- 请选择 --</option>
            {users.map(uid => <option key={uid} value={uid}>{uid === 'character_boss' ? '老板娘' : uid.slice(0, 16) + '...'}</option>)}
          </select>
        </div>
        {selectedUser && (
          <div className="rounded-2xl bg-ink-white p-4 shadow-paper-sm">
            {currentAffection !== null ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-gray">当前好感度: <strong className="text-sm text-ink-black">{Math.round(currentAffection * 100)}%</strong></span>
                  <span className={`text-[11px] font-medium ${stageColors[getRelationshipStage(currentAffection)] || 'text-gray-400'}`}>{stageLabels[getRelationshipStage(currentAffection)] || '未知'}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-white mb-4">
                  <div className="h-full rounded-full bg-ink-black transition-all duration-500" style={{ width: `${Math.round(currentAffection * 100)}%` }} />
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-light/60 mb-4">加载中...</p>
            )}
            <div className="flex items-center gap-3">
              <input type="number" min={0} max={100} value={affectionInput}
                onChange={e => setAffectionInput(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                className="w-20 rounded-lg border border-ink-white/60 bg-paper-white px-3 py-2.5 text-center text-sm text-ink-black outline-none transition-colors focus:border-ink-black/30 focus:ring-2 focus:ring-ink-black/5" />
              <span className="text-xs text-ink-gray">%</span>
              <button onClick={async () => {
                try {
                  const r = await fetch(`${API}/api/emotion/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUser, affection: affectionInput / 100 }) });
                  if (r.ok) { setCurrentAffection(affectionInput / 100); setAffectionSaved(true); setTimeout(() => setAffectionSaved(false), 2000); }
                } catch {}
              }} className={`ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium text-white transition-all ${affectionSaved ? 'bg-emerald-500' : 'bg-ink-black hover:brightness-105'}`}>
                {affectionSaved ? <><Check size={14} strokeWidth={2.5} /> 已保存</> : '确定'}
              </button>
            </div>
            <input type="range" min={0} max={100} value={affectionInput}
              onChange={e => setAffectionInput(parseInt(e.target.value))}
              className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-black [&::-webkit-slider-thumb]:shadow-sm" />
            <div className="mt-1 flex justify-between text-[10px] text-ink-light/50">
              <span>陌生人</span><span>相识</span><span>朋友</span><span>密友</span><span>恋人</span>
            </div>
          </div>
        )}
        {!selectedUser && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart size={48} strokeWidth={1} className="text-ink-light/25" />
            <p className="mt-3 text-sm text-ink-gray">暂无可用用户</p>
            <p className="mt-1 text-xs text-ink-light/60">请先在聊天页面添加好友</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatHistoryPage({ onBack }: { onBack: () => void }) {
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  const [history, setHistory] = useState<Record<string, any>>({});
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  const refresh = useCallback(() => setHistory(loadChatHistory()), []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleExport = (userId?: string) => {
    const text = exportChatHistory(userId);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${userId || 'all'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = (userId?: string) => {
    const msg = userId ? `确认清除 ${userId.slice(0, 16)}... 的聊天记录？` : '确认清除所有聊天记录？';
    if (!confirm(msg)) return;
    clearChatHistory(userId);
    if (userId && viewingUser === userId) setViewingUser(null);
    refresh();
  };

  // Message detail view
  if (viewingUser && history[viewingUser]) {
    const record = history[viewingUser];
    return (
      <div className="flex flex-col h-full bg-paper-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-white shrink-0 bg-warm-white">
          <BackBtn onClick={() => setViewingUser(null)} />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-ink-black truncate">{viewingUser.slice(0, 16)}...</h1>
            <p className="text-[11px] text-ink-light">{record.messages.length} 条消息</p>
          </div>
          <button onClick={() => handleExport(viewingUser)} className="flex items-center gap-1 rounded-lg bg-ink-black/10 px-2.5 py-1.5 text-xs text-ink-gray transition-colors hover:bg-ink-black/20"><Download size={14} strokeWidth={1.5} /> 导出</button>
          <button onClick={() => handleClear(viewingUser)} className="flex items-center gap-1 rounded-lg bg-red-500/8 px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/15"><Trash size={14} strokeWidth={1.5} /> 清除</button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4">
          {record.messages.map((m: any, i: number) => (
            <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-ink-white text-ink-black rounded-bl-md' : 'bg-ink-black text-white rounded-br-md'}`}>
                <div className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-ink-light' : 'text-white/50'}`}>{new Date(m.time).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const entries = Object.entries(history);
  return (
    <div className="flex flex-col h-full bg-paper-white">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-ink-white shrink-0">
        <BackBtn onClick={onBack} />
        <h1 className="flex-1 text-lg font-semibold text-ink-black">聊天记录</h1>
        {entries.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => handleExport()} className="flex items-center gap-1 rounded-lg bg-ink-black/10 px-2.5 py-1.5 text-xs text-ink-gray transition-colors hover:bg-ink-black/20"><Download size={14} strokeWidth={1.5} /> 导出全部</button>
            <button onClick={() => handleClear()} className="flex items-center gap-1 rounded-lg bg-red-500/8 px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/15"><Trash size={14} strokeWidth={1.5} /> 清空</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm">
            <Clock size={40} strokeWidth={1} className="text-ink-light/30" />
            <p className="mt-3">暂无聊天记录</p>
          </div>
        ) : (
          entries
            .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .map(([userId, record]) => (
              <div key={userId} onClick={() => setViewingUser(userId)}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-paper-white/50 transition-colors border-b border-ink-white/30">
                <div className="w-10 h-10 rounded-full bg-ink-white flex items-center justify-center text-ink-black text-sm font-semibold shrink-0">{userId.slice(0, 2).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-black truncate">{userId.slice(0, 16)}...</div>
                  <div className="text-xs text-ink-light mt-0.5">
                    {record.messages.length} 条消息 · 最后 {new Date(record.updatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN')}
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-light/30" />
              </div>
            ))
        )}
      </div>
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
  const [profilePage, setProfilePage] = useState<ProfilePage>('main');
  const [totalMessages, setTotalMessages] = useState(0);
  const [daysOnline, setDaysOnline] = useState(1);
  const settingsCtx = useSettings();
  const lang = settingsCtx?.lang || 'zh-CN';
  const [email, setEmail] = useState('');
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem('aperture_session') || '{}'); if (s.email) setEmail(s.email); } catch {} }, []);

  useEffect(() => {
    setTotalMessages(getTotalMessages());
    setDaysOnline(getDaysOnline());
  }, []);

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

  const handleOpenProfilePage = (page: string) => {
    if (page === 'contacts') { setTab('home'); setProfilePage('main'); }
    else { setProfilePage(page as ProfilePage); }
  };

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
            <div className="w-12 h-12 rounded-full bg-ink-white flex items-center justify-center text-ink-black text-sm font-semibold shrink-0">{uid === 'character_boss' ? '娘' : uid.slice(0, 2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-black">{uid === 'character_boss' ? '老板娘' : uid.slice(0, 10) + '...'}</div>
              <div className="text-xs text-ink-light mt-0.5 truncate">{uid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const profileContent = (() => {
    if (profilePage === 'personas') return <PersonaManagementPage onBack={() => setProfilePage('main')} />;
    if (profilePage === 'affection') return <AffectionControlPage onBack={() => setProfilePage('main')} users={Array.from(activeChatUsers)} />;
    if (profilePage === 'chatHistory') return <ChatHistoryPage onBack={() => setProfilePage('main')} />;
    if (profilePage === 'character') return <CharacterChat onBack={() => setProfilePage('main')} />;
    return <ProfilePanel email={email} userCount={activeChatUsers.size} totalMessages={totalMessages} daysOnline={daysOnline}
      onLogout={onLogout} onOpenPage={handleOpenProfilePage} onSwitchTab={() => { setTab('home'); setProfilePage('main'); }} />;
  })();

  return (
    <>
      <ThreeErrorBoundary><Suspense fallback={null}><MistScene /></Suspense></ThreeErrorBoundary>
      <div className="relative z-10 flex justify-center w-screen h-screen overflow-hidden bg-paper-white font-sans text-ink-black">
        <div className="flex flex-col w-full max-w-[420px] h-full bg-warm-white shadow-paper-lg relative overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0" style={{ display: tab === 'home' ? 'block' : 'none' }}>{homeContent}</div>
            <div className="absolute inset-0" style={{ display: tab === 'message' ? 'block' : 'none' }}><MessagesPanel notifications={notifications} lang={lang} /></div>
            <div className="absolute inset-0" style={{ display: tab === 'profile' ? 'block' : 'none' }}>{profileContent}</div>
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
