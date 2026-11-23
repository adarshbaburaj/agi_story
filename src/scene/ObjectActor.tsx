// One object agent: a Gemini-built toy body wrapped in its own photo crop, with eyes, a mouth and a name tag.
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MOODS, type Character, type Model3D, type ModelPart } from '../../shared/types'
import { useFilm } from '../film/store'
import { livePos, textureFromDataUrl } from './live'

const HOP_MS = 650

export function ObjectActor({ ch, index }: { ch: Character; index: number }) {
  const outer = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  const eyes = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  const target = useFilm((s) => s.positions[ch.id] ?? ch.position)
  const hidden = useFilm((s) => s.hidden.includes(ch.id))
  const speaking = useFilm((s) => s.speakingId === ch.id)
  const bubble = useFilm((s) => s.bubbles[ch.id])
  const ending = useFilm((s) => s.ending)
  const phase = useFilm((s) => s.phase)

  const model: Model3D = ch.model ?? fallbackModel(ch)
  const h = model.body.height
  const front = model.body.shape === 'cylinder' || model.body.shape === 'sphere' ? model.body.width / 2 : model.body.depth / 2
  const tex = useMemo(() => textureFromDataUrl(ch.crop), [ch.crop])

  // hop state
  const hop = useRef({ from: new THREE.Vector2(...ch.position), to: new THREE.Vector2(...ch.position), t0: -1e9 })
  const cur = useRef(new THREE.Vector2(...ch.position))
  useEffect(() => {
    hop.current = { from: cur.current.clone(), to: new THREE.Vector2(target[0], target[1]), t0: performance.now() }
  }, [target[0], target[1]])

  if (!livePos[ch.id]) livePos[ch.id] = new THREE.Vector3(ch.position[0], 0, ch.position[1])
  const blink = useRef({ next: 1 + Math.random() * 3, until: 0 })

  useFrame(({ clock }, dt) => {
    const now = performance.now()
    const t = clock.elapsedTime
    const g = outer.current
    if (!g || !body.current) return
    const s = useFilm.getState()

    // position: hop arc toward target
    const p = Math.min(1, (now - hop.current.t0) / HOP_MS)
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    cur.current.lerpVectors(hop.current.from, hop.current.to, e)
    const moving = p < 1 && hop.current.from.distanceTo(hop.current.to) > 0.01
    // in-place hop for ally / hop fx
    const fx = s.fx.filter((f) => (f.actor === ch.id || f.target === ch.id) && now - f.at < 900)
    const jump = fx.find((f) => f.kind === 'ally' || (f.kind === 'hop' && f.actor === ch.id))
    const jp = jump ? (now - jump.at) / 600 : 1
    let y = moving ? Math.sin(Math.PI * p) * 0.45 : jp < 1 ? Math.sin(Math.PI * jp) * 0.3 : 0

    const isWinner = ending?.winnerId === ch.id && (phase === 'ending' || phase === 'done')
    const isLoser = !!ending && !isWinner && (phase === 'ending' || phase === 'done')
    if (isWinner) y = Math.abs(Math.sin(t * 4)) * 0.35
    g.position.set(cur.current.x, y, cur.current.y)
    livePos[ch.id].set(cur.current.x, y, cur.current.y)

    // squash & stretch
    const land = moving ? (p > 0.85 ? 1 - (p - 0.85) * 4 : 1) : 1
    const stretch = moving ? 1 + Math.sin(Math.PI * p) * 0.18 : 1 + Math.sin(t * 2 + index) * 0.02
    const sq = land < 1 ? 0.85 : 1
    const sc = hidden ? 0.8 : 1
    body.current.scale.set(sc / Math.sqrt(stretch * sq), sc * stretch * sq, sc / Math.sqrt(stretch * sq))

    // push recoil, betrayal shake
    const pushed = fx.find((f) => f.kind === 'push' && f.target === ch.id)
    const betrayed = fx.find((f) => f.kind === 'betray' && f.target === ch.id)
    const shake = betrayed ? Math.sin(now / 25) * 0.08 * (1 - (now - betrayed.at) / 900) : 0
    const tilt = pushed ? Math.sin(((now - pushed.at) / 900) * Math.PI) * 0.4 : 0

    // facing: look toward camera, lean toward whoever we are interacting with
    let yaw = Math.sin(t * 0.7 + index) * 0.12
    const act = fx.find((f) => f.actor === ch.id && f.target && livePos[f.target])
    if (act) {
      const tp = livePos[act.target!]
      yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(tp.x - g.position.x, tp.z - g.position.z)))
    }
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, isWinner ? t * 3 : yaw, isWinner ? 1 : 0.08)
    const tipTarget = isLoser ? (index % 2 ? 1 : -1) * 1.45 : tilt + shake
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, tipTarget, isLoser ? 0.04 : 0.3)

    // blink
    if (eyes.current) {
      if (t > blink.current.next) {
        blink.current.until = t + 0.12
        blink.current.next = t + 2 + Math.random() * 3.5
      }
      eyes.current.scale.y = t < blink.current.until || isLoser ? 0.12 : 1
    }
    // mouth
    if (mouth.current) {
      const open = speaking ? 0.35 + Math.abs(Math.sin(t * 17)) * 0.9 + Math.abs(Math.sin(t * 7.3)) * 0.4 : isWinner ? 1.1 : 0.25
      mouth.current.scale.y = THREE.MathUtils.lerp(mouth.current.scale.y, open, 0.35)
    }
    // fx ring
    if (ring.current) {
      const f = fx.find((x) => x.target === ch.id && x.kind !== 'hop') ?? fx.find((x) => x.actor === ch.id && x.kind === 'ally')
      const m = ring.current.material as THREE.MeshBasicMaterial
      if (f) {
        const k = (now - f.at) / 900
        ring.current.visible = true
        ring.current.scale.setScalar(0.6 + k * 1.4)
        m.opacity = 1 - k
        m.color.set(f.kind === 'betray' ? '#ff2d55' : f.kind === 'ally' ? '#ffd166' : f.kind === 'skill' ? '#7c5cff' : '#ff9f43')
      } else ring.current.visible = false
    }
    void dt
  })

  const eyeY = h * 0.27
  const bubbleAge = bubble ? performance.now() - bubble.at : 1e9
  const showBubble = bubble && bubbleAge < 6000

  return (
    <group ref={outer} position={[ch.position[0], 0, ch.position[1]]}>
      <group ref={body}>
        <group position={[0, h / 2, 0]}>
          <Body model={model} />
          <Label model={model} tex={tex} front={front} />
          {model.parts.map((p, i) => (
            <Part key={i} part={p} />
          ))}
          {/* googly eyes */}
          <group ref={eyes} position={[0, eyeY, front + 0.04]}>
            {[-1, 1].map((sgn) => (
              <group key={sgn} position={[sgn * Math.min(0.15, model.body.width * 0.2), 0, 0]}>
                <mesh>
                  <sphereGeometry args={[0.085, 20, 20]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.01, 0.06]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#111" roughness={0.1} />
                </mesh>
              </group>
            ))}
          </group>
          <mesh ref={mouth} position={[0, eyeY - 0.17, front + 0.03]} scale={[1, 0.25, 1]}>
            <sphereGeometry args={[0.07, 20, 12]} />
            <meshStandardMaterial color="#3a0d12" roughness={0.5} />
          </mesh>
        </group>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={false}>
        <ringGeometry args={[0.45, 0.55, 48]} />
        <meshBasicMaterial transparent toneMapped={false} />
      </mesh>
      <Html position={[0, -0.05, 0.55]} center zIndexRange={[10, 0]}>
        <div className={`nametag ${hidden ? 'dim' : ''}`} style={{ boxShadow: ch.mood ? `0 0 0 1.5px ${MOODS[ch.mood].color}` : undefined }}>
          {ch.mood && <span>{MOODS[ch.mood].emoji}</span>}
          <b>{ch.name}</b>
          <span className="skill">{ch.skill}</span>
        </div>
      </Html>
      {showBubble && (
        <Html position={[0, h + 0.45, 0]} center zIndexRange={[20, 11]}>
          <div className={`bubble ${bubble.kind}`} key={bubble.at}>
            {bubble.kind === 'whisper' && <i>psst… </i>}
            {bubble.kind === 'skill' && <span className="skillcard">★ {ch.skill}</span>}
            {bubble.text}
          </div>
        </Html>
      )}
    </group>
  )
}

