import fs from 'fs'
import path from 'path'

const glyphDir = path.join(
  process.cwd(),
  'client',
  'src',
  'assets',
  'glyphs',
)

const diamondTargets = [
  'diamond-green-open.png',
  'diamond-purple-open.png',
  'diamond-green-striped.png',
  'diamond-red-striped.png',
  'diamond-purple-striped.png',
  'diamond-red-open.png',
  'diamond-green-solid.png',
  'diamond-red-solid.png',
  'diamond-purple-solid.png',
]

const pillTargets = [
  'pill-red-open.png',
  'pill-green-open.png',
  'pill-purple-open.png',
  'pill-green-striped.png',
  'pill-red-striped.png',
  'pill-purple-striped.png',
  'pill-green-solid.png',
  'pill-red-solid.png',
  'pill-purple-solid.png',
]

const squiggleTargets = [
  'squiggle-purple-solid.png',
  'squiggle-purple-open.png',
  'squiggle-green-open.png',
  'squiggle-red-open.png',
  'squiggle-purple-striped.png',
  'squiggle-green-striped.png',
  'squiggle-red-striped.png',
  'squiggle-red-solid.png',
  'squiggle-green-solid.png',
]

function sortedByPrefix(prefix) {
  return fs
    .readdirSync(glyphDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

const diamonds = sortedByPrefix('diamond-')
const pills = sortedByPrefix('pill-')
const squiggles = sortedByPrefix('squiggle-')

if (diamonds.length !== 9) {
  console.error(`Expected 9 diamond PNGs, got ${diamonds.length}:`, diamonds)
  process.exit(1)
}
if (pills.length !== 9) {
  console.error(`Expected 9 pill PNGs, got ${pills.length}:`, pills)
  process.exit(1)
}
if (squiggles.length !== 9) {
  console.error(`Expected 9 squiggle PNGs, got ${squiggles.length}:`, squiggles)
  process.exit(1)
}

const pairs = []
for (let i = 0; i < 9; i++) {
  pairs.push({ from: diamonds[i], to: diamondTargets[i] })
}
for (let i = 0; i < 9; i++) {
  pairs.push({ from: pills[i], to: pillTargets[i] })
}
for (let i = 0; i < 9; i++) {
  pairs.push({ from: squiggles[i], to: squiggleTargets[i] })
}

// Phase 1: rename all to unique temp names
const tmpPrefix = '__tmp_glyph_'
pairs.forEach((p, i) => {
  const fromPath = path.join(glyphDir, p.from)
  const tmpName = `${tmpPrefix}${i}.png`
  const tmpPath = path.join(glyphDir, tmpName)
  fs.renameSync(fromPath, tmpPath)
  console.log('tmp:', p.from, '->', tmpName)
})

// Phase 2: temp -> final
pairs.forEach((p, i) => {
  const tmpPath = path.join(glyphDir, `${tmpPrefix}${i}.png`)
  const finalPath = path.join(glyphDir, p.to)
  fs.renameSync(tmpPath, finalPath)
  console.log('final:', `${tmpPrefix}${i}.png`, '->', p.to)
})

console.log('Done. Renamed 27 glyphs to match ordered list.')
