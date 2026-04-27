import { useEffect, useState } from 'react'
import { SESSION_STORAGE_KEY, type RoomState } from '../ws/useWebSocketGame'

type Props = {
  game: {
    room: RoomState | null
    playerId: string | null
    startGame: () => void
    connected: boolean
    reconnecting?: boolean
    error: string | null
    clearError: () => void
  }
  onStartGame: () => void
}

export function LobbyView({ game, onStartGame }: Props) {
  const room = game.room
  if (!room) {
    return (
      <div className="app-shell">
        <div className="card">
          <div className="home-card-header">
            <h1 className="title">Lobby</h1>
          </div>
          {game.error ? (
            <>
              <p className="subtitle">{game.error}</p>
              {import.meta.env.DEV ? (
                <p className="hint">
                  If you just deployed, confirm the game Worker is reachable at your API domain (try <code>/health</code>{' '}
                  over HTTPS) and that Pages was built with <code>VITE_WS_URL</code> set to that host ( <code>wss://…</code>{' '}
                  ). The API hostname must be attached to the <strong>Worker</strong>, not only to Pages.
                </p>
              ) : (
                <p className="hint">Try refreshing. If this keeps happening, the game server is probably unreachable.</p>
              )}
              <button type="button" className="primary" onClick={() => game.clearError()}>
                Dismiss
              </button>
            </>
          ) : (
            <p className="subtitle">
              {game.reconnecting
                ? 'Reconnecting to server…'
                : game.connected
                  ? 'Syncing with server…'
                  : 'Connecting to server…'}
            </p>
          )}
          <StuckLobbyHelp connected={game.connected} />
        </div>
      </div>
    )
  }

  const me = room.players.find((p) => p.playerId === game.playerId)
  const isHost = me?.isHost ?? false
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!copyStatus) return
    const t = window.setTimeout(() => setCopyStatus(null), 1400)
    return () => window.clearTimeout(t)
  }, [copyStatus])

  const handleStart = () => {
    if (!isHost) return
    game.startGame()
    onStartGame()
  }

  return (
    <div className="app-shell">
      <div className="card">
        <div className="home-card-header">
          <h1 className="title">Lobby</h1>
        </div>
        <div className="room-code-row">
          <p className="subtitle room-code-text">
            Room code: <strong>{room.roomCode}</strong>
          </p>
          <button
            type="button"
            className="room-code-copy"
            onClick={async () => {
              const base = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${base}/?room=${encodeURIComponent(room.roomCode)}`
              try {
                await navigator.clipboard.writeText(link)
                setCopyStatus('Copied')
              } catch {
                try {
                  const ta = document.createElement('textarea')
                  ta.value = link
                  ta.style.position = 'fixed'
                  ta.style.opacity = '0'
                  document.body.appendChild(ta)
                  ta.select()
                  document.execCommand('copy')
                  document.body.removeChild(ta)
                  setCopyStatus('Copied')
                } catch {
                  setCopyStatus('Copy failed')
                }
              }
            }}
            aria-label="Copy room link"
            title="Copy room link"
          >
            {copyStatus ?? 'Copy link'}
          </button>
        </div>
        {!game.connected && (
          <p className="hint" role="status">
            {game.reconnecting ? 'Reconnecting…' : 'Disconnected — retrying connection.'}
          </p>
        )}
        <div className="player-list">
          {room.players.map((p) => (
            <div key={p.playerId} className="player-row">
              <span>{p.nickname}</span>
              {p.isHost && <span className="badge">Host</span>}
            </div>
          ))}
        </div>
        <p className="hint">
          Share this code with friends to join (max 6). Playing alone? Start when you are ready — solo runs are timed for the home
          leaderboard.
        </p>
        {isHost ? (
          <button type="button" onClick={handleStart} className="primary" disabled={!game.connected}>
            Start Game
          </button>
        ) : (
          <p className="hint">Waiting for host to start the game…</p>
        )}
      </div>
    </div>
  )
}

function StuckLobbyHelp({ connected }: { connected: boolean }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!connected) {
      setShow(false)
      return
    }
    const t = window.setTimeout(() => setShow(true), 8000)
    return () => window.clearTimeout(t)
  }, [connected])

  if (!show) return null

  return (
    <div className="hint" role="status">
      Still syncing?{' '}
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY)
          } catch {
            /* */
          }
          window.location.reload()
        }}
        style={{ textDecoration: 'underline' }}
      >
        Reset connection
      </button>
    </div>
  )
}

