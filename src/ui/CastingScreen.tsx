// Snap → drag boxes around 3-5 objects → each crop becomes a character (Gemini vision) with a
// Gemini-built 3D body, a Finch skill, a Telem fact and a Glasser price.
import { useRef, useState } from 'react'
import { MOODS, SKILLS, type Character, type Model3D, type Skill, type Vec2 } from '../../shared/types'
import { api } from '../api'
import { refreshMemory, runFilm } from '../film/engine'
import { useFilm } from '../film/store'
import { cropBox, drawDemoTable, preparePhoto, type Box } from './demoTable'

const SEATS: Vec2[] = [
  [-1.5, 0.55],
  [-0.5, 0.95],
  [0.55, 0.9],
  [1.55, 0.45],
  [0.0, -0.95],
]

type Status = 'idle' | 'casting' | 'building' | 'done' | 'error'

export function CastingScreen() {
  const photo = useFilm((s) => s.photo)
  const screen = useFilm((s) => s.screen)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [draft, setDraft] = useState<Box | null>(null)
  const [status, setStatus] = useState<Record<number, Status>>({})
  const [busy, setBusy] = useState(false)
  const imgWrap = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  async function onFile(f: File | undefined) {
    if (!f) return
    const url = URL.createObjectURL(f)
    const { photo, backdrop } = await preparePhoto(url)
    useFilm.setState({ photo, backdrop, cast: [] })
    setBoxes([])
  }
  async function useDemo() {
    // prefer a real backup photo if one was dropped into public/demo/table.jpg
    const real = await fetch('/demo/table.jpg', { method: 'HEAD' }).then((r) => r.ok && r.headers.get('content-type')?.startsWith('image'), () => false)
    if (real) {
      const { photo, backdrop } = await preparePhoto('/demo/table.jpg')
      useFilm.setState({ photo, backdrop, cast: [] })
      // optional preset boxes for the backup photo (public/demo/table.json)
      const preset = await fetch('/demo/table.json').then((r) => (r.ok ? r.json() : null), () => null)
      setBoxes(Array.isArray(preset?.boxes) ? preset.boxes : [])
      return
    }
    const d = drawDemoTable()
    const { backdrop } = await preparePhoto(d.photo)
    useFilm.setState({ photo: d.photo, backdrop, cast: [] })
    setBoxes(d.boxes)
  }

  const rel = (e: React.PointerEvent) => {
    const r = imgWrap.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.box')) return
    if (boxes.length >= 5) return
    start.current = rel(e)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!start.current) return
    const p = rel(e)
    const s = start.current
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => {
    if (draft && draft.w > 0.03 && draft.h > 0.03) setBoxes((b) => [...b, draft])
    setDraft(null)
    start.current = null
  }

  async function castThem() {
    if (!photo || boxes.length < 2) return
    setBusy(true)
    const results: (Character | null)[] = Array(boxes.length).fill(null)
    useFilm.setState({ cast: [], screen: 'cast' })
    await Promise.all(
      boxes.map(async (b, i) => {
        try {
          setStatus((s) => ({ ...s, [i]: 'casting' }))
          const crop = await cropBox(photo, b)
          const card = await api<Omit<Character, 'id' | 'crop' | 'position' | 'memory'>>('cast', {
            crop,
            hint: b.label,
            index: i,
            total: boxes.length,
          })
          const ch: Character = { ...card, id: `obj_${i + 1}`, crop, position: SEATS[i], memory: [], box: { x: b.x, y: b.y, w: b.w, h: b.h } }
          results[i] = ch
          useFilm.setState({ cast: results.filter(Boolean) as Character[], positions: Object.fromEntries(results.filter(Boolean).map((c) => [c!.id, c!.position])) })
          setStatus((s) => ({ ...s, [i]: 'done' }))
        } catch (e) {
          console.error(e)
          setStatus((s) => ({ ...s, [i]: 'error' }))
        }
      }),
    )
    // every character gets a different skill card so the film has variety
    const final = results.filter(Boolean) as Character[]
    const used = new Set<Skill>()
    for (const c of final) {
      if (used.has(c.skill)) c.skill = SKILLS.find((s) => !used.has(s)) ?? c.skill
      used.add(c.skill)
    }
    useFilm.setState({ cast: final })
    await refreshMemory()
    setBusy(false)
    // 3D bodies (for the 3D view) build in the background; the living photo doesn't need them
    for (const c of final) {
      api<Model3D>('model3d', { crop: c.crop, object: c.object, shape: c.shape })
        .then((model) => useFilm.setState((st) => ({ cast: st.cast.map((x) => (x.id === c.id ? { ...x, model } : x)) })))
        .catch(() => {})
    }
  }

  if (screen === 'cast') return <CastIntro busy={busy} status={status} total={boxes.length} onBack={() => useFilm.setState({ screen: 'snap' })} />

  return (
    <div className="snap">
      <div className="snap-head">
        <h1>
          AGI Story <small>After Hours · your table, after the humans leave</small>
        </h1>
        <p>1 · Snap a photo of the table. 2 · Drag a box around 3–5 objects. 3 · They become the cast.</p>
      </div>
      {!photo ? (
        <div className="snap-empty">
          <label className="btn big">
            📷 Snap / upload table photo
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button className="btn ghost" onClick={useDemo}>
            Use backup demo table
          </button>
        </div>
      ) : (
        <>
          <div className="photo" ref={imgWrap} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
            <img src={photo} draggable={false} />
            {boxes.map((b, i) => (
              <div key={i} className="box" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                <span className="n">{i + 1}</span>
                <input
                  placeholder="what is it? (optional)"
                  value={b.label ?? ''}
                  onChange={(e) => setBoxes((bs) => bs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <button onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {draft && <div className="box draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
          </div>
          <div className="snap-actions">
            <label className="btn ghost">
              Retake
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <span className="hint">{boxes.length < 3 ? `Drag boxes around ${3 - boxes.length} more object${3 - boxes.length > 1 ? 's' : ''}` : `${boxes.length} cast members`}</span>
            <button className="btn big" disabled={boxes.length < 2 || busy} onClick={castThem}>
              Cast them →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function CastIntro({ busy, status, total, onBack }: { busy: boolean; status: Record<number, Status>; total: number; onBack: () => void }) {
  const cast = useFilm((s) => s.cast)
  return (
    <div className="castintro">
      <h2>{busy ? 'Casting…' : 'Meet the cast'}</h2>
      <div className="cards">
        {Array.from({ length: total }, (_, i) => {
          const c = cast.find((x) => x.id === `obj_${i + 1}`)
          const st = status[i] ?? 'idle'
          return (
            <div key={i} className={`card ${c ? 'in' : ''}`} style={{ animationDelay: `${i * 120}ms`, borderColor: c?.mood ? MOODS[c.mood].color + '66' : undefined }}>
              {c ? (
                <>
                  <img src={c.crop} />
                  <div className="card-body">
                    <h3>{c.name}</h3>
                    <div className="obj">
                      {c.object} · <b>{c.facts.price}</b>
                    </div>
                    <div className="chips">
                      {c.mood && (
                        <span className="chip mood" style={{ background: MOODS[c.mood].color + '33', color: MOODS[c.mood].color }}>
                          {MOODS[c.mood].emoji} {MOODS[c.mood].label}
                        </span>
                      )}
                      <span className="chip skill">★ {c.skill}</span>
                      <span className="chip">{c.shape}</span>
                      <span className={`chip ${c.model && c.model.source !== 'mock' ? 'live' : ''}`}>
                        {st === 'building' ? '3D: building…' : c.model?.source === 'gemini' ? '3D by Gemini' : c.model?.source === 'claude' ? '3D by Claude' : '3D: basic'}
                      </span>
                    </div>
                    <p className="pers">“{c.personality}” · voice: {c.voice}</p>
                    <p className="goal">Secret goal: {c.secretGoal}</p>
                    <p className="fact">Fun fact: {c.facts.funFact}</p>
                    {c.memory.length > 0 && <p className="mem">🗣 {c.memory[0]}</p>}
                  </div>
                </>
              ) : (
                <div className="card-loading">{st === 'error' ? 'Could not cast this one' : 'Reading the object…'}</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="snap-actions">
        <button className="btn ghost" onClick={onBack} disabled={busy}>
          ← Re-cast
        </button>
        <button className="btn big" disabled={busy || cast.length < 2} onClick={() => runFilm()}>
          ▶ Roll film
        </button>
      </div>
    </div>
  )
}
