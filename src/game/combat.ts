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
import type { BossId, Bullet, Dodge, Enemy, Game, ShotStyle } from './types'

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

export function fireBullet(
  g: Game,
  x: number,
  y: number,
  vx: number,
  vy: number,
  friendly: boolean,
  dodge: Dodge,
  gravity = false,
): void {
  const b: Bullet = {
    x,
    y,
    w: dodge === 'low' ? 16 : BULLET_W,
    h: BULLET_H,
    vx,
    vy,
    life: gravity ? 3.2 : 2.4,
    friendly,
    damage: 1,
    dodge,
    gravity,
  }
  g.bullets.push(b)
  if (g.bullets.length > 80) g.bullets.splice(0, g.bullets.length - 80)
}

export function shotY(style: ShotStyle, cycle: number): { y: number; dodge: Dodge } {
  const low = style === 'low' || (style === 'mix' && cycle % 2 === 1)
  return low ? { y: LOW_SHOT_Y, dodge: 'low' } : { y: HIGH_SHOT_Y, dodge: 'high' }
}

export function hurtPlayer(g: Game, amount = 1, ignoreFrames = false): void {
  const p = g.player
  if (!p.alive || p.deadT > 0) return
  if (!ignoreFrames && p.hurtT > 0) return
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

export function bossLabel(id: BossId): string {
  if (id === 'mech') return 'IRON WARDEN'
  if (id === 'conductor') return 'THE CONDUCTOR'
  return 'LOCO-LOCK'
}

export function bossSize(id: BossId): { w: number; h: number; hp: number } {
  if (id === 'mech') return { w: 118, h: 132, hp: 36 }
  if (id === 'conductor') return { w: 74, h: 112, hp: 42 }
  return { w: 168, h: 158, hp: 48 }
}
