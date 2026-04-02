import { useEffect, useState } from 'react'
import { LobbyView } from './LobbyView'
import { GameView } from './GameView'
import { useWebSocketGame } from '../ws/useWebSocketGame'

type View = 'home' | 'lobby' | 'game'

export function HomeView() {
  const [view, setView] = useState<View>('home')
  const [nickname, setNickname] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState('')

  const game = useWebSocketGame()

  const canProceed = nickname.trim().length > 0

  // When the host starts, everyone in the lobby should enter the game view.
  useEffect(() => {
    if (view === 'lobby' && game.room?.status === 'in-progress') {
      setView('game')
    }
  }, [view, game.room?.status])

  const handleCreate = () => {
    if (!canProceed) return
    game.createRoom(nickname.trim())
    setView('lobby')
  }

  const handleJoin = () => {
    if (!canProceed || roomCodeInput.trim().length === 0) return
    game.joinRoom(roomCodeInput.trim().toUpperCase(), nickname.trim())
    setView('lobby')
  }

  if (view === 'lobby') {
    return <LobbyView game={game} onStartGame={() => setView('game')} />
  }

  if (view === 'game') {
    return <GameView game={game} />
  }

  return (
    <div className="app-shell">
      <div className="card">
        <h1 className="title">Online Set</h1>
        <p className="subtitle">Play Set with friends in your browser.</p>
        <div className="field-group">
          <label>Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="actions">
          <button onClick={handleCreate} disabled={!canProceed}>
            Create Game
          </button>
          <div className="divider">or</div>
          <input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="Room code"
          />
          <button onClick={handleJoin} disabled={!canProceed || !roomCodeInput}>
            Join Game
          </button>
        </div>
        {game.error && <div className="error">{game.error}</div>}
      </div>
    </div>
  )
}

