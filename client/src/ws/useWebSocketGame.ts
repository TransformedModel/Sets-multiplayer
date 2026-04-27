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

export const SESSION_STORAGE_KEY = 'set-game-ws-session'

export type PersistedSession = {
  roomCode: string
  playerId: string
}

export function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    const roomCode = typeof o.roomCode === 'string' ? o.roomCode : ''
    const playerId = typeof o.playerId === 'string' ? o.playerId : ''
    if (!roomCode || !playerId) return null
    return { roomCode, playerId }
  } catch {
    return null
  }
}

function writePersistedSession(roomCode: string, playerId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ roomCode, playerId }))
  } catch {
    /* quota / private mode */
  }
}

function clearPersistedSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    /* */
  }
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
  | { type: 'soloRunRecorded'; ok: boolean }
  | { type: 'error'; message: string }
  | { type: 'pong' }

type PendingOpen =
  | { kind: 'createRoom'; nickname: string }
  | { kind: 'joinRoom'; roomCode: string; nickname: string }
  | { kind: 'reconnect' }

const PING_INTERVAL_MS = 25_000

function normalizeRoom(r: RoomState): RoomState {
  return {
    ...r,
    claimedSets: r.claimedSets ?? [],
    reshuffleCount: r.reshuffleCount ?? 0,
    gameStartedAt: r.gameStartedAt ?? null,
    gameEndedAt: r.gameEndedAt ?? null,
  }
}

function isFatalReconnectError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('room not found') ||
    m.includes('not a member') ||
    m.includes('unable to reconnect') ||
    m.includes('invalid reconnect')
  )
}

