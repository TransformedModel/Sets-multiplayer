import type { Card } from '../ws/useWebSocketGame'

/** Vite: `as: 'url'` is deprecated and can stringify to "[object Module]"; use `?url` + default import. */
function urlFromGlobEntry(entry: unknown): string {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object' && 'default' in entry) {
    const d = (entry as { default: unknown }).default
    if (typeof d === 'string') return d
  }
  return ''
}

const pngImagesRaw = import.meta.glob('../assets/cards/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, unknown>

const pngImages: Record<string, string> = {}
for (const [key, value] of Object.entries(pngImagesRaw)) {
  pngImages[key] = urlFromGlobEntry(value)
}

export function cardImageFor(card: Card): string {
  const base = `card-${card.shape}-${card.color}-${card.fill}-${card.count}`
  const pngPath = `../assets/cards/${base}.png`
  const png = pngImages[pngPath]
  if (!png) {
    console.warn('Missing image for card', `${base}.png`)
  }
  return png
}

export function cardDescription(card: Card): string {
  return `${card.count} ${card.color} ${card.fill} ${card.shape}`
}

