// Every /api/<name> call lands here, both in `vite dev` (middleware) and on Vercel (api/[route].ts).
import type {
  AgentAction,
  CastSummary,
  Character,
  Ending,
  LogEntry,
  Model3D,
  ModelPart,
  RunRecord,
  Shape,
  Shot,
  Whisper,
  WorldState,
} from '../shared/types.js'
import { MOOD_ORDER, MOODS, SPOTS, type Mood } from '../shared/types.js'
import { validateAction } from '../shared/validate.js'
import { Tracker, env } from './env.js'
import { geminiImage, geminiReady, models } from './gemini.js'
import { agentsPrefer, llmJSON, llmReady } from './llm.js'
import { elevenReady, NARRATOR_VOICE, tts, voiceList } from './elevenlabs.js'
import { mockBeat, mockCard, mockEnding, mockModel, mockOpening, mockShot } from './mockBrain.js'
import { routeTask } from './router.js'
import {
  adalPoster,
  bandWhisper,
  bruinLoad,
  bruinSave,
  casuroScore,
  finchSkill,
  glasserPrice,
  sponsorConfig,
  telemFact,
  telemWeather,
} from './sponsors/index.js'
import { runwareImage, runwareReady } from './sponsors/runware.js'

type Body = Record<string, any>
type Handler = (body: Body, t: Tracker) => Promise<unknown>

/** Try the models (Gemini → Claude, see llm.ts); on failure or missing keys, use the mock. */
async function viaGemini<T>(t: Tracker, live: () => Promise<T>, mock: () => T): Promise<T> {
  if (!llmReady()) {
    t.mark('Gemini', 'mock')
    return mock()
  }
  try {
    return await live()
  } catch (e) {
    console.warn('[llm] failed, using mock:', (e as Error).message.slice(0, 200))
    return mock()
  }
}

const SHAPES: Shape[] = ['cylinder', 'box', 'sphere', 'card']

// ------------------------------------------------------------------ cast
const cast: Handler = async (b, t) => {
  const { crop, hint, index = 0, total = 1 } = b as {
    crop: string
    hint?: string
    index?: number
    total?: number
  }
  const mood: Mood = MOOD_ORDER[index % MOOD_ORDER.length]
  const M = MOODS[mood]
  const voices = await voiceList()
  // cast members are cast in parallel, so each gets its own slice of the voice list: no two share a voice
  const n = Math.min(Math.max(1, total), voices.length)
  const free = voices.filter((_, k) => k % n === index % n)
  const voiceMenu = (free.length ? free : voices).map((v) => `${v.id}: ${v.desc}`).join('\n')

  const card = await viaGemini(
    t,
    async () => {
      const r = await llmJSON<Record<string, string>>(t, {
        model: routeTask('cast'),
        system:
          'You are the casting director of a Pixar-style short film where real desk objects come alive after the humans leave. Be funny, specific and warm. Respond with JSON only.',
        prompt: `Look at this photo crop of an object on a table${hint ? ` (the user says it is: "${hint}")` : ''}.
Return JSON:
{"object": "what it is, 2-4 words",
 "name": "a short character name derived from the object (brand/model if visible)",
 "shape": one of ${JSON.stringify(SHAPES)} (closest toy body: bottles/cups=cylinder, laptops/phones/books=box, round things=sphere, flat things like lanyards/cards/paper=card),
 "personality": "under 10 words: its core emotion is ${M.label.toUpperCase()} (${M.persona}), mixed with how the object looks",
 "voice": "under 6 words describing its voice (${M.voiceHint})",
 "voiceId": the id of the voice from this list that best fits a ${M.voiceHint} character:\n${voiceMenu}
 "secretGoal": "what it secretly wants tonight, under 14 words",
 "skill": one of Persuade, Deceive, Hide, Rally, Bargain,
 "price": "typical retail price like $24",
 "funFact": "one true, surprising fact about this kind of object, under 18 words",
 "color": "dominant hex color of the object"}`,
        images: [crop],
        temperature: 1,
        prefer: agentsPrefer(),
      })
      return r
    },
    () => {
      const m = mockCard(hint, index)
      return { ...m, voiceId: (free[0] ?? voices[index % voices.length]).id, color: '#c9a27a' } as Record<string, string>
    },
  )

  const object = String(card.object ?? hint ?? 'thing')
  const shape = (SHAPES.includes(card.shape as Shape) ? card.shape : 'box') as Shape
  const [skill, funFact, price] = await Promise.all([
    finchSkill(t, { object, personality: card.personality ?? '' }, card.skill),
    telemFact(t, object, card.funFact ?? ''),
    glasserPrice(t, object, card.price ?? '$?'),
  ])
  const voiceId = voices.some((v) => v.id === card.voiceId) ? card.voiceId : (free[0] ?? voices[0]).id
  return {
    name: String(card.name ?? object).slice(0, 24),
    object,
    shape,
    personality: card.personality ?? M.persona,
    mood,
    voice: card.voice ?? 'plain',
    voiceId,
    secretGoal: card.secretGoal ?? 'survive the night',
    skill,
    facts: { price, funFact },
    color: /^#[0-9a-f]{6}$/i.test(card.color ?? '') ? card.color : '#c9a27a',
  } satisfies Partial<Character>
}

