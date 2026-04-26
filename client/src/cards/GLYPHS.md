# Updating card glyphs (PNG art)

The game loads **static PNG files** from `client/src/assets/cards/`. Filenames are the contract between art and code.

## 1. Naming convention

Each file is one card. The name is built in `imageMap.ts` as:

```text
card-{shape}-{color}-{fill}-{count}.png
```

| Part | Allowed values |
|------|----------------|
| `shape` | `diamond`, `squiggle`, `oval` |
| `color` | `red`, `green`, `purple` |
| `fill` | `solid`, `striped`, `open` |
| `count` | `1`, `2`, `3` (number of symbols on the card) |

Example: `card-diamond-red-striped-2.png`

There are **81** cards (full Set deck). Every combination must exist or the client logs a warning and the image may be missing.

## 2. Replace or add images

1. Put new PNGs in **`client/src/assets/cards/`** with the exact names above (lowercase, hyphens).
2. Prefer **transparent** or consistent margins so cards look even in the grid; the UI scales with `object-fit: contain`.
3. Run **`npm run build`** (or `npm run dev`) from `client/` — Vite **eager-imports** all `*.png` in that folder at build time, so new files are picked up automatically. No registry file to edit.

## 3. Optional helper scripts (`/scripts`)

If you work from exports or sprite sheets, the repo has Node scripts you can adapt (paths may need updating):

- `scripts/slice-glyphs.mjs` — cut a sheet into tiles  
- `scripts/rename-glyphs-to-order.mjs` / `scripts/rename-glyph-screenshots.mjs` — batch rename  
- `scripts/classify-glyphs.mjs` — assist sorting by attribute  
- `scripts/generate-sample-cards.mjs` / `scripts/generate-card-svgs.mjs` — procedural placeholders  

These are **not** run in CI by default; use them locally when refreshing art.

## 4. Verify

- Open the game, claim sets on boards that use **1-, 2-, and 3-symbol** cards and each **fill** type.
- Watch the browser **console** for `Missing image for card` from `cardImageFor()`.
- Hard-refresh after replacing assets (cache-busting uses hashed filenames in production builds).

## 5. Tutorial / QA

The in-app tutorial uses the same `cardImageFor()` paths. If you rename shapes or colors, update **types** in `useWebSocketGame.ts` and **server** `cards` / `setRules` if those literals change — usually you only swap PNGs and keep the same vocabulary.
