// tts.ts — 多引擎 TTS 支持
// 支持：Android TTS / Edge TTS / CosyVoice / 本地 Kokoro / 自定义 API

export interface TtsVoice {
  id: string
  name: string
  lang: string
  engine: 'system' | 'edge' | 'cosyvoice' | 'localkokoro' | 'custom'
}

// Kokoro-82M 预设音色（手机端离线推理，纯 CPU，无网络）
export const KOKORO_VOICES: TtsVoice[] = [
  { id: 'af', name: '妹1 (默认女声)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_bella', name: '妹2 (贝拉)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_nicole', name: '妹3 (妮可)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_aoede', name: '妹4 (悠扬)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_kore', name: '妹5 (清亮)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_sarah', name: '妹6 (莎拉)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_nova', name: '妹7 (新星)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'af_sky', name: '妹8 (天空)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'am_adam', name: '哥1 (亚当)', lang: 'zh-CN', engine: 'localkokoro' },
  { id: 'am_echo', name: '哥2 (回声)', lang: 'zh-CN', engine: 'localkokoro' },
]

// Edge TTS 高质量语音列表（微软免费，无密钥，中文顶级）
export const EDGE_VOICES: TtsVoice[] = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (亲切女声)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (活力女声)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-CN-YunjianNeural', name: '云健 (沉稳男声)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (阳光男声)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (新闻男声)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北 (东北话)', lang: 'zh-CN', engine: 'edge' },
  { id: 'zh-HK-HiuGaaiNeural', name: '晓佳 (粤语女声)', lang: 'zh-HK', engine: 'edge' },
  { id: 'en-US-AriaNeural', name: 'Aria (女声)', lang: 'en-US', engine: 'edge' },
  { id: 'en-US-JennyNeural', name: 'Jenny (女声)', lang: 'en-US', engine: 'edge' },
  { id: 'en-US-GuyNeural', name: 'Guy (男声)', lang: 'en-US', engine: 'edge' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (英音女声)', lang: 'en-GB', engine: 'edge' },
  { id: 'ja-JP-NanamiNeural', name: 'Nanami (日语女声)', lang: 'ja-JP', engine: 'edge' },
]

// CosyVoice 语音列表（阿里云 DashScope，真人级音质，需 API key）
export const COSYVOICE_VOICES: TtsVoice[] = [
  { id: 'longxiaochun_v2', name: '龙小淳 (温柔姐姐)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longxiaoxia_v2', name: '龙小夏 (活泼女声)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longwan_v2', name: '龙婉 (普通话女声)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longxiu_v2', name: '龙修 (说书男声)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longcheng_v2', name: '龙橙 (阳光男声)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longyuan_v2', name: '龙媛 (治愈女声)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longxiaobai_v2', name: '龙小白 (沉稳播报)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longyingmu', name: '龙应沐 (优雅知性)', lang: 'zh-CN', engine: 'cosyvoice' },
  { id: 'longtan_v2', name: '龙檀 (磁性男声)', lang: 'zh-CN', engine: 'cosyvoice' },
]

const COSYVOICE_API = 'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech'

const EDGE_ORIGIN = 'speech.platform.bing.com'
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function speakEdge(text: string, voiceId: string): Promise<void> {
  const ws = new WebSocket(
    `wss://${EDGE_ORIGIN}/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=${EDGE_TOKEN}&connectionId=${crypto.randomUUID()}`
  )
  return new Promise((resolve, reject) => {
    const chunks: Blob[] = []
    let mime = 'audio/mpeg'

    ws.onopen = () => {
      ws.send(JSON.stringify({
        context: { synthesis: { audio: { metadataoptions: {}, outputFormat: 'audio-24khz-96kbitrate-mono-mp3' } } }
      }))
      ws.send(JSON.stringify({
        type: 'ssml',
        ssml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${voiceId}">${escapeXml(text)}</voice></speak>`
      }))
    }
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try { const m = JSON.parse(e.data); if (m.metadata?.audio?.contentType) mime = m.metadata.audio.contentType } catch {}
      } else if (e.data instanceof Blob) { chunks.push(e.data) }
    }
    ws.onclose = () => {
      if (chunks.length === 0) { reject(new Error('无音频数据')); return }
      const blob = new Blob(chunks, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = new Audio(url)
      a.onended = () => { URL.revokeObjectURL(url); resolve() }
      a.onerror = () => { URL.revokeObjectURL(url); reject(new Error('播放失败')) }
      a.play().catch(reject)
    }
    ws.onerror = reject
  })
}

