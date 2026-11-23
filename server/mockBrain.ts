// Offline fallbacks: a small rule-based brain so the film plays even with no keys at all.
import type {
  AgentAction,
  CastSummary,
  Ending,
  LogEntry,
  Model3D,
  Shape,
  Shot,
  WorldState,
} from '../shared/types.js'

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

export function mockCard(hint: string | undefined, index: number) {
  const presets = [
    { object: 'laptop', name: 'MacBook', shape: 'box', personality: 'smug, thinks it runs the table', voice: 'smooth, confident', secretGoal: 'stay plugged into the last charger all night', price: '$1,999', funFact: 'its battery has lived through 400 charge cycles', skill: 'Persuade' },
    { object: 'iced coffee cup', name: 'Cold Brew', shape: 'cylinder', personality: 'jittery, loyal until it isn\'t', voice: 'fast, high, nervous', secretGoal: 'get moved next to the window before it melts', price: '$6.50', funFact: 'cold brew steeps for 12+ hours', skill: 'Bargain' },
    { object: 'water bottle', name: 'Hydra', shape: 'cylinder', personality: 'half-empty and anxious about it', voice: 'soft, worried', secretGoal: 'not get thrown away by the cleaner at 6 AM', price: '$24', funFact: 'a reusable bottle replaces about 150 plastic ones a year', skill: 'Rally' },
    { object: 'lanyard', name: 'Lanyard', shape: 'card', personality: 'knows everyone\'s secrets, trades them', voice: 'raspy, sly', secretGoal: 'get the window seat by blackmail', price: '$3', funFact: 'lanyards were first used by sailors to secure tools', skill: 'Deceive' },
    { object: 'phone', name: 'Pixel', shape: 'box', personality: 'dramatic, 4% battery, desperate', voice: 'bright, panicky', secretGoal: 'reach the charger before dying', price: '$799', funFact: 'phones are checked about 96 times a day', skill: 'Hide' },
  ]
  const p = presets[index % presets.length]
  if (hint) {
    return { ...p, object: hint, name: hint.split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') }
  }
  return p
}

export function mockModel(shape: Shape, object: string): Model3D {
  const colors = ['#e8d5b5', '#6aa9ff', '#ff8a65', '#9ccc65', '#ba68c8', '#ffd54f']
  const color = pick(colors)
  const parts: Model3D['parts'] = []
  let body: Model3D['body'] = { shape, width: 0.7, height: 1, depth: 0.7, color }
  if (shape === 'box' && /laptop|mac/i.test(object)) {
    body = { shape: 'box', width: 1.1, height: 0.75, depth: 0.12, color: '#b8bcc4' }
    parts.push({ kind: 'box', size: [1.1, 0.06, 0.8], position: [0, -0.37, 0.4], color: '#9aa0a8', metalness: 0.7, roughness: 0.3 })
  } else if (shape === 'cylinder') {
    body = { shape, width: 0.55, height: 1.05, depth: 0.55, color }
    if (/coffee|cup/i.test(object)) {
      parts.push({ kind: 'cylinder', size: [0.3, 0.3, 0.06], position: [0, 0.55, 0], color: '#f5f5f5' })
      parts.push({ kind: 'cylinder', size: [0.025, 0.025, 0.5], position: [0.08, 0.78, 0], rotation: [0, 0, 0.2], color: '#2e7d32' })
    } else {
      parts.push({ kind: 'cylinder', size: [0.14, 0.16, 0.2], position: [0, 0.62, 0], color: '#263238' })
    }
  } else if (shape === 'card') {
    body = { shape, width: 0.6, height: 0.85, depth: 0.05, color: '#fafafa' }
    parts.push({ kind: 'torus', size: [0.28, 0.025], position: [0, 0.7, 0], color: '#1e88e5' })
  } else if (shape === 'sphere') {
    body = { shape, width: 0.8, height: 0.8, depth: 0.8, color }
  }
  return { body, label: { y: 0, width: body.width * 0.8, height: body.height * 0.55 }, parts, source: 'mock' }
}

const LINES = {
  say: ['Nobody touches the charger. Nobody.', 'I was here first, remember that.', 'The cleaner comes at six. Tick tock.', 'I have a plan and none of you are in it.', 'Did anyone else hear that?'],
  whisper: ['Help me reach the charger and I\'ll keep your secret.', 'Between us? They\'re bluffing.', 'Stick with me and you survive the morning.', 'I know what happened at the last table.'],
}

export function mockBeat(self: CastSummary & { secretGoal?: string }, cast: CastSummary[], world: WorldState): AgentAction {
  const others = cast.filter((c) => c.id !== self.id)
  const t = pick(others)
  const myAllies = world.alliances.filter((a) => a.includes(self.id)).map((a) => (a[0] === self.id ? a[1] : a[0]))
  const whisperedToMe = world.whispers.filter((w) => w.to === self.id).slice(-1)[0]
  const roll = Math.random()
  const late = world.beat >= world.totalBeats - 2

  if (whisperedToMe && roll < 0.35 && !myAllies.includes(whisperedToMe.from)) {
    const from = cast.find((c) => c.id === whisperedToMe.from)
    return { action: 'ally', target: whisperedToMe.from, text: `Fine, ${from?.name}. Together.`, why: `${from?.name} offered a deal in private`, emotion: 'hopeful' }
  }
  if (late && myAllies.length && roll < 0.5) {
    const ex = cast.find((c) => c.id === myAllies[0])
    return { action: 'betray', target: myAllies[0], text: `Sorry, ${ex?.name}. Only one of us charges.`, why: 'only one can win and the night is almost over', emotion: 'cold' }
  }
  if (roll < 0.2) return { action: 'move_to', target: pick(['charger', 'charger', 'window', 'lamp']), why: self.secretGoal ?? 'it is time to make a move', emotion: 'determined' }
  if (roll < 0.4) return { action: 'whisper', target: t.id, text: pick(LINES.whisper), why: `${t.name} could be useful`, emotion: 'scheming' }
  if (roll < 0.52) return { action: 'push', target: t.id, text: 'Out of my way.', why: `${t.name} is between me and the charger`, emotion: 'angry' }
  if (roll < 0.62) return { action: 'use_skill', skill: self.skill, target: t.id, text: `${self.skill}!`, why: `my ${self.skill} is my best chance against ${t.name}`, emotion: 'smug' }
  if (roll < 0.7) return { action: 'hide_behind', target: t.id, why: 'nobody can betray what they can\'t see', emotion: 'nervous' }
  if (roll < 0.8 && !myAllies.includes(t.id)) return { action: 'ally', target: t.id, text: 'Truce?', why: `${t.name} and I want the same thing`, emotion: 'hopeful' }
  return { action: 'say', text: pick(LINES.say), why: 'everyone needs to know where I stand', emotion: 'defiant' }
}

export function mockOpening(cast: CastSummary[], weather: string | null) {
  return `Midnight${weather ? `, ${weather} outside` : ''}. The humans are gone. ${cast.length} objects, one charger left, and the cleaner arrives at 6 AM.`
}

export function mockEnding(cast: CastSummary[], log: LogEntry[], world: Pick<WorldState, 'positions' | 'alliances'>): Ending {
  const score: Record<string, number> = Object.fromEntries(cast.map((c) => [c.id, 0]))
  for (const e of log) {
    if (e.action === 'betray') score[e.actorId] += 2
    if (e.action === 'ally') score[e.actorId] += 1
    if (e.action === 'push') score[e.actorId] += 1
    if (e.action === 'push' && e.targetId) score[e.targetId] -= 1
    if (e.action === 'use_skill') score[e.actorId] += 1
  }
  for (const c of cast) {
    const p = world.positions[c.id]
    if (p) score[c.id] += Math.max(0, 2 - Math.hypot(p[0], p[1]) * 1.5)
  }
  const winner = [...cast].sort((a, b) => score[b.id] - score[a.id])[0]
  const betrayal = log.filter((e) => e.action === 'betray').slice(-1)[0]
  return {
    winnerId: winner.id,
    title: `The Last Charger`,
    ending: `${winner.name} plugs in as the sky turns grey.${betrayal ? ` ${betrayal.actorName}'s betrayal of ${betrayal.targetName} changed everything.` : ''}`,
    verdict: `${winner.name} wins: closest to the charger when the cleaner walked in.`,
  }
}

export function mockShot(events: LogEntry[]): Shot {
  const drama = events.find((e) => e.action === 'betray') ?? events.find((e) => e.action === 'whisper') ?? events[0]
  if (!drama) return { type: 'wide', reason: 'establish the table' }
  if (drama.action === 'betray') return { type: 'closeup', subject: drama.actorId, reason: 'a betrayal needs a face' }
  if (drama.action === 'whisper') return { type: 'over_shoulder', subject: drama.actorId, reason: 'secrets feel closer' }
  return { type: pick(['wide', 'orbit', 'closeup']), subject: drama.actorId, reason: 'keep the rhythm moving' }
}
