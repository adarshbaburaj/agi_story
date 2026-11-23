// Green = a live call really ran this session · amber = configured but failed · grey = mock.
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useFilm } from '../film/store'

interface Sponsor {
  name: string
  role: string
  configured: boolean
}

export function SponsorPanel() {
  const states = useFilm((s) => s.sponsors)
  const [list, setList] = useState<Sponsor[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api<{ sponsors: Sponsor[] }>('status').then((r) => setList(r.sponsors), () => {})
  }, [])
  const live = list.filter((s) => states[s.name] === 'live').length
  return (
    <div className={`sponsors ${open ? 'open' : ''}`}>
      <button onClick={() => setOpen(!open)}>
        <span className={`dot ${live ? 'live' : ''}`} /> Sponsors · {live}/{list.length} live
      </button>
      {open && (
        <ul>
          {list.map((s) => {
            const st = states[s.name] ?? (s.configured ? 'ready' : 'mock')
            return (
              <li key={s.name} title={s.role}>
                <span className={`dot ${st}`} />
                <b>{s.name}</b> <small>{s.role}</small>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