// ------------------------------------------------------------------ model3d (Gemini builds the 3D toy)
function cleanModel(raw: any, shape: Shape, object: string, source: Model3D['source']): Model3D {
  const fallback = mockModel(shape, object)
  if (!raw || typeof raw !== 'object' || !raw.body) return fallback
  const num = (v: unknown, d: number, lo = 0.02, hi = 2) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
  }
  const col = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d)
  const v3 = (v: unknown): [number, number, number] =>
    Array.isArray(v) && v.length === 3 ? (v.map((x) => num(x, 0, -2, 2)) as [number, number, number]) : [0, 0, 0]
  const body = {
    shape: SHAPES.includes(raw.body.shape) ? raw.body.shape : shape,
    width: num(raw.body.width, 0.7, 0.15, 1.4),
    height: num(raw.body.height, 1, 0.15, 1.4),
    depth: num(raw.body.depth, 0.7, 0.03, 1.4),
    color: col(raw.body.color, fallback.body.color),
  }
  const kinds = ['box', 'cylinder', 'sphere', 'cone', 'torus', 'capsule']
  const parts: ModelPart[] = (Array.isArray(raw.parts) ? raw.parts : [])
    .filter((p: any) => p && kinds.includes(p.kind) && Array.isArray(p.size))
    .slice(0, 14)
    .map((p: any) => ({
      kind: p.kind,
      size: p.size.slice(0, 3).map((s: unknown) => num(s, 0.1, 0.005, 1.5)),
      position: v3(p.position),
      rotation: p.rotation ? v3(p.rotation) : undefined,
      color: col(p.color, '#888888'),
      metalness: num(p.metalness, 0.1, 0, 1),
      roughness: num(p.roughness, 0.6, 0, 1),
      emissive: !!p.emissive,
    }))
  const label = raw.label ?? {}
  return {
    body,
    label: {
      y: num(label.y, 0, -1, 1),
      width: num(label.width, body.width * 0.8, 0.1, 1.4),
      height: num(label.height, body.height * 0.55, 0.1, 1.4),
    },
    parts,
    source,
  }
}

const model3d: Handler = async (b, t) => {
  const { crop, object, shape } = b as { crop: string; object: string; shape: Shape }
  return viaGemini(
    t,
    async () => {
      const raw = await llmJSON(t, {
        model: models.builder3d(),
        system:
          'You are a 3D toy designer. You build cute, chunky, instantly recognisable toy versions of real objects out of simple primitives for a three.js scene. Respond with JSON only.',
        prompt: `Build a 3D toy of this "${object}" (photo attached). Coordinates: the toy stands on the floor, body centre at origin, +y up, +z faces the camera, body height about 1 unit.
The body is a ${shape} (box | cylinder | sphere | card) and the user's photo is printed on its front as a label. Add 2-10 extra parts that make it recognisable (lid, straw, cap, screen, keyboard, hinge, handle, strap, clip, buttons, logo…). Use the real colours from the photo. Parts must touch the body; nothing below y = -body.height/2. Leave the upper front area (where eyes go, around y = +0.25*height, z = front) uncovered.
JSON:
{"body":{"shape":"${shape}","width":n,"height":n,"depth":n,"color":"#hex"},
 "label":{"y":n,"width":n,"height":n},
 "parts":[{"kind":"box|cylinder|sphere|cone|torus|capsule","size":[...],"position":[x,y,z],"rotation":[rx,ry,rz],"color":"#hex","metalness":0-1,"roughness":0-1,"emissive":false}]}
Sizes: box [w,h,d], cylinder [radiusTop,radiusBottom,height], sphere [r], cone [r,h], torus [radius,tube], capsule [r,length]. Rotations in radians.`,
        images: crop ? [crop] : [],
        temperature: 0.6,
        timeoutMs: 45000,
        effort: 'medium',
        retries429: 1,
        geminiConcurrency: 2,
      })
      return cleanModel(raw, shape, object, t.report['Gemini'] === 'live' ? 'gemini' : 'claude')
    },
    () => mockModel(shape, object),
  )
}

