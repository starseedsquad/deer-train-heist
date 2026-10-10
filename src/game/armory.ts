import { DASH_COOLDOWN, FIRE_COOLDOWN, MAG_SIZE, MAX_HP, RELOAD_TIME } from './constants'
import type { Game, Ranks, UpgradeId, WeaponId } from './types'
import { emptyRanks } from './types'

export const WEAPONS: WeaponId[] = ['revolver', 'shotgun', 'smg', 'rifle', 'launcher']

export interface WeaponSpec {
  id: WeaponId
  name: string
  blurb: string
  price: number
  cooldown: number
  mag: number
  reload: number
  damage: number
  pellets: number
  spread: number
  speed: number
  life: number
  gravity: boolean
  style: 'auto' | 'charge' | 'rocket'
  metal: number
  blast: number
  pierce: number
}

export const CATALOG: Record<WeaponId, WeaponSpec> = {
  revolver: {
    id: 'revolver',
    name: 'Revolver',
    blurb: 'Steady sidearm',
    price: 0,
    cooldown: FIRE_COOLDOWN,
    mag: MAG_SIZE,
    reload: RELOAD_TIME,
    damage: 1,
    pellets: 1,
    spread: 0,
    speed: 700,
    life: 2.4,
    gravity: false,
    style: 'auto',
    metal: 0,
    blast: 0,
    pierce: 0,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Scattergun',
    blurb: 'Close spread',
    price: 8,
    cooldown: 0.52,
    mag: 5,
    reload: 1.1,
    damage: 1,
    pellets: 4,
    spread: 0.28,
    speed: 560,
    life: 0.42,
    gravity: false,
    style: 'auto',
    metal: 0,
    blast: 0,
    pierce: 0,
  },
  smg: {
    id: 'smg',
    name: 'Antler SMG',
    blurb: 'Fast, light hits',
    price: 14,
    cooldown: 0.09,
    mag: 26,
    reload: 1.2,
    damage: 1,
    pellets: 1,
    spread: 0.055,
    speed: 780,
    life: 1.6,
    gravity: false,
    style: 'auto',
    metal: 0,
    blast: 0,
    pierce: 0,
  },
  rifle: {
    id: 'rifle',
    name: 'Charge Rifle',
    blurb: 'Hold, then release',
    price: 18,
    cooldown: 0.28,
    mag: 6,
    reload: 1.15,
    damage: 2,
    pellets: 1,
    spread: 0,
    speed: 1100,
    life: 0.22,
    gravity: false,
    style: 'charge',
    metal: 0,
    blast: 0,
    pierce: 4,
  },
  launcher: {
    id: 'launcher',
    name: 'Haul Rocket',
    blurb: 'Breaks metal fast',
    price: 24,
    cooldown: 0.78,
    mag: 3,
    reload: 1.4,
    damage: 3,
    pellets: 1,
    spread: 0,
    speed: 480,
    life: 1.8,
    gravity: true,
    style: 'rocket',
    metal: 3,
    blast: 52,
    pierce: 0,
  },
}

export const UPGRADES: { id: UpgradeId; name: string; blurb: string; prices: [number, number, number] }[] = [
  { id: 'damage', name: 'Damage', blurb: '+1 per shot', prices: [7, 14, 24] },
  { id: 'rate', name: 'Fire rate', blurb: 'Shorter pause', prices: [6, 12, 20] },
  { id: 'ammo', name: 'Ammo', blurb: 'More rounds, faster reload', prices: [5, 10, 18] },
  { id: 'health', name: 'Health', blurb: '+1 heart', prices: [6, 12, 20] },
  { id: 'dash', name: 'Dash', blurb: 'Shorter cooldown', prices: [6, 12, 20] },
  { id: 'armor', name: 'Armor', blurb: 'Ignore some hits', prices: [8, 16, 26] },
]

export function specOf(id: WeaponId): WeaponSpec {
  return CATALOG[id]
}

export function magSize(g: Game): number {
  const spec = specOf(g.weapon)
  const bonus = g.ranks.ammo * (spec.mag >= 20 ? 6 : 2)
  return spec.mag + bonus
}

export function fireCooldown(g: Game): number {
  const spec = specOf(g.weapon)
  return Math.max(0.045, spec.cooldown * (1 - 0.16 * g.ranks.rate))
}

export function reloadTime(g: Game): number {
  return specOf(g.weapon).reload * (1 - 0.12 * g.ranks.ammo)
}

export function dashCooldown(g: Game): number {
  return DASH_COOLDOWN * (1 - 0.18 * g.ranks.dash)
}

export function maxHearts(g: Game): number {
  return MAX_HP + g.ranks.health
}

export function upgradePrice(ranks: Ranks, id: UpgradeId): number | null {
  const rank = ranks[id]
  if (rank >= 3) return null
  return UPGRADES.find((u) => u.id === id)!.prices[rank]
}

export function applyLoadout(g: Game): void {
  const p = g.player
  p.maxHp = maxHearts(g)
  p.hp = p.maxHp
  p.ammo = magSize(g)
  p.reloading = false
  p.reloadT = 0
  p.fireCd = 0
  p.charge = 0
  p.dashCd = 0
  p.armorClock = 0
}

export function equip(g: Game, id: WeaponId): boolean {
  if (!g.owned.includes(id)) return false
  g.weapon = id
  const p = g.player
  const mag = magSize(g)
  if (p.ammo > mag) p.ammo = mag
  p.charge = 0
  p.fireCd = Math.max(p.fireCd, 0.12)
  g.message = specOf(id).name.toUpperCase()
  g.messageT = 0.9
  g.onSfx?.('ui')
  return true
}

export function cycleWeapon(g: Game, dir: 1 | -1): void {
  const owned = WEAPONS.filter((id) => g.owned.includes(id))
  const index = Math.max(0, owned.indexOf(g.weapon))
  const next = owned[(index + dir + owned.length) % owned.length]
  if (next && next !== g.weapon) equip(g, next)
}

export function buyWeapon(g: Game, id: WeaponId): boolean {
  const spec = specOf(id)
  if (g.owned.includes(id)) return equip(g, id)
  if (g.coins < spec.price) return false
  g.coins -= spec.price
  g.owned.push(id)
  equip(g, id)
  g.onSfx?.('pickup')
  return true
}

export function buyUpgrade(g: Game, id: UpgradeId): boolean {
  const price = upgradePrice(g.ranks, id)
  if (price === null || g.coins < price) return false
  g.coins -= price
  g.ranks[id] += 1
  if (id === 'health') g.player.maxHp = maxHearts(g)
  g.message = `${UPGRADES.find((u) => u.id === id)!.name.toUpperCase()} ${g.ranks[id]}`
  g.messageT = 0.9
  g.onSfx?.('pickup')
  return true
}

export function freshRanks(): Ranks {
  return emptyRanks()
}
