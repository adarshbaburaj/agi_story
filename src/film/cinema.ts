// Cinema mode (?cinema=1): letterboxed one-take camera + a timing reel of everything said and thought,
// so the demo video can sync the real voice clips. window.__reel holds the reel.
export const CINEMA = new URLSearchParams(location.search).has('cinema')

export interface ReelEvent {
  t: number // seconds since the film started
  kind: 'start' | 'narrator' | 'thought' | 'action' | 'voice' | 'ending' | 'credits'
  [k: string]: unknown
}
export const reel: { t0: number; wallT0: number; events: ReelEvent[] } = { t0: 0, wallT0: 0, events: [] }
;(window as unknown as { __reel: typeof reel }).__reel = reel

export function startReel() {
  reel.t0 = performance.now()
  reel.wallT0 = Date.now() // lets the capture script line the reel up with the screen recording
  reel.events = [{ t: 0, kind: 'start' }]
}
export function mark(e: Omit<ReelEvent, 't'>) {
  if (!CINEMA || !reel.t0) return
  reel.events.push({ t: +((performance.now() - reel.t0) / 1000).toFixed(3), ...e } as ReelEvent)
}
