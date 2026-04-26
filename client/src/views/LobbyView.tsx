import type { RoomState } from '../ws/useWebSocketGame'

type Props = {
  game: {
    room: RoomState | null
    playerId: string | null
    startGame: () => void
  }
  onStartGame: () => void
  onOpenHowToPlay: () => void
}

export function LobbyView({ game, onStartGame, onOpenHowToPlay }: Props) {
  const room = game.room
  if (!room) {
    return (
      <div className="app-shell">
        <div className="card">
          <div className="home-card-header">
            <h1 className="title">Lobby</h1>
            <button type="button" className="home-how-to-play" aria-haspopup="dialog" onClick={onOpenHowToPlay}>
              How to play
            </button>
          </div>
          <p className="subtitle">Connecting to room…</p>
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
        <div className="home-card-header">
          <h1 className="title">Lobby</h1>
          <button
            type="button"
            className="home-how-to-play"
            aria-haspopup="dialog"
            onClick={onOpenHowToPlay}
          >
            How to play
          </button>
        </div>
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
        <p className="hint">
          Share this code with friends to join (max 6). Playing alone? Start when you are ready — solo runs are timed for the home
          leaderboard.
        </p>
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

