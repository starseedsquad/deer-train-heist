import { WEAPONS } from './armory'
import type { ChapterId, Game, Ranks, WeaponId } from './types'
import { emptyRanks } from './types'

const KEY = 'antler-express-v1'

export interface SaveData {
  unlocked: number
  highScore: number
  treasure: number
  muted: boolean
  chapter2: number
  coins: number
  weapon: WeaponId
  owned: WeaponId[]
  ranks: Ranks
  chapter: ChapterId
}

export function defaultSave(): SaveData {
  return {
    unlocked: 1,
    highScore: 0,
    treasure: 0,
    muted: false,
    chapter2: 0,
    coins: 0,
    weapon: 'revolver',
    owned: ['revolver'],
    ranks: emptyRanks(),
    chapter: 1,
  }
}

function store(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function clampRank(n: unknown): number {
  const v = typeof n === 'number' ? n : 0
  return Math.max(0, Math.min(3, Math.floor(v)))
}

export function normalizeSave(data: Partial<SaveData> | null | undefined): SaveData {
  const base = defaultSave()
  if (!data) return base
  const unlocked = Math.max(1, data.unlocked ?? 1)
  const owned = (Array.isArray(data.owned) ? data.owned : base.owned).filter((id): id is WeaponId =>
    WEAPONS.includes(id as WeaponId),
  )
  if (!owned.includes('revolver')) owned.unshift('revolver')
  const weapon = owned.includes(data.weapon as WeaponId) ? (data.weapon as WeaponId) : 'revolver'
  const ranksIn: Partial<Ranks> = data.ranks ?? {}
  return {
    unlocked,
    highScore: data.highScore ?? 0,
    treasure: data.treasure ?? 0,
    muted: Boolean(data.muted),
    chapter2: Math.max(0, data.chapter2 ?? (unlocked > 15 ? 1 : 0)),
    coins: Math.max(0, data.coins ?? data.treasure ?? 0),
    weapon,
    owned,
    ranks: {
      damage: clampRank(ranksIn.damage),
      rate: clampRank(ranksIn.rate),
      ammo: clampRank(ranksIn.ammo),
      health: clampRank(ranksIn.health),
      dash: clampRank(ranksIn.dash),
      armor: clampRank(ranksIn.armor),
    },
    chapter: data.chapter === 2 ? 2 : 1,
  }
}

export function loadSave(): SaveData {
  const s = store()
  if (!s) return defaultSave()
  try {
    const raw = s.getItem(KEY)
    if (!raw) return defaultSave()
    return normalizeSave(JSON.parse(raw) as Partial<SaveData>)
  } catch {
    return defaultSave()
  }
}

export function encodeSave(g: Game): SaveData {
  return {
    unlocked: g.unlocked,
    highScore: g.highScore,
    treasure: g.lifetimeTreasure,
    muted: g.muted,
    chapter2: g.chapter2,
    coins: g.coins,
    weapon: g.weapon,
    owned: g.owned,
    ranks: { ...g.ranks },
    chapter: g.selectedChapter,
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
  writeSave(encodeSave(g))
}
