// Memory across runs: the "Rumor Mill". Stored in Bruin via /api/memory, mirrored in localStorage.
import type { Character, RunRecord } from '../../shared/types'
import { api } from '../api'

const KEY = 'afterhours.runs.v1'

export function localRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export async function loadHistory(): Promise<RunRecord[]> {
  const local = localRuns()
  try {
    const { runs } = await api<{ runs: RunRecord[] }>('memory', {})
    const seen = new Set(local.map((r) => r.id))
    return [...local, ...runs.filter((r) => !seen.has(r.id))].sort((a, b) => b.at - a.at)
  } catch {
    return local
  }
}

export async function saveRun(run: RunRecord) {
  const runs = [run, ...localRuns().filter((r) => r.id !== run.id)].slice(0, 60)
  localStorage.setItem(KEY, JSON.stringify(runs))
  await api('memory', { run }).catch(() => {})
}

export function category(object: string): string {
  const o = object.toLowerCase()
  const map: [RegExp, string][] = [
    [/laptop|macbook|notebook computer/, 'laptops'],
    [/phone|iphone|pixel/, 'phones'],
    [/bottle|flask/, 'bottles'],
    [/coffee|cup|mug|latte|tea/, 'cups'],
    [/lanyard|badge/, 'lanyards'],
    [/pen|pencil|marker/, 'pens'],
    [/headphone|earbud|airpod/, 'headphones'],
    [/charger|cable/, 'chargers'],
    [/book|notebook/, 'notebooks'],
  ]
  const hit = map.find(([re]) => re.test(o))
  if (hit) return hit[1]
  const last = o.trim().split(/\s+/).pop() ?? 'thing'
  return last.endsWith('s') ? last : `${last}s`
}

/** 2-3 rumors per character, drawn from earlier tables. */
export function rumorsFor(ch: Pick<Character, 'object'>, history: RunRecord[]): string[] {
  const cat = category(ch.object)
  const out: string[] = []
  const mine = history.filter((r) => r.cast.some((c) => category(c.object) === cat))
  if (mine.length) {
    const r = mine[0]
    const won = category(r.winner.object) === cat
    out.push(
      won
        ? `At an earlier table a ${cat.replace(/s$/, '')} like you won "${r.title}". They'll be gunning for you.`
        : `At an earlier table, ${r.winner.name} the ${r.winner.object} beat a ${cat.replace(/s$/, '')} like you. ${r.highlights[0] ?? ''}`,
    )
  }
  const losses = mine.filter((r) => category(r.winner.object) !== cat).length
  if (mine.length >= 2) out.push(`Rumor: ${cat} have lost ${losses} of ${mine.length} tables tonight.`)
  const judge = history.find((r) => r.judgeVerdict)
  if (judge?.judgeVerdict) out.push(judge.judgeVerdict)
  const other = history.find((r) => !mine.includes(r))
  if (other && out.length < 3) out.push(`Gossip: at another table, ${other.highlights[0] ?? `${other.winner.name} won`}`)
  return out.slice(0, 3)
}

export function generalRumors(history: RunRecord[]): string[] {
  return history.slice(0, 3).map((r) => `${r.winner.name} the ${r.winner.object} won "${r.title}"`)
}

/** e.g. "Across 7 tables, laptops lost 5 times". */
export function statLine(history: RunRecord[]): string | null {
  if (!history.length) return null
  const lost: Record<string, number> = {}
  const played: Record<string, number> = {}
  for (const r of history) {
    for (const c of r.cast) {
      const k = category(c.object)
      played[k] = (played[k] ?? 0) + 1
      if (category(r.winner.object) !== k) lost[k] = (lost[k] ?? 0) + 1
    }
  }
  const worst = Object.entries(lost).sort((a, b) => b[1] - a[1])[0]
  if (!worst) return `Across ${history.length} table${history.length > 1 ? 's' : ''}, nobody has lost yet.`
  return `Across ${history.length} table${history.length > 1 ? 's' : ''}, ${worst[0]} lost ${worst[1]} of ${played[worst[0]]} times.`
}