export function useWebSocketGame() {
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const pendingOpenRef = useRef<PendingOpen | null>(null)
  const reconnectingRef = useRef(false)
  const attachHandlersImplRef = useRef<(ws: WebSocket) => void>(() => {})

  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSetResult, setLastSetResult] = useState<string | null>(null)
  const [lastReshuffleError, setLastReshuffleError] = useState<string | null>(null)
  const [wsCloseSummary, setWsCloseSummary] = useState<string | null>(null)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const startPing = useCallback(
    (ws: WebSocket) => {
      stopPing()
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping' }))
          } catch {
            /* */
          }
        }
      }, PING_INTERVAL_MS)
    },
    [stopPing],
  )

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return
    const sess = readPersistedSession()
    if (!sess?.roomCode || !sess?.playerId) return

    clearReconnectTimer()
    reconnectingRef.current = true
    setReconnecting(true)

    const attempt = reconnectAttemptRef.current
    const delay = attempt === 0 ? 0 : Math.min(30_000, 1000 * Math.pow(2, attempt - 1))
    reconnectAttemptRef.current = attempt + 1

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      pendingOpenRef.current = { kind: 'reconnect' }
      const ws = new WebSocket(getWebSocketUrl())
      wsRef.current = ws
      attachHandlersImplRef.current(ws)
    }, delay)
  }, [clearReconnectTimer])

  const attachHandlers = useCallback(
    (ws: WebSocket) => {
    ws.onopen = () => {
      setConnected(true)
      reconnectingRef.current = false
      setReconnecting(false)
      reconnectAttemptRef.current = 0
      startPing(ws)

      const pending = pendingOpenRef.current
      pendingOpenRef.current = null

      if (pending?.kind === 'createRoom') {
        ws.send(JSON.stringify({ type: 'createRoom', nickname: pending.nickname }))
      } else if (pending?.kind === 'joinRoom') {
        ws.send(
          JSON.stringify({
            type: 'joinRoom',
            roomCode: pending.roomCode,
            nickname: pending.nickname,
          }),
        )
      } else if (pending?.kind === 'reconnect') {
        const sess = readPersistedSession()
        if (sess) {
          ws.send(
            JSON.stringify({
              type: 'reconnect',
              roomCode: sess.roomCode,
              playerId: sess.playerId,
            }),
          )
        }
      }
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as GameMessage
      if (msg.type === 'pong') {
        return
      }
      if (msg.type === 'roomCreated' || msg.type === 'joinedRoom') {
        setPlayerId(msg.playerId)
        setRoom(normalizeRoom(msg.room))
        writePersistedSession(msg.roomCode, msg.playerId)
        setError(null)
      } else if (msg.type === 'gameState') {
        const sess = readPersistedSession()
        if (sess?.playerId && msg.room.roomCode === sess.roomCode) {
          setPlayerId(sess.playerId)
        }
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
        const m = msg.message || 'Error'
        if (isFatalReconnectError(m)) {
          clearReconnectTimer()
          clearPersistedSession()
          reconnectingRef.current = false
          setReconnecting(false)
        }
        setError(m)
      }
    }

    ws.onerror = () => {
      if (!intentionalCloseRef.current) {
        setError('Connection error')
      }
    }

    ws.onclose = (ev: CloseEvent) => {
      stopPing()
      setConnected(false)
      const summary = `code=${ev.code} clean=${ev.wasClean} reason=${ev.reason || ''} visibility=${typeof document !== 'undefined' ? document.visibilityState : 'n/a'}`
      setWsCloseSummary(summary)
      if (import.meta.env.DEV) {
        console.warn('[ws close]', summary)
      }

      if (intentionalCloseRef.current) {
        return
      }

      if (readPersistedSession()) {
        scheduleReconnect()
      } else {
        reconnectingRef.current = false
        setReconnecting(false)
      }
    }
    },
    [clearReconnectTimer, scheduleReconnect, startPing, stopPing],
  )

  attachHandlersImplRef.current = attachHandlers

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    pendingOpenRef.current = null
    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws
    attachHandlers(ws)
  }, [attachHandlers])

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!reconnectingRef.current) {
        setError('Not connected to the server — reconnecting or refresh the page.')
      }
      return false
    }
    ws.send(JSON.stringify(payload))
    return true
  }, [])

  const createRoom = useCallback(
    (nickname: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        pendingOpenRef.current = { kind: 'createRoom', nickname }
        const newWs = new WebSocket(getWebSocketUrl())
        wsRef.current = newWs
        attachHandlers(newWs)
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
    [attachHandlers],
  )

  const joinRoom = useCallback(
    (roomCode: string, nickname: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        pendingOpenRef.current = { kind: 'joinRoom', roomCode, nickname }
        const newWs = new WebSocket(getWebSocketUrl())
        wsRef.current = newWs
        attachHandlers(newWs)
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
    [attachHandlers],
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

  const recordSoloRun = useCallback(() => {
    send({ type: 'recordSoloRun' })
  }, [send])

  const clearError = useCallback(() => setError(null), [])

  const reset = useCallback(() => {
    intentionalCloseRef.current = true
    clearReconnectTimer()
    stopPing()
    clearPersistedSession()
    const ws = wsRef.current
    wsRef.current = null
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
    }
    setConnected(false)
    reconnectingRef.current = false
    setReconnecting(false)
    reconnectAttemptRef.current = 0
    setRoom(null)
    setPlayerId(null)
    setError(null)
    setLastSetResult(null)
    setLastReshuffleError(null)
    setWsCloseSummary(null)
    intentionalCloseRef.current = false
  }, [clearReconnectTimer, stopPing])

  /** Resume a stored session after full page load (same tab). */
  useEffect(() => {
    const sess = readPersistedSession()
    if (!sess) return
    intentionalCloseRef.current = false
    pendingOpenRef.current = { kind: 'reconnect' }
    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws
    attachHandlersImplRef.current(ws)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only resume
  }, [])

  /** Do not force-close WebSocket here; `HomeView` stays mounted across lobby/game and Strict Mode double-mount would fight reconnect logic. Browser tab unload closes the socket anyway. */
  useEffect(() => {
    return () => {
      clearReconnectTimer()
      stopPing()
    }
  }, [clearReconnectTimer, stopPing])

  return {
    connect,
    connected,
    reconnecting,
    wsCloseSummary,
    room,
    playerId,
    error,
    clearError,
    reset,
    lastSetResult,
    clearLastSetResult: () => setLastSetResult(null),
    lastReshuffleError,
    clearLastReshuffleError: () => setLastReshuffleError(null),
    createRoom,
    joinRoom,
    startGame,
    claimSet,
    reshuffleBoard,
    recordSoloRun,
  }
}
