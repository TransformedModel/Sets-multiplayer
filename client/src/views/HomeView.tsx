import { useEffect, useState } from 'react'
import { GameTutorialModal } from '../components/GameTutorialModal'
import { SoloLeaderboardPanel } from '../components/SoloLeaderboardPanel'
import { ThemeToggle } from '../components/ThemeToggle'
import { getStoredNickname, setStoredNickname } from '../solo/soloLeaderboard'
import { LobbyView } from './LobbyView'
import { GameView } from './GameView'
import { useWebSocketGame } from '../ws/useWebSocketGame'

type View = 'home' | 'lobby' | 'game'

type EntryMode = 'create' | 'join'

export function HomeView() {
  const [view, setView] = useState<View>('home')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<EntryMode>('create')
  const [nickname, setNickname] = useState(() => getStoredNickname())
  const [roomCodeInput, setRoomCodeInput] = useState('')

  const game = useWebSocketGame()

  useEffect(() => {
    setStoredNickname(nickname)
  }, [nickname])

  const resolvedNickname = nickname.trim() || 'Player'
  const canJoin = roomCodeInput.trim().length > 0

  // When the host starts, everyone in the lobby should enter the game view.
  useEffect(() => {
    if (view === 'lobby' && game.room?.status === 'in-progress') {
      setView('game')
    }
  }, [view, game.room?.status])

  const handleCreate = () => {
    game.createRoom(resolvedNickname)
    setView('lobby')
  }

  const handleJoin = () => {
    if (!canJoin) return
    game.joinRoom(roomCodeInput.trim().toUpperCase(), resolvedNickname)
    setView('lobby')
  }

  if (view === 'lobby') {
    return (
      <>
        <ThemeToggle />
        <GameTutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
        <LobbyView
          game={game}
          onStartGame={() => setView('game')}
          onOpenHowToPlay={() => setTutorialOpen(true)}
        />
      </>
    )
  }

  if (view === 'game') {
    return <GameView game={game} />
  }

  return (
    <>
      <ThemeToggle />
      <GameTutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      <div className="app-shell app-shell--home">
        <div className="home-entry-stack">
          <div className="card">
            <div className="home-card-header">
              <h1 className="title">Online Set</h1>
              <button
                type="button"
                className="home-how-to-play"
                aria-haspopup="dialog"
                aria-expanded={tutorialOpen}
                onClick={() => setTutorialOpen(true)}
              >
                How to play
              </button>
            </div>
            <p className="subtitle">Play Set with friends in your browser — or practice solo in your own room.</p>

            <div className="home-mode-toggle" role="tablist" aria-label="Start or join">
              <button
                type="button"
                role="tab"
                aria-selected={entryMode === 'create'}
                className={`home-mode-tab ${entryMode === 'create' ? 'home-mode-tab--active' : ''}`}
                onClick={() => setEntryMode('create')}
              >
                New room
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={entryMode === 'join'}
                className={`home-mode-tab ${entryMode === 'join' ? 'home-mode-tab--active' : ''}`}
                onClick={() => setEntryMode('join')}
              >
                Have a code?
              </button>
            </div>

            <div className="field-group">
              <label htmlFor="home-nickname">Your name</label>
              <input
                id="home-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Player"
                autoComplete="nickname"
                maxLength={32}
              />
              <span className="field-hint">Optional — defaults to “Player” if empty.</span>
            </div>

            {entryMode === 'join' ? (
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleJoin()
                }}
              >
                <div className="field-group">
                  <label htmlFor="home-room-code">Room code</label>
                  <input
                    id="home-room-code"
                    value={roomCodeInput}
                    onChange={(e) =>
                      setRoomCodeInput(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4),
                      )
                    }
                    placeholder="ABCD"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={4}
                    inputMode="text"
                  />
                </div>
                <button type="submit" className="primary" disabled={!canJoin}>
                  Join room
                </button>
              </form>
            ) : (
              <div className="actions">
                <button type="button" className="primary" onClick={handleCreate}>
                  Create room
                </button>
              </div>
            )}

            {game.error && <div className="error">{game.error}</div>}
          </div>
          <SoloLeaderboardPanel />
        </div>
      </div>
    </>
  )
}
