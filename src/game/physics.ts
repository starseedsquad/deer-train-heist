import type { Solid } from './types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

export function blocks(s: Solid): boolean {
  return s.collides && s.hp > 0 && s.kind !== 'piston'
}

export interface Body {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
}

export function moveBody(body: Body, solids: Solid[], dt: number): { onGround: boolean; platformId: number } {
  const prevBottom = body.y + body.h
  body.x += body.vx * dt
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      if (!blocks(s) || s.oneWay) continue
      if (s.kind === 'floor') continue
      if (s.y >= prevBottom - 2) continue
      if (!overlaps(body, s)) continue
      const vert = Math.min(body.y + body.h, s.y + s.h) - Math.max(body.y, s.y)
      if (vert < 2) continue
      if (body.vx > 0) body.x = s.x - body.w
      else if (body.vx < 0) body.x = s.x + s.w
      else {
        const penL = body.x + body.w - s.x
        const penR = s.x + s.w - body.x
        if (penL < penR) body.x = s.x - body.w
        else body.x = s.x + s.w
      }
      body.vx = 0
    }
  }

  const bottomBeforeY = body.y + body.h
  body.y += body.vy * dt
  let onGround = false
  let platformId = 0
  for (let pass = 0; pass < 3; pass++) {
    for (const s of solids) {
      if (s.hp <= 0) continue
      if (s.oneWay) {
        if (body.vy < 0) continue
        if (bottomBeforeY > s.y + 6) continue
        if (!overlaps(body, s)) continue
        body.y = s.y - body.h
        body.vy = 0
        onGround = true
        platformId = s.id
        continue
      }
      if (!blocks(s)) continue
      if (!overlaps(body, s)) continue
      const penTop = body.y + body.h - s.y
      const penBot = s.y + s.h - body.y
      if (body.vy >= 0 && bottomBeforeY <= s.y + 8 && penTop < penBot) {
        body.y = s.y - body.h
        body.vy = 0
        onGround = true
        if (s.move === 'sine-x') platformId = s.id
      } else if (body.vy < 0 && penBot < penTop) {
        body.y = s.y + s.h
        body.vy = 0
      }
    }
  }
  if (!onGround && body.vy >= 0) {
    const feet = body.y + body.h
    for (const s of solids) {
      if (s.hp <= 0 || s.kind === 'piston') continue
      if (!s.oneWay && !blocks(s)) continue
      if (feet > s.y + 2 || feet < s.y - 8) continue
      const overlapX = Math.min(body.x + body.w, s.x + s.w) - Math.max(body.x, s.x)
      if (overlapX < 6) continue
      body.y = s.y - body.h
      body.vy = 0
      onGround = true
      if (s.oneWay || s.move === 'sine-x') platformId = s.id
      break
    }
  }
  return { onGround, platformId }
}

export function pistonT(s: Solid, time: number): number {
  const period = s.period || 2.4
  return (((time / period + s.phase) % 1) + 1) % 1
}

/** 0 retracted, 1 fully slammed. */
export function pistonExt(t: number): number {
  if (t < 0.4) return 0
  if (t < 0.52) return 0
  if (t < 0.64) return (t - 0.52) / 0.12
  if (t < 0.8) return 1
  return Math.max(0, 1 - (t - 0.8) / 0.2)
}

export function pistonUnsafe(s: Solid, time: number): boolean {
  const t = pistonT(s, time)
  return t >= 0.38 && t < 0.88
}

export function lineBlocked(solids: Solid[], x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.max(1, Math.ceil(dist / 12))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    for (const s of solids) {
      if (!blocks(s) || s.oneWay || s.kind === 'floor') continue
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true
    }
  }
  return false
}