function Body({ model }: { model: Model3D }) {
  const { shape, width, height, depth, color } = model.body
  const mat = <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
  if (shape === 'cylinder')
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[width / 2, width / 2.1, height, 40]} />
        {mat}
      </mesh>
    )
  if (shape === 'sphere')
    return (
      <mesh castShadow receiveShadow scale={[width / height, 1, depth / height]}>
        <sphereGeometry args={[height / 2, 40, 32]} />
        {mat}
      </mesh>
    )
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      {mat}
    </mesh>
  )
}

/** The photo crop printed on the front: curved for cylinders, flat otherwise. */
function Label({ model, tex, front }: { model: Model3D; tex: THREE.Texture; front: number }) {
  const { label, body } = model
  if (body.shape === 'cylinder') {
    const r = body.width / 2 + 0.006
    const arc = Math.min(2.4, label.width / r)
    return (
      <mesh position={[0, label.y, 0]}>
        <cylinderGeometry args={[r, r, label.height, 32, 1, true, -arc / 2, arc]} />
        <meshStandardMaterial map={tex} roughness={0.5} side={THREE.FrontSide} />
      </mesh>
    )
  }
  return (
    <mesh position={[0, label.y, front + 0.006]}>
      <planeGeometry args={[label.width, label.height]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  )
}

function Part({ part }: { part: ModelPart }) {
  const s = part.size
  const geo = (() => {
    switch (part.kind) {
      case 'box':
        return <boxGeometry args={[s[0] ?? 0.1, s[1] ?? 0.1, s[2] ?? 0.1]} />
      case 'cylinder':
        return <cylinderGeometry args={[s[0] ?? 0.1, s[1] ?? s[0] ?? 0.1, s[2] ?? 0.1, 28]} />
      case 'sphere':
        return <sphereGeometry args={[s[0] ?? 0.1, 24, 18]} />
      case 'cone':
        return <coneGeometry args={[s[0] ?? 0.1, s[1] ?? 0.2, 28]} />
      case 'torus':
        return <torusGeometry args={[s[0] ?? 0.2, s[1] ?? 0.03, 12, 40]} />
      case 'capsule':
        return <capsuleGeometry args={[s[0] ?? 0.05, s[1] ?? 0.2, 6, 16]} />
    }
  })()
  return (
    <mesh position={part.position} rotation={part.rotation ?? [0, 0, 0]} castShadow>
      {geo}
      <meshStandardMaterial
        color={part.color}
        metalness={part.metalness ?? 0.1}
        roughness={part.roughness ?? 0.6}
        emissive={part.emissive ? part.color : '#000000'}
        emissiveIntensity={part.emissive ? 1.5 : 0}
      />
    </mesh>
  )
}

function fallbackModel(ch: Character): Model3D {
  const dims = {
    cylinder: [0.55, 1, 0.55],
    box: [0.8, 0.9, 0.5],
    sphere: [0.8, 0.8, 0.8],
    card: [0.6, 0.85, 0.05],
  }[ch.shape]
  return {
    body: { shape: ch.shape, width: dims[0], height: dims[1], depth: dims[2], color: ch.color },
    label: { y: -0.05, width: dims[0] * 0.85, height: dims[1] * 0.55 },
    parts: [],
    source: 'mock',
  }
}
