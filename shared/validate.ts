import { ACTIONS, SKILLS, SPOTS, type AgentAction, type CastSummary, type Skill } from './types.js'

/** Validate an agent's JSON. Anything unusable becomes a safe "say" action. */
export function validateAction(raw: unknown, selfId: string, cast: CastSummary[], skill: Skill): AgentAction {
  const r = (raw ?? {}) as Record<string, unknown>
  const action = String(r.action ?? '').toLowerCase() as AgentAction['action']
  const why = typeof r.why === 'string' && r.why.trim() ? r.why.trim().slice(0, 220) : 'gut feeling'
  const text = typeof r.text === 'string' ? r.text.trim().slice(0, 160) : undefined
  const emotion = typeof r.emotion === 'string' ? r.emotion.slice(0, 24) : undefined
  const safe: AgentAction = { action: 'say', text: text || '...', why, emotion }
  if (!ACTIONS.includes(action)) return safe

  let target = typeof r.target === 'string' ? r.target.trim() : undefined
  // allow targets by name as well as id
  if (target && !SPOTS[target]) {
    const byId = cast.find((c) => c.id === target)
    const byName = cast.find((c) => c.name.toLowerCase() === target!.toLowerCase())
    target = byId?.id ?? byName?.id
  }
  if (target === selfId) target = undefined

  const needsChar = ['whisper', 'ally', 'betray', 'push', 'hide_behind'].includes(action)
  if (needsChar && (!target || SPOTS[target])) return safe
  if (action === 'move_to' && !target) return { ...safe, action: 'move_to', target: 'charger' }
  if ((action === 'say' || action === 'whisper') && !text) return safe
  if (action === 'use_skill') {
    return { action, target, skill, text, why, emotion }
  }
  return { action, target, text, why, emotion, skill: SKILLS.includes(r.skill as Skill) ? (r.skill as Skill) : undefined }
}
