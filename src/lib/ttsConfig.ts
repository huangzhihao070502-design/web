// ttsConfig.ts — TTS 语音设置（localStorage 持久化）

export interface TtsConfig {
  engine: 'system'|'edge'|'cosyvoice'|'localkokoro'|'custom'
  voice: string
  voice_name: string
  rate: number
  pitch: number
  custom_api_url: string
  custom_api_key: string
}

const STORAGE_KEY = 'tts_config'

const DEFAULT_CONFIG: TtsConfig = {
  engine: 'localkokoro',
  voice: 'af',
  voice_name: '妹1 (默认女声)',
  rate: 1.0,
  pitch: 1.0,
  custom_api_url: '',
  custom_api_key: '',
}

export function loadTtsConfig(): TtsConfig {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) try { return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveTtsConfig(config: Partial<TtsConfig>): void {
  const merged = { ...loadTtsConfig(), ...config }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
}
