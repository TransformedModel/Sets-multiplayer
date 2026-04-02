import type { RoomState } from '../ws/useWebSocketGame'

type Props = {
  game: {
    room: RoomState | null
    playerId: string | null
    startGame: () => void
  }
  onStartGame: () => void
}

export function LobbyView({ game, onStartGame }: Props) {
  const room = game.room
  if (!room) {
    return (
      <div className="app-shell">
        <div className="card">
          <p>Connecting to room...</p>
        </div>
      </div>
    )
  }

  const me = room.players.find((p) => p.playerId === game.playerId)
  const isHost = me?.isHost ?? false

  const handleStart = () => {
    if (!isHost) return
    game.startGame()
    onStartGame()
  }

  return (
    <div className="app-shell">
      <div className="card">
        <h1 className="title">Lobby</h1>
        <p className="subtitle">
          Room code: <strong>{room.roomCode}</strong>
        </p>
        <div className="player-list">
          {room.players.map((p) => (
            <div key={p.playerId} className="player-row">
              <span>{p.nickname}</span>
              {p.isHost && <span className="badge">Host</span>}
            </div>
          ))}
        </div>
        <p className="hint">Share this code with friends to join. Max 6 players.</p>
        {isHost ? (
          <button onClick={handleStart} className="primary">
            Start Game
          </button>
        ) : (
          <p className="hint">Waiting for host to start the game…</p>
        )}
      </div>
    </div>
  )
}

