// The living photo: the real table photo stays as it is, and each object in it comes alive in place:
// googly eyes and a talking mouth on the real object, hops, leans, shakes, glows, speech bubbles,
// thought clouds and whisper arcs between the real items. A Ken Burns camera follows the
// Cinematographer agent's shots.
import { useEffect, useMemo, useRef, useState } from 'react'
import { MOODS, type Character } from '../../shared/types'
import { CINEMA } from '../film/cinema'
import { useFilm } from '../film/store'

type Rect = { x: number; y: number; w: number; h: number }

// named spots from the agents' world, placed on the photo
const PHOTO_SPOTS: Record<string, [number, number]> = {
  charger: [0.5, 0.86],
  window: [0.08, 0.2],
  edge: [0.92, 0.92],
  lamp: [0.88, 0.14],
}

export function PhotoStage() {
  const photo = useFilm((s) => s.photo)
  const cast = useFilm((s) => s.cast)
  const stageRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [aspect, setAspect] = useState(16 / 9)

  useEffect(() => {
    if (!photo) return
    const img = new Image()
    img.onload = () => setAspect(img.naturalWidth / img.naturalHeight)
    img.src = photo
  }, [photo])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the photo, fitted to cover the stage (it is the whole world)
  const fit = useMemo(() => {
    const sw = stage.w
    const sh = stage.h
    let w = sw
    let h = sw / aspect
    if (h < sh) {
      h = sh
      w = sh * aspect
    }
    return { x: (sw - w) / 2, y: (sh - h) / 2, w, h }
  }, [stage, aspect])

  const boxPx = (c: Character): Rect | null =>
    c.box ? { x: c.box.x * fit.w, y: c.box.y * fit.h, w: c.box.w * fit.w, h: c.box.h * fit.h } : null

  // --- camera: smooth zoom/pan toward the shot's subject ---
  const cam = useRef({ s: 1, tx: 0, ty: 0 })
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const el = camRef.current
      if (!el) return
      const st = useFilm.getState()
      const t = now / 1000
      const id = CINEMA ? (st.speakingId ?? st.focusId ?? st.shot.subject) : (st.shot.subject ?? st.speakingId)
      const subj = st.cast.find((c) => c.id === id)
      const b = subj ? boxPx(subj) : null
      let s = 1.04 + Math.sin(t * 0.15) * 0.02
      let px = fit.w / 2
      let py = fit.h / 2
      const filming = st.screen === 'film' || st.screen === 'credits'
      if (filming && b) {
        const type = st.phase === 'opening' ? 'wide' : st.shot.type
        s = type === 'closeup' ? 1.75 : type === 'over_shoulder' ? 1.5 : type === 'orbit' ? 1.3 : 1.15
        if (st.phase === 'done' || st.phase === 'ending') s = 1.6
        px = b.x + b.w / 2
        py = b.y + b.h / 2
        if (type === 'orbit') {
          px += Math.sin(t * 0.3) * 40
          py += Math.cos(t * 0.25) * 20
        }
      }
      // keep the photo covering the frame
      const cx = stage.w / 2
      const cy = stage.h / 2
      let tx = cx - (fit.x + px) * s
      let ty = cy - (fit.y + py) * s
      tx = Math.min(-fit.x * s, Math.max(stage.w - (fit.x + fit.w) * s, tx))
      ty = Math.min(-fit.y * s, Math.max(stage.h - (fit.y + fit.h) * s, ty))
      const c = cam.current
      const k = 0.035
      c.s += (s - c.s) * k
      c.tx += (tx - c.tx) * k
      c.ty += (ty - c.ty) * k
      el.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`
      el.style.setProperty('--inv', String(1 / c.s))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fit, stage, cast])

  if (!photo) return <div className="photo-stage empty" ref={stageRef} />

  return (
    <div className="photo-stage" ref={stageRef}>
      <div className="photo-cam" ref={camRef}>
        <img className="photo-bg" src={photo} style={{ left: fit.x, top: fit.y, width: fit.w, height: fit.h }} draggable={false} />
        <div className="photo-world" style={{ left: fit.x, top: fit.y, width: fit.w, height: fit.h }}>
          <Links cast={cast} boxPx={boxPx} />
          {cast.map((c, i) => {
            const b = boxPx(c)
            return b ? <LivingObject key={c.id} ch={c} index={i} b={b} photo={photo} fit={fit} boxPx={boxPx} /> : null
          })}
          <PhotoConfetti cast={cast} boxPx={boxPx} />
        </div>
      </div>
    </div>
  )
}

function LivingObject({
  ch,
  index,
  b,
  photo,
  fit,
  boxPx,
}: {
  ch: Character
  index: number
  b: Rect
  photo: string
  fit: { w: number; h: number }
  boxPx: (c: Character) => Rect | null
}) {
  const body = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLDivElement>(null)
  const eyes = useRef<HTMLDivElement>(null)
  const pupils = useRef<HTMLDivElement[]>([])
  const mouth = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const bubble = useFilm((s) => s.bubbles[ch.id])
  const thought = useFilm((s) => s.thoughts[ch.id])
  const hidden = useFilm((s) => s.hidden.includes(ch.id))
  const ending = useFilm((s) => s.ending)
  const phase = useFilm((s) => s.phase)
  const mood = ch.mood ? MOODS[ch.mood] : null
  const isWinner = !!ending && ending.winnerId === ch.id && (phase === 'ending' || phase === 'done')
  const isLoser = !!ending && !isWinner && (phase === 'ending' || phase === 'done')

  const eyeSize = Math.max(16, Math.min(54, b.w * 0.16))

  useEffect(() => {
    let raf = 0
    let blinkNext = 1 + index
    let blinkUntil = 0
    let mouthOpen = 0.2
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const t = now / 1000
      const st = useFilm.getState()
      const el = body.current
      if (!el) return
      const fx = st.fx.filter((f) => (f.actor === ch.id || f.target === ch.id) && now - f.at < 1100)
      // hop (move / ally) with squash and stretch
      const hop = fx.find((f) => f.actor === ch.id && (f.kind === 'hop' || f.kind === 'ally'))
      const hp = hop ? Math.min(1, (now - hop.at) / 650) : 1
      let y = hp < 1 ? -Math.sin(Math.PI * hp) * Math.min(60, b.h * 0.22) : 0
      let sx = 1 + (hp < 1 ? (hp > 0.85 ? 0.08 : -Math.sin(Math.PI * hp) * 0.06) : Math.sin(t * 2 + index) * 0.008)
      let sy = 1 + (hp < 1 ? (hp > 0.85 ? -0.08 : Math.sin(Math.PI * hp) * 0.08) : Math.sin(t * 2 + index) * 0.012)
      // lean toward whoever (or wherever) it is acting on
      let lean = 0
      let x = 0
      const act = fx.find((f) => f.actor === ch.id && f.target)
      if (act) {
        const k = Math.sin(Math.min(1, (now - act.at) / 1100) * Math.PI)
        const other = st.cast.find((c) => c.id === act.target)
        const ob = other ? boxPx(other) : null
        const spot = PHOTO_SPOTS[act.target ?? '']
        const tx = ob ? ob.x + ob.w / 2 : spot ? spot[0] * fit.w : b.x
        const dir = Math.sign(tx - (b.x + b.w / 2))
        x = dir * Math.min(36, b.w * 0.12) * k
        lean = dir * 7 * k
      }
      // pushed: knocked back; betrayed: shaken
      const pushed = fx.find((f) => f.kind === 'push' && f.target === ch.id)
      if (pushed) {
        const k = Math.sin(Math.min(1, (now - pushed.at) / 900) * Math.PI)
        const pusher = st.cast.find((c) => c.id === pushed.actor)
        const pb = pusher ? boxPx(pusher) : null
        const dir = pb ? Math.sign(b.x + b.w / 2 - (pb.x + pb.w / 2)) || 1 : 1
        x += dir * 26 * k
        lean += dir * 10 * k
      }
      const betrayed = fx.find((f) => f.kind === 'betray' && f.target === ch.id)
      if (betrayed) x += Math.sin(now / 22) * 6 * (1 - (now - betrayed.at) / 1100)
      if (st.speakingId === ch.id) sy += Math.abs(Math.sin(t * 9)) * 0.02
      if (isWinner) {
        y = -Math.abs(Math.sin(t * 4)) * Math.min(50, b.h * 0.18)
        lean = Math.sin(t * 4) * 4
      }
      if (isLoser) lean = (index % 2 ? 1 : -1) * 9
      el.style.transform = `translate(${x}px, ${y}px) rotate(${lean}deg) scale(${sx}, ${sy})`
      if (shadow.current) {
        const lift = Math.min(1, -y / 60)
        shadow.current.style.transform = `translateX(${x}px) scale(${1 - lift * 0.35})`
        shadow.current.style.opacity = String(0.45 - lift * 0.3)
      }
      // blink
      if (eyes.current) {
        if (t > blinkNext) {
          blinkUntil = t + 0.12
          blinkNext = t + 2 + ((index * 7 + Math.floor(t)) % 4)
        }
        eyes.current.style.transform = `scaleY(${t < blinkUntil || isLoser ? 0.12 : 1})`
      }
      // pupils look at the current speaker / target
      const look = act?.target ? st.cast.find((c) => c.id === act.target) : st.cast.find((c) => c.id === st.speakingId && c.id !== ch.id)
      const lb = look ? boxPx(look) : null
      const dx = lb ? Math.max(-1, Math.min(1, (lb.x + lb.w / 2 - (b.x + b.w / 2)) / 300)) : Math.sin(t * 0.5 + index) * 0.4
      for (const p of pupils.current) if (p) p.style.transform = `translate(${dx * eyeSize * 0.18}px, ${eyeSize * 0.06}px)`
      // mouth
      if (mouth.current) {
        const target = st.speakingId === ch.id ? 0.5 + Math.abs(Math.sin(t * 17)) * 0.9 + Math.abs(Math.sin(t * 7.3)) * 0.4 : isWinner ? 1.2 : 0.22
        mouthOpen += (target - mouthOpen) * 0.35
        mouth.current.style.transform = `scaleY(${mouthOpen})`
      }
      // impact ring
      if (ring.current) {
        const f = fx.find((x2) => x2.target === ch.id && x2.kind !== 'hop') ?? fx.find((x2) => x2.actor === ch.id && x2.kind === 'ally')
        if (f) {
          const k = (now - f.at) / 1100
          ring.current.style.opacity = String(1 - k)
          ring.current.style.transform = `translate(-50%, -50%) scale(${0.7 + k * 0.7})`
          ring.current.style.borderColor = f.kind === 'betray' ? '#ff2d55' : f.kind === 'ally' ? '#ffd166' : f.kind === 'skill' ? '#7c5cff' : '#ff9f43'
        } else ring.current.style.opacity = '0'
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [b.x, b.y, b.w, b.h, isWinner, isLoser, eyeSize])

  const now = performance.now()
  const showBubble = bubble && now - bubble.at < 6000
  const showThought = thought && now - thought.at < 6000

  return (
    <div className={`living ${hidden ? 'hiding' : ''} ${isLoser ? 'lost' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
      <div className="living-shadow" ref={shadow} />
      <div className="living-body" ref={body}>
        {/* the object itself, lifted out of the photo with a feathered edge */}
        <div
          className="living-cutout"
          style={{ backgroundImage: `url(${photo})`, backgroundSize: `${fit.w}px ${fit.h}px`, backgroundPosition: `${-b.x}px ${-b.y}px` }}
        />
        <div className="living-face" style={{ top: b.h * 0.3 - eyeSize / 2 }}>
          <div className="living-eyes" ref={eyes}>
            {[0, 1].map((k) => (
              <div key={k} className="eye" style={{ width: eyeSize, height: eyeSize }}>
                <div className="pupil" ref={(el) => void (el && (pupils.current[k] = el))} style={{ width: eyeSize * 0.46, height: eyeSize * 0.46 }} />
              </div>
            ))}
          </div>
          <div className="living-mouth" ref={mouth} style={{ width: eyeSize * 0.9, height: eyeSize * 0.55, marginTop: eyeSize * 0.25 }} />
        </div>
        <div className="living-ring" ref={ring} style={{ width: Math.max(b.w, b.h) * 1.1, height: Math.max(b.w, b.h) * 1.1 }} />
      </div>
      <div className="living-tag" style={{ borderColor: mood?.color }}>
        {mood?.emoji} <b>{ch.name}</b> <span>{ch.skill}</span>
      </div>
      {showThought && (
        <div className="living-thought" key={thought.at} style={{ borderColor: mood?.color }}>
          <span className="thought-head">💭 {ch.name} thinks</span>
          {thought.text}
        </div>
      )}
      {showBubble && (
        <div className={`living-bubble ${bubble.kind}`} key={bubble.at}>
          {bubble.kind === 'whisper' && <i>psst… </i>}
          {bubble.kind === 'skill' && <span className="skillcard">★ {ch.skill}</span>}
          {bubble.text}
        </div>
      )}
    </div>
  )
}

