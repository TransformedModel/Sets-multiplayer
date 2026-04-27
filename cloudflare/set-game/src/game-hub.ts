import { DurableObject } from 'cloudflare:workers'
import { RoomManager, type HubSnapshot } from './room-manager'

type Attachment = { playerId: string; roomCode: string }
type SoloLeaderboardEntry = {
  id: string
  nickname: string
  durationMs: number
  reshuffleCount: number
  finishedAt: number
  score: number
}

const SOLO_LEADERBOARD_KEY = 'solo-leaderboard-v1'
const SOLO_LEADERBOARD_MAX = 50

function send(ws: WebSocket, type: string, payload: Record<string, unknown> = {}) {
  try {
    ws.send(JSON.stringify({ type, ...payload }))
  } catch {
    /* closed */
  }
}

export class GameHub extends DurableObject {
  private rm: RoomManager
  private connections = new Map<string, WebSocket>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.rm = new RoomManager()
    ctx.blockConcurrencyWhile(async () => {
      const snap = await ctx.storage.get<HubSnapshot>('snap')
      if (snap) {
        this.rm = RoomManager.fromSnapshot(snap)
      }
      for (const w of ctx.getWebSockets()) {
        try {
          const a = w.deserializeAttachment() as Attachment | null
          if (a?.playerId) this.connections.set(a.playerId, w)
        } catch {
          /* no attachment */
        }
      }
    })
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put('snap', this.rm.toSnapshot())
  }

  private async getSoloLeaderboard(): Promise<SoloLeaderboardEntry[]> {
    const raw = await this.ctx.storage.get<SoloLeaderboardEntry[]>(SOLO_LEADERBOARD_KEY)
    if (!raw || !Array.isArray(raw)) return []
    return raw.filter(
      (e): e is SoloLeaderboardEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.nickname === 'string' &&
        typeof e.durationMs === 'number' &&
        typeof e.reshuffleCount === 'number' &&
        typeof e.finishedAt === 'number' &&
        typeof e.score === 'number',
    )
  }

  private async recordSoloRunFromRoom(roomCode: string, playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const room = this.rm.getRoom(roomCode)
    if (!room) return { ok: false, error: 'Room not found' }
    if (room.status !== 'finished') return { ok: false, error: 'Game is not finished' }
    if (room.players.length !== 1) return { ok: false, error: 'Not a solo game' }
    if (String(room.players[0].playerId) !== String(playerId)) return { ok: false, error: 'Player mismatch' }
    if (typeof room.gameStartedAt !== 'number' || typeof room.gameEndedAt !== 'number') {
      return { ok: false, error: 'Missing timestamps' }
    }
    const durationMs = Math.max(0, room.gameEndedAt - room.gameStartedAt)
    const entry: SoloLeaderboardEntry = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${room.gameEndedAt}-${Math.random().toString(36).slice(2, 10)}`,
      nickname: room.players[0].nickname || 'Player',
      durationMs,
      reshuffleCount: room.reshuffleCount ?? 0,
      finishedAt: room.gameEndedAt,
      score: room.players[0].score ?? 0,
    }

    const list = await this.getSoloLeaderboard()
    list.push(entry)
    list.sort((a, b) => a.durationMs - b.durationMs || a.reshuffleCount - b.reshuffleCount || b.finishedAt - a.finishedAt)
    const trimmed = list.slice(0, SOLO_LEADERBOARD_MAX)
    await this.ctx.storage.put(SOLO_LEADERBOARD_KEY, trimmed)
    return { ok: true }
  }

  private broadcastRoom(roomCode: string): void {
    const room = this.rm.getPublicRoomState(roomCode)
    if (!room) return
    const payload = JSON.stringify({ type: 'gameState', room })
    const players = (room as { players: { playerId: string }[] }).players
    for (const p of players) {
      const ws = this.connections.get(p.playerId)
      if (ws) {
        try {
          ws.send(payload)
        } catch {
          /* */
        }
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const upgrade = request.headers.get('Upgrade') ?? ''
    if (upgrade.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (request.method === 'GET' && url.pathname === '/solo-leaderboard') {
      const rows = await this.getSoloLeaderboard()
      return Response.json(
        { ok: true, rows },
        {
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, OPTIONS',
          },
        },
      )
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    let msg: {
      type?: string
      nickname?: string
      roomCode?: string
      playerId?: string
      cardIds?: string[]
    }
    try {
      msg = JSON.parse(text) as typeof msg
    } catch {
      return
    }
    const type = msg.type
    if (!type) return

    if (type === 'ping') {
      send(ws, 'pong', {})
      return
    }

    if (type === 'reconnect') {
      const code = (msg.roomCode as string) || ''
      const pid = (msg.playerId as string) || ''
      if (!code || !pid) {
        send(ws, 'error', { message: 'Invalid reconnect payload' })
        return
      }
      const result = this.rm.reconnect(code, pid)
      if (!result.ok) {
        send(ws, 'error', { message: result.error || 'Unable to reconnect' })
        return
      }
      ws.serializeAttachment({ playerId: pid, roomCode: code } satisfies Attachment)
      this.connections.set(pid, ws)
      await this.persist()
      send(ws, 'gameState', {
        room: this.rm.getPublicRoomState(code),
      })
      this.broadcastRoom(code)
      return
    }

    let att: Attachment | null = null
    try {
      att = ws.deserializeAttachment() as Attachment | null
    } catch {
      att = null
    }
    let playerId: string | null = att?.playerId ?? null
    let roomCode: string | null = att?.roomCode ?? null

    if (type === 'createRoom') {
      const nickname = (msg.nickname as string) || 'Player'
      const result = this.rm.createRoom(nickname)
      playerId = result.playerId
      roomCode = result.room.roomCode
      ws.serializeAttachment({ playerId, roomCode } satisfies Attachment)
      this.connections.set(playerId, ws)
      await this.persist()
      send(ws, 'roomCreated', {
        roomCode: result.room.roomCode,
        playerId: result.playerId,
        room: this.rm.getPublicRoomState(roomCode),
      })
      this.broadcastRoom(roomCode)
      return
    }

    if (type === 'joinRoom') {
      const code = (msg.roomCode as string) || ''
      const nickname = (msg.nickname as string) || 'Player'
      const joinResult = this.rm.joinRoom(code, nickname)
      if (!joinResult.ok) {
        send(ws, 'error', { message: joinResult.error || 'Unable to join room' })
        return
      }
      playerId = joinResult.playerId
      roomCode = code
      ws.serializeAttachment({ playerId, roomCode } satisfies Attachment)
      this.connections.set(playerId, ws)
      await this.persist()
      send(ws, 'joinedRoom', {
        roomCode,
        playerId,
        room: this.rm.getPublicRoomState(roomCode),
      })
      this.broadcastRoom(roomCode)
      return
    }

    if (type === 'startGame') {
      if (!roomCode || !playerId) {
        send(ws, 'error', { message: 'Session expired — refresh the page and rejoin the room.' })
        return
      }
      const result = this.rm.startGame(roomCode, playerId)
      if (!result.ok) {
        send(ws, 'error', { message: result.error || 'Unable to start game' })
        return
      }
      await this.persist()
      this.broadcastRoom(roomCode)
      return
    }

    if (type === 'claimSet') {
      if (!roomCode || !playerId) {
        send(ws, 'error', { message: 'Session expired — refresh the page and rejoin the room.' })
        return
      }
      const cardIds = msg.cardIds ?? []
      const result = this.rm.handleClaimSet(roomCode, playerId, cardIds)
      if (!result.ok) {
        send(ws, 'setClaimResult', { success: false, reason: result.error || 'Invalid set' })
        return
      }
      send(ws, 'setClaimResult', { success: true })
      await this.persist()
      this.broadcastRoom(roomCode)
      return
    }

    if (type === 'reshuffleBoard') {
      if (!roomCode || !playerId) {
        send(ws, 'reshuffleResult', {
          ok: false,
          message: 'Session expired — refresh the page and rejoin the room.',
        })
        return
      }
      const result = this.rm.reshuffleBoard(roomCode, playerId)
      if (!result.ok) {
        send(ws, 'reshuffleResult', { ok: false, message: result.error || 'Unable to reshuffle' })
        return
      }
      send(ws, 'reshuffleResult', { ok: true })
      await this.persist()
      this.broadcastRoom(roomCode)
      return
    }

    if (type === 'recordSoloRun') {
      if (!roomCode || !playerId) {
        send(ws, 'error', { message: 'Session expired — refresh the page and rejoin the room.' })
        return
      }
      const result = await this.recordSoloRunFromRoom(roomCode, playerId)
      if (!result.ok) {
        send(ws, 'error', { message: result.error })
        return
      }
      send(ws, 'soloRunRecorded', { ok: true })
      return
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    let att: Attachment | null = null
    try {
      att = ws.deserializeAttachment() as Attachment | null
    } catch {
      att = null
    }
    const reasonStr = typeof reason === 'string' ? reason : new TextDecoder().decode(reason as ArrayBuffer)
    console.log(
      JSON.stringify({
        event: 'ws_close',
        playerId: att?.playerId ?? null,
        roomCode: att?.roomCode ?? null,
        code,
        reason: reasonStr,
      }),
    )
    if (att?.playerId) {
      this.connections.delete(att.playerId)
      this.rm.disconnectPlayer(att.playerId)
      if (att.roomCode) {
        await this.persist()
        this.broadcastRoom(att.roomCode)
      }
    }
  }
}
