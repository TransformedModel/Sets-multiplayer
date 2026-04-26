import { DurableObject } from 'cloudflare:workers'
import { RoomManager, type HubSnapshot } from './room-manager'

type Attachment = { playerId: string; roomCode: string }

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
    const upgrade = request.headers.get('Upgrade') ?? ''
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    let msg: {
      type?: string
      nickname?: string
      roomCode?: string
      cardIds?: string[]
    }
    try {
      msg = JSON.parse(text) as typeof msg
    } catch {
      return
    }
    const type = msg.type
    if (!type) return

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
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    let att: Attachment | null = null
    try {
      att = ws.deserializeAttachment() as Attachment | null
    } catch {
      att = null
    }
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
