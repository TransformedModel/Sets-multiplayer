import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Card, ClaimedSetEntry, RoomState } from '../ws/useWebSocketGame'
import { cardImageFor, cardDescription } from '../cards/imageMap'
import { GameOverOverlay } from '../components/GameOverOverlay'
import { GameTutorialModal } from '../components/GameTutorialModal'
import { countSetsOnBoard, enumerateSetsOnBoard } from '../set/countSetsOnBoard'
import { addSoloRun, hasSoloRunBeenRecorded, markSoloRunRecorded } from '../solo/soloLeaderboard'
import { useTheme } from '../theme/ThemeProvider'

type Props = {
  game: {
    room: RoomState | null
    playerId: string | null
    connected?: boolean
    reconnecting?: boolean
    wsCloseSummary?: string | null
    claimSet: (cardIds: string[]) => void
    lastSetResult: string | null
    clearLastSetResult: () => void
    reshuffleBoard: () => void
    recordSoloRun: () => void
    error: string | null
    clearError: () => void
    lastReshuffleError: string | null
    clearLastReshuffleError: () => void
  }
  onPlayAgain?: () => void
}

type CelebrationState = {
  nickname: string
  cards: Card[]
}

const CLAIM_REPLACE_PHASE_MS = 250

/** Two-step fade out old cards + fade in replacements after a 3-card claim. */
type ClaimReplaceTransition = {
  slots: number[]
  prevCards: Card[]
  nextBoard: (Card | null)[]
  phase: 'out' | 'in'
}

function MiniSetThumbnails({ cards }: { cards: Card[] }) {
  return (
    <div className="captured-mini-set">
      {cards.map((c) => (
        <img
          key={c.id}
          className="captured-mini-card"
          src={cardImageFor(c)}
          alt={cardDescription(c)}
        />
      ))}
    </div>
  )
}

