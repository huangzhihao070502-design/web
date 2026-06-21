// companionConfig.ts — AI 悬浮伴侣配置（localStorage 持久化）

export interface CompanionConfig {
  ai_api_url: string
  ai_api_key: string
  ai_model: string
  ai_system_prompt: string
  persona_id: string            // 关联的角色卡 ID，为空则不使用
  voice_enabled: boolean
  voice_language: string
  tts_enabled: boolean
  tts_voice: string
  tts_rate: number
  tts_pitch: number
  tts_volume: number
  long_press_ms: number
  bubble_duration_ms: number
  idle_enabled: boolean
  idle_interval_min: number
  idle_interval_max: number
  motion_enabled: boolean
}

const STORAGE_KEY = 'companion_config'

const DEFAULT_CONFIG: CompanionConfig = {
  ai_api_url: 'https://api.deepseek.com',
  ai_api_key: '',
  ai_model: 'deepseek-chat',
  ai_system_prompt: '你是用户的 AI 伴侣，性格温柔可爱，回复简短自然，像朋友一样聊天。用中文回复。',
  persona_id: '',
  voice_enabled: true,
  voice_language: 'zh-CN',
  tts_enabled: true,
  tts_voice: '',
  tts_rate: 1.0,
  tts_pitch: 1.0,
  tts_volume: 1.0,
  long_press_ms: 600,
  bubble_duration_ms: 5000,
  idle_enabled: true,
  idle_interval_min: 30,
  idle_interval_max: 90,
  motion_enabled: true,
}

export function loadCompanionConfig(): CompanionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveCompanionConfig(config: Partial<CompanionConfig>): void {
  const merged = { ...loadCompanionConfig(), ...config }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
}

export function resetCompanionConfig(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
