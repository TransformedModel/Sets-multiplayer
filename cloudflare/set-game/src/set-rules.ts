import type { Card } from './cards'

function allSameOrAllDifferent(a: unknown, b: unknown, c: unknown): boolean {
  const set = new Set([a, b, c])
  return set.size === 1 || set.size === 3
}

export function isSet(cardA: Card, cardB: Card, cardC: Card): boolean {
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

export function hasAnySet(board: (Card | null)[]): boolean {
  const n = board.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = board[i]
        const b = board[j]
        const c = board[k]
        if (a && b && c && isSet(a, b, c)) return true
      }
    }
  }
  return false
}
