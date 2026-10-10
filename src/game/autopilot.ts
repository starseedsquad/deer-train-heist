import {
  CEILING_Y,
  CROUCH_H,
  GROUND,
  JUMP_HEIGHT,
  STAND_H,
} from './constants'
import { pistonUnsafe } from './physics'
import type { Bullet, Game, InputState, Solid } from './types'
import { emptyInput } from './types'

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function surfaceAt(g: Game, x: number, feet: number): boolean {
  return g.solids.some((s) => {
    if (s.hp <= 0 || !s.collides || s.kind === 'piston' || s.kind === 'gate') return false
    if (x < s.x + 2 || x > s.x + s.w - 2) return false
    return s.y >= feet - 10 && s.y <= feet + 56
  })
}

function gapAhead(g: Game, feet: number, x: number): { dist: number; width: number } | null {
  let dist = 0
  for (; dist < 440; dist += 6) {
    if (!surfaceAt(g, x + dist, feet)) break
  }
  if (dist >= 440) return null
  let width = 0
  for (; width < 480; width += 6) {
    if (surfaceAt(g, x + dist + width, feet)) break
  }
  if (width >= 480 || width < 24) return null
  return { dist, width }
}

function columnTop(s: Solid, solids: Solid[]): number {
  let y = s.y
  let cursor = s
  for (let i = 0; i < 6; i++) {
    const above = solids.find(
      (o) =>
        o.id !== cursor.id &&
        o.hp > 0 &&
        o.collides &&
        Math.abs(o.y + o.h - y) <= 4 &&
        o.x < cursor.x + cursor.w - 6 &&
        o.x + o.w > cursor.x + 6,
    )
    if (!above) break
    y = above.y
    cursor = above
  }
  return y
}

