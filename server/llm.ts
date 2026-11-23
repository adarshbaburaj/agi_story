// One entry point for every model call: Gemini and Claude in the preferred order, mock last (in routes).
import { claudeJSON, claudeReady } from './claude.js'
import { env, type Tracker } from './env.js'
import { geminiJSON, geminiReady } from './gemini.js'

// circuit breaker: after an auth failure skip Gemini for 5 min; after a rate limit, for 20 s
let geminiDownUntil = 0

export const llmReady = () => geminiReady() || claudeReady()

/** Small concurrency gate so Gemini's per-minute quota isn't hit by bursts (e.g. 5 parallel 3D builds). */
const gates: Record<string, { active: number; queue: (() => void)[] }> = {}
async function gated<T>(name: string, limit: number, fn: () => Promise<T>): Promise<T> {
  const g = (gates[name] ??= { active: 0, queue: [] })
  if (g.active >= limit) await new Promise<void>((r) => g.queue.push(r))
  g.active++
  try {
    return await fn()
  } finally {
    g.active--
    g.queue.shift()?.()
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface LlmOpts {
  model: string
  system: string
  prompt: string
  images?: string[]
  temperature?: number
  timeoutMs?: number
  effort?: 'low' | 'medium' | 'high'
  /** Which provider to try first. Default: Gemini. */
  prefer?: 'gemini' | 'claude'
  /** Retry Gemini rate limits (429) this many times with backoff before falling back. */
  retries429?: number
  /** Max concurrent Gemini calls for this kind of task. */
  geminiConcurrency?: number
}

export async function llmJSON<T = unknown>(t: Tracker, opts: LlmOpts): Promise<T> {
  let lastErr: unknown = null

  const tryGemini = async (): Promise<T | undefined> => {
    if (!geminiReady() || Date.now() < geminiDownUntil) return undefined
    for (let attempt = 0; ; attempt++) {
      try {
        const out = await gated('gemini', opts.geminiConcurrency ?? 3, () => geminiJSON<T>(opts))
        t.mark('Gemini', 'live')
        return out
      } catch (e) {
        const msg = (e as Error).message
        lastErr = e
        const rateLimited = /\b429\b/.test(msg)
        if (rateLimited && attempt < (opts.retries429 ?? 0)) {
          await sleep(1500 * 2 ** attempt + Math.random() * 500)
          continue
        }
        t.mark('Gemini', 'error')
        if (/\b(400|401|402|403|404)\b/.test(msg)) geminiDownUntil = Date.now() + 5 * 60_000
        else if (rateLimited) geminiDownUntil = Date.now() + 20_000
        console.warn('[Gemini]', msg.slice(0, 160))
        return undefined
      }
    }
  }
  const tryClaude = async (): Promise<T | undefined> => {
    if (!claudeReady()) return undefined
    try {
      const out = await claudeJSON<T>(opts)
      t.mark('Claude', 'live')
      return out
    } catch (e) {
      lastErr = e
      t.mark('Claude', 'error')
      console.warn('[Claude]', (e as Error).message.slice(0, 160))
      return undefined
    }
  }

  const order = opts.prefer === 'claude' && claudeReady() ? [tryClaude, tryGemini] : [tryGemini, tryClaude]
  for (const step of order) {
    const out = await step()
    if (out !== undefined) return out
  }
  throw lastErr ?? new Error('no model available')
}

/** Provider for everything except the 3D builder (which always tries Gemini first): AGENTS_PROVIDER=gemini|claude (default claude). */
export const agentsPrefer = (): 'gemini' | 'claude' => (env('AGENTS_PROVIDER') === 'gemini' ? 'gemini' : 'claude')
