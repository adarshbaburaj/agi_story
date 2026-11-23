import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFilm } from '../film/store'
import { CameraRig } from './CameraRig'
import { focusTarget, livePos } from './live'
import { ObjectActor } from './ObjectActor'
import { Backdrop, Charger, Lamp, Table, WindowLight } from './Props'
import { WhisperLines } from './WhisperLines'

export function Stage() {
  const cast = useFilm((s) => s.cast)
  const backdrop = useFilm((s) => s.backdrop)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 3.3, 5.7], fov: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#0d0907']} />
      <fog attach="fog" args={['#0d0907', 7, 15]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#ffd9a8', '#1a1020', 0.5]} />
      <spotLight
        position={[2.3, 4.4, -1.2]}
        angle={0.8}
        penumbra={0.6}
        intensity={80}
        color="#ffd49a"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-3, 2.2, 3]} intensity={8} color="#7aa7ff" />
      <Suspense fallback={null}>
        <Backdrop url={backdrop} />
        <Table />
        <Lamp />
        <Charger />
        <WindowLight />
        {cast.map((c, i) => (
          <ObjectActor key={c.id} ch={c} index={i} />
        ))}
        <WhisperLines />
        <Confetti />
      </Suspense>
      <CameraRig />
      <EffectComposer multisampling={0}>
        <DepthOfField target={focusTarget} worldFocusRange={3.2} bokehScale={2.2} />
        <Bloom luminanceThreshold={0.85} intensity={0.9} mipmapBlur />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  )
}

/** Confetti burst over the winner. */
function Confetti() {
  const ending = useFilm((s) => s.ending)
  const count = 220
  const ref = useRef<THREE.InstancedMesh>(null)
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 2.4),
        r: Math.random() * Math.PI,
        delay: Math.random() * 0.3,
      })),
    [ending?.winnerId],
  )
  const colors = useMemo(() => {
    const pal = ['#ff2d55', '#ffd166', '#5ee7ff', '#7c5cff', '#59ffb0']
    return Array.from({ length: count }, (_, i) => new THREE.Color(pal[i % pal.length]))
  }, [])
  const start = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    if (!ending) {
      m.visible = false
      start.current = 0
      return
    }
    if (!start.current) {
      start.current = clock.elapsedTime
      colors.forEach((c, i) => m.setColorAt(i, c))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    m.visible = true
    const w = livePos[ending.winnerId] ?? new THREE.Vector3()
    const t = clock.elapsedTime - start.current
    parts.forEach((p, i) => {
      const tt = Math.max(0, t - p.delay)
      dummy.position.set(w.x + p.v.x * tt, 1.2 + p.v.y * tt - 4.9 * tt * tt * 0.5, w.z + p.v.z * tt)
      if (dummy.position.y < 0.01) dummy.position.y = 0.01
      dummy.rotation.set(p.r + tt * 6, p.r * 2 + tt * 4, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} visible={false}>
      <planeGeometry args={[0.06, 0.1]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}
