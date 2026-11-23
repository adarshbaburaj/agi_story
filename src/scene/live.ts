import * as THREE from 'three'

/** Rendered (animated) actor positions, written by ObjectActor every frame, read by lines + camera. */
export const livePos: Record<string, THREE.Vector3> = {}
/** Where the depth of field focuses; CameraRig moves it. */
export const focusTarget = new THREE.Vector3(0, 0.4, 0)

export function textureFromDataUrl(url: string): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Procedural wood grain for the tabletop. */
export function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#6b4226'
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * c.height
    g.strokeStyle = `rgba(${40 + Math.random() * 60}, ${20 + Math.random() * 30}, 10, ${0.08 + Math.random() * 0.18})`
    g.lineWidth = 1 + Math.random() * 3
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= c.width; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 4 + (Math.random() - 0.5) * 2)
    g.stroke()
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * c.width
    const y = Math.random() * c.height
    const r = g.createRadialGradient(x, y, 2, x, y, 30 + Math.random() * 30)
    r.addColorStop(0, 'rgba(40,20,8,0.5)')
    r.addColorStop(1, 'rgba(40,20,8,0)')
    g.fillStyle = r
    g.beginPath()
    g.ellipse(x, y, 60, 16, 0, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
