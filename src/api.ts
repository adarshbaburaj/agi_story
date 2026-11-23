import { useFilm } from './film/store'

/** POST /api/<route>. Every response carries `_sponsors` telling us which calls really ran live. */
export async function api<T = any>(route: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`/api/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({ error: `bad response ${res.status}` }))
  if (json._sponsors) useFilm.getState().mergeSponsors(json._sponsors)
  if (!res.ok) throw new Error(json.error ?? `api/${route} ${res.status}`)
  return json as T
}
