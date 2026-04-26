import { generateDeck, shuffle, type Card } from './cards'
import { hasAnySet, isSet } from './set-rules'

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export type Player = {
  playerId: string
  nickname: string
  score: number
  isHost: boolean
  connected: boolean
}

export type ClaimedSetEntry = {
  by: string
  at: number
  cards: Card[]
}

export type Room = {
  roomCode: string
  hostId: string
  players: Player[]
  deck: Card[]
  board: (Card | null)[]
  status: 'waiting' | 'in-progress' | 'finished'
  claimedSets: ClaimedSetEntry[]
  reshuffleCount: number
  gameStartedAt: number | null
  gameEndedAt: number | null
}

export type HubSnapshot = {
  nextPlayerId: number
  rooms: [string, Room][]
}

export class RoomManager {
  nextPlayerId = 1
  rooms = new Map<string, Room>()

  static fromSnapshot(s: HubSnapshot): RoomManager {
    const rm = new RoomManager()
    rm.nextPlayerId = s.nextPlayerId
    rm.rooms = new Map(s.rooms)
    return rm
  }

  toSnapshot(): HubSnapshot {
    return {
      nextPlayerId: this.nextPlayerId,
      rooms: [...this.rooms.entries()],
    }
  }

  createRoom(hostNickname: string): { room: Room; playerId: string } {
    let roomCode: string
    do {
      roomCode = makeRoomCode()
    } while (this.rooms.has(roomCode))

    const playerId = String(this.nextPlayerId++)
    const player: Player = {
      playerId,
      nickname: hostNickname,
      score: 0,
      isHost: true,
      connected: true,
    }

    const room: Room = {
      roomCode,
      hostId: playerId,
      players: [player],
      deck: [],
      board: [],
      status: 'waiting',
      claimedSets: [],
      reshuffleCount: 0,
      gameStartedAt: null,
      gameEndedAt: null,
    }

    this.rooms.set(roomCode, room)
    return { room, playerId }
  }

  joinRoom(roomCode: string, nickname: string): { ok: true; playerId: string } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode)
    if (!room) {
      return { ok: false, error: 'Room not found' }
    }
    if (room.status !== 'waiting') {
      return { ok: false, error: 'Game already started' }
    }
    if (room.players.length >= 6) {
      return { ok: false, error: 'Room is full' }
    }
    const playerId = String(this.nextPlayerId++)
    const player: Player = {
      playerId,
      nickname,
      score: 0,
      isHost: false,
      connected: true,
    }
    room.players.push(player)
    return { ok: true, playerId }
  }

  startGame(roomCode: string, playerId: string): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'Room not found' }
    if (String(room.hostId) !== String(playerId)) {
      return { ok: false, error: 'Only host can start the game' }
    }
    if (room.status !== 'waiting') {
      return { ok: false, error: 'Game already started' }
    }
    const deck = shuffle(generateDeck())
    const board = deck.splice(0, 12)
    room.deck = deck
    room.board = board
    room.status = 'in-progress'
    room.reshuffleCount = 0
    room.gameStartedAt = Date.now()
    room.gameEndedAt = null
    return { ok: true }
  }

  handleClaimSet(
    roomCode: string,
    playerId: string,
    cardIds: string[],
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'Room not found' }
    if (room.status !== 'in-progress') {
      return { ok: false, error: 'Game is not in progress' }
    }
    if (!Array.isArray(cardIds) || cardIds.length !== 3) {
      return { ok: false, error: 'Must claim exactly 3 cards' }
    }
    const indices = cardIds.map((id) => room.board.findIndex((c) => c && String(c.id) === String(id)))
    if (indices.some((idx) => idx === -1)) {
      return { ok: false, error: 'One or more cards not on board' }
    }
    const [i1, i2, i3] = indices
    if (i1 === i2 || i1 === i3 || i2 === i3) {
      return { ok: false, error: 'Duplicate card in claim' }
    }
    const cards = [room.board[i1]!, room.board[i2]!, room.board[i3]!]
    if (!isSet(cards[0], cards[1], cards[2])) {
      return { ok: false, error: 'Not a valid set' }
    }

    const player = room.players.find((p) => p.playerId === playerId)
    if (!player) {
      return { ok: false, error: 'Player not found' }
    }

    player.score += 1
    room.claimedSets.push({ by: playerId, cards, at: Date.now() })

    if (room.board.length === 12 && room.deck.length >= 3) {
      const sortedSlots = [...indices].sort((a, b) => a - b)
      for (let s = 0; s < 3; s++) {
        const next = room.deck.shift()
        room.board[sortedSlots[s]] = next ?? null
      }
    } else {
      indices.sort((a, b) => b - a)
      for (const idx of indices) {
        room.board.splice(idx, 1)
      }
      while (room.board.length < 12 && room.deck.length > 0) {
        room.board.push(room.deck.shift()!)
      }
    }

    if (room.deck.length === 0 && !hasAnySet(room.board)) {
      room.status = 'finished'
      room.gameEndedAt = Date.now()
    }

    return { ok: true }
  }

  reshuffleBoard(roomCode: string, playerId: string): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'Room not found' }
    if (String(room.hostId) !== String(playerId)) {
      return { ok: false, error: 'Only host can reshuffle the board' }
    }
    if (room.status !== 'in-progress') {
      return { ok: false, error: 'Game is not in progress' }
    }
    const combined = room.board.concat(room.deck).filter(Boolean) as Card[]
    if (combined.length === 0) {
      return { ok: false, error: 'No cards to reshuffle' }
    }
    const shuffled = shuffle(combined)
    const onBoard = Math.min(12, shuffled.length)
    room.board = shuffled.slice(0, onBoard)
    room.deck = shuffled.slice(onBoard)
    room.reshuffleCount = (room.reshuffleCount || 0) + 1
    if (room.deck.length === 0 && !hasAnySet(room.board)) {
      room.status = 'finished'
      room.gameEndedAt = Date.now()
    }
    return { ok: true }
  }

  disconnectPlayer(playerId: string): void {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.playerId === playerId)
      if (player) {
        player.connected = false
      }
    }
  }

  getPublicRoomState(roomCode: string): object | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    return {
      roomCode: room.roomCode,
      status: room.status,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        score: p.score,
        isHost: p.isHost,
        connected: p.connected,
      })),
      board: room.board,
      deckCount: room.deck.length,
      claimedSets: room.claimedSets.map((entry) => ({
        by: entry.by,
        at: entry.at,
        cards: entry.cards.map((c) => ({
          id: c.id,
          shape: c.shape,
          color: c.color,
          fill: c.fill,
          count: c.count,
        })),
      })),
      reshuffleCount: room.reshuffleCount ?? 0,
      gameStartedAt: room.gameStartedAt ?? null,
      gameEndedAt: room.gameEndedAt ?? null,
    }
  }
}
