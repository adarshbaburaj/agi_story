// One entry point for every model call: Gemini first, Claude second, mock last (in routes).
import { claudeJSON, claudeReady } from './claude.js'
import type { Tracker } from './env.js'
import { geminiJSON, geminiReady } from './gemini.js'

// circuit breaker: after an auth/permission failure, skip Gemini for a while so beats stay fast
let geminiDownUntil = 0

export const llmReady = () => geminiReady() || claudeReady()

export async function llmJSON<T = unknown>(
  t: Tracker,
  opts: {
    model: string
    system: string
    prompt: string
    images?: string[]
    temperature?: number
    timeoutMs?: number
    effort?: 'low' | 'medium' | 'high'
  },
): Promise<T> {
  let lastErr: unknown = null
  if (geminiReady() && Date.now() > geminiDownUntil) {
    try {
      const out = await geminiJSON<T>(opts)
      t.mark('Gemini', 'live')
      return out
    } catch (e) {
      lastErr = e
      t.mark('Gemini', 'error')
      if (/\b(400|401|402|403|404)\b/.test((e as Error).message)) geminiDownUntil = Date.now() + 5 * 60_000
      console.warn('[Gemini]', (e as Error).message.slice(0, 160))
    }
  }
  if (claudeReady()) {
    try {
      const out = await claudeJSON<T>(opts)
      t.mark('Claude', 'live')
      return out
    } catch (e) {
      lastErr = e
      t.mark('Claude', 'error')
      console.warn('[Claude]', (e as Error).message.slice(0, 160))
    }
  }
  throw lastErr ?? new Error('no model available')
}
