import type { SoloRunEntry } from './soloLeaderboard'

export type GlobalSoloLeaderboardResponse = {
  ok: boolean
  rows: SoloRunEntry[]
}

function getApiBaseFromViteWsUrl(): string | null {
  const raw = import.meta.env.VITE_WS_URL as string | undefined
  const wsUrl = raw?.trim().replace(/^['"]|['"]$/g, '')
  if (!wsUrl) return null
  try {
    const u = new URL(wsUrl)
    u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
    u.pathname = ''
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export async function fetchGlobalSoloLeaderboard(): Promise<SoloRunEntry[]> {
  const base = getApiBaseFromViteWsUrl()
  if (!base) return []
  try {
    const res = await fetch(`${base}/solo-leaderboard`, { method: 'GET' })
    if (!res.ok) return []
    const json = (await res.json()) as GlobalSoloLeaderboardResponse
    if (!json || typeof json !== 'object' || json.ok !== true || !Array.isArray(json.rows)) return []
    return json.rows
  } catch {
    return []
  }
}

