// Single Vercel function that serves every /api/<route>. Keys stay server-side.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handle } from '../server/routes.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = String(req.query.route ?? '')
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  const out = await handle(route, body)
  res.status(out.status).json(out.body)
}
