import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SPOTS } from '../../shared/types'
import { textureFromDataUrl, woodTexture } from './live'

export function Table() {
  const tex = useMemo(woodTexture, [])
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[6.2, 0.24, 3.8]} />
        <meshStandardMaterial map={tex} color="#e9c9a3" roughness={0.5} metalness={0.02} />
      </mesh>
      {[
        [-2.8, -1.6],
        [2.8, -1.6],
        [-2.8, 1.6],
        [2.8, 1.6],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -1.4, z]} castShadow>
          <boxGeometry args={[0.2, 2.4, 0.2]} />
          <meshStandardMaterial color="#3e2716" />
        </mesh>
      ))}
      {/* seamless studio sweep: floor curving up into the back wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#e8dccd" roughness={0.95} />
      </mesh>
      <mesh position={[0, 4, -7]} receiveShadow>
        <planeGeometry args={[60, 20]} />
        <meshStandardMaterial color="#efe4d6" roughness={0.95} />
      </mesh>
    </group>
  )
}

/** The prize: the last charger, glowing in the centre. */
export function Charger() {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) (ring.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(clock.elapsedTime * 2.5) * 1.2
  })
  const [x, z] = SPOTS.charger
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.28, 0.06, 40]} />
        <meshStandardMaterial color="#1c1c22" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh ref={ring} position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.2, 48]} />
        <meshStandardMaterial color="#59ffb0" emissive="#3dffa0" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* cable snaking to the table edge */}
      <mesh position={[0, 0.02, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.5, 8]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
    </group>
  )
}

export function Lamp() {
  return (
    <group position={[2.55, 0, -1.45]} rotation={[0, -0.6, 0]}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.08, 32]} />
        <meshStandardMaterial color="#2b2b30" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.85, 0]} rotation={[0, 0, 0.18]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.7, 12]} />
        <meshStandardMaterial color="#2b2b30" metalness={0.6} roughness={0.35} />
      </mesh>
      <group position={[-0.25, 1.68, 0.1]} rotation={[0.3, 0, 0.9]}>
        <mesh castShadow>
          <coneGeometry args={[0.32, 0.45, 32, 1, true]} />
          <meshStandardMaterial color="#c0392b" side={THREE.DoubleSide} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#fff3c4" emissive="#ffd27a" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Moonlight from a window falling on the table: the "window seat". */
export function WindowLight() {
  const [x, z] = SPOTS.window
  return (
    <group>
      <mesh position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshBasicMaterial color="#8fb8ff" transparent opacity={0.16} />
      </mesh>
      <spotLight position={[x - 1.5, 3.5, z - 2]} angle={0.35} penumbra={0.8} intensity={18} color="#9cc0ff" />
    </group>
  )
}

/** The user's photo, blurred, hanging behind the table like a dream of daytime. */
export function Backdrop({ url }: { url: string | null }) {
  const tex = useMemo(() => (url ? textureFromDataUrl(url) : null), [url])
  if (!tex) return null
  return (
    <group position={[-2.2, 2.6, -6.9]} rotation={[0, 0.12, 0]}>
      <mesh position={[0, 0, -0.02]} castShadow>
        <boxGeometry args={[3.5, 2.1, 0.06]} />
        <meshStandardMaterial color="#fbf7f1" roughness={0.6} />
      </mesh>
      <mesh>
        <planeGeometry args={[3.2, 1.8]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
    </group>
  )
}
