import React, { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Bell, Lock, Sliders, Info, LogOut, ChevronRight, ArrowLeft, AlertTriangle, MessageSquare, Check, Loader, Edit3, Trash2, BookOpen, Volume2, Monitor, Eye, EyeOff, Trash, Download, Upload, Globe, Smartphone, ShieldCheck, Clock, FileText, Zap, Heart, Wifi } from "lucide-react";
import { useSettings } from "../../contexts/SettingsContext";
import { animate } from 'animejs';
import { t, Lang } from "../../lib/i18n";
import { loadCompanionConfig, saveCompanionConfig, resetCompanionConfig, type CompanionConfig } from "../../lib/companionConfig";

interface Props { onLogout: () => void }

const API = "";

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-gray transition-colors hover:bg-ink-white/50 active:bg-ink-white/80">
      <ArrowLeft size={20} strokeWidth={1.5} />
    </button>
  );
}

function PageHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <BackButton onClick={onBack} />
      <h1 className="text-h3 text-ink-black flex-1">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-ink-white p-4 shadow-paper-sm ${className}`}>{children}</div>;
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${enabled ? "bg-ink-black" : "bg-ink-white"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-ink-sm transition-transform duration-200 ${enabled ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-tiny font-medium text-ink-gray">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-body-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ochre/50 focus:ring-2 focus:ring-ochre/10 sm:px-4 sm:py-3" />
    </div>
  );
}

function FormTextarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="mb-1.5 block text-tiny font-medium text-ink-gray">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full resize-y rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-body-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ochre/50 focus:ring-2 focus:ring-ochre/10 sm:px-4 sm:py-3" />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-tiny font-medium text-ink-gray">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-body-sm text-ink-black outline-none transition-colors focus:border-ochre/50 focus:ring-2 focus:ring-ochre/10 sm:px-4 sm:py-3">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SettingRow({ icon: Icon, label, onClick, badge, trailing }: { icon: any; label: string; onClick?: () => void; badge?: string | number; trailing?: React.ReactNode }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${onClick ? "cursor-pointer hover:bg-paper-white/60" : ""}`}>
      <Icon size={20} strokeWidth={1.5} className="shrink-0 text-ink-gray" />
      <span className="flex-1 text-body-sm font-medium text-ink-black">{label}</span>
      {badge !== undefined && <span className="rounded-full bg-ochre/10 px-2 py-0.5 text-tiny font-medium text-ochre">{badge}</span>}
      {trailing ?? <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-light/40" />}
    </div>
  );
}

function getRelationshipStage(affection: number): string {
  if (affection >= 0.7) return 'lover';
  if (affection >= 0.5) return 'close_friend';
  if (affection >= 0.3) return 'friend';
  if (affection >= 0.1) return 'acquaintance';
  return 'stranger';
}