/** Whisper arcs (cyan, fading) and alliance bonds (gold) between the real objects. */
function Links({ cast, boxPx }: { cast: Character[]; boxPx: (c: Character) => Rect | null }) {
  const lines = useFilm((s) => s.whisperLines)
  const alliances = useFilm((s) => s.alliances)
  const center = (id: string) => {
    const c = cast.find((x) => x.id === id)
    const b = c ? boxPx(c) : null
    return b ? [b.x + b.w / 2, b.y + b.h * 0.3] : null
  }
  const arc = (a: number[], b: number[], lift: number) => {
    const mx = (a[0] + b[0]) / 2
    const my = Math.min(a[1], b[1]) - lift
    return `M ${a[0]} ${a[1]} Q ${mx} ${my} ${b[0]} ${b[1]}`
  }
  const now = performance.now()
  return (
    <svg className="living-links">
      {alliances.map(([a, b]) => {
        const p = center(a)
        const q = center(b)
        return p && q ? <path key={`${a}${b}`} d={arc(p, q, 40)} className="bond" /> : null
      })}
      {lines
        .filter((l) => now - l.at < 4000)
        .map((l) => {
          const p = center(l.from)
          const q = center(l.to)
          return p && q ? <path key={l.id} d={arc(p, q, 140)} className="whisper" /> : null
        })}
    </svg>
  )
}

function PhotoConfetti({ cast, boxPx }: { cast: Character[]; boxPx: (c: Character) => Rect | null }) {
  const ending = useFilm((s) => s.ending)
  const w = ending ? cast.find((c) => c.id === ending.winnerId) : null
  const b = w ? boxPx(w) : null
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: ((i * 37) % 100) - 50,
        d: 0.9 + ((i * 13) % 10) / 10,
        r: (i * 47) % 360,
        c: ['#ff2d55', '#ffd166', '#5ee7ff', '#7c5cff', '#59ffb0'][i % 5],
        delay: ((i * 7) % 10) / 25,
      })),
    [],
  )
  if (!b) return null
  return (
    <div className="living-confetti" style={{ left: b.x + b.w / 2, top: b.y }}>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={
            {
              background: p.c,
              '--dx': `${p.x * 9}px`,
              '--rot': `${p.r + 540}deg`,
              animationDuration: `${p.d * 2.2}s`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
