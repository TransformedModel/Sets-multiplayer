import path from 'path'
import fs from 'fs'
import sharp from 'sharp'

const projectRoot = process.cwd()

const assetsRoot = path.join(
  projectRoot,
  '..',
  '..',
  '.cursor',
  'projects',
  'Users-niharikakohli-Projects',
  'assets',
)

const sources = [
  {
    shape: 'squiggle',
    file: 'squiggle_shapes-0845c03c-c9ba-46e5-acfc-e9d86cf18077.png',
  },
  {
    shape: 'diamond',
    file: 'diamond_shapes-22922438-2838-4859-b4c1-20ffa38e1ec3.png',
  },
  {
    shape: 'pill',
    file: 'pill_shapes-110645a5-c3b6-4554-9462-75203bad16a2.png',
  },
]

const colors = ['red', 'purple', 'green']
const fills = ['solid', 'striped', 'open']

const outDir = path.join(
  projectRoot,
  'client',
  'src',
  'assets',
  'glyphs',
)

fs.mkdirSync(outDir, { recursive: true })

async function sliceOne({ shape, file }) {
  const srcPath = path.join(assetsRoot, file)
  const img = sharp(srcPath)
  const meta = await img.metadata()
  const cellWidth = Math.floor(meta.width / 3)
  const cellHeight = Math.floor(meta.height / 3)

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * cellWidth
      const top = row * cellHeight
      const color = colors[row]
      const fill = fills[col]
      const outPath = path.join(
        outDir,
        `${shape}-${color}-${fill}.png`,
      )
      // Extra trim to remove internal grid lines if present
      await img
        .extract({ left, top, width: cellWidth, height: cellHeight })
        .trim()
        .toFile(outPath)
      console.log('Wrote glyph', outPath)
    }
  }
}

async function main() {
  for (const src of sources) {
    await sliceOne(src)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

