// ElevenLabs: one distinct voice per object, plus the Narrator.
import { env } from './env.js'

export const elevenReady = () => !!env('ELEVENLABS_API_KEY')

/** ElevenLabs premade voices. Override with ELEVENLABS_VOICE_IDS="id:desc,id:desc". */
const DEFAULT_VOICES: { id: string; desc: string }[] = [
  { id: 'EXAVITQu4vr4xnAGDQAI', desc: 'soft young female, gentle, anxious' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', desc: 'deep young male, calm, confident' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', desc: 'bright young female, fast, emotional' },
  { id: 'ErXwobaYiN019PkySvjV', desc: 'well-rounded male, smooth, persuasive' },
  { id: 'AZnzlk1XvdvUeBnXmlld', desc: 'strong female, bold, bossy' },
  { id: 'VR6AewLTigWG4xSOukaG', desc: 'crisp middle-aged male, gruff, grumpy' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', desc: 'raspy young male, scheming, sly' },
  { id: '21m00Tcm4TlvDq8ikWAM', desc: 'calm female, warm, wise' },
]
export const NARRATOR_VOICE = () => env('ELEVENLABS_NARRATOR_VOICE') ?? 'pNInz6obpgDQGcFmaJgB'

let accountVoices: { id: string; desc: string }[] | null = null

/** Voices available on this ElevenLabs account (cached), falling back to the premade list. */
export async function voiceList(): Promise<{ id: string; desc: string }[]> {
  const custom = env('ELEVENLABS_VOICE_IDS')
  if (custom)
    return custom.split(',').map((s) => {
      const [id, ...d] = s.split(':')
      return { id: id.trim(), desc: d.join(':').trim() || 'character voice' }
    })
  if (accountVoices) return accountVoices
  const key = env('ELEVENLABS_API_KEY')
  if (!key) return DEFAULT_VOICES
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
    if (!res.ok) throw new Error(String(res.status))
    const json = (await res.json()) as {
      voices?: { voice_id: string; name: string; labels?: Record<string, string>; description?: string }[]
    }
    const narrator = NARRATOR_VOICE()
    const list = (json.voices ?? [])
      .filter((v) => v.voice_id !== narrator)
      .map((v) => ({
        id: v.voice_id,
        desc: [v.name, ...Object.values(v.labels ?? {}), v.description ?? ''].filter(Boolean).join(', ').slice(0, 120),
      }))
    accountVoices = list.length >= 2 ? list : DEFAULT_VOICES
  } catch {
    accountVoices = DEFAULT_VOICES
  }
  return accountVoices
}

/** Returns base64 mp3. */
export async function tts(text: string, voiceId: string): Promise<string> {
  try {
    return await ttsOnce(text, voiceId)
  } catch (e) {
    if (!/404|voice_not_found/.test((e as Error).message)) throw e
    const list = await voiceList()
    const alt = list[Math.abs(hash(voiceId)) % list.length]?.id ?? NARRATOR_VOICE()
    return ttsOnce(text, alt)
  }
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)

async function ttsOnce(text: string, voiceId: string): Promise<string> {
  const key = env('ELEVENLABS_API_KEY')
  if (!key) throw new Error('ELEVENLABS_API_KEY missing')
  const model = env('ELEVENLABS_MODEL') ?? 'eleven_flash_v2_5'
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': key, accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.slice(0, 400),
        model_id: model,
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.45 },
      }),
    },
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer()).toString('base64')
}
