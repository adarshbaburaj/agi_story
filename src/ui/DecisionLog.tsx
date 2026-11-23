import { useEffect, useRef } from 'react'
import { MOODS } from '../../shared/types'
import { useFilm } from '../film/store'

const ICON: Record<string, string> = {
  move_to: '➜',
  say: '💬',
  whisper: '🤫',
  ally: '🤝',
  betray: '🗡',
  push: '✋',
  hide_behind: '🫣',
  use_skill: '★',
}

export function DecisionLog() {
  const log = useFilm((s) => s.log)
  const beat = useFilm((s) => s.beat)
  const total = useFilm((s) => s.totalBeats)
  const phase = useFilm((s) => s.phase)
  const opening = useFilm((s) => s.opening)
  const cast = useFilm((s) => s.cast)
  const moodOf = (id: string) => cast.find((c) => c.id === id)?.mood
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [log.length, phase])

  return (
    <aside className="log">
      <header>
        <b>Decision log</b>
        <span>
          {phase === 'opening' ? 'opening' : phase === 'ending' || phase === 'done' ? 'the end' : `beat ${beat}/${total}`}
        </span>
      </header>
      <div className="log-body" ref={ref}>
        {opening && <div className="log-opening">🎬 {opening}</div>}
        {log.map((e, i) => (
          <div key={i} className={`entry a-${e.action}`}>
            <div className="line">
              <span className="b">B{e.beat}</span>
              <b style={{ color: moodOf(e.actorId) ? MOODS[moodOf(e.actorId)!].color : undefined }}>
                {moodOf(e.actorId) ? MOODS[moodOf(e.actorId)!].emoji + ' ' : ''}
                {e.actorName}
              </b>
              <span className="act">
                {ICON[e.action]} {e.action.replace('_', ' ')}
              </span>
              {e.targetName && <b>→ {e.targetName}</b>}
              {/rumou?r|last time|last table|earlier table|remember|last run|judge said/i.test(e.why) && <span className="mem-tag">🧠 remembers</span>}
            </div>
            {e.text && <div className="txt">“{e.text}”</div>}
            <div className="why">why: {e.why}</div>
          </div>
        ))}
        {phase === 'thinking' && <div className="thinking">agents are deciding beat {beat}…</div>}
      </div>
    </aside>
  )
}