// ------------------------------------------------------------------ beat (one agent, one decision)
const ACTION_HELP = `move_to {target: character id or spot (charger|window|edge|lamp)} - hop there
say {text} - say it out loud, everyone hears
whisper {target, text} - private message to one character
ally {target} - form an alliance
betray {target} - break an alliance with an ally
push {target} - shove them a step back
hide_behind {target} - hide behind them
use_skill {target} - use your skill card on them`

const beat: Handler = async (b, t) => {
  const { character, cast: castList, world } = b as {
    character: Omit<Character, 'crop' | 'model'>
    cast: CastSummary[]
    world: WorldState
  }
  const me = castList.find((c) => c.id === character.id)!
  const result = await viaGemini<AgentAction>(
    t,
    async () => {
      const others = castList
        .filter((c) => c.id !== character.id)
        .map((c) => `- ${c.id} "${c.name}" (${c.object}, ${c.mood ? MOODS[c.mood].label + ', ' : ''}skill ${c.skill}, ${c.personality}) at ${fmt(world.positions[c.id])}${world.hidden.includes(c.id) ? ' [hiding]' : ''}`)
        .join('\n')
      const allies = world.alliances
        .filter((a) => a.includes(character.id))
        .map((a) => (a[0] === character.id ? a[1] : a[0]))
      const myWhispers = world.whispers
        .filter((w) => w.to === character.id)
        .slice(-3)
        .map((w) => `${name(castList, w.from)} whispered to you: "${w.text}"`)
      const raw = await llmJSON(t, {
        model: routeTask('beat'),
        system: `You are ${character.name}, a ${character.object} on a table after the humans left. You are a character in an animated film.
Personality: ${character.personality}. Voice: ${character.voice}.
Core emotion: ${MOODS[character.mood ?? 'sunny'].label} — ${MOODS[character.mood ?? 'sunny'].persona}.
How you talk (every single line must sound like this): ${MOODS[character.mood ?? 'sunny'].style}
Secret goal: ${character.secretGoal}. Skill card: ${character.skill}. Worth: ${character.facts.price}.
Memory and rumors from earlier tables: ${character.memory.length ? character.memory.join(' | ') : 'none yet'}.
Rules: pick exactly ONE action from the list. Stay in character. Be dramatic and funny, short punchy lines (max 12 words). Refer to your memory or rumors when it matters. Never decide the ending of the film. Alliances can be broken. Return strict JSON only.
Actions:
${ACTION_HELP}
Spots: ${Object.entries(SPOTS).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}`,
        prompt: `Opening: ${world.opening}
Beat ${world.beat} of ${world.totalBeats}.${world.beat >= world.totalBeats - 1 ? ' The night is almost over: make your boldest move.' : ''}
You are at ${fmt(world.positions[character.id])}. Your allies: ${allies.length ? allies.map((a) => name(castList, a)).join(', ') : 'none'}.
Others:
${others}
Last events:
${world.events.slice(-6).map(logLine).join('\n') || 'nothing yet'}
${myWhispers.join('\n')}
Return {"action": "...", "target": "id or spot", "text": "...", "why": "one short sentence, max 20 words", "emotion": "one word"}`,
        temperature: 1.05,
        timeoutMs: 15000,
        prefer: agentsPrefer(),
      })
      return validateAction(raw, character.id, castList, character.skill)
    },
    () => validateAction(mockBeat({ ...me, secretGoal: character.secretGoal }, castList, world), character.id, castList, character.skill),
  )
  return result
}

const fmt = (p?: [number, number]) => (p ? `(${p[0].toFixed(1)}, ${p[1].toFixed(1)})` : '(?)')
const name = (c: CastSummary[], id?: string) => c.find((x) => x.id === id)?.name ?? id ?? ''
const logLine = (e: LogEntry) =>
  `Beat ${e.beat} · ${e.actorName} → ${e.action}${e.targetName ? ` → ${e.targetName}` : ''}${e.text && e.action !== 'whisper' ? ` · "${e.text}"` : ''} · why: ${e.why}`

