export interface ChatRecord {
  userId: string
  messages: { role: 'user' | 'ai'; text: string; time: number }[]
  updatedAt: number
}

const STORAGE_KEY = 'inkos_chat_history'

export function loadChatHistory(): Record<string, ChatRecord> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} }
}

export function saveMessage(userId: string, role: 'user' | 'ai', text: string) {
  const history = loadChatHistory()
  if (!history[userId]) history[userId] = { userId, messages: [], updatedAt: Date.now() }
  history[userId].messages.push({ role, text, time: Date.now() })
  history[userId].updatedAt = Date.now()
  if (history[userId].messages.length > 500) history[userId].messages = history[userId].messages.slice(-500)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)) } catch {}
}

export function clearChatHistory(userId?: string) {
  const history = loadChatHistory()
  if (userId) { delete history[userId] } else {
    for (const k of Object.keys(history)) delete history[k]
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)) } catch {}
}

export function exportChatHistory(userId?: string): string {
  const history = loadChatHistory()
  const lines: string[] = []
  const uids = userId ? [userId] : Object.keys(history)
  for (const uid of uids) {
    if (!history[uid]) continue
    lines.push(`=== ${uid} ===`)
    history[uid].messages.forEach(m => {
      lines.push(`[${new Date(m.time).toLocaleString('zh-CN')}] ${m.role === 'user' ? '我' : 'AI'}: ${m.text}`)
    })
  }
  return lines.join('\n')
}

export function getTotalMessages(): number {
  const history = loadChatHistory()
  let count = 0
  for (const uid of Object.keys(history)) count += history[uid].messages.length
  return count
}
