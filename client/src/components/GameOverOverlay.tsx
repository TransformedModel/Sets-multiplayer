import { useMemo } from 'react'
import { formatRunDuration } from '../solo/soloLeaderboard'
import type { Player } from '../ws/useWebSocketGame'

type Props = {
  players: Player[]
  roomCode: string
  /** Stable when game ends so confetti layout doesn’t reshuffle on every render. */
  gameKey: string
  /** Shown only for single-player finished games (solo run stats). */
  soloRunSummary?: { durationMs: number; reshuffleCount: number } | null
}

type RankedPlayer = Player & { rank: number; isWinner: boolean }

function rankPlayers(players: Player[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' }),
  )
  const maxScore = sorted[0]?.score ?? 0
  return sorted.map((p, i) => ({
    ...p,
    rank: i + 1,
    isWinner: maxScore > 0 && p.score === maxScore,
  }))
}

/** Deterministic pseudo-random from string so confetti is stable per finished game. */
function createConfettiSpecs(count: number, seedStr: string) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rnd = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10000) / 10000
  }
  return Array.from({ length: count }, (_, i) => {
    rnd()
    return {
      id: i,
      left: rnd() * 100,
      delay: rnd() * 2.8,
      duration: 2.6 + rnd() * 2.8,
      rotate: rnd() * 1080,
      hue: Math.floor(rnd() * 360),
      w: 4 + rnd() * 7,
      circle: rnd() > 0.45,
    }
  })
}

export function GameOverOverlay({ players, roomCode, gameKey, soloRunSummary }: Props) {
  const ranked = useMemo(() => rankPlayers(players), [players])
  const specs = useMemo(() => createConfettiSpecs(80, gameKey), [gameKey])
  const winners = ranked.filter((p) => p.isWinner)

  return (
    <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="confetti-layer" aria-hidden>
        {specs.map((s) => (
          <span
            key={s.id}
            className={s.circle ? 'confetti-piece confetti-piece-circle' : 'confetti-piece confetti-piece-rect'}
            style={{
              left: `${s.left}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              ['--confetti-rotate' as string]: `${s.rotate}deg`,
              background: `hsl(${s.hue} 85% 58%)`,
              width: s.circle ? `${s.w + 3}px` : `${s.w}px`,
              height: s.circle ? `${s.w + 3}px` : `${s.w * 1.55}px`,
            }}
          />
        ))}
      </div>
      <div className="game-over-panel">
        <p className="game-over-eyebrow">Room {roomCode}</p>
        <h2 id="game-over-title" className="game-over-heading">
          Game over
        </h2>
        <p className="game-over-sub">
          {winners.length === 1
            ? `${winners[0].nickname} wins!`
            : winners.length > 1
              ? 'Tie for first place!'
              : 'No sets claimed — well played!'}
        </p>
        {soloRunSummary && (
          <p className="game-over-solo-run" role="status">
            Solo run: <strong>{formatRunDuration(soloRunSummary.durationMs)}</strong>
            {' · '}
            {soloRunSummary.reshuffleCount} reshuffle{soloRunSummary.reshuffleCount === 1 ? '' : 's'} — saved on this device’s
            leaderboard (home screen).
          </p>
        )}
        <h3 className="leaderboard-title">Final rankings</h3>
        <ol className="leaderboard-list">
          {ranked.map((p) => (
            <li key={p.playerId} className={p.isWinner ? 'leaderboard-row leaderboard-row-winner' : 'leaderboard-row'}>
              <span className="leaderboard-rank">#{p.rank}</span>
              <span className="leaderboard-name">{p.nickname}</span>
              <span className="leaderboard-score-wrap">
                <span className="leaderboard-score">{p.score}</span>
                <span className="leaderboard-score-label">sets</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
