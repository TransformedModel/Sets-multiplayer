import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dev: Vite on :5173 → game server on :4000.
 * Prod (same origin): same host as the page, wss/ws and port from location (no :4000).
 * Override anytime with VITE_WS_URL.
 */
function getWebSocketUrl(): string {
  const raw = import.meta.env.VITE_WS_URL as string | undefined
  if (raw) {
    const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
    if (trimmed) return trimmed
  }
  if (typeof window === 'undefined') return 'ws://localhost:4000'
  if (import.meta.env.DEV) {
    const host = window.location.hostname
    return `ws://${host}:4000`
  }
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${window.location.host}`
}

export type Player = {
  playerId: string
  nickname: string
  score: number
  isHost: boolean
  connected: boolean
}

export type Card = {
  id: string
  shape: 'diamond' | 'squiggle' | 'oval'
  color: 'red' | 'green' | 'purple'
  fill: 'solid' | 'striped' | 'open'
  count: number
}

export type ClaimedSetEntry = {
  by: string
  at: number
  cards: Card[]
}

export type RoomState = {
  roomCode: string
  status: 'waiting' | 'in-progress' | 'finished'
  players: Player[]
  board: Card[]
  deckCount: number
  claimedSets: ClaimedSetEntry[]
  reshuffleCount: number
  gameStartedAt: number | null
  gameEndedAt: number | null
}

type GameMessage =
  | { type: 'roomCreated'; roomCode: string; playerId: string; room: RoomState }
  | { type: 'joinedRoom'; roomCode: string; playerId: string; room: RoomState }
  | { type: 'gameState'; room: RoomState }
  | { type: 'setClaimResult'; success: boolean; reason?: string }
  | { type: 'reshuffleResult'; ok: boolean; message?: string }
  | { type: 'error'; message: string }

function normalizeRoom(r: RoomState): RoomState {
  return {
    ...r,
    claimedSets: r.claimedSets ?? [],
    reshuffleCount: r.reshuffleCount ?? 0,
    gameStartedAt: r.gameStartedAt ?? null,
    gameEndedAt: r.gameEndedAt ?? null,
  }
}

export function useWebSocketGame() {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSetResult, setLastSetResult] = useState<string | null>(null)
  const [lastReshuffleError, setLastReshuffleError] = useState<string | null>(null)

  const attachHandlers = (ws: WebSocket) => {
    ws.onopen = () => {
      setConnected(true)
    }
    ws.onclose = () => {
      setConnected(false)
    }
    ws.onerror = () => {
      setError('Connection error')
    }
    ws.onmessage = (event) => {
      const msg: GameMessage = JSON.parse(event.data)
      if (msg.type === 'roomCreated' || msg.type === 'joinedRoom') {
        setPlayerId(msg.playerId)
        setRoom(normalizeRoom(msg.room))
        setError(null)
      } else if (msg.type === 'gameState') {
        setRoom(normalizeRoom(msg.room))
        setError(null)
        setLastReshuffleError(null)
      } else if (msg.type === 'setClaimResult') {
        if (msg.success) {
          setLastSetResult(null)
        } else {
          setLastSetResult(msg.reason || 'Not a valid set')
        }
      } else if (msg.type === 'reshuffleResult') {
        if (!msg.ok) {
          setLastReshuffleError(msg.message || 'Unable to reshuffle')
        }
      } else if (msg.type === 'error') {
        setError(msg.message)
      }
    }
  }

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }
    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws
    attachHandlers(ws)
  }, [])

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected to the server — is it running? Try refreshing the page.')
      return false
    }
    ws.send(JSON.stringify(payload))
    return true
  }, [])

  const createRoom = useCallback(
    (nickname: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        const newWs = new WebSocket(getWebSocketUrl())
        wsRef.current = newWs
        attachHandlers(newWs)
        newWs.addEventListener(
          'open',
          () => {
            newWs.send(JSON.stringify({ type: 'createRoom', nickname }))
          },
          { once: true },
        )
        return
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'createRoom', nickname }))
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => {
            ws.send(JSON.stringify({ type: 'createRoom', nickname }))
          },
          { once: true },
        )
      }
    },
    [],
  )

  const joinRoom = useCallback(
    (roomCode: string, nickname: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        const newWs = new WebSocket(getWebSocketUrl())
        wsRef.current = newWs
        attachHandlers(newWs)
        newWs.addEventListener(
          'open',
          () => {
            newWs.send(JSON.stringify({ type: 'joinRoom', roomCode, nickname }))
          },
          { once: true },
        )
        return
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'joinRoom', roomCode, nickname }))
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => {
            ws.send(JSON.stringify({ type: 'joinRoom', roomCode, nickname }))
          },
          { once: true },
        )
      }
    },
    [],
  )

  const startGame = useCallback(() => {
    send({ type: 'startGame' })
  }, [send])

  const claimSet = useCallback(
    (cardIds: string[]) => {
      send({ type: 'claimSet', cardIds })
    },
    [send],
  )

  const reshuffleBoard = useCallback(() => {
    setLastReshuffleError(null)
    send({ type: 'reshuffleBoard' })
  }, [send])

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    connect,
    connected,
    room,
    playerId,
    error,
    clearError,
    lastSetResult,
    clearLastSetResult: () => setLastSetResult(null),
    lastReshuffleError,
    clearLastReshuffleError: () => setLastReshuffleError(null),
    createRoom,
    joinRoom,
    startGame,
    claimSet,
    reshuffleBoard,
  }
}

