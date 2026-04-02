import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const glyphDir = path.join(
  process.cwd(),
  'client',
  'src',
  'assets',
  'glyphs',
)
const cardsDir = path.join(
  process.cwd(),
  'client',
  'src',
  'assets',
  'cards',
)

const CARD_W = 260
/** Minimum canvas height; grows if 2–3 glyphs need more room */
const CARD_H_MIN = 300
/** Max width for a single glyph before scaling down to fit vertically */
const GLYPH_MAX_W = 200
const GAP = 14
/** Vertical padding inside the card (above/below the glyph stack) */
const PAD_Y = 36
/** Frame inset matching the rounded rect (x/y offset) */
const FRAME = 8

/** Game uses `oval`; glyph files are `pill-*.png` */
function glyphFile(shape, color, fill) {
  const prefix = shape === 'oval' ? 'pill' : shape
  return path.join(glyphDir, `${prefix}-${color}-${fill}.png`)
}

async function makeCard(shape, color, fill, count) {
  const glyphPath = glyphFile(shape, color, fill)
  if (!fs.existsSync(glyphPath)) {
    throw new Error(`Missing glyph: ${glyphPath}`)
  }

  let maxW = GLYPH_MAX_W
  let resizedBuffers
  let heights
  let widths
  let totalH

  for (;;) {
    resizedBuffers = []
    for (let i = 0; i < count; i++) {
      const buf = await sharp(glyphPath)
        .resize({ width: maxW, fit: 'inside' })
        .png()
        .toBuffer()
      resizedBuffers.push(buf)
    }

    const metas = await Promise.all(
      resizedBuffers.map((b) => sharp(b).metadata()),
    )
    heights = metas.map((m) => m.height || 0)
    widths = metas.map((m) => m.width || 0)
    totalH =
      heights.reduce((a, h) => a + h, 0) + GAP * Math.max(0, count - 1)

    const neededH = totalH + PAD_Y * 2 + FRAME * 2
    if (neededH <= 520 || maxW <= 96) {
      break
    }
    maxW -= 14
  }

  const cardH = Math.max(CARD_H_MIN, totalH + PAD_Y * 2 + FRAME * 2)

  const svg = `<svg width="${CARD_W}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${FRAME}" y="${FRAME}" width="${CARD_W - FRAME * 2}" height="${cardH - FRAME * 2}" rx="28" ry="28" fill="#f9fafb" stroke="#e5e7eb" stroke-width="4"/>
</svg>`

  const base = sharp(Buffer.from(svg)).png()

  let y = Math.round((cardH - totalH) / 2)

  const composites = []
  for (let i = 0; i < count; i++) {
    const w = widths[i]
    const h = heights[i]
    const x = Math.round((CARD_W - w) / 2)
    composites.push({ input: resizedBuffers[i], left: x, top: y })
    y += h + GAP
  }

  const outName = `card-${shape}-${color}-${fill}-${count}.png`
  const outPath = path.join(cardsDir, outName)
  await base.composite(composites).png().toFile(outPath)
}

/** Same order as server deck: diamond, squiggle, oval */
const SHAPES = ['diamond', 'squiggle', 'oval']
const COLORS = ['red', 'green', 'purple']
const FILLS = ['solid', 'striped', 'open']
const COUNTS = [1, 2, 3]

async function main() {
  const verbose = process.argv.includes('--verbose')
  fs.mkdirSync(cardsDir, { recursive: true })
  let n = 0
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      for (const fill of FILLS) {
        for (const count of COUNTS) {
          await makeCard(shape, color, fill, count)
          n += 1
          if (verbose) {
            console.log(
              'Wrote',
              `card-${shape}-${color}-${fill}-${count}.png`,
            )
          }
        }
      }
    }
  }
  console.log(`Generated ${n} card PNGs in ${cardsDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
