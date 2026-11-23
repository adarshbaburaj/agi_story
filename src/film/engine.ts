// The beat loop: Narrator opening → N beats of parallel agent decisions → Narrator ending → poster + memory.
import type { AgentAction, CastSummary, Character, Ending, LogEntry, RunRecord, Shot, WorldState } from '../../shared/types'
import { validateAction } from '../../shared/validate'
import { api } from '../api'
import { applyAction, spokenLine } from './actions'
import { generalRumors, loadHistory, rumorsFor, saveRun } from './memory'
import { useFilm } from './store'
import { prefetch, speak } from './voice'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let runToken = 0

export const summary = (c: Character): CastSummary => ({
  id: c.id,
  name: c.name,
  object: c.object,
  skill: c.skill,
  personality: c.personality,
  mood: c.mood,
})

function world(): WorldState {
  const s = useFilm.getState()
  return {
    beat: s.beat,
    totalBeats: s.totalBeats,
    opening: s.opening,
    positions: s.positions,
    alliances: s.alliances,
    hidden: s.hidden,
    events: s.log,
    whispers: s.log
      .filter((e) => e.action === 'whisper' && e.targetId)
      .map((e) => ({ beat: e.beat, from: e.actorId, to: e.targetId!, text: e.text ?? '' })),
  }
}

const NARRATOR_SEED = 99

async function narrate(text: string, voiceId: string) {
  useFilm.setState({ subtitle: text })
  await speak(text, voiceId, NARRATOR_SEED)
  await sleep(300)
}

export function stopFilm() {
  runToken++
  window.speechSynthesis?.cancel()
}

/** Load memory and refresh each character's rumors before a run. */
export async function refreshMemory() {
  const history = await loadHistory()
  const { cast } = useFilm.getState()
  useFilm.setState({ cast: cast.map((c) => ({ ...c, memory: rumorsFor(c, history) })) })
  return history
}

