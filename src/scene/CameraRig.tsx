// Animates the camera to the shot the Cinematographer agent picked.
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { CINEMA } from '../film/cinema'
import { useFilm } from '../film/store'
import { focusTarget, livePos } from './live'

export function CameraRig() {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 0.4, 0))
  const wantPos = new THREE.Vector3()
  const wantLook = new THREE.Vector3()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { shot, screen } = useFilm.getState()
    const subj = shot.subject ? livePos[shot.subject] : undefined
    const type = screen === 'snap' || screen === 'cast' ? 'orbit' : shot.type

    // cinema mode: one continuous take that glides to whoever is thinking or speaking;
    // the Cinematographer agent's shot type still sets how close we are
    if (CINEMA && (screen === 'film' || screen === 'credits')) {
      const s = useFilm.getState()
      const id = s.speakingId ?? s.focusId
      const p = id ? livePos[id] : undefined
      const radius = s.phase === 'opening' ? 7 : type === 'wide' ? 5.6 : type === 'orbit' ? 4.6 : type === 'over_shoulder' ? 4 : 3.5
      // sweep back and forth in front of the cast (faces and photo labels look toward +z), never behind them
      const a = Math.sin(t * 0.07) * 0.6 + (s.phase === 'done' ? Math.sin(t * 0.25) * 0.25 : 0)
      // frame the speaker but keep the cast in shot: aim between the speaker and the table centre
      const cx = p ? p.x * 0.6 : 0
      const cz = p ? p.z * 0.6 : 0
      wantPos.set(cx + Math.sin(a) * radius * 0.55, (s.phase === 'opening' ? 3.4 : 1.0) + radius * 0.22, cz + Math.cos(a) * radius * 0.85 + 0.4)
      wantLook.set(cx, p ? 0.75 : 0.3, cz)
      camera.position.lerp(wantPos, 0.018)
      look.current.lerp(wantLook, 0.03)
      camera.lookAt(look.current)
      focusTarget.copy(look.current)
      return
    }

    if (type === 'closeup' && subj) {
      wantPos.set(subj.x + 0.4 + Math.sin(t * 0.4) * 0.15, 1.45, subj.z + 2.7)
      wantLook.set(subj.x, 0.6, subj.z)
    } else if (type === 'over_shoulder' && subj) {
      const dir = new THREE.Vector3(subj.x, 0, subj.z).normalize()
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1)
      wantPos.set(subj.x + dir.x * 1.5 - 0.4, 1.35, subj.z + dir.z * 1.5 + 0.6)
      wantLook.set(0, 0.4, 0)
    } else if (type === 'orbit') {
      const a = t * 0.12
      wantPos.set(Math.sin(a) * 5.4, 2.6 + Math.sin(t * 0.3) * 0.3, Math.cos(a) * 5.4)
      wantLook.set(0, 0.35, 0)
    } else {
      wantPos.set(Math.sin(t * 0.15) * 0.6, 3.3, 5.7)
      wantLook.set(0, 0.25, 0)
    }
    camera.position.lerp(wantPos, 0.035)
    look.current.lerp(wantLook, 0.05)
    camera.lookAt(look.current)
    focusTarget.copy(look.current)
  })
  return null
}
