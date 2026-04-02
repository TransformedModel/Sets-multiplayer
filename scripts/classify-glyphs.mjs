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

const files = fs
  .readdirSync(glyphDir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort()

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    const s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
    return { h, s, l }
  }
  return { h: 0, s: 0, l }
}

const colorRefs = [
  { name: 'red', h: 0 },
  { name: 'purple', h: 280 },
  { name: 'green', h: 120 },
]

async function classify(file) {
  const fullPath = path.join(glyphDir, file)
  let img = sharp(fullPath)
  // Trim borders
  img = img.trim()
  const resized = img.resize(32, 32, { fit: 'inside' })
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  let sumH = 0
  let count = 0
  let nonBgCount = 0
  let outlineCount = 0

  // simple diagonal sample for stripe variance
  const samples = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const brightness = (r + g + b) / (3 * 255)
      if (brightness > 0.98) continue // treat as background
      nonBgCount++
      const { h, s, l } = rgbToHsl(r, g, b)
      if (s > 0.2) {
        sumH += h
        count++
      }
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        outlineCount++
      }
      if (x === y) {
        samples.push(brightness)
      }
    }
  }

  const avgH = count > 0 ? sumH / count : 0
  let bestColor = 'red'
  let bestDist = Infinity
  for (const ref of colorRefs) {
    let d = Math.abs(avgH - ref.h)
    if (d > 180) d = 360 - d
    if (d < bestDist) {
      bestDist = d
      bestColor = ref.name
    }
  }

  const coverage = nonBgCount / (width * height)
  let variance = 0
  if (samples.length > 1) {
    const mean = samples.reduce((a, v) => a + v, 0) / samples.length
    variance =
      samples.reduce((a, v) => a + (v - mean) * (v - mean), 0) /
      (samples.length - 1)
  }

  let fill = 'solid'
  if (coverage < 0.3) fill = 'open'
  else if (variance > 0.02 && coverage < 0.8) fill = 'striped'

  return { file, color: bestColor, fill, coverage, variance }
}

async function main() {
  for (const file of files) {
    const result = await classify(file)
    console.log(result)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

