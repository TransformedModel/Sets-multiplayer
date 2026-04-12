import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Card } from '../ws/useWebSocketGame'
import { cardImageFor, cardDescription } from '../cards/imageMap'

type Props = {
  open: boolean
  onClose: () => void
}

/** Same color, fill, shape — only counts differ (1, 2, 3): valid Set. */
const EXAMPLE_VALID_SIMPLE: Card[] = [
  { id: 'tutorial-v1', shape: 'diamond', color: 'red', fill: 'solid', count: 1 },
  { id: 'tutorial-v2', shape: 'diamond', color: 'red', fill: 'solid', count: 2 },
  { id: 'tutorial-v3', shape: 'diamond', color: 'red', fill: 'solid', count: 3 },
]

/** Every feature is “all different” across the three cards — a maximal mixed Set. */
const EXAMPLE_VALID_MIXED: Card[] = [
  { id: 'tutorial-v4', shape: 'diamond', color: 'red', fill: 'solid', count: 1 },
  { id: 'tutorial-v5', shape: 'oval', color: 'green', fill: 'striped', count: 2 },
  { id: 'tutorial-v6', shape: 'squiggle', color: 'purple', fill: 'open', count: 3 },
]

/** Same count on every card; shape, color, and fill are each all different — still valid. */
const EXAMPLE_VALID_SAME_COUNT: Card[] = [
  { id: 'tutorial-v7', shape: 'diamond', color: 'red', fill: 'solid', count: 2 },
  { id: 'tutorial-v8', shape: 'oval', color: 'green', fill: 'striped', count: 2 },
  { id: 'tutorial-v9', shape: 'squiggle', color: 'purple', fill: 'open', count: 2 },
]

/** Colors are red, red, green — neither “all same” nor “all different” for color. */
const EXAMPLE_INVALID_COLOR: Card[] = [
  { id: 'tutorial-i1', shape: 'diamond', color: 'red', fill: 'solid', count: 1 },
  { id: 'tutorial-i2', shape: 'diamond', color: 'red', fill: 'solid', count: 2 },
  { id: 'tutorial-i3', shape: 'diamond', color: 'green', fill: 'solid', count: 2 },
]

/** Shapes are diamond, diamond, pill — not all the same and not three different shapes. */
const EXAMPLE_INVALID_SHAPE: Card[] = [
  { id: 'tutorial-i4', shape: 'diamond', color: 'red', fill: 'solid', count: 1 },
  { id: 'tutorial-i5', shape: 'diamond', color: 'green', fill: 'striped', count: 2 },
  { id: 'tutorial-i6', shape: 'oval', color: 'purple', fill: 'open', count: 3 },
]

/** Fills are solid, striped, striped — two striped breaks the rule. */
const EXAMPLE_INVALID_FILL: Card[] = [
  { id: 'tutorial-i7', shape: 'diamond', color: 'red', fill: 'solid', count: 1 },
  { id: 'tutorial-i8', shape: 'oval', color: 'green', fill: 'striped', count: 2 },
  { id: 'tutorial-i9', shape: 'squiggle', color: 'purple', fill: 'striped', count: 3 },
]

function ExampleRow({ label, cards, valid }: { label: string; cards: Card[]; valid: boolean }) {
  return (
    <div className={`game-tutorial-example ${valid ? 'game-tutorial-example--yes' : 'game-tutorial-example--no'}`}>
      <p className="game-tutorial-example-label">{label}</p>
      <div className="game-tutorial-example-cards">
        {cards.map((c) => (
          <img
            key={c.id}
            className="game-tutorial-example-card"
            src={cardImageFor(c)}
            alt={cardDescription(c)}
          />
        ))}
      </div>
    </div>
  )
}

export function GameTutorialModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
      // Panel keeps scroll position when closed; always start from the top.
      requestAnimationFrame(() => {
        const panel = panelRef.current
        if (panel) panel.scrollTop = 0
      })
    } else if (el.open) {
      el.close()
    }
  }, [open])

  const dialog = (
    <dialog
      ref={dialogRef}
      className="game-tutorial-dialog"
      aria-labelledby="game-tutorial-title"
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="game-tutorial-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="game-tutorial-title" className="game-tutorial-title">
          How to play
        </h2>
        <div className="game-tutorial-body">
          <section>
            <h3>What is a Set?</h3>
            <p>
              Each card has four features: <strong>shape</strong> (diamond, pill, squiggle),{' '}
              <strong>fill</strong> (solid, striped, open), <strong>color</strong> (red, green, purple), and{' '}
              <strong>count</strong> (1, 2, or 3 symbols). Pick three cards that form a <em>Set</em>: for every
              feature, the three cards are either <strong>all the same</strong> or <strong>all different</strong>.
            </p>
          </section>

          <section>
            <h3>Examples</h3>
            <ExampleRow
              label="Set — same color, fill, and shape; only counts differ (1, 2, 3)."
              cards={EXAMPLE_VALID_SIMPLE}
              valid
            />
            <ExampleRow
              label="Set — harder case: shape, color, fill, and count are each all different across the three cards."
              cards={EXAMPLE_VALID_MIXED}
              valid
            />
            <ExampleRow
              label="Set — same count (2) on each card; shape, color, and fill are still each all same or all different."
              cards={EXAMPLE_VALID_SAME_COUNT}
              valid
            />
            <ExampleRow
              label="Not a Set — two red and one green: color is neither all the same nor all three different."
              cards={EXAMPLE_INVALID_COLOR}
              valid={false}
            />
            <ExampleRow
              label="Not a Set — two diamonds and a pill: you need three identical shapes or three different shapes."
              cards={EXAMPLE_INVALID_SHAPE}
              valid={false}
            />
            <ExampleRow
              label="Not a Set — two striped and one solid: fill fails the same / different test."
              cards={EXAMPLE_INVALID_FILL}
              valid={false}
            />
          </section>

          <section>
            <h3>In this room</h3>
            <ul>
              <li>Up to 6 players join with a room code; the host starts the game.</li>
              <li>Tap cards to select up to three. Only you see your own highlights.</li>
              <li>When your three cards are a valid Set, they are scored for you and new cards fill those spots.</li>
              <li>The host can use &quot;Reshuffle deck&quot; to put the board back in the deck and deal a fresh layout.</li>
              <li>The game ends when there are no Sets on the board and the deck is empty.</li>
            </ul>
          </section>
        </div>
        <button type="button" className="game-tutorial-close primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </dialog>
  )

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : null
}
