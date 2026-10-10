import type { Game } from './types'

const KEY = 'antler-express-v1'

export interface SaveData {
  unlocked: number
  highScore: number
  treasure: number
  muted: boolean
}

export function defaultSave(): SaveData {
  return { unlocked: 1, highScore: 0, treasure: 0, muted: false }
}

function store(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function loadSave(): SaveData {
  const s = store()
  if (!s) return defaultSave()
  try {
    const raw = s.getItem(KEY)
    if (!raw) return defaultSave()
    const data = JSON.parse(raw) as Partial<SaveData>
    return {
      unlocked: Math.max(1, data.unlocked ?? 1),
      highScore: data.highScore ?? 0,
      treasure: data.treasure ?? 0,
      muted: Boolean(data.muted),
    }
  } catch {
    return defaultSave()
  }
}

export function writeSave(data: SaveData): void {
  const s = store()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify(data))
  } catch {
    /* private mode */
  }
}

export function saveFromGame(g: Game): void {
  writeSave({
    unlocked: g.unlocked,
    highScore: g.highScore,
    treasure: g.lifetimeTreasure,
    muted: g.muted,
  })
}