function trySystemTts(text: string, rate?: number, pitch?: number): boolean {
  const ats = (window as any).AndroidTts
  if (ats?.isAvailable?.()) {
    if (rate) ats.setRate(rate); if (pitch) ats.setPitch(pitch)
    ats.speak(text); return true
  }
  if (typeof SpeechSynthesisUtterance !== 'undefined') {
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = rate || 1.0; u.pitch = pitch || 1.0; speechSynthesis.speak(u); return true } catch {}
  }
  return false
}

async function speakCustom(url: string, text: string, key?: string, voice?: string): Promise<void> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) h['Authorization'] = `Bearer ${key}`
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ model: voice || 'tts-1', input: text, voice: voice || 'alloy' }) })
  if (!r.ok) throw new Error(`API ${r.status}`)
  const blob = await r.blob()
  const u = URL.createObjectURL(blob)
  const a = new Audio(u)
  await new Promise<void>((resolve, reject) => { a.onended = () => { URL.revokeObjectURL(u); resolve() }; a.onerror = reject; a.play().catch(reject) })
}

async function speakCosyvoice(text: string, voice: string, apiKey: string): Promise<void> {
  if (!apiKey) throw new Error('请填写阿里云 API Key')
  const r = await fetch(COSYVOICE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'cosyvoice-v2', input: { text }, voice: { voice_id: voice }, parameters: { format: 'mp3' } })
  })
  if (!r.ok) { const e = await r.text(); throw new Error(`CosyVoice ${r.status}: ${e.slice(0, 100)}`) }
  const blob = await r.blob()
  const u = URL.createObjectURL(blob)
  const a = new Audio(u)
  await new Promise<void>((resolve, reject) => { a.onended = () => { URL.revokeObjectURL(u); resolve() }; a.onerror = reject; a.play().catch(reject) })
}

// GPT-SoVITS API（自部署 GPU 服务）
async function speakGptSovits(text: string, apiUrl: string, voice: string): Promise<void> {
  const base = apiUrl.replace(/\/$/, '')
  const url = `${base}/tts?text=${encodeURIComponent(text)}&text_lang=zh&ref_audio_path=${encodeURIComponent(voice)}&streaming_mode=false`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`GPT-SoVITS ${r.status}`)
  const blob = await r.blob()
  const u = URL.createObjectURL(blob)
  const a = new Audio(u)
  await new Promise<void>((resolve, reject) => { a.onended = () => { URL.revokeObjectURL(u); resolve() }; a.onerror = reject; a.play().catch(reject) })
}

function speakLocalKokoro(text: string, voiceIndex?: number): boolean {
  const ltts = (window as any).LocalTts
  if (ltts?.isAvailable?.()) {
    if (typeof voiceIndex === 'number') ltts.setVoice(voiceIndex)
    ltts.speak(text)
    return true
  }
  return false
}

export async function speak(
  text: string,
  opts: { engine: 'system'|'edge'|'cosyvoice'|'localkokoro'|'gptsovits'|'custom'; voice?: string; rate?: number; pitch?: number; apiUrl?: string; apiKey?: string }
): Promise<string> {
  if (opts.engine === 'cosyvoice' && opts.voice) {
    try { await speakCosyvoice(text, opts.voice, opts.apiKey || ''); return '🎯 CosyVoice 已播放（真人级音质）' }
    catch (e: any) { console.warn('[TTS] CosyVoice failed:', e.message); throw e }
  }
  if (opts.engine === 'gptsovits' && opts.apiUrl) {
    try { await speakGptSovits(text, opts.apiUrl, opts.voice || ''); return '🤖 GPT-SoVITS 已播放（音色克隆）' }
    catch (e: any) { console.warn('[TTS] GPT-SoVITS failed:', e.message); throw e }
  }
  if (opts.engine === 'edge' && opts.voice) {
    try { await speakEdge(text, opts.voice); return '🔊 Edge TTS 已播放' }
    catch (e: any) { console.warn('[TTS] Edge failed:', e.message); if (trySystemTts(text, opts.rate, opts.pitch)) return '🔊 已降级到系统 TTS'; throw e }
  }
  if (opts.engine === 'localkokoro') {
    const voiceIdx = opts.voice ? KOKORO_VOICES.findIndex(v => v.id === opts.voice) : 0
    if (speakLocalKokoro(text, voiceIdx >= 0 ? voiceIdx : 0)) return '📱 本地 Kokoro 已播放（离线）'
    if (trySystemTts(text, opts.rate, opts.pitch)) return '🔊 已降级到系统 TTS'
    throw new Error('本地 TTS 不可用，请下载语音模型')
  }
  if (opts.engine === 'custom' && opts.apiUrl) {
    await speakCustom(opts.apiUrl, text, opts.apiKey, opts.voice)
    return '🔊 自定义 TTS 已播放'
  }
  if (trySystemTts(text, opts.rate, opts.pitch)) return '🔊 系统 TTS 已播放'
  throw new Error('无可用的 TTS 引擎')
}
