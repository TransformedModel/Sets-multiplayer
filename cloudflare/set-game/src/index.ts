import { GameHub } from './game-hub'

export { GameHub }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    if ((request.method === 'GET' || request.method === 'OPTIONS') && url.pathname === '/solo-leaderboard') {
      const id = env.GAME_HUB.idFromName('global')
      const stub = env.GAME_HUB.get(id)
      return stub.fetch(request)
    }

    // WebSocket handshake is GET `/` + `Upgrade: websocket` — must run before the browser "explainer" for GET `/`.
    const upgrade = request.headers.get('Upgrade') ?? ''
    if (upgrade.toLowerCase() === 'websocket') {
      const id = env.GAME_HUB.idFromName('global')
      const stub = env.GAME_HUB.get(id)
      return stub.fetch(request)
    }

    // Plain browser GET to `/` (no WebSocket upgrade) — API-only; SPA is on Pages.
    if (request.method === 'GET' && url.pathname === '/') {
      const accept = request.headers.get('Accept') ?? ''
      if (accept.includes('application/json')) {
        return Response.json({
          ok: true,
          role: 'set-game-websocket-api',
          health: `${url.origin}/health`,
          websocket: `wss://${url.host}/`,
          hint: 'Open your Cloudflare Pages app to play; point VITE_WS_URL at the websocket URL when building the client.',
        })
      }
      const wss = `wss://${url.host}/`
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Set game API</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;line-height:1.5">
<h1>This is the realtime API</h1>
<p>This Worker does not serve the game UI. Open your <strong>Cloudflare Pages</strong> site to play.</p>
<p>Build the client with <code>VITE_WS_URL=${wss}</code> (no path after the host unless you changed the Worker).</p>
<p><a href="/health">GET /health</a> — JSON status check.</p>
<p>WebSocket clients connect to <code>${wss}</code></p>
</body></html>`
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
