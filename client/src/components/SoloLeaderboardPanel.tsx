import { useMemo, useState } from 'react'
import { clearSoloRuns, formatRunDuration, getSoloRuns, type SoloRunEntry } from '../solo/soloLeaderboard'

function formatShortDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
      new Date(ts),
    )
  } catch {
    return new Date(ts).toLocaleString()
  }
}

export function SoloLeaderboardPanel() {
  const [runs, setRuns] = useState<SoloRunEntry[]>(() => getSoloRuns())

  const rows = useMemo(() => {
    const sorted = [...runs].sort(
      (a, b) => a.durationMs - b.durationMs || a.reshuffleCount - b.reshuffleCount || b.finishedAt - a.finishedAt,
    )
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }))
  }, [runs])

  if (runs.length === 0) {
    return (
      <div className="solo-lb-card">
        <h2 className="solo-lb-heading">Solo run leaderboard</h2>
        <p className="solo-lb-empty">
          Finish a <strong>solo</strong> game (create a room, start alone, play to the end) to record your time and reshuffle count here. Only
          runs with exactly one player in the room are saved.
        </p>
      </div>
    )
  }

  return (
    <div className="solo-lb-card">
      <div className="solo-lb-header-row">
        <h2 className="solo-lb-heading">Solo run leaderboard</h2>
        <button
          type="button"
          className="solo-lb-clear"
          onClick={() => {
            clearSoloRuns()
            setRuns([])
          }}
        >
          Clear
        </button>
      </div>
      <p className="solo-lb-hint">Sorted by fastest time, then fewest reshuffles. Stored on this device only.</p>
      <div className="solo-lb-table-wrap">
        <table className="solo-lb-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Name</th>
              <th scope="col">Time</th>
              <th scope="col">Reshuffles</th>
              <th scope="col">Sets</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.rank}</td>
                <td>{r.nickname}</td>
                <td>{formatRunDuration(r.durationMs)}</td>
                <td>{r.reshuffleCount}</td>
                <td>{r.score}</td>
                <td>{formatShortDate(r.finishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
