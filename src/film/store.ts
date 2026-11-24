import { create } from 'zustand'
import type {
  Character,
  Ending,
  LogEntry,
  Shot,
  SponsorState,
  Vec2,
} from '../../shared/types'

export type Screen = 'snap' | 'cast' | 'film' | 'credits'
export type ViewMode = 'photo' | '3d'
export const initialView: ViewMode = new URLSearchParams(location.search).get('mode') === '3d' ? '3d' : 'photo'

export type Phase = 'idle' | 'opening' | 'thinking' | 'acting' | 'ending' | 'done'

export interface Bubble {
  text: string
  kind: 'say' | 'whisper' | 'skill'
  at: number
}
export interface Fx {
  id: number
  kind: 'betray' | 'ally' | 'push' | 'skill' | 'hop'
  actor: string
  target?: string
  at: number
}
export interface WhisperLine {
  id: number
  from: string
  to: string
  at: number
}

interface FilmState {
  screen: Screen
  view: ViewMode
  photo: string | null
  backdrop: string | null
  cast: Character[]
  positions: Record<string, Vec2>
  alliances: [string, string][]
  hidden: string[]
  log: LogEntry[]
  opening: string
  beat: number
  totalBeats: number
  phase: Phase
  bubbles: Record<string, Bubble>
  thoughts: Record<string, { text: string; at: number }>
  focusId: string | null
  fx: Fx[]
  whisperLines: WhisperLine[]
  speakingId: string | null
  subtitle: string | null
  shot: Shot
  ending: Ending | null
  poster: string | null
  runNumber: number
  sponsors: Record<string, SponsorState>
  set: (p: Partial<FilmState>) => void
  addFx: (f: Omit<Fx, 'id' | 'at'>) => void
  addWhisperLine: (from: string, to: string) => void
  bubble: (id: string, text: string, kind: Bubble['kind']) => void
  think: (id: string, text: string) => void
  mergeSponsors: (r: Record<string, SponsorState>) => void
  resetFilm: () => void
}

let fxId = 1

export const useFilm = create<FilmState>((set) => ({
  screen: 'snap',
  view: initialView,
  photo: null,
  backdrop: null,
  cast: [],
  positions: {},
  alliances: [],
  hidden: [],
  log: [],
  opening: '',
  beat: 0,
  totalBeats: Number(new URLSearchParams(location.search).get('beats')) || 6,
  phase: 'idle',
  bubbles: {},
  thoughts: {},
  focusId: null,
  fx: [],
  whisperLines: [],
  speakingId: null,
  subtitle: null,
  shot: { type: 'orbit', reason: 'idle' },
  ending: null,
  poster: null,
  runNumber: 0,
  sponsors: {},
  set: (p) => set(p),
  addFx: (f) =>
    set((s) => ({ fx: [...s.fx.filter((x) => performance.now() - x.at < 4000), { ...f, id: fxId++, at: performance.now() }] })),
  addWhisperLine: (from, to) =>
    set((s) => ({
      whisperLines: [
        ...s.whisperLines.filter((x) => performance.now() - x.at < 5000),
        { id: fxId++, from, to, at: performance.now() },
      ],
    })),
  bubble: (id, text, kind) => set((s) => ({ bubbles: { ...s.bubbles, [id]: { text, kind, at: performance.now() } } })),
  think: (id, text) => set((s) => ({ focusId: id, thoughts: { ...s.thoughts, [id]: { text, at: performance.now() } } })),
  mergeSponsors: (r) =>
    set((s) => {
      const next = { ...s.sponsors }
      for (const [k, v] of Object.entries(r)) if (next[k] !== 'live' || v === 'live') next[k] = v
      return { sponsors: next }
    }),
  resetFilm: () =>
    set((s) => ({
      positions: Object.fromEntries(s.cast.map((c) => [c.id, c.position])),
      alliances: [],
      hidden: [],
      log: [],
      opening: '',
      beat: 0,
      phase: 'idle',
      bubbles: {},
      thoughts: {},
      focusId: null,
      fx: [],
      whisperLines: [],
      speakingId: null,
      subtitle: null,
      ending: null,
      poster: null,
      shot: { type: 'wide', reason: 'start' },
    })),
}))

// handle for the demo-capture tooling (cinema mode recordings)
;(window as unknown as { __film: typeof useFilm }).__film = useFilm
