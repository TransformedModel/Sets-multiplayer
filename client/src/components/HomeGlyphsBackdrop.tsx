import { useMemo, type CSSProperties } from 'react'
import { allGlyphImageUrls } from '../cards/imageMap'

type GlyphSpec = {
  id: string
  src: string
  leftPct: number
  staticTopPct: number
  sizePx: number
  rotateDeg: number
  driftPx: number
  durationSec: number
  delaySec: number
  opacity: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function pseudoRand(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function HomeGlyphsBackdrop() {
  const pool = useMemo(() => allGlyphImageUrls(), [])

  const glyphs = useMemo(() => {
    if (!pool.length) return []

    const count = 42
    const list: GlyphSpec[] = []

    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(i + 1)
      const r2 = pseudoRand(i + 17)
      const r3 = pseudoRand(i + 33)
      const r4 = pseudoRand(i + 51)
      const r5 = pseudoRand(i + 71)

      const src = pool[Math.floor(r1 * pool.length)]

      const leftPct = clamp(((i * 37 + r3 * 23) % 100) + r4 * 3 - 1.5, -6, 106)
      const staticTopPct = clamp(((i * 53 + r5 * 41) % 100) + r2 * 6 - 3, 6, 94)
      const sizePx = Math.round(50 + r2 * 100)
      const rotateDeg = Math.round(-26 + r3 * 52)
      const driftPx = Math.round(-38 + r4 * 76)
      const durationSec = Number((24 + r1 * 26).toFixed(2))
      const delaySec = Number((-r2 * durationSec).toFixed(2))
      const opacity = Number((0.09 + r3 * 0.14).toFixed(3))

      list.push({
        id: `hg-${i}`,
        src,
        leftPct,
        staticTopPct,
        sizePx,
        rotateDeg,
        driftPx,
        durationSec,
        delaySec,
        opacity,
      })
    }
    return list
  }, [pool])

  if (!glyphs.length) return null

  return (
    <div className="home-glyphs-backdrop" aria-hidden="true">
      {glyphs.map((g) => (
        <img
          key={g.id}
          className="home-glyph-img"
          src={g.src}
          alt=""
          draggable={false}
          style={
            {
              left: `${g.leftPct}%`,
              ['--glyph-static-top' as string]: `${g.staticTopPct}%`,
              ['--glyph-size' as string]: `${g.sizePx}px`,
              ['--glyph-rot' as string]: `${g.rotateDeg}deg`,
              ['--glyph-drift' as string]: `${g.driftPx}px`,
              ['--glyph-dur' as string]: `${g.durationSec}s`,
              ['--glyph-delay' as string]: `${g.delaySec}s`,
              opacity: g.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