// ------------------------------------------------------------------ narrator
const narrator: Handler = async (b, t) => {
  const { mode, cast: castList, rumors = [], log = [], world } = b as {
    mode: 'opening' | 'ending'
    cast: CastSummary[]
    rumors?: string[]
    log?: LogEntry[]
    world?: WorldState
  }
  if (mode === 'opening') {
    const weather = await telemWeather(t)
    const opening = await viaGemini(
      t,
      async () => {
        const r = await llmJSON<{ opening: string }>(t, {
          model: routeTask('narrator'),
          system: 'You are the Narrator of a short animated film where desk objects come alive after the humans leave. Dry, cinematic, funny. JSON only.',
          prompt: `Cast: ${castList.map((c) => `${c.name} (${c.object}, ${c.personality})`).join('; ')}.
${weather ? `Real weather tonight: ${weather}.` : ''}
${rumors.length ? `Rumors from earlier tables: ${rumors.join(' | ')}` : ''}
Write ONE opening event in max 30 words that creates a conflict over something scarce (e.g. "Midnight. One charger left. The cleaner arrives at 6 AM."). Return {"opening": "..."}`,
          temperature: 1,
          prefer: agentsPrefer(),
        })
        return r.opening
      },
      () => mockOpening(castList, weather),
    )
    return { opening, voiceId: NARRATOR_VOICE() }
  }
  const ending = await viaGemini<Ending>(
    t,
    async () => {
      const r = await llmJSON<Ending>(t, {
        model: routeTask('narrator'),
        system: 'You are the Narrator. You decide the ending ONLY from what is in the decision log: alliances, betrayals, pushes, skills and who ended up near the charger. JSON only.',
        prompt: `Cast: ${castList.map((c) => `${c.id} = ${c.name} (${c.object})`).join('; ')}
Final positions (charger at 0,0): ${castList.map((c) => `${c.name} ${fmt(world?.positions[c.id])}`).join(', ')}
Alliances at the end: ${(world?.alliances ?? []).map(([a, b2]) => `${name(castList, a)}+${name(castList, b2)}`).join(', ') || 'none'}
Decision log:
${log.map(logLine).join('\n')}
Return {"winnerId": "id of the winner", "title": "a movie title, 2-5 words", "ending": "the last line of the film, max 30 words", "verdict": "why they won, citing specific beats, max 25 words, never mention coordinates or numbers like (0,0)"}`,
        temperature: 0.8,
        prefer: agentsPrefer(),
      })
      if (!castList.some((c) => c.id === r.winnerId)) throw new Error('bad winner')
      return r
    },
    () => mockEnding(castList, log, world ?? { positions: {}, alliances: [] }),
  )
  return { ...ending, voiceId: NARRATOR_VOICE() }
}

// ------------------------------------------------------------------ camera (Cinematographer)
const camera: Handler = async (b, t) => {
  const { events, cast: castList } = b as { events: LogEntry[]; cast: CastSummary[] }
  return viaGemini<Shot>(
    t,
    async () => {
      const r = await llmJSON<Shot>(t, {
        model: routeTask('camera'),
        system: 'You are the Cinematographer of an animated film. Pick one shot for this beat. JSON only.',
        prompt: `This beat's events:\n${events.map(logLine).join('\n')}
Cast ids: ${castList.map((c) => `${c.id}=${c.name}`).join(', ')}
Shots: wide (whole table), closeup (face of subject), over_shoulder (behind subject looking at the scene), orbit (slow circle, for tension).
Return {"type": "...", "subject": "character id or omit", "reason": "max 10 words"}`,
        temperature: 0.7,
        timeoutMs: 8000,
        prefer: agentsPrefer(),
      })
      if (!['wide', 'closeup', 'over_shoulder', 'orbit'].includes(r.type)) throw new Error('bad shot')
      return r
    },
    () => mockShot(events),
  )
}

// ------------------------------------------------------------------ voice (ElevenLabs)
const voice: Handler = async (b, t) => {
  const { text, voiceId, mood } = b as { text: string; voiceId: string; mood?: Mood }
  if (!elevenReady()) {
    t.mark('ElevenLabs', 'mock')
    return { audio: null }
  }
  try {
    const audio = await tts(text, voiceId, mood ? MOODS[mood].voice : undefined)
    t.mark('ElevenLabs', 'live')
    return { audio }
  } catch (e) {
    console.warn('[ElevenLabs]', (e as Error).message)
    t.mark('ElevenLabs', 'error')
    return { audio: null }
  }
}

// ------------------------------------------------------------------ whisper (BAND)
const whisper: Handler = async (b, t) => {
  const { whisper: w, fromName, toName } = b as { whisper: Whisper; fromName: string; toName: string }
  const sent = await bandWhisper(t, w, fromName, toName)
  return { sent }
}

