// A drawn backup "table photo" with 4 objects and pre-placed boxes, for offline demos.
// If public/demo/table.jpg exists, the casting screen offers that real photo instead.
export interface Box {
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export function drawDemoTable(): { photo: string; boxes: Box[] } {
  const W = 1280
  const H = 860
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // wood
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#8a5a36')
  grad.addColorStop(1, '#5d3a20')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 120; i++) {
    g.strokeStyle = `rgba(40,20,8,${0.05 + Math.random() * 0.12})`
    g.lineWidth = 1 + Math.random() * 3
    const y = Math.random() * H
    g.beginPath()
    g.moveTo(0, y)
    g.bezierCurveTo(W / 3, y + 10, (2 * W) / 3, y - 10, W, y + 4)
    g.stroke()
  }
  const shadow = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.beginPath()
    g.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    g.fill()
  }

  // laptop
  shadow(330, 600, 240, 40)
  g.fillStyle = '#c9ccd2'
  g.beginPath()
  g.moveTo(110, 590)
  g.lineTo(550, 590)
  g.lineTo(500, 520)
  g.lineTo(160, 520)
  g.fill()
  g.fillStyle = '#b4b8bf'
  g.fillRect(150, 230, 360, 290)
  g.fillStyle = '#1c2a3a'
  g.fillRect(168, 248, 324, 254)
  g.fillStyle = '#e9edf3'
  g.beginPath()
  g.arc(330, 375, 26, 0, Math.PI * 2)
  g.fill()

  // iced coffee
  shadow(700, 640, 80, 18)
  g.fillStyle = 'rgba(230,240,250,0.85)'
  g.beginPath()
  g.moveTo(630, 360)
  g.lineTo(770, 360)
  g.lineTo(750, 640)
  g.lineTo(650, 640)
  g.fill()
  g.fillStyle = '#6b3e1f'
  g.beginPath()
  g.moveTo(636, 420)
  g.lineTo(764, 420)
  g.lineTo(750, 630)
  g.lineTo(650, 630)
  g.fill()
  g.fillStyle = '#0d7a3e'
  g.beginPath()
  g.arc(700, 520, 34, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#fff'
  g.font = 'bold 18px sans-serif'
  g.textAlign = 'center'
  g.fillText('COLD', 700, 515)
  g.fillText('BREW', 700, 535)
  g.strokeStyle = '#1f8f4a'
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(715, 360)
  g.lineTo(740, 260)
  g.stroke()

  // water bottle
  shadow(930, 660, 70, 16)
  g.fillStyle = '#2f6fdf'
  g.fillRect(880, 300, 100, 360)
  g.fillStyle = '#1b3f86'
  g.fillRect(895, 240, 70, 60)
  g.fillStyle = 'rgba(255,255,255,0.25)'
  g.fillRect(892, 310, 14, 330)
  g.fillStyle = '#fff'
  g.font = 'bold 22px sans-serif'
  g.fillText('HYDRO', 930, 480)

  // lanyard
  g.strokeStyle = '#d6332b'
  g.lineWidth = 16
  g.beginPath()
  g.moveTo(1060, 380)
  g.bezierCurveTo(1110, 300, 1210, 300, 1230, 400)
  g.stroke()
  shadow(1150, 700, 80, 14)
  g.fillStyle = '#fafafa'
  g.fillRect(1080, 470, 150, 210)
  g.fillStyle = '#d6332b'
  g.fillRect(1080, 470, 150, 44)
  g.fillStyle = '#222'
  g.font = 'bold 20px sans-serif'
  g.fillText('JUDGE', 1155, 600)
  g.fillStyle = '#ccc'
  g.fillRect(1125, 530, 60, 50)

  return {
    photo: c.toDataURL('image/jpeg', 0.9),
    boxes: [
      { x: 100 / W, y: 220 / H, w: 460 / W, h: 380 / H, label: 'laptop' },
      { x: 620 / W, y: 250 / H, w: 160 / W, h: 400 / H, label: 'iced coffee cup' },
      { x: 870 / W, y: 230 / H, w: 120 / W, h: 440 / H, label: 'water bottle' },
      { x: 1050 / W, y: 290 / H, w: 200 / W, h: 400 / H, label: 'conference lanyard' },
    ],
  }
}

/** Crop a normalized box out of an image into a small data URL. */
export async function cropBox(photo: string, b: Box, max = 384): Promise<string> {
  const img = await loadImage(photo)
  const sx = b.x * img.naturalWidth
  const sy = b.y * img.naturalHeight
  const sw = Math.max(8, b.w * img.naturalWidth)
  const sh = Math.max(8, b.h * img.naturalHeight)
  const k = Math.min(1, max / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.round(sw * k)
  c.height = Math.round(sh * k)
  c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

/** Shrink a camera photo and also produce a blurred backdrop. */
export async function preparePhoto(src: string): Promise<{ photo: string; backdrop: string }> {
  const img = await loadImage(src)
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * k)
  c.height = Math.round(img.naturalHeight * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const photo = c.toDataURL('image/jpeg', 0.88)
  const b = document.createElement('canvas')
  b.width = 480
  b.height = Math.round((480 * c.height) / c.width)
  const bg = b.getContext('2d')!
  bg.filter = 'blur(14px) brightness(0.7)'
  bg.drawImage(c, -20, -20, b.width + 40, b.height + 40)
  return { photo, backdrop: b.toDataURL('image/jpeg', 0.8) }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}
