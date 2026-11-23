// Claude: second brain behind Gemini for casting (vision), agents, Narrator, Cinematographer and the 3D builder.
import Anthropic from '@anthropic-ai/sdk'
import { env, extractJson, parseDataUrl } from './env.js'

export const claudeReady = () => !!env('ANTHROPIC_API_KEY')
const model = () => env('CLAUDE_MODEL') ?? 'claude-opus-5-5'

let client: Anthropic | null = null
const getClient = () => (client ??= new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 1 }))

type ImageMedia = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export async function claudeJSON<T = unknown>(opts: {
  system: string
  prompt: string
  images?: string[]
  effort?: 'low' | 'medium' | 'high'
  timeoutMs?: number
}): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = []
  for (const img of opts.images ?? []) {
    const p = parseDataUrl(img)
    if (p && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(p.mime))
      content.push({ type: 'image', source: { type: 'base64', media_type: p.mime as ImageMedia, data: p.data } })
  }
  content.push({ type: 'text', text: `${opts.prompt}\n\nRespond with only the JSON object, no prose.` })
  const res = await getClient().messages.create(
    {
      model: model(),
      max_tokens: 4000,
      system: opts.system,
      output_config: { effort: opts.effort ?? 'low' },
      messages: [{ role: 'user', content }],
    },
    { timeout: opts.timeoutMs ?? 30000 },
  )
  if (res.stop_reason === 'refusal') throw new Error('Claude refused')
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  return extractJson(text) as T
}
