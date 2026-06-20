import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { saveMessage, loadChatHistory } from '../../lib/chatHistory';

const API = '';
const CHAR_USER_ID = 'character_boss';

interface Props { onBack: () => void }

export default function CharacterChat({ onBack }: Props) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; time: number }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = loadChatHistory();
    const saved = history[CHAR_USER_ID];
    if (saved) setMessages(saved.messages.slice(-50));
  }, []);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, time: Date.now() }]);
    saveMessage(CHAR_USER_ID, 'user', text);
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/character/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const d = await r.json();
      const reply = d.reply || '...';
      setMessages(prev => [...prev, { role: 'ai', text: reply, time: Date.now() }]);
      saveMessage(CHAR_USER_ID, 'ai', reply);
    } catch { setMessages(prev => [...prev, { role: 'ai', text: '嗯？我没听清，能再说一遍吗~', time: Date.now() }]); }
    setLoading(false);
  }, [input, loading]);

  return (
    <div className="flex flex-col h-full bg-warm-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-white shrink-0 bg-warm-white">
        <button onClick={onBack} className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-gray hover:bg-paper-white"><ArrowLeft size={20} strokeWidth={1.5} /></button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-sm">娘</div>
          <div><div className="text-sm font-medium text-ink-black">老板娘</div><div className="text-[11px] text-ink-green">在线 · AI 驱动</div></div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3 bg-paper-white">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-gray text-sm">
            <div className="w-16 h-16 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-2xl mb-4">娘</div>
            <p className="font-medium text-ink-black">老板娘</p>
            <p className="text-xs text-ink-light mt-1">你好呀~有什么想聊的吗？</p>
          </div>
        ) : messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'ai' && <div className="w-7 h-7 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-[10px] shrink-0 mb-1">娘</div>}
            <div className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed rounded-lg ${msg.role === 'user' ? 'bg-ink-black text-warm-white rounded-br-[4px]' : 'bg-warm-white text-ink-black shadow-paper-sm rounded-bl-[4px]'}`}>
              {msg.text}
              <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-warm-white/50' : 'text-ink-light/60'}`}>{new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            {msg.role === 'user' && <div className="w-7 h-7 rounded-full bg-ink-dark flex items-center justify-center text-warm-white text-[10px] shrink-0 mb-1">我</div>}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-ink-black flex items-center justify-center text-warm-white text-[10px] shrink-0 mb-1">娘</div>
            <div className="bg-warm-white shadow-paper-sm rounded-lg rounded-bl-[4px] px-4 py-3 flex gap-1.5">
              {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-ink-black/40 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-ink-white bg-warm-white">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="给老板娘发消息..." disabled={loading}
          className="flex-1 bg-paper-white border-none rounded-[20px] px-4 py-2.5 text-sm text-ink-black outline-none placeholder:text-ink-light/60 disabled:opacity-50" />
        <button onClick={handleSend} disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-full bg-ink-black flex items-center justify-center text-warm-white disabled:opacity-30 shrink-0"><Send size={16} strokeWidth={1.5} /></button>
      </div>
    </div>
  );
}
