import {
  BULLET_H,
  BULLET_W,
  GUN_OFFSET,
  HIGH_SHOT_Y,
  HURT_TIME,
  LOW_SHOT_Y,
  SCORE_BOSS,
  SCORE_CRATE,
  SCORE_DRONE,
  SCORE_METAL,
  SCORE_ROBOT,
} from './constants'
import type { BossId, Bullet, BulletKind, Dodge, Enemy, Game, ShotStyle } from './types'

export function burst(g: Game, x: number, y: number, color: string, n: number, speed = 90): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.35 + Math.random() * 0.75)
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.28 + Math.random() * 0.35,
      max: 0.55,
      color,
      size: 2 + Math.random() * 2.5,
      grav: true,
    })
  }
  if (g.particles.length > 300) g.particles.splice(0, g.particles.length - 300)
}

export function floatText(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, life: 0.85, color })
  if (g.floaters.length > 20) g.floaters.shift()
}

export function gunOrigin(p: { x: number; y: number; w: number; facing: 1 | -1 }): { x: number; y: number } {
  return {
    x: p.facing === 1 ? p.x + p.w - 2 : p.x - BULLET_W + 2,
    y: p.y + GUN_OFFSET,
  }
}

export interface ShotOpts {
  damage?: number
  kind?: BulletKind
  pierce?: number
  blast?: number
  metal?: number
  life?: number
  w?: number
  h?: number
}

export function fireBullet(
  g: Game,
  x: number,
  y: number,
  vx: number,
  vy: number,
  friendly: boolean,
  dodge: Dodge,
  gravity = false,
  opts: ShotOpts = {},
): void {
  const b: Bullet = {
    x,
    y,
    w: opts.w ?? (dodge === 'low' ? 16 : BULLET_W),
    h: opts.h ?? BULLET_H,
    vx,
    vy,
    life: opts.life ?? (gravity ? 3.2 : 2.4),
    friendly,
    damage: opts.damage ?? 1,
    dodge,
    gravity,
    kind: opts.kind ?? 'slug',
    pierce: opts.pierce ?? 0,
    blast: opts.blast ?? 0,
    metal: opts.metal ?? 0,
  }
  g.bullets.push(b)
  if (g.bullets.length > 120) g.bullets.splice(0, g.bullets.length - 120)
}

/** Front plate blocks high shots. Crouch shots and rounds from behind go through. */
export function shieldVerdict(e: Enemy, b: Bullet): 'block' | 'hit' {
  if (e.kind !== 'shield') return 'hit'
  const fromBehind = e.facing === 1 ? b.vx > 0 : b.vx < 0
  if (fromBehind) return 'hit'
  if (b.y >= e.y + 30) return 'hit'
  return 'block'
}

export function shotY(style: ShotStyle, cycle: number): { y: number; dodge: Dodge } {
  const low = style === 'low' || (style === 'mix' && cycle % 2 === 1)
  return low ? { y: LOW_SHOT_Y, dodge: 'low' } : { y: HIGH_SHOT_Y, dodge: 'high' }
}

export function hurtPlayer(g: Game, amount = 1, ignoreFrames = false): void {
  const p = g.player
  if (!p.alive || p.deadT > 0) return
  if (!ignoreFrames && p.hurtT > 0) return
  if (g.ranks.armor > 0) {
    p.armorClock += 1
    const every = 5 - g.ranks.armor
    if (p.armorClock % every === 0) {
      floatText(g, p.x, p.y, 'ARMOR', '#9ad0ff')
      p.hurtT = 0.35
      g.onSfx?.('metal')
      return
    }
  }
  p.hp = Math.max(0, p.hp - amount)
  p.hurtT = HURT_TIME
  g.shake = Math.max(g.shake, 8)
  burst(g, p.x + p.w / 2, p.y + p.h / 2, '#e85d4c', 8, 120)
  if (p.hp <= 0) {
    p.alive = false
    p.hp = 0
    p.deadT = 1.05
    p.vx = 0
    g.onSfx?.('die')
  } else {
    g.onSfx?.('hurt')
  }
}