export default function SettingsPage({ onLogout }: Props) {
  const [email, setEmail] = useState("");
  const [page, setPage] = useState<"main" | "account" | "ai" | "personas" | "personaEdit" | "logs" | "features" | "notifications" | "privacy" | "general" | "about" | "ip" | "companion">("main");
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || { general_language: 'zh-CN', general_theme: 'auto', general_font_size: 'normal', features: {} };
  const lang = settingsCtx?.lang || 'zh-CN';
  const updateSettings = settingsCtx?.updateSettings || (() => {});
  const toggleFeature = settingsCtx?.toggleFeature || (() => {});
  const [featureList, setFeatureList] = useState<any[]>([]);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [personaMap, setPersonaMap] = useState<Record<string, string>>({});
  const [editingPersona, setEditingPersona] = useState<any>({ name: "", personality: "", style: "", background: "", details: "", mes_example: "" });
  const [affectionValue, setAffectionValue] = useState(50);
  const [currentAffection, setCurrentAffection] = useState<number | null>(null);
  const [affectionSaved, setAffectionSaved] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [prevAffection, setPrevAffection] = useState(0);
  useEffect(() => {
    if (currentAffection === null) return;
    const pct = Math.round(currentAffection * 100);
    if (progressBarRef.current) {
      animate(progressBarRef.current, { width: `${pct}%`, duration: 600, easing: 'easeOutElastic' });
    }
    setPrevAffection(pct);
  }, [currentAffection]);
  const [users, setUsers] = useState<string[]>([]);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "ERROR">("all");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [aiCfg, setAiCfg] = useState({ enabled: false, api_url: "", api_key: "", model: "", prompt: "", scheduled_reply: false, active_interval: 60, max_replies: 2, reply_min_chars: 0, reply_max_chars: 0, token_limit: 0, memory_enabled: false });
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [ipRecords, setIpRecords] = useState<any[]>([]);
  const [ipStats, setIpStats] = useState({ total: 0, online: 0, banned: 0, recent: 0 });
  const [ipSearch, setIpSearch] = useState("");
  const [ipFilter, setIpFilter] = useState<"all" | "normal" | "banned">("all");
  const [companionCfg, setCompanionCfg] = useState<CompanionConfig>(loadCompanionConfig());
  const [companionSaved, setCompanionSaved] = useState(false);
  const [companionTesting, setCompanionTesting] = useState(false);
  const [companionTestResult, setCompanionTestResult] = useState<string | null>(null);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);

  const loadLogs = useCallback(async () => { try { const r = await fetch(`${API}/api/logs`); const d = await r.json(); setLogs(Array.isArray(d) ? d : []); } catch {} }, []);
  useEffect(() => { if (page === "logs") { loadLogs(); const t = setInterval(loadLogs, 3000); return () => clearInterval(t); } }, [page, loadLogs]);
  useEffect(() => { try { const s = localStorage.getItem("aperture_session"); if (s) { const d = JSON.parse(s); if (d.email) setEmail(d.email); } } catch {} }, []);
  const loadPersonas = useCallback(async () => { try { const r = await fetch(`${API}/api/personas`); const d = await r.json(); if (d.personas) setPersonas(d.personas); if (d.user_map) setPersonaMap(d.user_map); } catch {} }, []);
  useEffect(() => { if (page === "personas") { loadPersonas(); fetch(`${API}/api/users`).then(r => r.json()).then(d => { if (d.users) setUsers(d.users); }).catch(() => {}); fetch(`${API}/api/skills`).then(r => r.json()).then(d => { if (d.skills) setAllSkills(d.skills); }).catch(() => {}); } }, [page, loadPersonas]);
  useEffect(() => { if (page !== "personaEdit") return; setAffectionSaved(false); fetch(`${API}/api/skills`).then(r => r.json()).then(d => { if (d.skills) { setAllSkills(d.skills); setSelectedSkills(editingPersona.id && editingPersona.skills?.length > 0 ? editingPersona.skills : d.skills.map((s: any) => s.id)); } }).catch(() => {}); const uid = Object.entries(personaMap).find(([, pid]) => pid === editingPersona.id)?.[0] || ""; if (uid) { fetch(`${API}/api/emotion/get?userId=${encodeURIComponent(uid)}`).then(r => r.json()).then(d => { if (d.success && d.emotion) { const aff = Math.round(d.emotion.affection * 100); setAffectionValue(aff); setCurrentAffection(d.emotion.affection); } }).catch(() => {}); } }, [page]);

  if (page === "companion") {
    const handleSaveCompanion = () => {
      saveCompanionConfig(companionCfg);
      setCompanionSaved(true);
      setTimeout(() => setCompanionSaved(false), 2000);
    };
    const handleTestCompanion = async () => {
      if (!companionCfg.ai_api_url || !companionCfg.ai_api_key) { setCompanionTestResult("请先填写 API 地址和密钥"); return; }
      setCompanionTesting(true); setCompanionTestResult(null);
      try {
        const r = await fetch(`${companionCfg.ai_api_url}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${companionCfg.ai_api_key}` },
          body: JSON.stringify({ model: companionCfg.ai_model, messages: [{ role: "user", content: "你好" }], max_tokens: 50 })
        });
        const d = await r.json();
        if (d.choices?.[0]?.message?.content) { setCompanionTestResult(`连接成功！回复：${d.choices[0].message.content}`); }
        else { setCompanionTestResult(`失败：${d.error?.message || JSON.stringify(d)}`); }
      } catch (e: any) { setCompanionTestResult(`连接失败：${e.message}`); }
      setCompanionTesting(false);
    };
    const handleTestTts = () => { try {
      const u = new SpeechSynthesisUtterance("你好呀，我是你的 AI 伴侣~");
      u.lang = companionCfg.voice_language; u.rate = companionCfg.tts_rate; u.pitch = companionCfg.tts_pitch; u.volume = companionCfg.tts_volume;
      if (companionCfg.tts_voice) { const v = ttsVoices.find(v => v.name === companionCfg.tts_voice); if (v) u.voice = v; }
      speechSynthesis.speak(u); } catch(e) { setCompanionTestResult("TTS 不可用: " + (e.message || e)); }
    };
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title="AI 伴侣配置" onBack={() => setPage("main")} />

          {/* AI 接口 */}
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black flex items-center gap-2">🧠 AI 接口设置</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormInput label="API 地址" value={companionCfg.ai_api_url} onChange={v => setCompanionCfg(p => ({ ...p, ai_api_url: v }))} placeholder="https://api.deepseek.com" /></div>
              <FormInput label="API 密钥" value={companionCfg.ai_api_key} onChange={v => setCompanionCfg(p => ({ ...p, ai_api_key: v }))} placeholder="sk-xxxxxxxxxxxx" type="password" />
              <FormInput label="模型名称" value={companionCfg.ai_model} onChange={v => setCompanionCfg(p => ({ ...p, ai_model: v }))} placeholder="deepseek-chat" />
            </div>
            <div className="mt-4"><FormTextarea label="系统提示词" value={companionCfg.ai_system_prompt} onChange={v => setCompanionCfg(p => ({ ...p, ai_system_prompt: v }))} placeholder="定义 AI 伴侣的性格和行为..." rows={4} /></div>
          </Card>

          {/* 语音输入 */}
          <Card className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <Toggle enabled={companionCfg.voice_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, voice_enabled: !p.voice_enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">🎤 语音输入</span>
            </div>
            {companionCfg.voice_enabled && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectInput label="识别语言" value={companionCfg.voice_language} onChange={v => setCompanionCfg(p => ({ ...p, voice_language: v }))}
                  options={[{ value: "zh-CN", label: "中文" }, { value: "en-US", label: "English" }, { value: "ja-JP", label: "日本語" }]} />
              </div>
            )}
          </Card>

          {/* 语音输出 TTS */}
          <Card className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <Toggle enabled={companionCfg.tts_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, tts_enabled: !p.tts_enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">🔊 语音输出 (TTS)</span>
            </div>
            {companionCfg.tts_enabled && (
              <div className="mt-3 space-y-4">
                <SelectInput label="语音" value={companionCfg.tts_voice} onChange={v => setCompanionCfg(p => ({ ...p, tts_voice: v }))}
                  options={[{ value: "", label: "默认" }, ...ttsVoices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en')).map(v => ({ value: v.name, label: `${v.name} (${v.lang})` }))]} />
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">语速 {companionCfg.tts_rate.toFixed(1)}x</label>
                  <input type="range" min={0.5} max={2} step={0.1} value={companionCfg.tts_rate} onChange={e => setCompanionCfg(p => ({ ...p, tts_rate: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">音调 {companionCfg.tts_pitch.toFixed(1)}</label>
                  <input type="range" min={0.5} max={2} step={0.1} value={companionCfg.tts_pitch} onChange={e => setCompanionCfg(p => ({ ...p, tts_pitch: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">音量 {Math.round(companionCfg.tts_volume * 100)}%</label>
                  <input type="range" min={0} max={1} step={0.05} value={companionCfg.tts_volume} onChange={e => setCompanionCfg(p => ({ ...p, tts_volume: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <button onClick={handleTestTts} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-2.5 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10">🔊 试听语音</button>
              </div>
            )}
          </Card>

          {/* 交互设置 */}
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black flex items-center gap-2">👆 交互设置</div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-tiny font-medium text-ink-gray">长按启动时间 {companionCfg.long_press_ms}ms</label>
                <input type="range" min={300} max={1500} step={100} value={companionCfg.long_press_ms} onChange={e => setCompanionCfg(p => ({ ...p, long_press_ms: parseInt(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                <div className="flex justify-between text-[10px] text-ink-light/50 mt-1"><span>快 300ms</span><span>慢 1500ms</span></div>
              </div>
              <div>
                <label className="mb-1.5 block text-tiny font-medium text-ink-gray">气泡显示时长 {Math.round(companionCfg.bubble_duration_ms / 1000)}秒</label>
                <input type="range" min={2000} max={15000} step={1000} value={companionCfg.bubble_duration_ms} onChange={e => setCompanionCfg(p => ({ ...p, bubble_duration_ms: parseInt(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
              </div>
            </div>
          </Card>

          {/* 待机 & 动作 */}
          <Card className="mb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Toggle enabled={companionCfg.idle_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, idle_enabled: !p.idle_enabled }))} />
                <span className="text-body-sm font-medium text-ink-black">😴 待机行为</span>
              </div>
              {companionCfg.idle_enabled && (
                <div className="flex items-center gap-3 pl-[52px]">
                  <span className="text-tiny text-ink-gray">间隔</span>
                  <input type="number" min={10} max={300} value={companionCfg.idle_interval_min} onChange={e => setCompanionCfg(p => ({ ...p, idle_interval_min: Math.max(10, parseInt(e.target.value) || 30) }))} className="w-16 rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-center text-body-sm text-ink-black outline-none" />
                  <span className="text-tiny text-ink-gray">~</span>
                  <input type="number" min={10} max={300} value={companionCfg.idle_interval_max} onChange={e => setCompanionCfg(p => ({ ...p, idle_interval_max: Math.max(10, parseInt(e.target.value) || 90) }))} className="w-16 rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-center text-body-sm text-ink-black outline-none" />
                  <span className="text-tiny text-ink-gray">秒</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Toggle enabled={companionCfg.motion_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, motion_enabled: !p.motion_enabled }))} />
                <span className="text-body-sm font-medium text-ink-black">🎭 动作同步</span>
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button onClick={handleSaveCompanion} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink-black px-4 py-3 text-body-sm font-medium text-white transition-all hover:brightness-105 active:brightness-95">
              {companionSaved ? <><Check size={16} strokeWidth={2} /> 已保存</> : "保存配置"}
            </button>
            <button onClick={handleTestCompanion} disabled={companionTesting || !companionCfg.ai_api_url || !companionCfg.ai_api_key} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-3 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10 disabled:opacity-40">
              {companionTesting ? <><Loader size={16} strokeWidth={2} className="animate-spin" /> 测试中...</> : "测试连接"}
            </button>
          </div>
          {companionTestResult && <div className="mt-3 rounded-xl bg-ink-white px-4 py-3 text-body-sm leading-relaxed text-ink-black">{companionTestResult}</div>}

          {/* 重置 */}
          <div className="mt-4">
            <button onClick={() => { if (confirm("确定要重置所有伴侣配置吗？")) { resetCompanionConfig(); setCompanionCfg(loadCompanionConfig()); } }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/4 px-4 py-3 text-body-sm font-medium text-red-500 transition-all hover:bg-red-500/8">
              重置为默认配置
            </button>
          </div>
        </div>
      </div>
    );
  }


  useEffect(() => { if (page === "ai") { fetch(`${API}/api/ai-config`).then(r => r.json()).then(d => { if (d && typeof d === "object") setAiCfg({ enabled: d.enabled || false, api_url: d.api_url || "", api_key: d.api_key || "", model: d.model || "", prompt: d.prompt || "", scheduled_reply: d.scheduled_reply || false, active_interval: d.active_interval || 60, max_replies: d.max_replies || 2, reply_min_chars: d.reply_min_chars || 0, reply_max_chars: d.reply_max_chars || 0, token_limit: d.token_limit || 0, memory_enabled: d.memory_enabled || false }); }).catch(() => {}); } }, [page]);

  const loadIpData = useCallback(async () => {
    try {
      const [statsRes, recordsRes] = await Promise.all([
        fetch(`${API}/api/ip-stats`),
        fetch(`${API}/api/ip-records?q=${encodeURIComponent(ipSearch)}&status=${ipFilter === 'all' ? '' : ipFilter}`),
      ]);
      const stats = await statsRes.json();
      const data = await recordsRes.json();
      setIpStats(stats);
      setIpRecords(Array.isArray(data.records) ? data.records : []);
    } catch {}
  }, [ipSearch, ipFilter]);

  useEffect(() => {
    if (page !== "companion") return;
    if (typeof speechSynthesis === "undefined") return;
    let mounted = true;
    const loadVoices = () => {
      try {
        const v = speechSynthesis.getVoices();
        if (v.length > 0 && mounted) setTtsVoices(v);
      } catch {}
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { mounted = false; speechSynthesis.onvoiceschanged = null; };
  }, [page]);
  useEffect(() => { if (page === "ip") { loadIpData(); const t = setInterval(loadIpData, 30000); return () => clearInterval(t); } }, [page, loadIpData]);
  const handleSaveSettings = useCallback((patch: Record<string, any>) => { updateSettings(patch); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }, [updateSettings]);

  const handleSaveAi = useCallback(async () => { try { await fetch(`${API}/api/ai-config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiCfg) }); setAiSaved(true); setTimeout(() => setAiSaved(false), 2000); } catch {} }, [aiCfg]);

  const handleBanIp = useCallback(async (ip: string) => {
    const reason = prompt(t("ip.ban_confirm", lang) + "\n" + t("ip.ban_reason", lang) + ":");
    if (reason === null) return;
    const duration = prompt("封禁时长:\n1 = 1小时\n2 = 1天\n3 = 7天\n0 = 永久\n\n请输入数字:", "0");
    if (duration === null) return;
    let expire_time = 0;
    const h = parseInt(duration);
    if (h === 1) expire_time = Date.now() + 3600000;
    else if (h === 2) expire_time = Date.now() + 86400000;
    else if (h === 3) expire_time = Date.now() + 604800000;
    try { await fetch(`${API}/api/ip-ban`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip, reason, expire_time }) }); loadIpData(); } catch {}
  }, [lang, loadIpData]);
  const handleUnbanIp = useCallback(async (ip: string) => {
    try { await fetch(`${API}/api/ip-unban`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip }) }); loadIpData(); } catch {}
  }, [loadIpData]);
  const handleTestAi = useCallback(async () => { setAiTesting(true); setAiTestResult(null); try { const r = await fetch(`${API}/api/ai-test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_url: aiCfg.api_url, api_key: aiCfg.api_key, model: aiCfg.model }) }); const d = await r.json(); setAiTestResult(d.success ? `连接成功！回复：${d.reply}` : `失败：${d.error}`); } catch { setAiTestResult("测试失败"); } setAiTesting(false); }, [aiCfg]);
  const handleDeleteAccount = () => { if (!confirm(t("account.delete_confirm", lang))) return; if (!confirm(t("account.delete_confirm2", lang))) return; try { localStorage.removeItem("aperture_auth"); localStorage.removeItem("aperture_session"); } catch {} onLogout(); };

  // Feature categories with lucide icons
  const featureCategories = [
    { cat: "天气与位置", items: [
      { id: "weather", name: "天气查询", desc: "实时天气，支持全国城市" },
      { id: "weather_3d", name: "天气预报", desc: "未来三天预报" },
      { id: "ip_location", name: "IP 定位", desc: "IP 地址地理定位" },
    ]},
    { cat: "金融", items: [
      { id: "exchange_rate", name: "汇率换算", desc: "实时汇率查询" },
      { id: "crypto", name: "加密货币", desc: "BTC/ETH 等币价" },
    ]},
    { cat: "内容与娱乐", items: [
      { id: "hitokoto", name: "随机一言", desc: "随机名言语录" },
      { id: "joke", name: "随机笑话", desc: "英文随机笑话" },
      { id: "cat_image", name: "随机猫咪", desc: "随机猫咪图片" },
      { id: "dog_image", name: "随机狗狗", desc: "随机狗狗图片" },
      { id: "news_hn", name: "科技新闻", desc: "Hacker News 热榜" },
      { id: "numbers", name: "数字趣闻", desc: "数字冷知识" },
    ]},
  ];


  if (page === "companion") {
    const handleSaveCompanion = () => {
      saveCompanionConfig(companionCfg);
      setCompanionSaved(true);
      setTimeout(() => setCompanionSaved(false), 2000);
    };
    const handleTestCompanion = async () => {
      if (!companionCfg.ai_api_url || !companionCfg.ai_api_key) { setCompanionTestResult("请先填写 API 地址和密钥"); return; }
      setCompanionTesting(true); setCompanionTestResult(null);
      try {
        const r = await fetch(`${companionCfg.ai_api_url}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${companionCfg.ai_api_key}` },
          body: JSON.stringify({ model: companionCfg.ai_model, messages: [{ role: "user", content: "你好" }], max_tokens: 50 })
        });
        const d = await r.json();
        if (d.choices?.[0]?.message?.content) { setCompanionTestResult(`连接成功！回复：${d.choices[0].message.content}`); }
        else { setCompanionTestResult(`失败：${d.error?.message || JSON.stringify(d)}`); }
      } catch (e: any) { setCompanionTestResult(`连接失败：${e.message}`); }
      setCompanionTesting(false);
    };
    const handleTestTts = () => { try {
      const u = new SpeechSynthesisUtterance("你好呀，我是你的 AI 伴侣~");
      u.lang = companionCfg.voice_language; u.rate = companionCfg.tts_rate; u.pitch = companionCfg.tts_pitch; u.volume = companionCfg.tts_volume;
      if (companionCfg.tts_voice) { const v = ttsVoices.find(v => v.name === companionCfg.tts_voice); if (v) u.voice = v; }
      speechSynthesis.speak(u); } catch(e) { setCompanionTestResult("TTS 不可用: " + (e.message || e)); }
    };
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title="AI 伴侣配置" onBack={() => setPage("main")} />

          {/* AI 接口 */}
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black flex items-center gap-2">🧠 AI 接口设置</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormInput label="API 地址" value={companionCfg.ai_api_url} onChange={v => setCompanionCfg(p => ({ ...p, ai_api_url: v }))} placeholder="https://api.deepseek.com" /></div>
              <FormInput label="API 密钥" value={companionCfg.ai_api_key} onChange={v => setCompanionCfg(p => ({ ...p, ai_api_key: v }))} placeholder="sk-xxxxxxxxxxxx" type="password" />
              <FormInput label="模型名称" value={companionCfg.ai_model} onChange={v => setCompanionCfg(p => ({ ...p, ai_model: v }))} placeholder="deepseek-chat" />
            </div>
            <div className="mt-4"><FormTextarea label="系统提示词" value={companionCfg.ai_system_prompt} onChange={v => setCompanionCfg(p => ({ ...p, ai_system_prompt: v }))} placeholder="定义 AI 伴侣的性格和行为..." rows={4} /></div>
          </Card>

          {/* 语音输入 */}
          <Card className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <Toggle enabled={companionCfg.voice_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, voice_enabled: !p.voice_enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">🎤 语音输入</span>
            </div>
            {companionCfg.voice_enabled && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectInput label="识别语言" value={companionCfg.voice_language} onChange={v => setCompanionCfg(p => ({ ...p, voice_language: v }))}
                  options={[{ value: "zh-CN", label: "中文" }, { value: "en-US", label: "English" }, { value: "ja-JP", label: "日本語" }]} />
              </div>
            )}
          </Card>

          {/* 语音输出 TTS */}
          <Card className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <Toggle enabled={companionCfg.tts_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, tts_enabled: !p.tts_enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">🔊 语音输出 (TTS)</span>
            </div>
            {companionCfg.tts_enabled && (
              <div className="mt-3 space-y-4">
                <SelectInput label="语音" value={companionCfg.tts_voice} onChange={v => setCompanionCfg(p => ({ ...p, tts_voice: v }))}
                  options={[{ value: "", label: "默认" }, ...ttsVoices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en')).map(v => ({ value: v.name, label: `${v.name} (${v.lang})` }))]} />
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">语速 {companionCfg.tts_rate.toFixed(1)}x</label>
                  <input type="range" min={0.5} max={2} step={0.1} value={companionCfg.tts_rate} onChange={e => setCompanionCfg(p => ({ ...p, tts_rate: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">音调 {companionCfg.tts_pitch.toFixed(1)}</label>
                  <input type="range" min={0.5} max={2} step={0.1} value={companionCfg.tts_pitch} onChange={e => setCompanionCfg(p => ({ ...p, tts_pitch: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-tiny font-medium text-ink-gray">音量 {Math.round(companionCfg.tts_volume * 100)}%</label>
                  <input type="range" min={0} max={1} step={0.05} value={companionCfg.tts_volume} onChange={e => setCompanionCfg(p => ({ ...p, tts_volume: parseFloat(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                </div>
                <button onClick={handleTestTts} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-2.5 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10">🔊 试听语音</button>
              </div>
            )}
          </Card>

          {/* 交互设置 */}
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black flex items-center gap-2">👆 交互设置</div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-tiny font-medium text-ink-gray">长按启动时间 {companionCfg.long_press_ms}ms</label>
                <input type="range" min={300} max={1500} step={100} value={companionCfg.long_press_ms} onChange={e => setCompanionCfg(p => ({ ...p, long_press_ms: parseInt(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
                <div className="flex justify-between text-[10px] text-ink-light/50 mt-1"><span>快 300ms</span><span>慢 1500ms</span></div>
              </div>
              <div>
                <label className="mb-1.5 block text-tiny font-medium text-ink-gray">气泡显示时长 {Math.round(companionCfg.bubble_duration_ms / 1000)}秒</label>
                <input type="range" min={2000} max={15000} step={1000} value={companionCfg.bubble_duration_ms} onChange={e => setCompanionCfg(p => ({ ...p, bubble_duration_ms: parseInt(e.target.value) }))} className="w-full h-1.5 cursor-pointer appearance-none rounded-full" />
              </div>
            </div>
          </Card>

          {/* 待机 & 动作 */}
          <Card className="mb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Toggle enabled={companionCfg.idle_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, idle_enabled: !p.idle_enabled }))} />
                <span className="text-body-sm font-medium text-ink-black">😴 待机行为</span>
              </div>
              {companionCfg.idle_enabled && (
                <div className="flex items-center gap-3 pl-[52px]">
                  <span className="text-tiny text-ink-gray">间隔</span>
                  <input type="number" min={10} max={300} value={companionCfg.idle_interval_min} onChange={e => setCompanionCfg(p => ({ ...p, idle_interval_min: Math.max(10, parseInt(e.target.value) || 30) }))} className="w-16 rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-center text-body-sm text-ink-black outline-none" />
                  <span className="text-tiny text-ink-gray">~</span>
                  <input type="number" min={10} max={300} value={companionCfg.idle_interval_max} onChange={e => setCompanionCfg(p => ({ ...p, idle_interval_max: Math.max(10, parseInt(e.target.value) || 90) }))} className="w-16 rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-center text-body-sm text-ink-black outline-none" />
                  <span className="text-tiny text-ink-gray">秒</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Toggle enabled={companionCfg.motion_enabled} onToggle={() => setCompanionCfg(p => ({ ...p, motion_enabled: !p.motion_enabled }))} />
                <span className="text-body-sm font-medium text-ink-black">🎭 动作同步</span>
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button onClick={handleSaveCompanion} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink-black px-4 py-3 text-body-sm font-medium text-white transition-all hover:brightness-105 active:brightness-95">
              {companionSaved ? <><Check size={16} strokeWidth={2} /> 已保存</> : "保存配置"}
            </button>
            <button onClick={handleTestCompanion} disabled={companionTesting || !companionCfg.ai_api_url || !companionCfg.ai_api_key} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-3 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10 disabled:opacity-40">
              {companionTesting ? <><Loader size={16} strokeWidth={2} className="animate-spin" /> 测试中...</> : "测试连接"}
            </button>
          </div>
          {companionTestResult && <div className="mt-3 rounded-xl bg-ink-white px-4 py-3 text-body-sm leading-relaxed text-ink-black">{companionTestResult}</div>}

          {/* 重置 */}
          <div className="mt-4">
            <button onClick={() => { if (confirm("确定要重置所有伴侣配置吗？")) { resetCompanionConfig(); setCompanionCfg(loadCompanionConfig()); } }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/4 px-4 py-3 text-body-sm font-medium text-red-500 transition-all hover:bg-red-500/8">
              重置为默认配置
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (page === "ai") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("ai.title", lang)} onBack={() => setPage("main")} />
          <Card className="mb-4">
            <div className="flex items-center gap-3">
              <Toggle enabled={aiCfg.enabled} onToggle={() => setAiCfg(p => ({ ...p, enabled: !p.enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">{t("ai.enable", lang)}</span>
            </div>
          </Card>
          <Card className="mb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormInput label={t("ai.api_url", lang)} value={aiCfg.api_url} onChange={v => setAiCfg(p => ({ ...p, api_url: v }))} placeholder="https://api.deepseek.com/v1" /></div>
              <FormInput label={t("ai.api_key", lang)} value={aiCfg.api_key} onChange={v => setAiCfg(p => ({ ...p, api_key: v }))} placeholder="sk-xxxxxxxxxxxx" type="password" />
              <FormInput label={t("ai.model", lang)} value={aiCfg.model} onChange={v => setAiCfg(p => ({ ...p, model: v }))} placeholder="deepseek-chat / gpt-4o" />
            </div>
            <div className="mt-4"><FormTextarea label={t("ai.prompt", lang)} value={aiCfg.prompt} onChange={v => setAiCfg(p => ({ ...p, prompt: v }))} placeholder="..." rows={4} /></div>
            <div className="mt-4">
              <label className="mb-2 block text-tiny font-medium text-ink-gray">{t("ai.max_replies", lang)}</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (<button key={n} onClick={() => setAiCfg(p => ({ ...p, max_replies: n }))} className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all sm:h-10 sm:w-10 ${aiCfg.max_replies === n ? "border-2 border-ochre bg-ochre/10 text-ochre" : "border border-ink-white/60 bg-paper-white text-ink-gray"}`}>{n}</button>))}
                <span className="ml-1 text-tiny text-ink-gray">{t("common.items", lang)}</span>
              </div>
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-tiny font-medium text-ink-gray">{t("ai.char_limit", lang)}</label>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input type="number" min={0} max={10000} value={aiCfg.reply_min_chars} onChange={e => setAiCfg(p => ({ ...p, reply_min_chars: Math.max(0, parseInt(e.target.value) || 0) }))} className="w-20 rounded-lg border border-ink-white/60 bg-paper-white px-3 py-2 text-center text-body-sm text-ink-black outline-none focus:border-ochre/50 sm:w-24" />
                <span className="text-body-sm text-ink-gray">~</span>
                <input type="number" min={0} max={10000} value={aiCfg.reply_max_chars} onChange={e => setAiCfg(p => ({ ...p, reply_max_chars: Math.max(0, parseInt(e.target.value) || 0) }))} className="w-20 rounded-lg border border-ink-white/60 bg-paper-white px-3 py-2 text-center text-body-sm text-ink-black outline-none focus:border-ochre/50 sm:w-24" />
                <span className="text-body-sm text-ink-gray">{t("common.chars", lang)}</span>
              </div>
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-tiny font-medium text-ink-gray">{t("ai.token_limit", lang)}</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={8192} step={256} value={aiCfg.token_limit} onChange={e => setAiCfg(p => ({ ...p, token_limit: parseInt(e.target.value) }))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full" style={{ background: aiCfg.token_limit > 0 ? "linear-gradient(90deg, #10b981, #f59e0b, #ef4444)" : "#E8E8E8" }} />
                <span className="min-w-[60px] text-center text-body-sm font-semibold text-ink-black">{aiCfg.token_limit === 0 ? t("ai.unlimited", lang) : aiCfg.token_limit >= 1000 ? `${(aiCfg.token_limit / 1000).toFixed(1)}k` : `${aiCfg.token_limit}`}</span>
              </div>
              <div className="mt-1 flex justify-between px-0.5"><span className="text-[10px] text-emerald-500">{t("ai.unlimited", lang)}</span><span className="text-[10px] text-amber-500">512</span><span className="text-[10px] text-red-500">8k</span></div>
            </div>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3">
              <Toggle enabled={aiCfg.scheduled_reply} onToggle={() => setAiCfg(p => ({ ...p, scheduled_reply: !p.scheduled_reply }))} />
              <span className="text-body-sm font-medium text-ink-black">{t("ai.scheduled", lang)}</span>
            </div>
            {aiCfg.scheduled_reply && (<div className="mt-3 flex items-center gap-2"><span className="whitespace-nowrap text-body-sm text-ink-gray">{t("ai.every", lang)}</span><input type="number" min={1} max={1440} value={aiCfg.active_interval} onChange={e => setAiCfg(p => ({ ...p, active_interval: Math.max(1, parseInt(e.target.value) || 60) }))} className="w-16 rounded-lg border border-ink-white/60 bg-paper-white px-3 py-2 text-center text-body-sm text-ink-black outline-none focus:border-ochre/50 sm:w-20" /><span className="text-body-sm text-ink-gray">{t("ai.minutes", lang)}</span></div>)}
            {aiCfg.scheduled_reply && <p className="mt-2 text-[11px] leading-relaxed text-ink-light/50">{t("ai.scheduled_desc", lang)}</p>}
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3">
              <Toggle enabled={!!aiCfg.memory_enabled} onToggle={() => setAiCfg(p => ({ ...p, memory_enabled: !p.memory_enabled }))} />
              <span className="text-body-sm font-medium text-ink-black">对话记忆</span>
            </div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">开启后 AI 会记住每条对话历史，回复时参考上下文，让对话更连贯。每用户最多保存 100 条记录。</p>
          </Card>
          <div className="flex gap-3">
            <button onClick={handleSaveAi} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink-black px-4 py-3 text-body-sm font-medium text-white transition-all hover:brightness-105 active:brightness-95">{aiSaved ? <><Check size={16} strokeWidth={2} /> {t("ai.saved", lang)}</> : t("ai.save", lang)}</button>
            <button onClick={handleTestAi} disabled={aiTesting || !aiCfg.api_url || !aiCfg.api_key} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-3 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10 disabled:opacity-40">{aiTesting ? <><Loader size={16} strokeWidth={2} className="animate-spin" /> {t("ai.testing", lang)}</> : t("ai.test", lang)}</button>
          </div>
          {aiTestResult && <div className="mt-3 rounded-xl bg-ink-white px-4 py-3 text-body-sm leading-relaxed text-ink-black">{aiTestResult}</div>}
        </div>
      </div>
    );
  }

  if (page === "personas") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <div className="flex items-center gap-3"><BackButton onClick={() => setPage("main")} /><h1 className="text-h3 text-ink-black">{t("persona.title", lang)} <span className="text-body-sm font-normal text-ink-gray">({personas.length})</span></h1></div>
            <button onClick={() => { setEditingPersona({ name: "", personality: "", style: "", background: "", details: "", mes_example: "" }); setPage("personaEdit"); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-black text-white shadow-ink-sm transition-all hover:brightness-105">+</button>
          </div>
          {personas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center"><BookOpen size={48} strokeWidth={1} className="text-ink-light/25" /><p className="mt-3 text-body-sm text-ink-gray">{t("persona.none", lang)}</p><p className="mt-1 text-tiny text-ink-light/60">{t("persona.create_hint", lang)}</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {personas.map(p => {
                const isExpanded = expandedPersona === p.id;
                const assignedUserId = Object.entries(personaMap).find(([, pid]) => pid === p.id)?.[0] || "";
                return (
                  <div key={p.id}>
                    <div className="flex items-center gap-3 rounded-2xl bg-ink-white p-3.5 shadow-paper-sm sm:p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-black text-body-sm font-semibold text-white sm:h-11 sm:w-11">{p.name ? p.name[0].toUpperCase() : "?"}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-semibold text-ink-black sm:text-[15px]">{p.name || t("persona.unnamed", lang)}</div>
                        <div className="mt-0.5 truncate text-tiny text-ink-gray sm:text-[13px]">{p.personality || p.background || t("persona.no_desc", lang)}</div>
                        {assignedUserId && <div className="mt-1 text-[11px] text-emerald-500">{t("persona.assigned", lang)}: {assignedUserId.slice(0, 12)}...</div>}
                        {p.skills && p.skills.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{p.skills.map((sid: string) => { const skill = allSkills.find((s: any) => s.id === sid); return skill ? <span key={sid} className="rounded bg-ochre/10 px-1.5 py-0.5 text-[10px] font-medium text-ochre">{skill.name}</span> : null; })}</div>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
                        <button onClick={() => { setEditingPersona(p); setPage("personaEdit"); }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-ochre/10 text-ochre transition-colors hover:bg-ochre/20"><Edit3 size={14} strokeWidth={1.5} /></button>
                        <button onClick={async () => { if (confirm(`${t("persona.delete_confirm", lang)}「${p.name}」？`)) { await fetch(`${API}/api/personas/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); loadPersonas(); } }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/8 text-red-500 transition-colors hover:bg-red-500/15"><Trash2 size={14} strokeWidth={1.5} /></button>
                        <button onClick={() => setExpandedPersona(isExpanded ? null : p.id)} className="flex h-8 items-center justify-center rounded-lg bg-ochre/10 px-2 text-[11px] font-semibold text-ink-gray transition-colors hover:bg-ochre/20 sm:w-auto">{t("persona.manage", lang)}</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-0 rounded-b-2xl border-t border-ink-white/30 bg-paper-white/80 p-3">
                        <div className="mb-2 text-tiny font-medium text-ink-gray">{t("persona.select_user", lang)}</div>
                        {users.length === 0 ? <div className="py-3 text-tiny text-ink-gray">{t("persona.no_users", lang)}</div> : <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{users.map(uid => { const isAssigned = personaMap[uid] === p.id; return (<div key={uid} onClick={async () => { const newMap = { ...personaMap }; if (isAssigned) { delete newMap[uid]; } else { for (const u of Object.keys(newMap)) { if (newMap[u] === p.id) delete newMap[u]; } newMap[uid] = p.id; } await fetch(`${API}/api/personas/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: uid, persona_id: isAssigned ? "" : p.id }) }); setPersonaMap(newMap); }} className={`flex cursor-pointer items-center gap-2.5 rounded-xl p-2.5 transition-colors ${isAssigned ? "border border-ochre/25 bg-ochre/10" : "border border-transparent bg-ink-white"}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-black text-[11px] font-semibold text-white">{uid.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-tiny font-medium text-ink-black">{uid.slice(0, 12)}...</div></div>{isAssigned && <span className="shrink-0 rounded-full bg-ochre/15 px-2 py-0.5 text-[10px] font-medium text-ochre">{t("persona.assigned", lang)}</span>}</div>); })}</div>}
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

  if (page === "personaEdit") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={editingPersona.id ? t("persona.edit", lang) : t("persona.create", lang)} onBack={() => setPage("personas")} />
          <Card className="mb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[{ key: "name", label: t("persona.name", lang), placeholder: "" }, { key: "personality", label: t("persona.personality", lang), placeholder: "" }, { key: "style", label: t("persona.style", lang), placeholder: "" }, { key: "background", label: t("persona.background", lang), placeholder: "" }].map(f => (<div key={f.key}><label className="mb-1.5 block text-tiny font-medium text-ink-gray">{f.label}</label><input value={(editingPersona as any)[f.key] || ""} onChange={e => setEditingPersona((p: any) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full rounded-xl border border-ink-white/60 bg-paper-white px-3 py-2.5 text-body-sm text-ink-black outline-none transition-colors placeholder:text-ink-light/40 focus:border-ochre/50 focus:ring-2 focus:ring-ochre/10 sm:px-4 sm:py-3" /></div>))}
              <div className="sm:col-span-2"><FormTextarea label={t("persona.details", lang)} value={editingPersona.details || ""} onChange={v => setEditingPersona((p: any) => ({ ...p, details: v }))} placeholder="" rows={3} /></div>
              <div className="sm:col-span-2"><FormTextarea label="对话示例 (mes_example)" value={editingPersona.mes_example || ""} onChange={v => setEditingPersona((p: any) => ({ ...p, mes_example: v }))} placeholder={`示例格式：\n用户：今天好累\n你：抱抱~ 辛苦了，快去休息会儿\n\n用户：晚安\n你：晚安~ 做个好梦\n\n用户：在干嘛\n你：在看书呢，你呢？`} rows={6} /></div>
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-tiny font-medium text-ink-gray">好感度控制</label>
              {(() => {
                const uid = Object.entries(personaMap).find(([, pid]) => pid === editingPersona.id)?.[0] || "";
                if (!uid) return <p className="text-tiny text-ink-gray">保存角色卡并分配用户后可使用</p>;
                const stageMap: Record<string, string> = { stranger: '陌生人', acquaintance: '相识', friend: '朋友', close_friend: '密友', lover: '恋人' };
                const stageColors: Record<string, string> = { stranger: 'text-gray-400', acquaintance: 'text-blue-400', friend: 'text-emerald-400', close_friend: 'text-amber-400', lover: 'text-rose-400' };
                return (
                  <div className="space-y-3">
                    {currentAffection !== null ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-tiny text-ink-gray">当前好感度: <strong className="text-body-sm text-ink-black">{Math.round(currentAffection * 100)}%</strong></span>
                          <span className={`text-[11px] font-medium ${stageColors[getRelationshipStage(currentAffection)] || 'text-gray-400'}`}>{stageMap[getRelationshipStage(currentAffection)] || '未知'}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-white">
                          <div ref={progressBarRef} className="h-full rounded-full bg-ink-black" style={{ width: `${Math.round(currentAffection * 100)}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-tiny text-ink-light/60">加载中...</p>
                    )}
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} max={100} value={affectionValue} onChange={e => setAffectionValue(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="w-20 rounded-lg border border-ink-white/60 bg-paper-white px-3 py-2.5 text-center text-body-sm text-ink-black outline-none transition-colors focus:border-ochre/50 focus:ring-2 focus:ring-ochre/10" />
                      <span className="text-tiny text-ink-gray">%</span>
                      <button onClick={async () => {
                        try {
                          const r = await fetch(`${API}/api/emotion/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: uid, affection: affectionValue / 100 }) });
                          if (r.ok) { setCurrentAffection(affectionValue / 100); setAffectionSaved(true); setTimeout(() => setAffectionSaved(false), 2000); }
                        } catch {}
                      }} className={`ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-tiny font-medium text-white transition-all ${affectionSaved ? 'bg-emerald-500' : 'bg-ink-black hover:brightness-105'}`}>{affectionSaved ? <><Check size={14} strokeWidth={2.5} /> 已保存</> : '确定'}</button>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-tiny font-medium text-ink-gray">{t("persona.skills", lang)}</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{allSkills.map(s => { const isSelected = selectedSkills.includes(s.id); return (<div key={s.id} onClick={() => setSelectedSkills(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors ${isSelected ? "border border-ochre/30 bg-ochre/10" : "border border-transparent bg-paper-white/50"}`}><div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold ${isSelected ? "bg-ink-black text-white" : "border-2 border-ink-white text-transparent"}`}>{isSelected ? "✓" : ""}</div><div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-ink-black">{s.name}</div><div className="mt-0.5 text-[11px] text-ink-gray">{s.description}</div></div><span className="shrink-0 rounded bg-ochre/10 px-1.5 py-0.5 text-[10px] font-medium text-ochre">{s.type === "thinking" ? "思维" : s.type === "conversation" ? "话术" : "感知"}</span></div>); })}</div>
              {allSkills.length === 0 && <p className="mt-2 text-tiny text-ink-gray">{t("common.loading", lang)}</p>}
            </div>
          </Card>
          <button onClick={async () => { if (!editingPersona.name) { alert(t("persona.name", lang)); return; } await fetch(`${API}/api/personas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editingPersona, skills: selectedSkills }) }); setPage("personas"); loadPersonas(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-black px-4 py-3 text-body-sm font-medium text-white transition-all hover:brightness-105 active:brightness-95"><Check size={16} strokeWidth={2} /> {t("persona.save", lang)}</button>
        </div>
      </div>
    );
  }

  if (page === "account") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("account.title", lang)} onBack={() => setPage("main")} />
          <div className="mb-6 flex flex-col items-center rounded-2xl bg-ink-white p-6 shadow-paper-sm sm:p-8"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-black text-2xl font-semibold text-white sm:h-[72px] sm:w-[72px]">{email ? email[0].toUpperCase() : "?"}</div><div className="mt-3 text-base font-semibold text-ink-black sm:text-lg">{email || t("settings.not_logged_in", lang)}</div><div className="mt-1 text-tiny text-ink-gray sm:text-body-sm">{t("account.current", lang)}</div></div>
          <Card className="mb-6"><div className="flex items-center gap-3"><Shield size={20} strokeWidth={1.5} className="shrink-0 text-ink-gray" /><div><div className="text-body-sm font-medium text-ink-black">{t("account.registered", lang)}</div><div className="mt-0.5 text-tiny text-ink-gray">{new Date().toLocaleDateString(lang === "en" ? "en-US" : "zh-CN")}</div></div></div></Card>
          <div className="flex flex-col gap-3">
            <button onClick={async () => { if (!confirm(t("account.logout_scan", lang) + "?")) return; try { await fetch(`${API}/api/logout`, { method: "POST" }); alert(t("account.logout_scan", lang)); } catch {} }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-ochre/10 px-4 py-3.5 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/20"><LogOut size={16} strokeWidth={1.5} /> {t("account.logout_scan", lang)}</button>
            <button onClick={handleDeleteAccount} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/4 px-4 py-3.5 text-body-sm font-medium text-red-500 transition-all hover:bg-red-500/8"><AlertTriangle size={16} strokeWidth={1.5} /> {t("account.delete", lang)}</button>
            {(() => { try { const s = JSON.parse(localStorage.getItem('aperture_session') || '{}'); return s.type === 'admin'; } catch { return false; } })() && (
              <button onClick={() => setPage("ip")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-ochre/10 px-4 py-3.5 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/20"><Globe size={16} strokeWidth={1.5} /> {t("ip.title", lang)}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (page === "logs") {
    const filtered = logFilter === "all" ? logs : logs.filter((l: any) => l.level === "ERROR");
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="flex w-full flex-1 flex-col px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <div className="mb-4 flex items-center gap-3 sm:mb-5"><BackButton onClick={() => setPage("main")} /><h1 className="flex-1 text-h3 text-ink-black">{t("logs.title", lang)}</h1><button onClick={() => { fetch("/api/logs/clear", { method: "POST" }); setLogs([]); }} className="rounded-lg bg-red-500/8 px-2.5 py-1.5 text-tiny text-red-500">{t("logs.clear", lang)}</button><button onClick={() => setLogFilter(f => f === "all" ? "ERROR" : "all")} className="rounded-lg bg-ochre/10 px-2.5 py-1.5 text-tiny text-ochre">{logFilter === "all" ? t("logs.error_only", lang) : t("logs.all", lang)}</button><button onClick={() => { const text = filtered.map((l: any) => `[${l.time}][${l.level}][${l.tag}] ${l.msg}`).join("\n"); navigator.clipboard.writeText(text).catch(() => {}); }} className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-tiny text-emerald-500">{t("logs.copy", lang)}</button></div>
          <div className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed sm:text-tiny">{filtered.length === 0 ? <div className="flex items-center justify-center py-24 text-body-sm text-ink-gray">{t("logs.empty", lang)}</div> : filtered.map((l: any, i: number) => (<div key={i} className={`mb-1 rounded-lg border-l-[3px] px-3 py-2 ${l.level === "ERROR" ? "border-red-500 bg-red-500/5" : l.level === "WARN" ? "border-amber-500 bg-amber-500/5" : "border-transparent bg-ink-white"}`}><span className="text-ink-light">[{l.time}]</span>{l.level !== "INFO" && <span className={`ml-1 font-semibold ${l.level === "ERROR" ? "text-red-500" : "text-amber-500"}`}>[{l.level}]</span>}<span className="ml-1 text-ochre">[{l.tag}]</span><span className="ml-1 text-ink-black">{l.msg}</span></div>))}</div>
        </div>
      </div>
    );
  }

  if (page === "ip") {
    const fmtTime = (ts: number) => {
      if (!ts) return "-";
      const d = new Date(ts);
      return d.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN") + " " + d.toLocaleTimeString(lang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
    };
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("ip.title", lang)} onBack={() => setPage("account")}>
            <button onClick={loadIpData} className="rounded-lg bg-ochre/10 px-2.5 py-1.5 text-tiny text-ochre">{t("common.refresh", lang)}</button>
          </PageHeader>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ label: t("ip.total", lang), value: ipStats.total, color: "text-ink-black" },
              { label: t("ip.online", lang), value: ipStats.online, color: "text-emerald-500" },
              { label: t("ip.banned", lang), value: ipStats.banned, color: "text-red-500" },
              { label: t("ip.recent", lang), value: ipStats.recent, color: "text-ochre" }
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-ink-white p-3 text-center shadow-paper-sm">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="mt-0.5 text-[11px] text-ink-gray">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="mb-4 flex gap-2">
            <input value={ipSearch} onChange={e => setIpSearch(e.target.value)} placeholder={t("ip.search_ip", lang)} className="flex-1 rounded-xl border border-ink-white/60 bg-ink-white px-3 py-2 text-body-sm text-ink-black outline-none focus:border-ochre/50" />
            <select value={ipFilter} onChange={e => setIpFilter(e.target.value as any)} className="rounded-xl border border-ink-white/60 bg-ink-white px-3 py-2 text-body-sm text-ink-black outline-none">
              <option value="all">{t("common.all", lang)}</option>
              <option value="normal">{t("ip.normal", lang)}</option>
              <option value="banned">{t("ip.banned_status", lang)}</option>
            </select>
          </div>

          {/* IP List */}
          {ipRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Globe size={48} strokeWidth={1} className="text-ink-light/20" />
              <p className="mt-3 text-body-sm text-ink-gray">{t("ip.no_records", lang)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ipRecords.map((r: any) => (
                <div key={r.ip_address} className="rounded-xl bg-ink-white p-3 shadow-paper-sm sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-body-sm font-semibold text-ink-black">{r.ip_address}</span>
                        {r.status === "banned" ? (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">{t("ip.banned_status", lang)}</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">{t("ip.normal", lang)}</span>
                        )}
                      </div>
                      {r.ipv6_address && <div className="mt-0.5 font-mono text-[10px] text-ink-light/60">IPv6: {r.ipv6_address}</div>}
                      {r.local_ip && <div className="font-mono text-[10px] text-ink-light/60">本地: {r.local_ip}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-gray">
                        <span>{r.country} {r.province} {r.city}{r.district && r.district !== '-' ? ' ' + r.district : ''}</span>
                        <span>{r.isp}</span>
                        <span>{t("ip.login_count", lang)}: {r.login_count}</span>
                        {r.network_type && (
                          <span className={r.network_type === 'mobile' ? 'text-orange-500' : 'text-blue-500'}>
                            {r.network_type === 'mobile' ? (
                              <><Smartphone size={12} className="inline" /> {t("ip.network_mobile", lang)}</>
                            ) : (
                              <><Wifi size={12} className="inline" /> {t("ip.network_wifi", lang)}</>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-ink-light/60">
                        {t("ip.last_login", lang)}: {fmtTime(r.last_login)}
                        {r.expire_time > 0 && <span className="ml-2 text-amber-500">到期: {fmtTime(r.expire_time)}</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {r.status === "banned" ? (
                        <button onClick={() => handleUnbanIp(r.ip_address)} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-tiny font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20">{t("ip.unban", lang)}</button>
                      ) : (
                        <button onClick={() => handleBanIp(r.ip_address)} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-tiny font-medium text-red-500 transition-colors hover:bg-red-500/20">{t("ip.ban", lang)}</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (page === "features") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("features.title", lang)} onBack={() => setPage("main")} />
          <p className="mb-4 text-tiny text-ink-gray sm:text-body-sm">{t("features.desc", lang)}</p>
          {featureCategories.map(cat => (
            <div key={cat.cat} className="mb-4">
              <div className="mb-2 px-1 text-tiny font-medium text-ink-light/60">{cat.cat}</div>
              <div className="overflow-hidden rounded-2xl bg-ink-white shadow-paper-sm">
                {cat.items.map((f, i) => {
                  const enabled = settings.features?.[f.id] !== false;
                  return (
                    <div key={f.id} className={`flex items-center gap-3 p-3.5 sm:p-4 ${i > 0 ? "border-t border-ink-white/30" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-medium text-ink-black sm:text-[15px]">{f.name}</div>
                        <div className="mt-0.5 text-[11px] text-ink-gray sm:text-tiny">{f.desc}</div>
                      </div>
                      <Toggle enabled={enabled} onToggle={() => toggleFeature(f.id)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "notifications") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("settings.notifications", lang)} onBack={() => setPage("main")} />
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.notify_sound} onToggle={() => handleSaveSettings({ notify_sound: !settings.notify_sound })} /><Volume2 size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("notify.sound", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("notify.sound_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.notify_desktop} onToggle={() => handleSaveSettings({ notify_desktop: !settings.notify_desktop })} /><Monitor size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("notify.desktop", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("notify.desktop_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.notify_ai_indicator} onToggle={() => handleSaveSettings({ notify_ai_indicator: !settings.notify_ai_indicator })} /><MessageSquare size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("notify.ai_indicator", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("notify.ai_indicator_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.notify_quiet_enabled} onToggle={() => handleSaveSettings({ notify_quiet_enabled: !settings.notify_quiet_enabled })} /><Bell size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("notify.quiet", lang)}</span></div>
            {settings.notify_quiet_enabled && (
              <div className="mt-3 flex items-center gap-2 pl-[58px]">
                <input type="time" value={settings.notify_quiet_start} onChange={e => handleSaveSettings({ notify_quiet_start: e.target.value })} className="rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-body-sm text-ink-black outline-none focus:border-ochre/50" />
                <span className="text-body-sm text-ink-gray">{t("notify.quiet_to", lang)}</span>
                <input type="time" value={settings.notify_quiet_end} onChange={e => handleSaveSettings({ notify_quiet_end: e.target.value })} className="rounded-lg border border-ink-white/60 bg-paper-white px-2 py-1.5 text-body-sm text-ink-black outline-none focus:border-ochre/50" />
              </div>
            )}
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("notify.quiet_desc", lang)}</p>
          </Card>
          {settingsSaved && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-body-sm text-emerald-600"><Check size={16} strokeWidth={2} /> {t("general.saved", lang)}</div>}
        </div>
      </div>
    );
  }

  if (page === "privacy") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("settings.privacy", lang)} onBack={() => setPage("main")} />
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.privacy_msg_encrypt} onToggle={() => handleSaveSettings({ privacy_msg_encrypt: !settings.privacy_msg_encrypt })} /><ShieldCheck size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("privacy.encrypt", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("privacy.encrypt_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Clock size={18} strokeWidth={1.5} className="shrink-0 text-ink-gray" /><div className="flex-1"><span className="text-body-sm font-medium text-ink-black">{t("privacy.auto_delete", lang)}</span></div></div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[{ v: "0", l: t("privacy.never", lang) }, { v: "7", l: `7${t("common.days", lang)}` }, { v: "30", l: `30${t("common.days", lang)}` }, { v: "90", l: `90${t("common.days", lang)}` }].map(o => (
                <button key={o.v} onClick={() => handleSaveSettings({ privacy_auto_delete: parseInt(o.v) })} className={`rounded-xl py-2.5 text-tiny font-medium transition-all sm:text-body-sm ${settings.privacy_auto_delete === parseInt(o.v) ? "border-2 border-ochre bg-ochre/10 text-ochre" : "border border-ink-white/60 bg-paper-white text-ink-gray"}`}>{o.l}</button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-light/50">{t("privacy.auto_delete_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.privacy_read_receipt} onToggle={() => handleSaveSettings({ privacy_read_receipt: !settings.privacy_read_receipt })} /><Eye size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("privacy.read_receipt", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("privacy.read_receipt_desc", lang)}</p>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><Toggle enabled={settings.privacy_show_online} onToggle={() => handleSaveSettings({ privacy_show_online: !settings.privacy_show_online })} /><EyeOff size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("privacy.show_online", lang)}</span></div>
            <p className="mt-1.5 pl-[58px] text-[11px] leading-relaxed text-ink-light/50">{t("privacy.show_online_desc", lang)}</p>
          </Card>
          {settingsSaved && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-body-sm text-emerald-600"><Check size={16} strokeWidth={2} /> {t("general.saved", lang)}</div>}
        </div>
      </div>
    );
  }

  if (page === "general") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("settings.general", lang)} onBack={() => setPage("main")} />
          <Card className="mb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectInput label={t("general.language", lang)} value={settings.general_language} onChange={v => handleSaveSettings({ general_language: v })} options={[{ value: "zh-CN", label: "中文" }, { value: "en", label: "English" }]} />
              <SelectInput label={t("general.theme", lang)} value={settings.general_theme} onChange={v => handleSaveSettings({ general_theme: v })} options={[{ value: "auto", label: t("general.theme_auto", lang) }, { value: "light", label: t("general.theme_light", lang) }, { value: "dark", label: t("general.theme_dark", lang) }]} />
              <SelectInput label={t("general.font_size", lang)} value={settings.general_font_size} onChange={v => handleSaveSettings({ general_font_size: v })} options={[{ value: "small", label: t("general.size_small", lang) }, { value: "normal", label: t("general.size_normal", lang) }, { value: "large", label: t("general.size_large", lang) }]} />
            </div>
          </Card>
          <Card className="mb-4">
            <div className="mb-3 flex items-center gap-3"><Download size={18} strokeWidth={1.5} className="text-ink-gray" /><span className="text-body-sm font-medium text-ink-black">{t("general.data_manage", lang)}</span></div>
            <div className="flex gap-3">
              <button onClick={() => { const data = JSON.stringify(settings, null, 2); const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "webchat-settings.json"; a.click(); URL.revokeObjectURL(url); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-3 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10"><Download size={16} strokeWidth={1.5} /> {t("general.export", lang)}</button>
              <button onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".json"; input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; try { const text = await file.text(); const imported = JSON.parse(text); handleSaveSettings(imported); alert(t("general.saved", lang)); } catch { alert("导入失败"); } }; input.click(); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ochre/30 bg-paper-white px-4 py-3 text-body-sm font-medium text-ochre transition-all hover:bg-ochre/10"><Upload size={16} strokeWidth={1.5} /> {t("general.import", lang)}</button>
            </div>
          </Card>
          <Card className="mb-4">
            <button onClick={() => { if (confirm(t("general.clear_cache", lang) + "?")) { try { localStorage.clear(); alert(t("general.saved", lang)); } catch {} } }} className="flex w-full items-center gap-3"><Trash size={18} strokeWidth={1.5} className="text-red-500" /><span className="text-body-sm font-medium text-red-500">{t("general.clear_cache", lang)}</span></button>
          </Card>
          {settingsSaved && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-body-sm text-emerald-600"><Check size={16} strokeWidth={2} /> {t("general.saved", lang)}</div>}
        </div>
      </div>
    );
  }

  if (page === "about") {
    return (
      <div className="flex h-full flex-col overflow-auto bg-paper-white">
        <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
          <PageHeader title={t("settings.about", lang)} onBack={() => setPage("main")} />
          <div className="mb-6 flex flex-col items-center rounded-2xl bg-ink-white p-6 shadow-paper-sm sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-black text-2xl font-bold text-white sm:h-[72px] sm:w-[72px]">W</div>
            <div className="mt-3 text-base font-semibold text-ink-black sm:text-lg">WebChat</div>
            <div className="mt-1 text-tiny text-ink-gray sm:text-body-sm">{t("about.desc", lang)}</div>
            <div className="mt-2 rounded-full bg-ochre/10 px-3 py-1 text-tiny font-medium text-ochre">v1.0.0</div>
          </div>
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black">{t("about.tech", lang)}</div>
            <div className="flex flex-wrap gap-2">
              {[{ name: "React 18", color: "bg-blue-500/10 text-blue-600" }, { name: "TypeScript", color: "bg-sky-500/10 text-sky-600" }, { name: "Tailwind CSS", color: "bg-cyan-500/10 text-cyan-600" }, { name: "Node.js", color: "bg-green-500/10 text-green-600" }, { name: "Vite", color: "bg-purple-500/10 text-purple-600" }].map(item => <span key={item.name} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.color}`}>{item.name}</span>)}
            </div>
          </Card>
          <Card className="mb-4">
            <div className="mb-3 text-body-sm font-medium text-ink-black">{t("about.features", lang)}</div>
            <div className="space-y-2">
              {["微信 Bot 扫码登录与消息收发", "AI 自动回复（支持多种模型）", "角色卡与技能系统", "多媒体消息支持", "定时主动问候", "运行日志与监控"].map(f => <div key={f} className="flex items-center gap-2.5"><div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><Check size={12} strokeWidth={2} /></div><span className="text-body-sm text-ink-black">{f}</span></div>)}
            </div>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3"><FileText size={18} strokeWidth={1.5} className="text-ink-gray" /><div className="flex-1"><div className="text-body-sm font-medium text-ink-black">{t("about.license", lang)}</div><div className="mt-0.5 text-tiny text-ink-gray">MIT License</div></div></div>
          </Card>
          <div className="text-center text-[11px] text-ink-light/40">Made with <Heart size={11} strokeWidth={1.5} className="inline" /></div>
        </div>
      </div>
    );
  }

  // Main settings page
  return (
    <div className="flex h-full flex-col overflow-auto bg-paper-white">
      <div className="w-full px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
        <h1 className="text-h2 text-ink-black mb-1">{t("settings.title", lang)}</h1>
        {/* Profile card with ink-white bg */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-ink-white p-4 shadow-paper-sm mb-6 sm:gap-4 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-black text-lg font-semibold text-white sm:h-14 sm:w-14 sm:text-xl">
            {email ? email[0].toUpperCase() : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-body-sm font-semibold text-ink-black sm:text-[15px]">{email || t("settings.not_logged_in", lang)}</div>
            <div className="mt-0.5 text-tiny text-ink-gray sm:text-[13px]">{t("settings.wechat_bot", lang)}</div>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-ink-light/30" />
        </div>

        {/* Settings sections in ink-white bg */}
        <div className="overflow-hidden rounded-2xl bg-ink-white">
          <SettingRow icon={Shield} label={t("settings.account", lang)} onClick={() => setPage("account")} />
          <div className="mx-4 h-px bg-ink-white/60" />
          <SettingRow icon={BookOpen} label={t("settings.personas", lang)} onClick={() => setPage("personas")} badge={personas.length} />
          <div className="mx-4 h-px bg-ink-white/60" />
          <SettingRow icon={Zap} label="AI 伴侣" onClick={() => setPage("companion")} />
          <div className="mx-4 h-px bg-ink-white/60" />
          <SettingRow icon={MessageSquare} label={t("settings.ai", lang)} onClick={() => setPage("ai")} />
          <div className="mx-4 h-px bg-ink-white/60" />
          <SettingRow icon={AlertTriangle} label={t("settings.logs", lang)} onClick={() => setPage("logs")} />
          <div className="mx-4 h-px bg-ink-white/60" />
          <SettingRow icon={Zap} label={t("settings.features", lang)} onClick={() => setPage("features")} badge="11" />
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl bg-ink-white">
          {[{ icon: Bell, label: t("settings.notifications", lang), page: "notifications" as const },
            { icon: Lock, label: t("settings.privacy", lang), page: "privacy" as const },
            { icon: Sliders, label: t("settings.general", lang), page: "general" as const },
            { icon: Info, label: t("settings.about", lang), page: "about" as const }
          ].map((item, idx) => (
            <React.Fragment key={item.page}>
              {idx > 0 && <div className="mx-4 h-px bg-ink-white/60" />}
              <SettingRow icon={item.icon} label={item.label} onClick={() => setPage(item.page)} />
            </React.Fragment>
          ))}
        </div>
        <button onClick={onLogout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/5 px-4 py-3.5 text-body-sm font-medium text-red-500 transition-all hover:bg-red-500/10 sm:mt-8"><LogOut size={16} strokeWidth={1.5} /> {t("settings.logout", lang)}</button>
      </div>
    </div>
  );
}
