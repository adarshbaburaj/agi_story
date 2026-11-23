import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Serves /api/<route> in `npm run dev` with the same handlers Vercel uses. */
function devApi(): Plugin {
  return {
    name: 'after-hours-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse) => {
        const route = (req.url ?? '').replace(/^\//, '').split('?')[0]
        let raw = ''
        for await (const chunk of req) raw += chunk
        const body = raw ? JSON.parse(raw) : {}
        const mod = await server.ssrLoadModule('/server/routes.ts')
        const out = await mod.handle(route, body)
        res.statusCode = out.status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(out.body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // expose .env (from this folder or the parent folder) to server code in dev
  Object.assign(process.env, loadEnv(mode, '..', ''), loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), devApi()],
    server: { host: true },
  }
})