export function GameView({ game, onPlayAgain }: Props) {
  const room = game.room
  const wsConnected = game.connected !== false
  const reconnecting = game.reconnecting === true
  const { theme, toggleTheme } = useTheme()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [celebration, setCelebration] = useState<CelebrationState | null>(null)
  const prevClaimedLenRef = useRef<number | null>(null)
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Filled inside setState when a triple is complete; claim runs once in layout effect (avoids Strict Mode double-invoking updaters and sending claimSet twice). */
  const pendingClaimRef = useRef<string[] | null>(null)
  const prevBoardRef = useRef<(Card | null)[] | null>(null)
  const claimAnimTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [claimReplace, setClaimReplace] = useState<ClaimReplaceTransition | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [reshuffleConfirmOpen, setReshuffleConfirmOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
      }
      claimAnimTimersRef.current.forEach((id) => clearTimeout(id))
      claimAnimTimersRef.current = []
    }
  }, [])

  useEffect(() => {
    if (!room) return
    const sets: ClaimedSetEntry[] = room.claimedSets ?? []
    const len = sets.length
    if (prevClaimedLenRef.current === null) {
      prevClaimedLenRef.current = len
      return
    }
    if (len > prevClaimedLenRef.current) {
      const latest = sets[len - 1]
      const claimer = room.players.find((pl) => pl.playerId === latest.by)
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
      }
      setCelebration({
        nickname: claimer?.nickname ?? 'Someone',
        cards: latest.cards,
      })
      celebrationTimerRef.current = setTimeout(() => {
        setCelebration(null)
        celebrationTimerRef.current = null
      }, 2000)
    }
    prevClaimedLenRef.current = len
  }, [room])

  useLayoutEffect(() => {
    const ids = pendingClaimRef.current
    if (!ids) return
    pendingClaimRef.current = null
    game.claimSet(ids)
  }, [selectedIds, game.claimSet])

  const boardIdsKey = useMemo(
    () => (room?.board ?? []).map((c) => c?.id ?? '').join('|'),
    [room?.board],
  )

  useEffect(() => {
    setSelectedIds([])
  }, [boardIdsKey])

  useEffect(() => {
    if (!room) return

    const clearClaimTimers = () => {
      claimAnimTimersRef.current.forEach((id) => clearTimeout(id))
      claimAnimTimersRef.current = []
    }

    const next = room.board
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prevBoardRef.current === null) {
      clearClaimTimers()
      setClaimReplace(null)
      prevBoardRef.current = next.map((c) => c)
      return
    }

    const prev = prevBoardRef.current

    if (prev.length !== next.length) {
      clearClaimTimers()
      setClaimReplace(null)
      prevBoardRef.current = next.map((c) => c)
      return
    }

    const changed: number[] = []
    for (let i = 0; i < next.length; i++) {
      if ((prev[i]?.id ?? '') !== (next[i]?.id ?? '')) changed.push(i)
    }

    const isClaimSizedReplace =
      changed.length === 3 && changed.every((i) => prev[i] && next[i])

    if (reduceMotion || !isClaimSizedReplace) {
      clearClaimTimers()
      setClaimReplace(null)
      prevBoardRef.current = next.map((c) => c)
      return
    }

    clearClaimTimers()
    setClaimReplace({
      slots: changed,
      prevCards: changed.map((i) => prev[i]!),
      nextBoard: next.map((c) => c),
      phase: 'out',
    })

    const t1 = window.setTimeout(() => {
      setClaimReplace((cur) => (cur && cur.phase === 'out' ? { ...cur, phase: 'in' } : cur))
    }, CLAIM_REPLACE_PHASE_MS)

    const t2 = window.setTimeout(() => {
      setClaimReplace(null)
      prevBoardRef.current = next.map((c) => c)
    }, CLAIM_REPLACE_PHASE_MS * 2)

    claimAnimTimersRef.current = [t1, t2]

    return () => clearClaimTimers()
  }, [boardIdsKey, room])

  const setsOnBoard = useMemo(
    () => (room ? countSetsOnBoard(room.board) : 0),
    [room?.board],
  )

  const finishedScoreSig = useMemo(
    () => (room ? room.players.map((p) => p.score).join('|') : ''),
    [room?.players],
  )

  const gameOverKey = useMemo(() => {
    if (!room || room.status !== 'finished') return ''
    return `${room.roomCode}-${room.claimedSets.length}-${finishedScoreSig}`
  }, [room?.status, room?.roomCode, room?.claimedSets?.length, finishedScoreSig])

  useEffect(() => {
    if (!room || room.status !== 'finished' || room.players.length !== 1) return
    const started = room.gameStartedAt
    const ended = room.gameEndedAt
    if (typeof started !== 'number' || typeof ended !== 'number') return
    const key = gameOverKey
    if (!key) return
    if (hasSoloRunBeenRecorded(key)) return
    const p = room.players[0]
    addSoloRun({
      nickname: p.nickname,
      durationMs: Math.max(0, ended - started),
      reshuffleCount: room.reshuffleCount ?? 0,
      finishedAt: ended,
      score: p.score,
    })
    markSoloRunRecorded(key)
    game.recordSoloRun()
  }, [room, gameOverKey])

  if (!room) {
    return (
      <div className="app-shell">
        <div className="card">
          <p>Loading game…</p>
        </div>
      </div>
    )
  }

  const me = room.players.find((p) => p.playerId === game.playerId)
  const claimedSets = room.claimedSets ?? []

  const soloRunSummary =
    room.status === 'finished' &&
    room.players.length === 1 &&
    typeof room.gameStartedAt === 'number' &&
    typeof room.gameEndedAt === 'number'
      ? {
          durationMs: room.gameEndedAt - room.gameStartedAt,
          reshuffleCount: room.reshuffleCount ?? 0,
        }
      : null

  const getSlotPresentation = (
    slotIndex: number,
  ): { card: Card; imageClass: string } | null => {
    const next = room.board[slotIndex]
    if (!next) return null

    if (!claimReplace) {
      return { card: next, imageClass: '' }
    }

    const { slots, prevCards, nextBoard, phase } = claimReplace
    const j = slots.indexOf(slotIndex)
    if (j === -1) {
      return { card: nextBoard[slotIndex]!, imageClass: '' }
    }
    if (phase === 'out') {
      return { card: prevCards[j], imageClass: 'card-replace-leave' }
    }
    return { card: nextBoard[slotIndex]!, imageClass: 'card-replace-enter' }
  }

  const logSetsOnBoardForQA = () => {
    const board = room.board
    const slotLine = board.map((c, i) => (c ? `${i}:${c.id}` : `${i}:(empty)`)).join(', ')
    console.log('[QA] Board slots (grid index → card id):', slotLine)
    const found = enumerateSetsOnBoard(board)
    console.log('[QA] Sets on board count:', found.length)
    found.forEach((entry, index) => {
      const { indices, cards: triple } = entry
      const rows = triple.map((c, slot) => ({
        boardIndex: indices[slot],
        id: c.id,
        shape: c.shape,
        color: c.color,
        fill: c.fill,
        count: c.count,
        description: cardDescription(c),
      }))
      console.log(`[QA] Set ${index + 1}/${found.length} (board indices ${indices.join(',')})`, rows)
    })
    if (found.length === 0) {
      console.log('[QA] No valid sets on this board.')
    }
  }

  const toggleCard = (card: Card) => {
    setSelectedIds((current) => {
      const exists = current.includes(card.id)
      let next = exists ? current.filter((id) => id !== card.id) : [...current, card.id]
      if (next.length === 3) {
        pendingClaimRef.current = next
        return []
      }
      return next
    })
  }

  return (
    <div className="game-layout">
      <GameTutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      {(!wsConnected || reconnecting) && (
        <div
          className={`game-connection-banner ${reconnecting ? 'game-connection-banner--reconnecting' : ''}`.trim()}
          role="status"
          aria-live="polite"
        >
          Reconnecting to the game server…
          {import.meta.env.DEV && game.wsCloseSummary ? (
            <span className="game-connection-banner__debug"> ({game.wsCloseSummary})</span>
          ) : null}
        </div>
      )}
      <div className="game-top-right-controls">
        <button
          type="button"
          className="game-icon-button"
          aria-haspopup="dialog"
          aria-expanded={tutorialOpen}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Avoid rare “open then immediately close” clicks if the dialog mounts under the pointer.
            requestAnimationFrame(() => setTutorialOpen(true))
          }}
          title="How to play"
          aria-label="How to play"
        >
          ❓
        </button>
        <button
          type="button"
          className="game-icon-button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '☀️' : '🌙'}
        </button>
      </div>
      {room.status === 'finished' && gameOverKey && (
        <GameOverOverlay
          players={room.players}
          roomCode={room.roomCode}
          gameKey={gameOverKey}
          soloRunSummary={soloRunSummary}
          onPlayAgain={onPlayAgain}
        />
      )}
      {reshuffleConfirmOpen && (
        <div
          className="reshuffle-confirm-backdrop"
          role="presentation"
          onClick={() => setReshuffleConfirmOpen(false)}
        >
          <div
            className="reshuffle-confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reshuffle-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reshuffle-confirm-title" className="reshuffle-confirm-title">
              Reshuffle the whole deck?
            </h2>
            <p className="reshuffle-confirm-body">
              All cards on the table go back into the deck, everything is shuffled, and up to twelve new cards are dealt.
              Use this when the board feels stuck — it also counts toward solo run stats.
            </p>
            <div className="reshuffle-confirm-actions">
              <button type="button" onClick={() => setReshuffleConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setReshuffleConfirmOpen(false)
                  game.reshuffleBoard()
                }}
              >
                Reshuffle
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="game-top-row">
        <button
          type="button"
          className="game-top-info game-top-info--sets"
          title="Click to log each set’s cards in the console (QA)"
          onClick={logSetsOnBoardForQA}
        >
          <span className="game-top-info-label">Sets on board:</span>
          <span className="game-top-info-value">{setsOnBoard}</span>
        </button>
      </div>
      {celebration && (
        <div className="celebration-overlay" role="status" aria-live="polite">
          <div className="celebration-card">
            <p className="celebration-headline">
              <span className="celebration-kicker">Set!</span>{' '}
              <strong>{celebration.nickname}</strong> took a set
            </p>
            <div className="celebration-preview">
              {celebration.cards.map((c) => (
                <img
                  key={c.id}
                  className="celebration-card-img"
                  src={cardImageFor(c)}
                  alt={cardDescription(c)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="board-area">
        <div className="board">
          {room.board.map((_, slotIndex) => {
            const pres = getSlotPresentation(slotIndex)
            if (!pres) return null
            const { card, imageClass } = pres
            const selected = selectedIds.includes(card.id)
            const boardBusy = claimReplace !== null
            const playable = room.status === 'in-progress' && !boardBusy && wsConnected
            const imgKey = claimReplace
              ? `${claimReplace.phase}-${slotIndex}-${card.id}`
              : `${slotIndex}-${card.id}`
            return (
              <button
                key={slotIndex}
                type="button"
                className={`card-tile ${selected ? 'selected' : ''} ${!playable ? 'disabled' : ''}`}
                disabled={!playable}
                data-card-count={Number(card.count)}
                onClick={() => playable && toggleCard(card)}
              >
                <span className="card-slot-label" aria-hidden="true" title={`Slot ${slotIndex + 1}`}>
                  {slotIndex + 1}
                </span>
                <img
                  key={imgKey}
                  className={`card-image ${imageClass}`.trim()}
                  src={cardImageFor(card)}
                  alt={cardDescription(card)}
                  draggable={false}
                />
              </button>
            )
          })}
        </div>
        {game.lastSetResult && (
          <div className="board-error-popover-wrap" role="alert" aria-live="assertive">
            <div className="board-error-popover" onAnimationEnd={game.clearLastSetResult}>
              {game.lastSetResult}
            </div>
          </div>
        )}
      </div>
      <aside className="sidebar">
        <h2>Room {room.roomCode}</h2>
        <p>Deck remaining: {room.deckCount}</p>
        {room.status === 'in-progress' && (
          <p className="sidebar-meta">Reshuffles this game: {room.reshuffleCount ?? 0}</p>
        )}
        {me?.isHost && room.status === 'in-progress' && (
          <button
            type="button"
            className={`reshuffle-deck ${setsOnBoard === 0 ? 'reshuffle-deck--urgent' : ''}`.trim()}
            title="Put all cards on the table back with the deck, shuffle, and deal up to 12 on the board"
            onClick={() => setReshuffleConfirmOpen(true)}
          >
            Reshuffle deck
          </button>
        )}
        {game.lastReshuffleError && (
          <div className="game-inline-error" role="alert">
            <p>{game.lastReshuffleError}</p>
            <button type="button" className="game-inline-error-dismiss" onClick={game.clearLastReshuffleError}>
              Dismiss
            </button>
          </div>
        )}
        {game.error && (
          <div className="game-inline-error" role="alert">
            <p>{game.error}</p>
            <button type="button" className="game-inline-error-dismiss" onClick={game.clearError}>
              Dismiss
            </button>
          </div>
        )}
        <h3>Players</h3>
        <ul className="score-list">
          {room.players.map((p) => {
            const setsForPlayer = claimedSets.filter((e) => e.by === p.playerId)
            return (
              <li key={p.playerId} className={p.playerId === me?.playerId ? 'me' : ''}>
                <div className="player-line-top">
                  <span className="player-nickname">{p.nickname}</span>
                  <span className="player-score">{p.score}</span>
                </div>
                {setsForPlayer.length > 0 && (
                  <div className="player-captured-sets">
                    {setsForPlayer.map((entry, idx) => (
                      <MiniSetThumbnails
                        key={`${entry.at}-${entry.by}-${idx}`}
                        cards={entry.cards}
                      />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
