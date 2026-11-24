// Shared between the browser (src/) and the serverless API (server/, api/).

export type Shape = 'cylinder' | 'box' | 'sphere' | 'card'
export type Skill = 'Persuade' | 'Deceive' | 'Hide' | 'Rally' | 'Bargain'
export const SKILLS: Skill[] = ['Persuade', 'Deceive', 'Hide', 'Rally', 'Bargain']

export type Mood = 'sunny' | 'gloomy' | 'fuming' | 'genz' | 'jittery'

/** Each cast member gets a different core emotion: it drives how they talk, act and sound. */
export const MOODS: Record<
  Mood,
  { label: string; emoji: string; color: string; persona: string; style: string; voiceHint: string; voice: { speed: number; stability: number; style: number } }
> = {
  sunny: {
    label: 'Sunny', emoji: '☀️', color: '#ffd166',
    persona: 'relentlessly happy and optimistic, sees the bright side of everything, even betrayal',
    style: 'Bubbly, exclamation marks, cheerful compliments, finds silver linings. Never mean, even when scheming.',
    voiceHint: 'bright, upbeat, energetic, young',
    voice: { speed: 1.12, stability: 0.3, style: 0.6 },
  },
  gloomy: {
    label: 'Gloomy', emoji: '🌧', color: '#7aa7ff',
    persona: 'sad, melancholy, expects the worst, sighs a lot, oddly wise',
    style: 'Slow, mopey, sighs ("*sigh*"), "what is even the point", trailing "..." — but occasionally devastatingly insightful.',
    voiceHint: 'soft, low, slow, tired, melancholic',
    voice: { speed: 0.86, stability: 0.6, style: 0.35 },
  },
  fuming: {
    label: 'Fuming', emoji: '🔥', color: '#ff4d4d',
    persona: 'angry, short-fused, everything is an outrage, SHOUTS in caps',
    style: 'Short, explosive sentences, some words in CAPS, indignant, threatens dramatically (comedic, never cruel).',
    voiceHint: 'gruff, intense, loud, forceful',
    voice: { speed: 1.05, stability: 0.22, style: 0.85 },
  },
  genz: {
    label: 'Gen Z', emoji: '💅', color: '#c084fc',
    persona: 'Gen Z, unbothered, chronically online, speaks ONLY in Gen Z slang',
    style: 'Gen Z slang in every line: no cap, fr fr, it\'s giving, bestie, slay, lowkey, highkey, ate, rizz, the ick, main character, delulu, bussin, mid. Lowercase vibes.',
    voiceHint: 'young, casual, sassy, playful',
    voice: { speed: 1.1, stability: 0.4, style: 0.65 },
  },
  jittery: {
    label: 'Jittery', emoji: '😰', color: '#59ffb0',
    persona: 'anxious overthinker, panics about every possible outcome, nervous laugh',
    style: 'Rambling, stammering ("w-wait"), what-ifs, nervous "haha", spirals then rallies.',
    voiceHint: 'nervous, quick, high, breathy',
    voice: { speed: 1.15, stability: 0.25, style: 0.55 },
  },
}
export const MOOD_ORDER: Mood[] = ['sunny', 'fuming', 'genz', 'gloomy', 'jittery']

export type Vec2 = [number, number] // x, z on the tabletop
export type Vec3 = [number, number, number]

/** One primitive in a Gemini-built 3D model. Units: the body is ~1 tall. */
export interface ModelPart {
  kind: 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'capsule'
  /** box: [w,h,d] · cylinder: [radiusTop, radiusBottom, height] · sphere: [r] · cone: [r,h] · torus: [r, tube] · capsule: [r, length] */
  size: number[]
  position: Vec3
  rotation?: Vec3
  color: string
  metalness?: number
  roughness?: number
  emissive?: boolean
}

export interface Model3D {
  body: { shape: Shape; width: number; height: number; depth: number; color: string }
  /** Where the photo label sits on the front of the body (y centre, size). */
  label: { y: number; width: number; height: number }
  parts: ModelPart[]
  source: 'gemini' | 'claude' | 'mock'
}

export interface Character {
  id: string
  name: string
  object: string
  shape: Shape
  personality: string
  mood: Mood
  voice: string
  voiceId: string
  secretGoal: string
  skill: Skill
  facts: { price: string; funFact: string }
  memory: string[]
  position: Vec2
  color: string
  crop: string // data URL
  /** Where the object sits in the table photo (normalized 0-1), for the living-photo view. */
  box?: { x: number; y: number; w: number; h: number }
  model?: Model3D
}

export type ActionType =
  | 'move_to'
  | 'say'
  | 'whisper'
  | 'ally'
  | 'betray'
  | 'push'
  | 'hide_behind'
  | 'use_skill'

export const ACTIONS: ActionType[] = [
  'move_to',
  'say',
  'whisper',
  'ally',
  'betray',
  'push',
  'hide_behind',
  'use_skill',
]

/** Named places on the table an agent can move_to. */
export const SPOTS: Record<string, Vec2> = {
  charger: [0, 0],
  window: [-1.9, -1.0],
  edge: [1.9, 1.0],
  lamp: [1.7, -1.1],
}

export interface AgentAction {
  action: ActionType
  target?: string // character id or spot name
  text?: string
  skill?: Skill
  why: string
  emotion?: string
}

export interface LogEntry {
  beat: number
  actorId: string
  actorName: string
  action: ActionType
  targetId?: string
  targetName?: string
  text?: string
  why: string
  emotion?: string
}

export interface Whisper {
  beat: number
  from: string
  to: string
  text: string
}

export interface WorldState {
  beat: number
  totalBeats: number
  opening: string
  positions: Record<string, Vec2>
  alliances: [string, string][]
  hidden: string[]
  events: LogEntry[]
  whispers: Whisper[]
}

export type ShotType = 'wide' | 'closeup' | 'over_shoulder' | 'orbit'
export interface Shot {
  type: ShotType
  subject?: string
  reason: string
}

export interface Ending {
  winnerId: string
  title: string
  ending: string
  verdict: string
}

export interface RunRecord {
  id: string
  at: number
  cast: { id: string; name: string; object: string }[]
  winner: { name: string; object: string }
  title: string
  verdict: string
  highlights: string[]
  judgeVerdict?: string
}

export type SponsorState = 'live' | 'mock' | 'error'
export type SponsorReport = Record<string, SponsorState>

/** Lightweight cast summary sent to agents (no images). */
export interface CastSummary {
  id: string
  name: string
  object: string
  skill: Skill
  personality: string
  mood?: Mood
}
