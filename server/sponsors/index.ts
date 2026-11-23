// One small adapter per sponsor. Each has a live path (env-gated) and a mock.
import type { Character, RunRecord, Skill, Whisper } from '../../shared/types.js'
import { SKILLS } from '../../shared/types.js'
import { env, type Tracker } from '../env.js'
import { postJson, withSponsor, configured } from './generic.js'

// ---------- Finch: one skill card per character ----------
const SKILL_HINTS: [RegExp, Skill][] = [
  [/laptop|phone|tablet|computer|mac/i, 'Persuade'],
  [/coffee|cup|mug|tea|can|soda/i, 'Bargain'],
  [/lanyard|badge|card|key|wallet/i, 'Deceive'],
  [/pen|pencil|marker|cable|charger|mouse/i, 'Hide'],
  [/bottle|water|flask|plant|book/i, 'Rally'],
]
export function finchSkill(t: Tracker, ch: Pick<Character, 'object' | 'personality'>, suggested?: string) {
  return withSponsor<Skill>(
    t,
    'Finch',
    'FINCH',
    async () => {
      const r = await postJson<{ skill?: string }>('FINCH', '/skills/equip', {
        agent: ch.object,
        personality: ch.personality,
        options: SKILLS,
      })
      return (SKILLS.find((s) => s.toLowerCase() === r.skill?.toLowerCase()) ?? 'Persuade') as Skill
    },
    () => {
      const s = SKILLS.find((k) => k.toLowerCase() === suggested?.toLowerCase())
      if (s) return s
      return SKILL_HINTS.find(([re]) => re.test(ch.object))?.[1] ?? SKILLS[Math.floor(Math.random() * 5)]
    },
  )
}

// ---------- Telem AI: one real web fact per object, and tonight's weather ----------
export function telemFact(t: Tracker, object: string, fallback: string) {
  return withSponsor<string>(
    t,
    'Telem AI',
    'TELEM',
    async () => {
      const r = await postJson<{ answer?: string; result?: string }>('TELEM', '/search', {
        query: `one surprising true fact about a ${object}, one sentence`,
      })
      return r.answer ?? r.result ?? fallback
    },
    () => fallback,
  )
}
export function telemWeather(t: Tracker) {
  return withSponsor<string | null>(
    t,
    'Telem AI',
    'TELEM',
    async () => {
      const r = await postJson<{ answer?: string; result?: string }>('TELEM', '/search', {
        query: 'current weather in San Francisco tonight, one short phrase',
      })
      return r.answer ?? r.result ?? null
    },
    () => null,
  )
}

// ---------- Glasser: typical retail price ----------
export function glasserPrice(t: Tracker, object: string, fallback: string) {
  return withSponsor<string>(
    t,
    'Glasser',
    'GLASSER',
    async () => {
      const r = await postJson<{ price?: string | number }>('GLASSER', '/price', { item: object })
      return r.price != null ? String(r.price).replace(/^(\d)/, '$$$1') : fallback
    },
    () => fallback,
  )
}

// ---------- BAND: the private channel the objects whisper through ----------
export function bandWhisper(t: Tracker, w: Whisper, fromName: string, toName: string) {
  return withSponsor<boolean>(
    t,
    'BAND',
    'BAND',
    async () => {
      await postJson('BAND', '/messages', {
        channel: env('BAND_CHANNEL') ?? 'after-hours',
        from: fromName,
        to: toName,
        text: w.text,
        meta: { beat: w.beat },
      })
      return true
    },
    () => false,
  )
}

// ---------- Bruin: run history / rumor mill ----------
// Server-side fallback store lives in memory on the warm instance; the browser also keeps its own copy.
const localRuns: RunRecord[] = []
export function bruinSave(t: Tracker, run: RunRecord) {
  return withSponsor<boolean>(
    t,
    'Bruin',
    'BRUIN',
    async () => {
      await postJson('BRUIN', '/runs', run)
      localRuns.unshift(run)
      return true
    },
    () => {
      localRuns.unshift(run)
      return true
    },
  )
}
export function bruinLoad(t: Tracker) {
  return withSponsor<RunRecord[]>(
    t,
    'Bruin',
    'BRUIN',
    async () => {
      const r = await postJson<{ runs?: RunRecord[] }>('BRUIN', '/runs/query', { limit: 50 })
      return r.runs ?? []
    },
    () => localRuns.slice(0, 50),
  )
}

// ---------- AdaL: movie poster (falls through to Runware / Gemini image in routes) ----------
export async function adalPoster(t: Tracker, prompt: string): Promise<string | null> {
  if (!configured('ADAL')) return null
  try {
    const r = await postJson<{ image?: string; url?: string }>('ADAL', '/generate', { prompt }, 45000)
    t.mark('AdaL', 'live')
    return r.image ?? r.url ?? null
  } catch {
    t.mark('AdaL', 'error')
    return null
  }
}

// ---------- Casuro: post-credits audience interview scoring ----------
export interface InterviewScore {
  pick: string
  score: number
  evidence: string[]
  verdict: string
}
export async function casuroScore(t: Tracker, payload: unknown): Promise<InterviewScore | null> {
  if (!configured('CASURO')) return null
  try {
    const r = await postJson<InterviewScore>('CASURO', '/interview/score', payload, 15000)
    t.mark('Casuro', 'live')
    return r
  } catch {
    t.mark('Casuro', 'error')
    return null
  }
}

export const SPONSORS = [
  { name: 'Gemini', prefix: 'GEMINI', role: '3D object builder, vision, agents' },
  { name: 'ElevenLabs', prefix: 'ELEVENLABS', role: 'a voice per object' },
  { name: 'Claude', prefix: 'ANTHROPIC', role: 'backup brain for agents + 3D' },
  { name: 'Bruin', prefix: 'BRUIN', role: 'run memory · rumor mill' },
  { name: 'BAND', prefix: 'BAND', role: 'whisper channel' },
  { name: 'Runware', prefix: 'RUNWARE', role: 'fast image gen' },
  { name: 'AdaL', prefix: 'ADAL', role: 'movie poster' },
  { name: 'Finch', prefix: 'FINCH', role: 'skill cards' },
  { name: 'Telem AI', prefix: 'TELEM', role: 'live web facts' },
  { name: 'Glasser', prefix: 'GLASSER', role: 'price data' },
  { name: 'Casuro', prefix: 'CASURO', role: 'audience interview' },
  { name: 'Harness Router', prefix: 'ROUTER', role: 'strong vs fast model routing' },
  { name: 'Teamily AI', prefix: 'TEAMILY', role: 'team, deck, README (build time)' },
  { name: 'LingCode', prefix: 'LINGCODE', role: 'Casting Camera phone app (build time)' },
]

export function sponsorConfig() {
  return SPONSORS.map((s) => ({
    ...s,
    configured:
      s.prefix === 'GEMINI'
        ? !!env('GEMINI_API_KEY')
        : s.prefix === 'ELEVENLABS'
          ? !!env('ELEVENLABS_API_KEY')
          : s.prefix === 'ANTHROPIC'
            ? !!env('ANTHROPIC_API_KEY')
            : s.prefix === 'RUNWARE'
            ? !!env('RUNWARE_API_KEY')
            : configured(s.prefix),
  }))
}
