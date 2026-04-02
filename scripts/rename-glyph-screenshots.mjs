import fs from 'fs'
import path from 'path'

const glyphDir = path.join(
  process.cwd(),
  'client',
  'src',
  'assets',
  'glyphs',
)

const all = fs
  .readdirSync(glyphDir)
  .filter((f) => f.toLowerCase().endsWith('.png') && f.startsWith('Screenshot'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

if (all.length !== 27) {
  console.warn(
    `Expected 27 screenshot glyphs, found ${all.length}. Proceeding with what is present.`,
  )
}

const shapesByGroup = ['diamond', 'pill', 'squiggle']
const colorsByRow = ['red', 'purple', 'green']
const fillsByCol = ['solid', 'striped', 'open']

all.forEach((file, index) => {
  const group = Math.floor(index / 9) // 0..2
  const within = index % 9
  const row = Math.floor(within / 3) // 0..2
  const col = within % 3 // 0..2

  const shape = shapesByGroup[group] ?? 'unknown'
  const color = colorsByRow[row]
  const fill = fillsByCol[col]

  if (shape === 'unknown') {
    console.warn('Skipping unexpected index', index, file)
    return
  }

  const oldPath = path.join(glyphDir, file)
  const newName = `${shape}-${color}-${fill}.png`
  const newPath = path.join(glyphDir, newName)

  // Avoid overwriting if already exists
  if (fs.existsSync(newPath)) {
    console.warn('Target already exists, skipping', newName)
    return
  }

  fs.renameSync(oldPath, newPath)
  console.log('Renamed', file, '→', newName)
})

