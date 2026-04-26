const STORAGE_KEY = 'online-set-solo-leaderboard-v1'
const RECORDED_KEYS_KEY = 'online-set-solo-recorded-game-keys-v1'
const NICKNAME_KEY = 'online-set-nickname'
const MAX_ENTRIES = 50
const MAX_RECORDED_KEYS = 80

export type SoloRunEntry = {
  id: string
  nickname: string
  durationMs: number
  reshuffleCount: number
  finishedAt: number
  score: number
}

export function formatRunDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

function readStored(): SoloRunEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is SoloRunEntry =>
        e &&
        typeof e === 'object' &&
        typeof (e as SoloRunEntry).id === 'string' &&
        typeof (e as SoloRunEntry).nickname === 'string' &&
        typeof (e as SoloRunEntry).durationMs === 'number' &&
        typeof (e as SoloRunEntry).reshuffleCount === 'number' &&
        typeof (e as SoloRunEntry).finishedAt === 'number' &&
        typeof (e as SoloRunEntry).score === 'number',
    )
  } catch {
    return []
  }
}

function writeStored(entries: SoloRunEntry[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* quota / private mode */
  }
}

export function getSoloRuns(): SoloRunEntry[] {
  return readStored()
}

export function addSoloRun(entry: Omit<SoloRunEntry, 'id'>): SoloRunEntry[] {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${entry.finishedAt}-${Math.random().toString(36).slice(2, 10)}`
  const list = readStored()
  list.push({ ...entry, id })
  list.sort((a, b) => a.durationMs - b.durationMs || a.reshuffleCount - b.reshuffleCount || b.finishedAt - a.finishedAt)
  const trimmed = list.slice(0, MAX_ENTRIES)
  writeStored(trimmed)
  return trimmed
}

export function clearSoloRuns() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(RECORDED_KEYS_KEY)
  } catch {
    /* ignore */
  }
}

export function getStoredNickname(): string {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredNickname(nickname: string) {
  if (typeof localStorage === 'undefined') return
  try {
    const t = nickname.trim()
    if (t) localStorage.setItem(NICKNAME_KEY, t)
    else localStorage.removeItem(NICKNAME_KEY)
  } catch {
    /* ignore */
  }
}

/** Avoid duplicate solo rows if the player refreshes on the game-over screen. */
export function hasSoloRunBeenRecorded(gameOverKey: string): boolean {
  if (typeof localStorage === 'undefined' || !gameOverKey) return false
  try {
    const raw = localStorage.getItem(RECORDED_KEYS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) && arr.includes(gameOverKey)
  } catch {
    return false
  }
}

export function markSoloRunRecorded(gameOverKey: string) {
  if (typeof localStorage === 'undefined' || !gameOverKey) return
  try {
    const raw = localStorage.getItem(RECORDED_KEYS_KEY)
    let arr: string[] = []
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        arr = parsed as string[]
      }
    }
    if (arr.includes(gameOverKey)) return
    arr.push(gameOverKey)
    while (arr.length > MAX_RECORDED_KEYS) arr.shift()
    localStorage.setItem(RECORDED_KEYS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}