export function createAutopilot(): (g: Game, dt: number) => InputState {
  let jumpHold = 0
  let jumpLatch = false
  let dashLatch = false
  let stuckT = 0
  let anchorX = 0
  let confirmWait = 0
  let groundT = 1

  return (g, dt) => {
    const input = emptyInput()
    if (g.mode === 'title') {
      input.confirmPressed = true
      return input
    }
    if (g.mode === 'complete') {
      confirmWait += dt
      if (confirmWait > 0.08) input.confirmPressed = true
      return input
    }
    confirmWait = 0
    if (g.mode !== 'playing') return input

    const p = g.player
    if (!p.alive || p.deadT > 0) return input

    if (p.x < anchorX - 30 || p.x > anchorX + 12) {
      anchorX = p.x
      stuckT = 0
    } else stuckT += dt

    const feet = p.y + p.h
    const boss = g.enemies.find((e) => e.kind === 'boss' && e.alive)
    const head: SolidProbe = { x: p.x + p.w - 6, y: GROUND - STAND_H, w: 48, h: CEILING_Y - (GROUND - STAND_H) }
    const crouchBox: SolidProbe = { x: p.x + p.w - 4, y: GROUND - CROUCH_H + 2, w: 40, h: CROUCH_H - 4 }
    const lowCeiling = g.solids.some(
      (s) => s.hp > 0 && s.collides && !s.oneWay && s.kind !== 'floor' && s.kind !== 'piston' && overlaps(head, s) && !overlaps(crouchBox, s),
    )

    let left = false
    let right = true
    let jump = false
    let crouch = false
    let shoot = false
    let dash = false

    const chest = g.pickups.find((item) => item.kind === 'chest' && !item.taken && !item.locked)
    if (!boss && chest && p.x > chest.x + chest.w - 8) {
      right = false
      left = true
    }

    if (boss) {
      const desired = boss.x - 280
      if (p.x > desired + 24) {
        right = false
        left = true
      } else if (p.x < desired - 36) {
        right = true
        left = false
      } else {
        right = false
        left = false
      }
      shoot = true
      if (boss.beam) crouch = true
    }

    let nearest: Bullet | null = null
    let nearestD = 190
    for (const b of g.bullets) {
      if (b.friendly || b.life <= 0) continue
      const closing =
        (b.vx < -20 && b.x > p.x - 16 && b.x < p.x + p.w + 175) ||
        (b.vx > 20 && b.x < p.x + p.w + 16 && b.x > p.x - 175)
      if (!closing && Math.abs(b.vy) < 40) continue
      const d = Math.abs(b.x - p.x)
      if (d < nearestD) {
        nearest = b
        nearestD = d
      }
    }
    if (nearest) {
      const high = nearest.dodge === 'high' || nearest.y + nearest.h < GROUND - CROUCH_H - 2
      const low = nearest.dodge === 'low' || nearest.y > GROUND - 26
      if (low && !high) jump = true
      else if (high) crouch = true
      else if (nearest.y > p.y + 8) jump = true
      else crouch = true
    }

    let waiting = false
    if (!boss) {
      for (const s of g.solids) {
        if (s.kind !== 'piston') continue
        const ahead = s.x < p.x + p.w + 120 && s.x + s.w > p.x - 4
        if (ahead && pistonUnsafe(s, g.levelTime)) waiting = true
      }
    }
    if (waiting) {
      right = false
      left = false
      stuckT = 0
    }

    const gap = p.onGround ? gapAhead(g, feet, p.x + p.w) : null
    if (gap && gap.dist <= 18 && !lowCeiling) {
      jump = true
      crouch = false
      if (gap.width >= 168 || (gap.width > 110 && Math.abs(p.vx) < 200)) dash = true
    } else if (lowCeiling) {
      crouch = true
      if (!(nearest && nearest.dodge === 'low' && nearestD < 120)) jump = false
    }

    const probe: SolidProbe = { x: p.x + (right ? p.w + 1 : -28), y: GROUND - STAND_H + 6, w: 30, h: STAND_H - 10 }
    const lowProbe: SolidProbe = { x: probe.x, y: GROUND - CROUCH_H, w: 36, h: CROUCH_H }
    const hits = g.solids.filter(
      (s) =>
        s.hp > 0 &&
        s.collides &&
        !s.oneWay &&
        s.kind !== 'floor' &&
        s.kind !== 'piston' &&
        s.kind !== 'gate' &&
        (overlaps(probe, s) || overlaps(lowProbe, s)),
    )
    const destructible = hits
      .filter((s) => s.destructible)
      .sort((a, b) => a.x - b.x || b.y - a.y)[0]
    if (destructible) {
      shoot = true
      if (lowCeiling || columnTop(destructible, g.solids) > GROUND - JUMP_HEIGHT) crouch = crouch || lowCeiling
      stuckT = Math.min(stuckT, 0.4)
    } else if (hits.length > 0 && lowCeiling) {
      crouch = true
    }

    if (!boss) {
      for (const e of g.enemies) {
        if (!e.alive) continue
        if (e.x + e.w < p.x - 10 || e.x > p.x + 440) continue
        shoot = true
      }
    }

    if (stuckT > 1.1 && !waiting) {
      shoot = true
      if (!lowCeiling && stuckT > 1.5) jump = true
      if (stuckT > 2.2) dash = true
      right = true
      left = false
    }
    if (lowCeiling) {
      crouch = true
      jump = false
    }

    if (p.onGround) groundT += dt
    else groundT = 0
    if (groundT > 0.12) jumpLatch = false
    if (jumpHold > 0) {
      input.jump = true
      jumpHold -= dt
    }
    if (jump && p.onGround && groundT > 0.04 && !jumpLatch) {
      input.jumpPressed = true
      input.jump = true
      jumpHold = 0.42
      jumpLatch = true
    }

    if (p.onGround && p.dashCd <= 0 && groundT > 0.12) dashLatch = false
    if (dash && !dashLatch && p.dashCd <= 0) {
      input.dashPressed = true
      dashLatch = true
    }

    input.left = left && !right
    input.right = right && !left
    input.crouch = crouch
    input.shoot = shoot
    input.shootPressed = shoot
    return input
  }
}

interface SolidProbe {
  x: number
  y: number
  w: number
  h: number
}
