import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Search, Pin, MoreHorizontal, Plus, X } from 'lucide-react';

const API = '';

interface Memory {
  role: string;
  text: string;
  time: number;
  pinned?: boolean;
}

interface Props {
  onBack: () => void;
  currentUser?: string;
}

export default function MemoryManagePage({ onBack, currentUser }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'assistant'>('user');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const userId = currentUser || localStorage.getItem('inkos_affection_user') || 'default';

  const loadMemories = async () => {
    try {
      const r = await fetch(`${API}/api/memory?userId=${encodeURIComponent(userId)}`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setMemories(arr);
    } catch (e) {
      console.error('Load memories failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMemories(); }, [userId]);

  const addMemory = async () => {
    if (!newText.trim()) return;
    try {
      await fetch(`${API}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text: newText.trim(), role: newRole })
      });
      setNewText('');
      setShowAdd(false);
      await loadMemories();
    } catch (e) {
      console.error('Add memory failed:', e);
    }
  };

  const deleteMemory = async (index: number) => {
    try {
      await fetch(`${API}/api/memory/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, index })
      });
      await loadMemories();
    } catch (e) {
      console.error('Delete memory failed:', e);
    }
  };

  const clearAll = async () => {
    if (!confirm('确定清空所有记忆吗？')) return;
    try {
      await fetch(`${API}/api/memory/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      await loadMemories();
    } catch (e) {
      console.error('Clear memories failed:', e);
    }
  };

  const deleteSelected = async () => {
    const sorted = [...memories];
    if (!sortAsc) sorted.reverse();
    const indices = Array.from(selected).sort((a, b) => b - a);
    for (const idx of indices) {
      const realIdx = sortAsc ? idx : sorted.length - 1 - idx;
      await deleteMemory(realIdx);
    }
    setSelected(new Set());
    setSelectMode(false);
  };

  const togglePin = (index: number) => {
    setMemories(prev => prev.map((m, i) => i === index ? { ...m, pinned: !m.pinned } : m));
  };

  const filtered = memories.filter(m => !search || m.text.toLowerCase().includes(search.toLowerCase()));
  const displayed = sortAsc ? [...filtered] : [...filtered].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-ink-white flex items-center gap-3">
        <button onClick={onBack} className="text-ink-black hover:text-ink-gray transition-colors">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-semibold text-ink-black flex-1">记忆库管理</h1>
        <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
          className="text-sm text-ink-gray hover:text-ink-black transition-colors">
          {selectMode ? '取消' : '选择'}
        </button>
        <button onClick={() => setSortAsc(!sortAsc)}
          className="text-sm text-ink-gray hover:text-ink-black transition-colors">
          {sortAsc ? '正序' : '倒序'}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-ink-white/50">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索记忆..." className="w-full pl-9 pr-3 py-2 bg-ink-white/50 rounded-lg text-sm text-ink-black outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-gray"><X size={14} /></button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-ink-gray text-sm">加载中...</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm gap-2">
            <p>{search ? '没有匹配的记忆' : '还没有记忆'}</p>
            {!search && <button onClick={() => setShowAdd(true)} className="text-cinnabar text-sm">添加第一条记忆</button>}
          </div>
        ) : displayed.map((mem, i) => {
          const realIdx = sortAsc ? i : memories.length - 1 - i;
          const isSelected = selected.has(realIdx);
          return (
            <div key={i} className={`px-4 py-3 border-b border-ink-white/50 hover:bg-ink-white/30 transition-colors ${isSelected ? 'bg-cinnabar/10' : ''}`}>
              <div className="flex items-start gap-3">
                {selectMode && (
                  <input type="checkbox" checked={isSelected} onChange={() => {
                    const next = new Set(selected);
                    if (isSelected) next.delete(realIdx); else next.add(realIdx);
                    setSelected(next);
                  }} className="mt-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${mem.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {mem.role === 'user' ? '用户' : 'AI'}
                    </span>
                    {mem.pinned && <Pin size={12} className="text-cinnabar" />}
                    <span className="text-xs text-ink-gray">
                      {new Date(mem.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-ink-black whitespace-pre-wrap break-words">{mem.text}</p>
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => togglePin(i)} className="p-1 hover:bg-ink-white/50 rounded transition-colors" title={mem.pinned ? '取消置顶' : '置顶'}>
                      <Pin size={14} className={mem.pinned ? 'text-cinnabar' : 'text-ink-gray'} />
                    </button>
                    <button onClick={() => deleteMemory(realIdx)} className="p-1 hover:bg-red-50 rounded transition-colors" title="删除">
                      <Trash2 size={14} className="text-ink-gray hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-ink-white flex items-center gap-2">
        {selectMode ? (
          <>
            <button onClick={() => setSelected(new Set(displayed.map((_, i) => sortAsc ? i : memories.length - 1 - i)))}
              className="text-sm text-ink-gray px-3 py-1.5 rounded-lg bg-ink-white/50">全选</button>
            <button onClick={deleteSelected} className="text-sm text-red-500 px-3 py-1.5 rounded-lg bg-ink-white/50 ml-auto">删除 ({selected.size})</button>
          </>
        ) : (
          <>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm text-white px-4 py-2 rounded-lg bg-cinnabar hover:bg-cinnabar/90 transition-colors">
              <Plus size={16} /> 添加记忆
            </button>
            {memories.length > 0 && (
              <button onClick={clearAll} className="text-sm text-ink-gray px-3 py-1.5 rounded-lg bg-ink-white/50 ml-auto">清空</button>
            )}
          </>
        )}
      </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink-black mb-4">添加记忆</h2>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setNewRole('user')} className={`px-3 py-1.5 rounded-lg text-sm ${newRole === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-ink-white/50 text-ink-gray'}`}>用户说的</button>
              <button onClick={() => setNewRole('assistant')} className={`px-3 py-1.5 rounded-lg text-sm ${newRole === 'assistant' ? 'bg-green-100 text-green-700' : 'bg-ink-white/50 text-ink-gray'}`}>AI说的</button>
            </div>
            <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={4}
              placeholder="输入记忆内容..." className="w-full p-3 border border-ink-white/50 rounded-xl text-sm text-ink-black outline-none resize-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm text-ink-gray bg-ink-white/50">取消</button>
              <button onClick={addMemory} disabled={!newText.trim()} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-cinnabar disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
