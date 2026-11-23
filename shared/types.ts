// Shared between the browser (src/) and the serverless API (server/, api/).

export type Shape = 'cylinder' | 'box' | 'sphere' | 'card'
export type Skill = 'Persuade' | 'Deceive' | 'Hide' | 'Rally' | 'Bargain'
export const SKILLS: Skill[] = ['Persuade', 'Deceive', 'Hide', 'Rally', 'Bargain']

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
  source: 'gemini' | 'mock'
}

export interface Character {
  id: string
  name: string
  object: string
  shape: Shape
  personality: string
  voice: string
  voiceId: string
  secretGoal: string
  skill: Skill
  facts: { price: string; funFact: string }
  memory: string[]
  position: Vec2
  color: string
  crop: string // data URL
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
}
