// Voice playback: ElevenLabs audio from /api/voice, browser speechSynthesis as the fallback.
import { api } from '../api'

const cache = new Map<string, Promise<string | null>>()
let muted = false
export const setMuted = (m: boolean) => {
  muted = m
  if (m) window.speechSynthesis?.cancel()
}

/** Start fetching a line now so it's ready when the actor speaks. */
export function prefetch(text: string, voiceId: string) {
  const key = `${voiceId}|${text}`
  if (!cache.has(key)) {
    cache.set(
      key,
      api<{ audio: string | null }>('voice', { text, voiceId })
        .then((r) => (r.audio ? `data:audio/mpeg;base64,${r.audio}` : null))
        .catch(() => null),
    )
  }
  return cache.get(key)!
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Speak and resolve when done (or after a cap). `seed` varies the fallback voice per character. */
export async function speak(text: string, voiceId: string, seed: number, opts: { whisper?: boolean } = {}) {
  const minMs = Math.min(4200, 900 + text.length * 45)
  if (muted || !text.trim()) return sleep(minMs)
  const src = await prefetch(text, voiceId)
  if (src) {
    const audio = new Audio(src)
    audio.volume = opts.whisper ? 0.6 : 1
    audio.playbackRate = 1.08
    const done = new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      setTimeout(resolve, 12000)
    })
    try {
      await audio.play()
      return done
    } catch {
      /* autoplay blocked → fall through */
    }
  }
  return browserSpeak(text, seed, opts.whisper).then(() => undefined, () => sleep(minMs))
}

function browserSpeak(text: string, seed: number, whisper?: boolean) {
  const synth = window.speechSynthesis
  if (!synth) return sleep(Math.min(4200, 900 + text.length * 45))
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const voices = synth.getVoices().filter((v) => v.lang.startsWith('en'))
    if (voices.length) u.voice = voices[seed % voices.length]
    u.pitch = [1.5, 0.7, 1.15, 0.9, 1.3, 0.6][seed % 6]
    u.rate = [1.25, 0.9, 1.1, 1.0, 1.35, 0.85][seed % 6]
    u.volume = whisper ? 0.55 : 1
    u.onend = () => resolve()
    u.onerror = () => resolve()
    setTimeout(resolve, 9000)
    synth.speak(u)
  })
}
