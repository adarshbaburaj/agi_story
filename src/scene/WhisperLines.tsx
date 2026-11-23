// BAND whispers as glowing arcs between actors, alliances as gold bonds, skill cards flying.
import { QuadraticBezierLine } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFilm, type Fx, type WhisperLine } from '../film/store'
import { livePos } from './live'

const LIFE = 4000

function Arc({ from, to, color, lift, life, at, width = 3, dashed = true }: { from: string; to: string; color: string; lift: number; life?: number; at?: number; width?: number; dashed?: boolean }) {
  const ref = useRef<any>(null)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const m = new THREE.Vector3()
  useFrame((_, dt) => {
    const l = ref.current
    if (!l || !livePos[from] || !livePos[to]) return
    a.copy(livePos[from]).setY(livePos[from].y + 0.9)
    b.copy(livePos[to]).setY(livePos[to].y + 0.9)
    m.copy(a).add(b).multiplyScalar(0.5).setY(Math.max(a.y, b.y) + lift)
    l.setPoints(a, b, m)
    if (dashed) l.material.uniforms.dashOffset.value -= dt * 1.5
    if (life && at) l.material.opacity = Math.max(0, 1 - (performance.now() - at) / life)
  })
  return (
    <QuadraticBezierLine
      ref={ref}
      start={[0, 0, 0]}
      end={[0, 0, 0.01]}
      color={color}
      lineWidth={width}
      dashed={dashed}
      dashSize={0.12}
      gapSize={0.08}
      transparent
      toneMapped={false}
    />
  )
}

export function WhisperLines() {
  const lines = useFilm((s) => s.whisperLines)
  const alliances = useFilm((s) => s.alliances)
  const fx = useFilm((s) => s.fx)
  const now = performance.now()
  return (
    <>
      {lines
        .filter((l: WhisperLine) => now - l.at < LIFE)
        .map((l) => (
          <Arc key={l.id} from={l.from} to={l.to} color="#5ee7ff" lift={0.7} life={LIFE} at={l.at} width={4} />
        ))}
      {alliances.map(([a, b]) => (
        <Arc key={`${a}-${b}`} from={a} to={b} color="#ffd166" lift={0.25} width={2} dashed={false} />
      ))}
      {fx
        .filter((f: Fx) => f.kind === 'skill' && f.target && now - f.at < 1600)
        .map((f) => (
          <SkillCard key={f.id} fx={f} />
        ))}
    </>
  )
}

function SkillCard({ fx }: { fx: Fx }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    const a = livePos[fx.actor]
    const b = fx.target ? livePos[fx.target] : undefined
    if (!m || !a || !b) return
    const k = Math.min(1, (performance.now() - fx.at) / 1100)
    m.position.lerpVectors(a, b, k).setY(1.2 + Math.sin(k * Math.PI) * 0.8)
    m.rotation.y = k * Math.PI * 4
    m.visible = k < 1
    ;(m.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(k * 20)
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.26, 0.36, 0.02]} />
      <meshStandardMaterial color="#7c5cff" emissive="#7c5cff" emissiveIntensity={2} toneMapped={false} />
    </mesh>
  )
}
