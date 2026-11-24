import { useState } from 'react'
import { CINEMA } from './film/cinema'
import { useFilm } from './film/store'
import { setMuted } from './film/voice'
import { PhotoStage } from './scene/PhotoStage'
import { Stage } from './scene/Stage'
import { CastingScreen } from './ui/CastingScreen'
import { Credits } from './ui/Credits'
import { DecisionLog } from './ui/DecisionLog'
import { SponsorPanel } from './ui/SponsorPanel'

export default function App() {
  const screen = useFilm((s) => s.screen)
  const subtitle = useFilm((s) => s.subtitle)
  const phase = useFilm((s) => s.phase)
  const shot = useFilm((s) => s.shot)
  const run = useFilm((s) => s.runNumber)
  const view = useFilm((s) => s.view)
  const photo = useFilm((s) => s.photo)
  const [muted, setM] = useState(false)
  const filming = screen === 'film' || screen === 'credits'

  return (
    <div className={`app screen-${screen} ${CINEMA ? 'cinema' : ''}`}>
      <div className="stage">
        {view === 'photo' && photo ? <PhotoStage /> : <Stage />}
      </div>
      {(screen === 'snap' || screen === 'cast') && <CastingScreen />}
      {filming && (
        <>
          <div className="hud">
            <h1>
              AGI Story <small>After Hours · run #{run}</small>
            </h1>
            {phase === 'thinking' && <div className="thinking-hud">🧠 {useFilm.getState().cast.length} agents deciding in parallel…</div>}
            {phase !== 'idle' && (
              <div className="shot">
                🎥 {shot.type.replace('_', ' ')} <span>{shot.reason}</span>
              </div>
            )}
          </div>
          <DecisionLog />
          {subtitle && <div className="subtitle">{subtitle}</div>}
        </>
      )}
      {screen === 'credits' && <Credits />}
      <div className="corner">
        <SponsorPanel />
        <button className="mute view-toggle" title="Switch between the living photo and the 3D table" onClick={() => useFilm.setState({ view: view === 'photo' ? '3d' : 'photo' })}>
          {view === 'photo' ? '3D' : '📷'}
        </button>
        <button
          className="mute"
          onClick={() => {
            setMuted(!muted)
            setM(!muted)
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
