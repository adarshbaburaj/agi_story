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
      <color attach="background" args={['#efe4d6']} />
      <fog attach="fog" args={['#efe4d6', 11, 26]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fff4e6', '#c9b8a8', 1.1]} />
      <directionalLight position={[-4, 6, 5]} intensity={1.6} color="#fff8ee" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
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
      <pointLight position={[-3, 2.2, 3]} intensity={6} color="#ffe2c4" />
      <pointLight position={[0, 2.5, -3.5]} intensity={10} color="#ffffff" />
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
        <DepthOfField target={focusTarget} worldFocusRange={4.5} bokehScale={1.6} />
        <Bloom luminanceThreshold={1.1} intensity={0.6} mipmapBlur />
        <Vignette offset={0.35} darkness={0.35} />
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