export async function runFilm() {
  const token = ++runToken
  const alive = () => token === runToken
  const st = useFilm.getState()
  st.resetFilm()
  useFilm.setState({ screen: 'film', phase: 'opening', runNumber: st.runNumber + 1 })

  const history = await refreshMemory()
  const cast = useFilm.getState().cast
  const castSum = cast.map(summary)

  // ---- opening
  const op = await api<{ opening: string; voiceId: string }>('narrator', {
    mode: 'opening',
    cast: castSum,
    rumors: generalRumors(history),
  }).catch(() => ({ opening: 'Midnight. One charger left. The cleaner arrives at 6 AM.', voiceId: '' }))
  if (!alive()) return
  const narratorVoice = op.voiceId
  useFilm.setState({ opening: op.opening, shot: { type: 'orbit', reason: 'opening' } })
  await narrate(op.opening, narratorVoice)
  useFilm.setState({ subtitle: null })

  // ---- beats
  const total = useFilm.getState().totalBeats
  // every agent decides in parallel, each sees the same world
  const decide = (beat: number) => {
    const w = { ...world(), beat }
    return Promise.all(
      cast.map(async (c) => {
        const { crop: _c, model: _m, ...card } = c
        const raw = await api<AgentAction>('beat', { character: card, cast: castSum, world: w }).catch(() => ({
          action: 'say',
          text: '…',
          why: 'lost in thought',
        }))
        return { c, a: validateAction(raw, c.id, castSum, c.skill) }
      }),
    )
  }
  let next: ReturnType<typeof decide> | null = null
  for (let beat = 1; beat <= total; beat++) {
    if (!alive()) return
    useFilm.setState({ beat })
    if (!next) useFilm.setState({ phase: 'thinking' })
    const decisions = await (next ?? decide(beat))
    next = null
    if (!alive()) return

    // prefetch voices while the camera decides
    for (const { c, a } of decisions) {
      const line = spokenLine(a)
      if (line) prefetch(line, c.voiceId, c.mood)
    }
    const planned: LogEntry[] = decisions.map(({ c, a }) => toLog(beat, c, a, cast))
    const shot = await api<Shot>('camera', { events: planned, cast: castSum }).catch(
      () => ({ type: 'wide', reason: 'fallback' }) as Shot,
    )
    useFilm.setState({ shot, phase: 'acting' })

    // play actions one by one: whispers & betrayals feel better spaced out
    const order = [...decisions].sort((x, y) => rank(x.a) - rank(y.a))
    for (const [k, { c, a }] of order.entries()) {
      if (!alive()) return
      applyAction(c, a)
      // the world is final for this beat: let the agents think about the next one while this line plays
      if (k === order.length - 1 && beat < total) next = decide(beat + 1)
      const entry = toLog(beat, c, a, cast)
      useFilm.setState((s) => ({ log: [...s.log, entry] }))
      if (a.action === 'whisper' && a.target) {
        api('whisper', {
          whisper: { beat, from: c.id, to: a.target, text: a.text },
          fromName: c.name,
          toName: entry.targetName,
        }).catch(() => {})
      }
      if (shot.type === 'closeup' || shot.type === 'over_shoulder') {
        // keep the camera on whoever is acting this moment if it's the dramatic one
        if (a.action === 'betray' || a.action === 'whisper') useFilm.setState({ shot: { ...shot, subject: c.id } })
      }
      const line = spokenLine(a)
      useFilm.setState({ speakingId: line ? c.id : null })
      if (line) await speak(line, c.voiceId, cast.indexOf(c), { whisper: a.action === 'whisper', mood: c.mood })
      else await sleep(800)
      useFilm.setState({ speakingId: null })
      await sleep(120)
    }
  }
  if (!alive()) return

  // ---- ending
  useFilm.setState({ phase: 'ending', shot: { type: 'wide', reason: 'the verdict' } })
  const s = useFilm.getState()
  const ending = await api<Ending & { voiceId: string }>('narrator', {
    mode: 'ending',
    cast: castSum,
    log: s.log,
    world: world(),
  }).catch(() => ({ winnerId: cast[0].id, title: 'After Hours', ending: 'Dawn breaks.', verdict: '', voiceId: narratorVoice }))
  if (!alive()) return
  useFilm.setState({ ending, shot: { type: 'closeup', subject: ending.winnerId, reason: 'the winner' } })
  // the poster renders while the Narrator reads the last line
  const posterPromise = makePoster(ending.title, ending.ending)
  await narrate(ending.ending, narratorVoice)

  const winner = cast.find((c) => c.id === ending.winnerId) ?? cast[0]
  const highlights = pickHighlights(s.log)
  const run: RunRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    cast: cast.map((c) => ({ id: c.id, name: c.name, object: c.object })),
    winner: { name: winner.name, object: winner.object },
    title: ending.title,
    verdict: ending.verdict,
    highlights,
  }
  await saveRun(run)
  ;(window as any).__lastRun = run
  useFilm.setState({ subtitle: null, phase: 'done', screen: 'credits' })
  const poster = await posterPromise
  if (alive()) useFilm.setState({ poster: poster ?? 'none' })
}

async function makePoster(title: string, ending: string): Promise<string | null> {
  const cast = useFilm.getState().cast
  try {
    const r = await api<{ image: string | null }>('poster', {
      title,
      ending,
      cast: cast.map((c) => ({ name: c.name, object: c.object, crop: c.crop })),
    })
    return r.image
  } catch {
    return null
  }
}

const rank = (a: AgentAction) =>
  ({ move_to: 0, hide_behind: 1, say: 2, whisper: 3, ally: 4, push: 5, use_skill: 6, betray: 7 })[a.action]

function toLog(beat: number, c: Character, a: AgentAction, cast: Character[]): LogEntry {
  const t = cast.find((x) => x.id === a.target)
  return {
    beat,
    actorId: c.id,
    actorName: c.name,
    action: a.action,
    targetId: t?.id ?? a.target,
    targetName: t?.name ?? a.target,
    text: a.text,
    why: a.why,
    emotion: a.emotion,
  }
}

function pickHighlights(log: LogEntry[]): string[] {
  const score = (e: LogEntry) => ({ betray: 5, ally: 3, push: 2, use_skill: 2, whisper: 1 })[e.action as string] ?? 0
  return [...log]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map((e) => `${e.actorName} ${e.action.replace('_', ' ')}${e.targetName ? ` ${e.targetName}` : ''} because ${e.why}`)
}
