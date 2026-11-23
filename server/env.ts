// Reads env lazily so the Vite dev middleware and Vercel both work.
export const env = (k: string): string | undefined => {
  const v = process.env[k]
  return v && v.trim() ? v.trim() : undefined
}

/** Collects which sponsor/provider calls really ran live during one request. */
export class Tracker {
  report: Record<string, 'live' | 'mock' | 'error'> = {}
  mark(name: string, state: 'live' | 'mock' | 'error') {
    // a live call anywhere in the request wins over a mock
    if (this.report[name] === 'live') return
    this.report[name] = state
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export function parseDataUrl(dataUrl: string): { mime: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  return m ? { mime: m[1], data: m[2] } : null
}

/** Pull the first JSON object/array out of a model response. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.search(/[[{]/)
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('No JSON in model output')
  }
}
