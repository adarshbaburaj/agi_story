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

export function voiceList() {
  const custom = env('ELEVENLABS_VOICE_IDS')
  if (!custom) return DEFAULT_VOICES
  return custom.split(',').map((s) => {
    const [id, ...d] = s.split(':')
    return { id: id.trim(), desc: d.join(':').trim() || 'character voice' }
  })
}

/** Returns base64 mp3. */
export async function tts(text: string, voiceId: string): Promise<string> {
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
