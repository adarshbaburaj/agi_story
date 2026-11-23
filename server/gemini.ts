// Gemini: vision casting, Narrator, Cinematographer, agent beats, the 3D model builder and the poster.
import { env, extractJson, parseDataUrl } from './env.js'

const STUDIO = 'https://generativelanguage.googleapis.com/v1beta/models'

const keys = () => [env('GEMINI_API_KEY_4'), env('GEMINI_API_KEY_3'), env('GEMINI_API_KEY_2'), env('GEMINI_API_KEY'), env('GEMINI_API_KEY_1'), env('GOOGLE_API_KEY')].filter(Boolean) as string[]
const useVertex = () => /^(1|true|yes)$/i.test(env('GOOGLE_GENAI_USE_VERTEXAI') ?? '')

export const geminiReady = () => keys().length > 0 || !!env('GOOGLE_CLOUD_ACCESS_TOKEN')

/** Endpoints to try in order: Vertex AI (token, then express-mode key), then AI Studio with each key. */
function endpoints(model: string): { url: string; headers: Record<string, string> }[] {
  const out: { url: string; headers: Record<string, string> }[] = []
  const token = env('GOOGLE_CLOUD_ACCESS_TOKEN')
  const project = env('GOOGLE_CLOUD_PROJECT')
  const loc = env('GOOGLE_CLOUD_LOCATION') ?? 'global'
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`
  if (token && project)
    out.push({
      url: `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`,
      headers: { authorization: `Bearer ${token}` },
    })
  if (useVertex())
    for (const k of keys()) {
      // Vertex AI express mode: the key goes in the query string
      out.push({ url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(k)}`, headers: {} })
      if (project)
        out.push({
          url: `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(k)}`,
          headers: {},
        })
    }
  for (const k of keys()) out.push({ url: `${STUDIO}/${model}:generateContent`, headers: { 'x-goog-api-key': k } })
  return out
}
let lastGood = 0

export const models = {
  strong: () => env('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  fast: () => env('GEMINI_FAST_MODEL') ?? env('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  /** The model that builds 3D objects (set GEMINI_3D_MODEL to the Hydrogen model id). */
  builder3d: () => env('GEMINI_3D_MODEL') ?? env('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  image: () => env('GEMINI_IMAGE_MODEL') ?? 'gemini-2.5-flash-image',
}

interface GeminiOpts {
  model: string
  system: string
  prompt: string
  images?: string[] // data URLs
  temperature?: number
  timeoutMs?: number
}

async function call(opts: GeminiOpts, generationConfig: Record<string, unknown>) {
  const parts: unknown[] = [{ text: opts.prompt }]
  for (const img of opts.images ?? []) {
    const p = parseDataUrl(img)
    if (p) parts.push({ inlineData: { mimeType: p.mime, data: p.data } })
  }
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  })
  const eps = endpoints(opts.model)
  if (!eps.length) throw new Error('no Gemini credentials')
  // start with whichever endpoint worked last time
  const order = [...eps.slice(lastGood), ...eps.slice(0, lastGood)]
  let lastErr = ''
  for (const ep of order) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000)
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...ep.headers },
        body,
        signal: ctrl.signal,
      })
      if (res.ok) {
        lastGood = eps.indexOf(ep)
        return (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] } }[]
        }
      }
      lastErr = `Gemini ${res.status} (${new URL(ep.url).host}${new URL(ep.url).pathname.includes('/projects/') ? ' project' : ''}): ${(await res.text()).slice(0, 400)}`
      if (env('GEMINI_DEBUG')) console.warn('[Gemini attempt]', lastErr.replace(/\s+/g, ' ').slice(0, 400))
      if (![400, 401, 402, 403, 404].includes(res.status)) break // rate limit / server error: don't hammer the others
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(lastErr)
}

export async function geminiJSON<T = unknown>(opts: GeminiOpts): Promise<T> {
  const out = await call(opts, {
    responseMimeType: 'application/json',
    temperature: opts.temperature ?? 0.9,
  })
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return extractJson(text) as T
}

/** Returns a data URL of the generated image. */
export async function geminiImage(opts: GeminiOpts): Promise<string> {
  const out = await call({ ...opts, timeoutMs: opts.timeoutMs ?? 55000 }, {
    responseModalities: ['TEXT', 'IMAGE'],
  })
  for (const p of out.candidates?.[0]?.content?.parts ?? []) {
    if (p.inlineData?.data) return `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
  }
  throw new Error('Gemini returned no image')
}
