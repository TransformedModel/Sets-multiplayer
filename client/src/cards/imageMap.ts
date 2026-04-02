import type { Card } from '../ws/useWebSocketGame'

const pngImages = import.meta.glob('../assets/cards/*.png', {
  eager: true,
  as: 'url',
}) as Record<string, string>

export function cardImageFor(card: Card): string {
  const base = `card-${card.shape}-${card.color}-${card.fill}-${card.count}`
  const pngPath = `../assets/cards/${base}.png`
  const png = pngImages[pngPath]
  if (!png) {
    console.warn('Missing image for card', `${base}.png`)
  }
  return png ?? ''
}

export function cardDescription(card: Card): string {
  return `${card.count} ${card.color} ${card.fill} ${card.shape}`
}

