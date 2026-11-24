// Turns one validated agent action into world changes + on-screen effects.
import { SPOTS, type AgentAction, type Character, type Vec2 } from '../../shared/types'
import { useFilm } from './store'

const BOUNDS = { x: 2.4, z: 1.35 }
const clamp = (p: Vec2): Vec2 => [
  Math.max(-BOUNDS.x, Math.min(BOUNDS.x, p[0])),
  Math.max(-BOUNDS.z, Math.min(BOUNDS.z, p[1])),
]
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Keep actors from overlapping; `fixed` keeps its spot. */
function separate(pos: Record<string, Vec2>, fixed: string) {
  const ids = Object.keys(pos)
  for (let iter = 0; iter < 4; iter++) {
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue
        const d = dist(pos[a], pos[b])
        if (d < 0.62) {
          const dx = d < 1e-3 ? 0.3 : (pos[b][0] - pos[a][0]) / d
          const dz = d < 1e-3 ? 0.2 : (pos[b][1] - pos[a][1]) / d
          const push = (0.62 - d) / (a === fixed || b === fixed ? 1 : 2)
          if (a !== fixed) pos[a] = clamp([pos[a][0] - dx * push, pos[a][1] - dz * push])
          if (b !== fixed) pos[b] = clamp([pos[b][0] + dx * push, pos[b][1] + dz * push])
        }
      }
    }
  }
}

/** Point `gap` units short of `to`, coming from `from`. */
function approach(from: Vec2, to: Vec2, gap: number): Vec2 {
  const d = dist(from, to)
  if (d <= gap) return from
  const k = (d - gap) / d
  return clamp([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k])
}

export function applyAction(actor: Character, a: AgentAction) {
  const s = useFilm.getState()
  const pos = { ...s.positions }
  let alliances = [...s.alliances]
  let hidden = s.hidden.filter((h) => h !== actor.id || a.action === 'hide_behind')
  const me = pos[actor.id]
  const tgt = a.target && !SPOTS[a.target] ? pos[a.target] : undefined

  switch (a.action) {
    case 'move_to': {
      const spot = a.target ? (SPOTS[a.target] ?? tgt) : undefined
      if (spot) pos[actor.id] = approach(me, spot, SPOTS[a.target!] ? 0 : 0.55)
      break
    }
    case 'say':
      s.bubble(actor.id, a.text ?? '…', 'say')
      break
    case 'whisper':
      s.bubble(actor.id, a.text ?? '…', 'whisper')
      s.addWhisperLine(actor.id, a.target!)
      break
    case 'ally':
      if (!alliances.some((p) => p.includes(actor.id) && p.includes(a.target!)))
        alliances.push([actor.id, a.target!])
      if (tgt) pos[actor.id] = approach(me, tgt, 0.65)
      s.addFx({ kind: 'ally', actor: actor.id, target: a.target })
      if (a.text) s.bubble(actor.id, a.text, 'say')
      break
    case 'betray':
      alliances = alliances.filter((p) => !(p.includes(actor.id) && p.includes(a.target!)))
      s.addFx({ kind: 'betray', actor: actor.id, target: a.target })
      if (a.text) s.bubble(actor.id, a.text, 'say')
      break
    case 'push':
      if (tgt) {
        pos[actor.id] = approach(me, tgt, 0.6)
        const d = dist(me, tgt) || 1
        pos[a.target!] = clamp([tgt[0] + ((tgt[0] - me[0]) / d) * 0.7, tgt[1] + ((tgt[1] - me[1]) / d) * 0.7])
        hidden = hidden.filter((h) => h !== a.target)
      }
      s.addFx({ kind: 'push', actor: actor.id, target: a.target })
      if (a.text) s.bubble(actor.id, a.text, 'say')
      break
    case 'hide_behind':
      if (tgt) {
        pos[actor.id] = clamp([tgt[0] + 0.1, tgt[1] - 0.6])
        hidden = [...new Set([...hidden, actor.id])]
      }
      break
    case 'use_skill':
      s.addFx({ kind: 'skill', actor: actor.id, target: a.target })
      s.bubble(actor.id, a.text || `${actor.skill}!`, 'skill')
      break
  }
  separate(pos, a.action === 'push' ? a.target! : actor.id)
  if (pos[actor.id][0] !== me[0] || pos[actor.id][1] !== me[1]) s.addFx({ kind: 'hop', actor: actor.id, target: a.target })
  useFilm.setState({ positions: pos, alliances, hidden })
}

/** The line this action speaks out loud (if any). */
export function spokenLine(a: AgentAction): string | null {
  if (a.action === 'say' || a.action === 'whisper') return a.text ?? null
  if (a.text && ['ally', 'betray', 'push', 'use_skill'].includes(a.action)) return a.text
  return null
}
