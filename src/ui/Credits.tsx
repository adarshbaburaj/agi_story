// Ending, poster, Bruin stats, Casuro audience interview, Run again.
import { useEffect, useRef, useState } from 'react'
import type { RunRecord } from '../../shared/types'
import { api } from '../api'
import { runFilm, summary } from '../film/engine'
import { loadHistory, localRuns, saveRun, statLine } from '../film/memory'
import { useFilm } from '../film/store'
import { loadImage } from './demoTable'

export function Credits() {
  const ending = useFilm((s) => s.ending)
  const poster = useFilm((s) => s.poster)
  const cast = useFilm((s) => s.cast)
  const [stat, setStat] = useState<string | null>(null)
  const [fallbackPoster, setFallbackPoster] = useState<string | null>(null)

  useEffect(() => {
    loadHistory().then((h) => setStat(statLine(h)))
  }, [])
  useEffect(() => {
    if (ending) drawPoster(ending.title, ending.ending, cast).then(setFallbackPoster)
  }, [ending])
  if (!ending) return null
  const winner = cast.find((c) => c.id === ending.winnerId)

  return (
    <div className="credits">
      <div className="poster">
        {poster && poster !== 'none' ? (
          <img src={poster} />
        ) : poster === 'none' && fallbackPoster ? (
          <img src={fallbackPoster} />
        ) : (
          <div className="poster-loading">Painting the poster…</div>
        )}
      </div>
      <div className="credits-body">
        <small>The End · AGI Story</small>
        <h1>{ending.title}</h1>
        <p className="ending">{ending.ending}</p>
        {winner && (
          <div className="winner">
            <img src={winner.crop} />
            <div>
              <b>🏆 {winner.name}</b>
              <span>{ending.verdict}</span>
            </div>
          </div>
        )}
        {stat && <p className="stat">📊 {stat}</p>}
        <Interview />
        <div className="snap-actions">
          <button className="btn ghost" onClick={() => useFilm.setState({ screen: 'snap', cast: [], photo: null, ending: null })}>
            New table
          </button>
          <button className="btn big" onClick={() => runFilm()}>
            ↻ Run it again
          </button>
        </div>
        <p className="tiny">Same table, different ending: the cast now remembers this run.</p>
      </div>
    </div>
  )
}

function Interview() {
  const cast = useFilm((s) => s.cast)
  const log = useFilm((s) => s.log)
  const ending = useFilm((s) => s.ending)
  const [answer, setAnswer] = useState('')
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<{ pick: string; score: number; evidence: string[]; verdict: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const rec = useRef<any>(null)

  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
  function listen() {
    if (!SR) return
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = true
    r.onresult = (e: any) => setAnswer(Array.from(e.results).map((x: any) => x[0].transcript).join(' '))
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
    const u = new SpeechSynthesisUtterance('Who deserved to win, and why?')
    window.speechSynthesis?.speak(u)
  }
  async function submit() {
    if (!answer.trim() || !ending) return
    rec.current?.stop()
    setBusy(true)
    try {
      const r = await api('interview', { answer, cast: cast.map(summary), log, ending })
      setResult(r)
      // the verdict becomes a rumor the cast hears next run
      const last: RunRecord | undefined = (window as any).__lastRun ?? localRuns()[0]
      if (last) await saveRun({ ...last, judgeVerdict: r.verdict })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="interview">
      <b>🎙 Audience interview</b>
      <p>Who deserved to win, and why?</p>
      {!result ? (
        <div className="iv-row">
          {SR && (
            <button className={`btn ghost ${listening ? 'rec' : ''}`} onClick={listen} disabled={listening}>
              {listening ? '● listening' : '🎤 Speak'}
            </button>
          )}
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="…or type it" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="btn" onClick={submit} disabled={busy || !answer.trim()}>
            {busy ? '…' : 'Judge'}
          </button>
        </div>
      ) : (
        <div className="iv-result">
          <div>
            Pick: <b>{result.pick}</b> · evidence score <b>{result.score}/10</b>
          </div>
          <ul>
            {result.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <i>Saved to memory: “{result.verdict}”</i>
        </div>
      )}
    </div>
  )
}

/** Client-side poster: used when no image model is available. */
async function drawPoster(title: string, tagline: string, cast: { name: string; crop: string }[]): Promise<string> {
  const W = 600
  const H = 900
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a0f2e')
  bg.addColorStop(0.6, '#3b1d1d')
  bg.addColorStop(1, '#0b0708')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W / 2, 420, 10, W / 2, 420, 380)
  glow.addColorStop(0, 'rgba(255,200,120,0.45)')
  glow.addColorStop(1, 'rgba(255,200,120,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)
  const imgs = await Promise.all(cast.map((x) => loadImage(x.crop)))
  const n = imgs.length
  imgs.forEach((im, i) => {
    const w = 170
    const h = (im.naturalHeight / im.naturalWidth) * w
    const x = W / 2 - ((n - 1) * 115) / 2 + i * 115 - w / 2
    const y = 560 - h - (i % 2 ? 0 : 40)
    g.save()
    g.shadowColor = 'rgba(0,0,0,0.7)'
    g.shadowBlur = 30
    g.translate(x + w / 2, y + h / 2)
    g.rotate((i - (n - 1) / 2) * 0.07)
    g.drawImage(im, -w / 2, -h / 2, w, h)
    g.restore()
  })
  g.fillStyle = '#ffe2b0'
  g.textAlign = 'center'
  g.font = 'bold 54px Georgia, serif'
  wrap(g, title.toUpperCase(), W / 2, 110, W - 60, 58)
  g.font = 'italic 20px Georgia, serif'
  g.fillStyle = '#f5d0c5'
  wrap(g, tagline, W / 2, 660, W - 100, 26)
  g.font = '15px sans-serif'
  g.fillStyle = '#c9b8b0'
  g.fillText(`STARRING ${cast.map((x) => x.name.toUpperCase()).join(' · ')}`, W / 2, 820, W - 40)
  g.fillText('AN AGI STORY PRODUCTION · NOBODY WROTE THIS ENDING', W / 2, 850, W - 40)
  return c.toDataURL('image/jpeg', 0.9)
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (g.measureText(t).width > max && line) {
      g.fillText(line, x, y)
      line = w
      y += lh
    } else line = t
  }
  g.fillText(line, x, y)
}
