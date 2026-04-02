import type { Card } from '../ws/useWebSocketGame'

function allSameOrAllDifferent(a: string | number, b: string | number, c: string | number): boolean {
  const s = new Set([a, b, c])
  return s.size === 1 || s.size === 3
}

/** A legal Set uses three different physical cards (unique ids). */
function isSet(cardA: Card | undefined, cardB: Card | undefined, cardC: Card | undefined): boolean {
  if (!cardA || !cardB || !cardC) return false
  const idA = String(cardA.id)
  const idB = String(cardB.id)
  const idC = String(cardC.id)
  if (idA === idB || idA === idC || idB === idC) return false
  const ca = Number(cardA.count)
  const cb = Number(cardB.count)
  const cc = Number(cardC.count)
  return (
    allSameOrAllDifferent(cardA.shape, cardB.shape, cardC.shape) &&
    allSameOrAllDifferent(cardA.color, cardB.color, cardC.color) &&
    allSameOrAllDifferent(cardA.fill, cardB.fill, cardC.fill) &&
    allSameOrAllDifferent(ca, cb, cc)
  )
}

export type FoundSet = { indices: [number, number, number]; cards: [Card, Card, Card] }

/**
 * Same triple enumeration as the server (length-based, no compaction), so QA matches game logic.
 * Each triple uses three distinct card ids.
 */
export function enumerateSetsOnBoard(board: Card[] | undefined): FoundSet[] {
  if (!Array.isArray(board)) return []
  const n = board.length
  const out: FoundSet[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = board[i]
        const b = board[j]
        const c = board[k]
        if (isSet(a, b, c)) {
          out.push({ indices: [i, j, k], cards: [a!, b!, c!] })
        }
      }
    }
  }
  return out
}

/** Every valid triple on the board (order matches enumerateSetsOnBoard). */
export function findSetsOnBoard(board: Card[]): Card[][] {
  return enumerateSetsOnBoard(board).map((x) => [...x.cards])
}

/** Number of distinct valid sets (distinct triples of distinct cards). */
export function countSetsOnBoard(board: Card[]): number {
  return enumerateSetsOnBoard(board).length
}