export function damageSolid(g: Game, id: number, amount: number): void {
  const s = g.solids.find((o) => o.id === id)
  if (!s || s.hp <= 0) return
  if (!s.destructible) {
    s.hitFlash = 0.08
    burst(g, s.x + s.w / 2, s.y + s.h / 2, '#d5dde8', 4, 70)
    g.onSfx?.('metal')
    return
  }
  s.hp -= amount
  s.hitFlash = 0.12
  if (s.hp > 0) {
    burst(g, s.x + s.w / 2, s.y + 8, s.kind === 'crate' ? '#e7c38a' : '#c5ced8', 5, 80)
    g.onSfx?.('hit')
    return
  }
  const score = s.kind === 'crate' ? SCORE_CRATE : SCORE_METAL
  g.score += score
  g.levelScore += score
  g.stats.cratesBroken++
  floatText(g, s.x, s.y, `+${score}`, '#f0c36a')
  burst(g, s.x + s.w / 2, s.y + s.h / 2, s.kind === 'metal' || s.kind === 'barrier' ? '#9aa6b2' : '#c9843f', 14, 140)
  g.onSfx?.('break')
  g.solids = g.solids.filter((o) => o.id !== id)
}

export function killEnemy(g: Game, e: Enemy): void {
  if (!e.alive || e.scored) return
  e.alive = false
  e.scored = true
  e.deathT = e.kind === 'boss' ? 0.9 : 0.35
  e.vx = 0
  e.beam = false
  const score = e.kind === 'boss' ? SCORE_BOSS : e.kind === 'drone' ? SCORE_DRONE : SCORE_ROBOT
  g.score += score
  g.levelScore += score
  floatText(g, e.x, e.y, `+${score}`, e.kind === 'boss' ? '#ffd76a' : '#f6e7c1')
  burst(g, e.x + e.w / 2, e.y + e.h / 2, '#d7dee8', e.kind === 'boss' ? 28 : 12, 160)
  g.shake = Math.max(g.shake, e.kind === 'boss' ? 14 : 4)
  if (e.kind === 'boss') {
    g.stats.bosses++
    g.bossDeathT = 0.9
    g.onSfx?.('boss')
  } else {
    g.onSfx?.('break')
  }
}

export function damageSolidHit(g: Game, id: number, amount: number, metalBonus = 0): void {
  const s = g.solids.find((o) => o.id === id)
  const extra = s && (s.kind === 'metal' || s.kind === 'barrier') ? metalBonus : 0
  damageSolid(g, id, amount + extra)
}

export function explode(g: Game, x: number, y: number, radius: number, damage: number, friendly: boolean, metalBonus = 0): void {
  burst(g, x, y, friendly ? '#ffb15a' : '#ff7a4a', 16, 160)
  g.shake = Math.max(g.shake, 6)
  for (const e of g.enemies) {
    if (!e.alive) continue
    const cx = e.x + e.w / 2
    const cy = e.y + e.h / 2
    if (Math.hypot(cx - x, cy - y) > radius + e.w * 0.3) continue
    e.hp -= damage
    e.hurtT = 0.08
    if (e.hp <= 0) killEnemy(g, e)
  }
  for (const s of g.solids) {
    if (!s.destructible || s.hp <= 0) continue
    const cx = s.x + s.w / 2
    const cy = s.y + s.h / 2
    if (Math.hypot(cx - x, cy - y) > radius) continue
    damageSolidHit(g, s.id, damage, metalBonus)
  }
  if (!friendly) {
    const p = g.player
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    if (Math.hypot(cx - x, cy - y) < radius) hurtPlayer(g, 1)
  }
  g.onSfx?.('break')
}

export function bossLabel(id: BossId): string {
  if (id === 'mech') return 'IRON WARDEN'
  if (id === 'conductor') return 'THE CONDUCTOR'
  if (id === 'turret') return 'LOCO-LOCK'
  if (id === 'ram') return 'GLACIER RAM'
  if (id === 'hawk') return 'WHITEOUT HAWK'
  return 'SUMMIT BREAKER'
}

export function bossSize(id: BossId): { w: number; h: number; hp: number } {
  if (id === 'mech') return { w: 118, h: 132, hp: 36 }
  if (id === 'conductor') return { w: 74, h: 112, hp: 42 }
  if (id === 'turret') return { w: 168, h: 158, hp: 48 }
  if (id === 'ram') return { w: 128, h: 118, hp: 40 }
  if (id === 'hawk') return { w: 100, h: 56, hp: 44 }
  return { w: 150, h: 146, hp: 54 }
}
