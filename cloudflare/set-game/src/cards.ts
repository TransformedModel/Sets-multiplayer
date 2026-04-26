export const SHAPES = ['diamond', 'squiggle', 'oval'] as const
export const COLORS = ['red', 'green', 'purple'] as const
export const FILLS = ['solid', 'striped', 'open'] as const
export const COUNTS = [1, 2, 3] as const

export type Shape = (typeof SHAPES)[number]
export type Color = (typeof COLORS)[number]
export type Fill = (typeof FILLS)[number]

export type Card = {
  id: string
  shape: Shape
  color: Color
  fill: Fill
  count: number
}

export function generateDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      for (const fill of FILLS) {
        for (const count of COUNTS) {
          deck.push({ id: String(id), shape, color, fill, count })
          id += 1
        }
      }
    }
  }
  return deck
}

export function shuffle<T>(deck: T[]): T[] {
  const arr = deck.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
