// Generic sponsor adapter. Each sponsor is "live" once <PREFIX>_API_URL (and usually <PREFIX>_API_KEY)
// are set in .env. Until the real API docs arrive the live call is a JSON POST to that URL; swap the
// body/response mapping in the sponsor's own file once you have the docs. On any failure we fall back
// to the mock so the film never breaks.
import { env, type Tracker } from '../env.js'

export function configured(prefix: string) {
  return !!env(`${prefix}_API_URL`)
}

export async function postJson<T>(
  prefix: string,
  path: string,
  payload: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const url = env(`${prefix}_API_URL`)!.replace(/\/$/, '') + path
  const key = env(`${prefix}_API_KEY`)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${prefix} ${res.status}`)
    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  } finally {
    clearTimeout(t)
  }
}

/** Run live() if configured, else mock(). Records the outcome on the tracker. */
export async function withSponsor<T>(
  tracker: Tracker,
  name: string,
  prefix: string,
  live: () => Promise<T>,
  mock: () => T | Promise<T>,
): Promise<T> {
  if (configured(prefix)) {
    try {
      const out = await live()
      tracker.mark(name, 'live')
      return out
    } catch (e) {
      console.warn(`[${name}] live call failed, using mock:`, (e as Error).message)
      tracker.mark(name, 'error')
      return mock()
    }
  }
  tracker.mark(name, 'mock')
  return mock()
}
