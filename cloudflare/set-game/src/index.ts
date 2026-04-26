import { GameHub } from './game-hub'

export { GameHub }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const id = env.GAME_HUB.idFromName('global')
      const stub = env.GAME_HUB.get(id)
      return stub.fetch(request)
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