// ------------------------------------------------------------------ poster (AdaL → Runware → Gemini image → client canvas)
const poster: Handler = async (b, t) => {
  const { title, ending, cast: castList } = b as {
    title: string
    ending: string
    cast: { name: string; object: string; crop?: string }[]
  }
  const prompt = `Cinematic animated movie poster titled "${title}". Starring cute 3D toy versions of: ${castList
    .map((c) => `${c.name} the ${c.object}`)
    .join(', ')}. They stand on a wooden desk at night under a single desk lamp, dramatic rim light, polished 3D animated-film style. Tagline: "${ending.slice(0, 80)}". Title text at the top. The only credits text at the bottom reads exactly: "AN AGI STORY PRODUCTION · STARRING ${castList.map((c) => c.name.toUpperCase()).join(' · ')}". Do not include any real studio, company, brand or person names anywhere on the poster.`
  const adal = await adalPoster(t, prompt)
  if (adal) return { image: adal }
  if (runwareReady()) {
    try {
      const url = await runwareImage(prompt)
      t.mark('Runware', 'live')
      return { image: url }
    } catch (e) {
      console.warn('[Runware]', (e as Error).message)
      t.mark('Runware', 'error')
    }
  }
  if (geminiReady() && env('POSTER_WITH_GEMINI') !== 'false') {
    try {
      const image = await geminiImage({
        model: models.image(),
        system: 'You design movie posters.',
        prompt: `${prompt} Base each toy on the attached photos of the real objects.`,
        images: castList.map((c) => c.crop).filter(Boolean).slice(0, 5) as string[],
      })
      t.mark('Gemini', 'live')
      return { image }
    } catch (e) {
      console.warn('[Gemini image]', (e as Error).message)
    }
  }
  return { image: null }
}

// ------------------------------------------------------------------ memory (Bruin)
const memory: Handler = async (b, t) => {
  if (b.run) {
    await bruinSave(t, b.run as RunRecord)
    return { ok: true }
  }
  return { runs: await bruinLoad(t) }
}

// ------------------------------------------------------------------ interview (Casuro)
const interview: Handler = async (b, t) => {
  const { answer, cast: castList, log, ending } = b as {
    answer: string
    cast: CastSummary[]
    log: LogEntry[]
    ending: Ending
  }
  const casuro = await casuroScore(t, { question: 'Who deserved to win, and why?', answer, log, ending })
  if (casuro) return casuro
  return viaGemini(
    t,
    async () =>
      llmJSON<{ pick: string; score: number; evidence: string[]; verdict: string }>(t, {
        model: routeTask('narrator'),
        system: 'You interview a film-festival judge after an AI-agent film and score how well their answer is backed by what happened. JSON only.',
        prompt: `Question: "Who deserved to win, and why?"
Judge's answer: "${answer}"
Actual winner: ${name(castList, ending.winnerId)}. Log:
${log.map(logLine).join('\n')}
Return {"pick": "character name the judge chose", "score": 0-10 how well the log supports them, "evidence": ["1-3 log beats that support or contradict them"], "verdict": "one sentence the characters will remember next run, e.g. 'A judge said Cold Brew was robbed.'"}`,
        temperature: 0.5,
        prefer: agentsPrefer(),
      }),
    () => {
      const picked = castList.find((c) => answer.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])) ?? castList[0]
      return {
        pick: picked.name,
        score: 6,
        evidence: log.filter((e) => e.actorId === picked.id).slice(0, 2).map(logLine),
        verdict: `A judge said ${picked.name} deserved to win: "${answer.slice(0, 80)}"`,
      }
    },
  )
}

// ------------------------------------------------------------------ status
const status: Handler = async () => ({ sponsors: sponsorConfig() })

const ROUTES: Record<string, Handler> = {
  cast,
  model3d,
  beat,
  narrator,
  camera,
  voice,
  whisper,
  poster,
  memory,
  interview,
  status,
}

export async function handle(route: string, body: Body): Promise<{ status: number; body: unknown }> {
  const h = ROUTES[route]
  if (!h) return { status: 404, body: { error: `unknown route ${route}` } }
  const t = new Tracker()
  try {
    const out = (await h(body ?? {}, t)) as Record<string, unknown>
    return { status: 200, body: { ...out, _sponsors: t.report } }
  } catch (e) {
    console.error(`[api/${route}]`, e)
    return { status: 500, body: { error: (e as Error).message, _sponsors: t.report } }
  }
}
