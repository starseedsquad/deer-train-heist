import {
  CEILING_Y,
  GROUND,
  HIGH_SHOT_Y,
  VIEW_H,
  VIEW_W,
} from './constants'
import { describeLevel } from './levels'
import { pistonExt, pistonT } from './physics'
import type { Game } from './types'
import { layoutButtons } from './ui'

const FONT = 'Trebuchet MS, Verdana, sans-serif'
const DISPLAY = 'Georgia, Palatino, serif'

const STARS = Array.from({ length: 64 }, (_, i) => ({
  x: (i * 89) % VIEW_W,
  y: (i * 47) % 200,
  s: i % 5 === 0 ? 2 : 1,
}))

export function render(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.imageSmoothingEnabled = true
  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const mag = reduce ? 0 : g.shake
  const sx = mag > 0 ? (Math.random() - 0.5) * mag : 0
  const sy = mag > 0 ? (Math.random() - 0.5) * mag : 0
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.save()
  ctx.translate(sx, sy + Math.sin(g.time * 16) * (g.mode === 'playing' ? 0.6 : 0))
  drawSky(ctx, g)
  drawRidges(ctx, g)
  if (g.mode === 'title') drawTitle(ctx, g)
  else drawWorld(ctx, g)
  ctx.restore()
  if (g.debug && g.mode === 'playing') drawDebug(ctx, g)
}

function drawSky(ctx: CanvasRenderingContext2D, g: Game): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#141a33')
  sky.addColorStop(0.45, '#2a3d66')
  sky.addColorStop(1, '#1b2436')
  ctx.fillStyle = sky
  ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40)
  ctx.fillStyle = '#f4ecd4'
  ctx.beginPath()
  ctx.arc(780, 78, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(244, 236, 212, 0.18)'
  ctx.beginPath()
  ctx.arc(780, 78, 46, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (const star of STARS) {
    const tw = 0.45 + Math.sin(g.time * 2 + star.x) * 0.4
    ctx.globalAlpha = tw
    ctx.fillRect(star.x, star.y, star.s, star.s)
  }
  ctx.globalAlpha = 1
  drawSnow(ctx, g.time)
}

function drawSnow(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  for (let i = 0; i < 36; i++) {
    const x = ((i * 137 + time * (18 + (i % 5) * 9)) % (VIEW_W + 30)) - 15
    const y = (i * 91 + time * (28 + (i % 4) * 8)) % (VIEW_H + 10)
    ctx.fillRect(x, y, 2, 2)
  }
}

function drawRidges(ctx: CanvasRenderingContext2D, g: Game): void {
  const cam = g.mode === 'title' ? g.time * 30 : g.camX
  band(ctx, '#24324a', 210, 90, cam * 0.12 + g.time * 8, 320, 150)
  band(ctx, '#1c3a32', 250, 70, cam * 0.28 + g.time * 22, 180, 90)
  band(ctx, '#14261f', 300, 80, cam * 0.45 + g.time * 36, 120, 70)
  ctx.fillStyle = '#12181c'
  ctx.fillRect(0, 430, VIEW_W, 110)
  ctx.strokeStyle = '#8d9398'
  ctx.lineWidth = 2
  const rail = -((cam * 0.8 + g.time * 80) % 40)
  for (let x = rail; x < VIEW_W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 470)
    ctx.lineTo(x + 22, 470)
    ctx.stroke()
  }
}

function band(
  ctx: CanvasRenderingContext2D,
  color: string,
  base: number,
  height: number,
  scroll: number,
  span: number,
  peak: number,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-40, base + height)
  const start = -((scroll % span) + span) % span
  for (let x = start - span; x <= VIEW_W + span; x += span) {
    ctx.lineTo(x, base + height)
    ctx.lineTo(x + span * 0.5, base + height - peak)
  }
  ctx.lineTo(VIEW_W + 40, base + height)
  ctx.lineTo(VIEW_W + 40, base + height + 80)
  ctx.lineTo(-40, base + height + 80)
  ctx.fill()
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.save()
  ctx.translate(-Math.floor(g.camX), 0)
  drawTrain(ctx, g)
  for (const s of g.solids) drawSolid(ctx, g, s)
  for (const d of g.decals) drawSign(ctx, d.x, d.y, d.text)
  for (const item of g.pickups) if (!item.taken) drawPickup(ctx, g, item)
  for (const e of g.enemies) drawEnemy(ctx, g, e)
  for (const t of g.player.trail) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, t.life * 3)
    drawDeer(ctx, {
      x: t.x,
      y: t.y,
      w: g.player.w,
      h: t.h,
      facing: t.facing,
      anim: g.player.anim,
      crouch: t.h < 40,
      dash: true,
      hurt: false,
      flash: 0,
      onGround: true,
    })
    ctx.restore()
  }
  if (g.player.deadT <= 0 || Math.floor(g.time * 16) % 2 === 0) {
    drawDeer(ctx, {
      x: g.player.x,
      y: g.player.y,
      w: g.player.w,
      h: g.player.h,
      facing: g.player.facing,
      anim: g.player.anim,
      crouch: g.player.crouching,
      dash: g.player.dashT > 0,
      hurt: g.player.hurtT > 0 && Math.floor(g.player.hurtT * 14) % 2 === 0,
      flash: g.player.shootFlash,
      onGround: g.player.onGround,
    })
  }
  for (const b of g.bullets) drawBullet(ctx, b)
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, p.size, p.size)
    ctx.globalAlpha = 1
  }
  for (const f of g.floaters) {
    ctx.globalAlpha = Math.max(0, f.life)
    ctx.fillStyle = f.color
    ctx.font = `700 14px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(f.text, f.x, f.y)
    ctx.globalAlpha = 1
  }
  ctx.restore()
  drawVignette(ctx)
  if (g.mode === 'playing' || g.mode === 'paused') drawHud(ctx, g)
  if (g.messageT > 0) drawBanner(ctx, g.message, Math.min(1, g.messageT))
  if (g.mode === 'paused') drawPause(ctx, g)
  if (g.mode === 'complete') drawComplete(ctx, g)
  if (g.mode === 'gameover') drawGameOver(ctx, g)
  drawButtons(ctx, g)
}

function spans(g: Game): { x: number; w: number }[] {
  const floors = g.solids.filter((s) => s.kind === 'floor').sort((a, b) => a.x - b.x)
  const out: { x: number; w: number }[] = []
  for (const f of floors) {
    const last = out[out.length - 1]
    if (last && f.x <= last.x + last.w + 4) last.w = Math.max(last.w, f.x + f.w - last.x)
    else out.push({ x: f.x, w: f.w })
  }
  return out
}

function drawTrain(ctx: CanvasRenderingContext2D, g: Game): void {
  const cars = spans(g)
  cars.forEach((car, index) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(car.x, 0, car.w, VIEW_H)
    ctx.clip()
    ctx.fillStyle = '#6a5344'
    ctx.fillRect(car.x, 30, car.w, 26)
    ctx.fillStyle = '#e0b15a'
    ctx.fillRect(car.x, 52, car.w, 5)
    if (index === 0) {
      ctx.fillStyle = '#2a2118'
      ctx.font = `700 16px ${DISPLAY}`
      ctx.textAlign = 'left'
      ctx.fillText('ANTLER EXPRESS', car.x + 18, 48)
    }
    const first = Math.floor(car.x / 170) * 170
    for (let x = first; x < car.x + car.w; x += 170) {
      ctx.fillStyle = '#3c2f26'
      ctx.fillRect(x, 58, 16, GROUND - 58)
      ctx.fillStyle = '#1c2836'
      round(ctx, x + 26, 74, 128, 132, 8)
      ctx.fill()
      ctx.fillStyle = '#4a3c32'
      ctx.fillRect(x + 16, 214, 150, GROUND - 214)
      ctx.fillStyle = '#6d5644'
      ctx.fillRect(x + 16, 214, 150, 10)
      ctx.fillStyle = '#5a4638'
      ctx.fillRect(x + 28, GROUND - 70, 46, 36)
      ctx.fillRect(x + 86, GROUND - 70, 46, 36)
      const glow = 0.35 + Math.sin(g.time * 10 + x) * 0.08
      ctx.fillStyle = `rgba(255, 214, 150, ${glow})`
      ctx.beginPath()
      ctx.arc(x + 90, 78, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#7a5b3e'
    ctx.fillRect(car.x, GROUND - 8, car.w, 16)
    ctx.fillStyle = '#3e3128'
    ctx.fillRect(car.x, GROUND + 8, car.w, VIEW_H - GROUND)
    ctx.fillStyle = '#d7c4a4'
    for (let x = car.x; x < car.x + car.w; x += 28) ctx.fillRect(x, GROUND - 4, 14, 3)
    ctx.restore()
    ctx.fillStyle = '#2b3138'
    ctx.beginPath()
    ctx.arc(car.x + 36, GROUND + 28, 14, 0, Math.PI * 2)
    ctx.arc(car.x + car.w - 36, GROUND + 28, 14, 0, Math.PI * 2)
    ctx.fill()
  })
  for (let i = 0; i < cars.length - 1; i++) {
    const a = cars[i]
    const b = cars[i + 1]
    const gapX = a.x + a.w
    const gapW = b.x - gapX
    if (gapW < 8 || gapW > 420) continue
    ctx.strokeStyle = '#9aa3ad'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(gapX - 6, GROUND - 20)
    ctx.lineTo(gapX + gapW + 6, GROUND - 20)
    ctx.stroke()
    ctx.strokeStyle = '#c9843f'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(gapX, GROUND - 36)
    ctx.lineTo(gapX + gapW, GROUND - 28)
    ctx.stroke()
  }
}

function drawSolid(ctx: CanvasRenderingContext2D, g: Game, s: Game['solids'][number]): void {
  if (s.kind === 'floor') return
  if (s.hp <= 0) return
  ctx.save()
  if (s.hitFlash > 0) ctx.globalAlpha = 0.65
  if (s.kind === 'crate' || s.kind === 'metal' || s.kind === 'barrier') {
    const metal = s.kind !== 'crate'
    ctx.fillStyle = metal ? '#8b949e' : '#c4843f'
    round(ctx, s.x, s.y, s.w, s.h, 4)
    ctx.fill()
    ctx.strokeStyle = metal ? '#d5dbe3' : '#efd0a4'
    ctx.lineWidth = 2
    ctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8)
    if (!metal) {
      ctx.strokeStyle = '#8a5a2b'
      ctx.beginPath()
      ctx.moveTo(s.x + 4, s.y + s.h / 2)
      ctx.lineTo(s.x + s.w - 4, s.y + s.h / 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#5c6770'
      for (let i = 0; i < s.maxHp; i++) {
        ctx.globalAlpha = i < s.hp ? 1 : 0.25
        ctx.fillRect(s.x + 8 + (i % 4) * 8, s.y + 10 + Math.floor(i / 4) * 8, 5, 5)
      }
      ctx.globalAlpha = 1
    }
    const cracks = 1 - s.hp / s.maxHp
    if (cracks > 0.2) {
      ctx.strokeStyle = 'rgba(40,24,12,0.7)'
      ctx.beginPath()
      ctx.moveTo(s.x + 10, s.y + 8)
      ctx.lineTo(s.x + s.w * 0.5, s.y + s.h * cracks)
      ctx.lineTo(s.x + s.w - 8, s.y + s.h - 6)
      ctx.stroke()
    }
  } else if (s.kind === 'steel' || s.kind === 'gate') {
    ctx.fillStyle = s.kind === 'gate' ? '#4c3a3a' : '#323a46'
    ctx.fillRect(s.x, s.y, s.w, s.h)
    ctx.fillStyle = '#f0c36a'
    ctx.fillRect(s.x, s.y + s.h - 8, s.w, 6)
    ctx.fillStyle = '#1b212b'
    const bars = s.kind === 'gate' ? 4 : 3
    for (let i = 0; i < bars; i++) {
      const y = s.y + 16 + i * 28
      if (y < s.y + s.h - 16) ctx.fillRect(s.x + 6, y, s.w - 12, 4)
    }
    if (s.kind === 'steel' && s.y + s.h >= CEILING_Y - 2 && s.h > 80) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(s.x, s.y, s.w, s.h)
      ctx.fillStyle = '#e23d3d'
      for (let x = s.x; x < s.x + s.w; x += 16) ctx.fillRect(x, CEILING_Y - 8, 8, 8)
    }
  } else if (s.kind === 'piston') {
    const t = pistonT(s, g.levelTime)
    const warn = t >= 0.38 && t < 0.52
    ctx.fillStyle = '#2c3138'
    ctx.fillRect(s.x - 6, 58, s.w + 12, 16)
    ctx.fillStyle = warn ? '#ff5a4a' : '#8d3a34'
    round(ctx, s.x, s.y, s.w, s.h, 4)
    ctx.fill()
    ctx.fillStyle = '#e8c27a'
    ctx.fillRect(s.x + 8, s.y + s.h - 10, s.w - 16, 6)
    if (pistonExt(t) > 0.2) {
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#ffb4a8'
      ctx.fillRect(s.x + 4, GROUND - 18, s.w - 8, 16)
      ctx.globalAlpha = 1
    }
  } else if (s.kind === 'platform') {
    ctx.fillStyle = '#9aa4b0'
    round(ctx, s.x, s.y, s.w, s.h, 4)
    ctx.fill()
    ctx.fillStyle = '#f0c36a'
    ctx.fillRect(s.x + 6, s.y + 4, s.w - 12, 3)
  }
  ctx.restore()
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.font = `700 12px ${FONT}`
  const w = ctx.measureText(text).width + 16
  ctx.fillStyle = '#f3e2c4'
  round(ctx, x, y, w, 22, 4)
  ctx.fill()
  ctx.strokeStyle = '#8a5a32'
  ctx.stroke()
  ctx.fillStyle = '#3a271c'
  ctx.textAlign = 'left'
  ctx.fillText(text, x + 8, y + 15)
}

function drawPickup(ctx: CanvasRenderingContext2D, g: Game, item: Game['pickups'][number]): void {
  const bob = Math.sin(g.time * 3 + item.bob) * 3
  const x = item.x
  const y = item.y + bob
  if (item.kind === 'ammo') {
    ctx.fillStyle = '#f0c36a'
    round(ctx, x, y, 18, 8, 2)
    ctx.fill()
    ctx.fillStyle = '#8a6230'
    ctx.fillRect(x + 14, y + 2, 6, 4)
  } else if (item.kind === 'heart') {
    drawHeart(ctx, x + 10, y + 10, 8, '#e85d4c')
  } else if (item.kind === 'gem') {
    ctx.fillStyle = '#5ddec4'
    ctx.beginPath()
    ctx.moveTo(x + 9, y)
    ctx.lineTo(x + 18, y + 8)
    ctx.lineTo(x + 9, y + 18)
    ctx.lineTo(x, y + 8)
    ctx.fill()
  } else {
    ctx.fillStyle = item.locked ? '#6d6248' : '#f0c36a'
    round(ctx, x, y, item.w, item.h, 4)
    ctx.fill()
    ctx.fillStyle = item.locked ? '#3a3428' : '#8a4e22'
    ctx.fillRect(x + 8, y + 6, item.w - 16, 8)
    ctx.fillStyle = '#fff4d2'
    ctx.font = `700 10px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(item.locked ? 'LOCKED' : 'HAUL', x + item.w / 2, y + item.h - 6)
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Game['bullets'][number]): void {
  ctx.save()
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2)
  ctx.fillStyle = b.friendly ? '#ffe08a' : b.dodge === 'low' ? '#ff7a4a' : b.dodge === 'high' ? '#ffd0d0' : '#ffb45a'
  round(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 3)
  ctx.fill()
  ctx.restore()
}

interface DeerOpts {
  x: number
  y: number
  w: number
  h: number
  facing: 1 | -1
  anim: number
  crouch: boolean
  dash: boolean
  hurt: boolean
  flash: number
  onGround: boolean
}

function drawDeer(ctx: CanvasRenderingContext2D, d: DeerOpts): void {
  ctx.save()
  ctx.translate(d.x + d.w / 2, d.y + d.h)
  ctx.scale(d.facing, 1)
  if (d.dash) ctx.rotate(-0.12)
  if (d.hurt) ctx.globalAlpha = 0.55
  const swing = Math.sin(d.anim) * (d.onGround && !d.crouch ? 7 : 2)
  const body = d.crouch ? '#e09a55' : '#e09a55'
  ctx.strokeStyle = '#3a271c'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  if (!d.crouch) {
    leg(ctx, -8, -24, -10 - swing, -2)
    leg(ctx, 6, -22, 9 + swing, -2)
    ctx.fillStyle = '#f4d7b0'
    ellipse(ctx, -16, -28, 6, 4)
    ctx.fillStyle = body
    ellipse(ctx, 0, -32, 18, 12)
    ctx.fillStyle = '#f6dcc0'
    ellipse(ctx, -2, -28, 10, 7)
    spot(ctx, -6, -36)
    spot(ctx, 4, -34)
    ctx.fillStyle = body
    ellipse(ctx, 12, -44, 6, 8)
    ctx.fillStyle = body
    ellipse(ctx, 20, -54, 11, 9)
    ctx.fillStyle = '#f3c9a4'
    ellipse(ctx, 18, -50, 6, 4)
    ear(ctx, 12, -60)
    antler(ctx, 14, -62, -1)
    antler(ctx, 22, -62, 1)
    eye(ctx, 24, -56)
    ctx.fillStyle = '#3c241c'
    ellipse(ctx, 30, -52, 3, 2)
    gun(ctx, 8, -48, d.flash)
  } else {
    leg(ctx, -6, -10, -12, -1)
    leg(ctx, 8, -10, 14, -1)
    ctx.fillStyle = body
    ellipse(ctx, 2, -16, 18, 9)
    ctx.fillStyle = '#f6dcc0'
    ellipse(ctx, 0, -14, 9, 5)
    ctx.fillStyle = body
    ellipse(ctx, 18, -22, 10, 8)
    ear(ctx, 12, -28)
    antler(ctx, 14, -30, -1)
    antler(ctx, 22, -30, 1)
    eye(ctx, 22, -24)
    ctx.fillStyle = '#3c241c'
    ellipse(ctx, 28, -20, 2.5, 2)
    gun(ctx, 10, -16, d.flash)
  }
  ctx.restore()
}

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.strokeStyle = '#b8743a'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.strokeStyle = '#3a271c'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x2, y2 + 1)
  ctx.lineTo(x2 + 4, y2 + 1)
  ctx.stroke()
}

function ear(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#c4844a'
  ctx.beginPath()
  ctx.moveTo(x, y + 6)
  ctx.lineTo(x - 3, y - 6)
  ctx.lineTo(x + 4, y)
  ctx.fill()
}

function antler(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.strokeStyle = '#8d5a32'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y + 4)
  ctx.lineTo(x + dir * 4, y - 8)
  ctx.moveTo(x + dir * 2, y - 2)
  ctx.lineTo(x + dir * 8, y - 4)
  ctx.stroke()
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#fffaf2'
  ellipse(ctx, x, y, 3.2, 3.2)
  ctx.fillStyle = '#24160f'
  ellipse(ctx, x + 0.8, y, 1.5, 1.5)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 1, y - 1.4, 1, 1)
}

function spot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#f3d2a8'
  ellipse(ctx, x, y, 3, 2)
}

function gun(ctx: CanvasRenderingContext2D, x: number, y: number, flash: number): void {
  ctx.fillStyle = '#2c3340'
  round(ctx, x, y, 22, 5, 2)
  ctx.fill()
  ctx.fillStyle = '#1b2028'
  round(ctx, x + 4, y + 4, 5, 7, 1)
  ctx.fill()
  ctx.fillStyle = '#e0b15c'
  ctx.fillRect(x + 8, y + 1, 4, 3)
  if (flash > 0) {
    ctx.fillStyle = '#fff1c4'
    ctx.beginPath()
    ctx.moveTo(x + 22, y + 2)
    ctx.lineTo(x + 32, y - 2)
    ctx.lineTo(x + 30, y + 6)
    ctx.fill()
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, g: Game, e: Game['enemies'][number]): void {
  if (!e.alive && e.deathT <= 0) return
  ctx.save()
  ctx.globalAlpha = e.alive ? 1 : Math.max(0, e.deathT)
  if (e.hurtT > 0) ctx.globalAlpha = 0.7
  if (e.kind === 'boss' && e.boss === 'mech') drawMech(ctx, g, e)
  else if (e.kind === 'boss' && e.boss === 'conductor') drawConductor(ctx, g, e)
  else if (e.kind === 'boss' && e.boss === 'turret') drawTurret(ctx, g, e)
  else if (e.kind === 'drone') drawDrone(ctx, g, e)
  else drawRobot(ctx, e, e.kind === 'shooter')
  ctx.restore()
}

function drawRobot(ctx: CanvasRenderingContext2D, e: Game['enemies'][number], shooter: boolean): void {
  ctx.save()
  ctx.translate(e.x + e.w / 2, e.y + e.h)
  ctx.scale(e.facing, 1)
  ctx.fillStyle = '#4b5563'
  round(ctx, -14, -16, 28, 10, 3)
  ctx.fill()
  ctx.fillStyle = shooter ? '#7f1d1d' : '#6b7280'
  round(ctx, -16, -40, 32, 26, 5)
  ctx.fill()
  ctx.fillStyle = '#ff3b3b'
  ellipse(ctx, 6, -28, 4, 3)
  ctx.fillStyle = '#d1d5db'
  ctx.fillRect(8, -24, 14, 4)
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -40)
  ctx.lineTo(0, -50)
  ctx.stroke()
  ctx.fillStyle = '#f0c36a'
  ctx.beginPath()
  ctx.arc(0, -52, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDrone(ctx: CanvasRenderingContext2D, g: Game, e: Game['enemies'][number]): void {
  ctx.save()
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2)
  ctx.strokeStyle = 'rgba(200,210,220,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-16, 0)
  ctx.lineTo(16, 0)
  ctx.moveTo(Math.cos(g.time * 20) * 16, -6)
  ctx.lineTo(-Math.cos(g.time * 20) * 16, -6)
  ctx.stroke()
  ctx.fillStyle = '#64748b'
  round(ctx, -12, -8, 24, 16, 6)
  ctx.fill()
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.arc(4, -1, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMech(ctx: CanvasRenderingContext2D, g: Game, e: Game['enemies'][number]): void {
  const stomp = e.phase === 'telegraph' ? Math.sin(g.time * 30) * 2 : 0
  ctx.save()
  ctx.translate(e.x + e.w / 2, e.y + e.h + stomp)
  ctx.fillStyle = '#3f4754'
  round(ctx, -34, -28, 22, 26, 4)
  ctx.fill()
  round(ctx, 12, -28, 22, 26, 4)
  ctx.fill()
  ctx.fillStyle = '#5b6775'
  round(ctx, -40, -108, 80, 84, 10)
  ctx.fill()
  ctx.fillStyle = '#2a313b'
  round(ctx, -28, -96, 56, 28, 6)
  ctx.fill()
  ctx.fillStyle = e.phase === 'telegraph' ? '#ffd0a0' : '#ff4b4b'
  round(ctx, -16, -88, 32, 10, 4)
  ctx.fill()
  ctx.fillStyle = '#6b7280'
  round(ctx, -52, -90, 18, 18, 3)
  ctx.fill()
  round(ctx, 34, -90, 18, 18, 3)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.fillRect(36, -84, 22, 6)
  ctx.fillRect(-58, -84, 22, 6)
  ctx.fillStyle = '#f0c36a'
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('WARDEN', 0, -48)
  ctx.restore()
}

function drawConductor(ctx: CanvasRenderingContext2D, g: Game, e: Game['enemies'][number]): void {
  ctx.save()
  ctx.translate(e.x + e.w / 2, e.y + e.h)
  const hop = e.phase === 'telegraph' ? -6 : Math.sin(g.time * 8) * 2
  ctx.translate(0, hop)
  ctx.fillStyle = '#1f2937'
  round(ctx, -16, -78, 32, 70, 8)
  ctx.fill()
  ctx.fillStyle = '#f0c36a'
  ctx.fillRect(-16, -58, 32, 8)
  ctx.fillStyle = '#111827'
  round(ctx, -18, -108, 36, 16, 3)
  ctx.fill()
  ctx.fillRect(-8, -94, 16, 12)
  ctx.fillStyle = '#e5e7eb'
  ellipse(ctx, 0, -78, 14, 12)
  ctx.fillStyle = '#111827'
  ctx.fillRect(-8, -80, 16, 3)
  ctx.fillStyle = '#ff4b4b'
  ellipse(ctx, -4, -80, 2, 2)
  ellipse(ctx, 4, -80, 2, 2)
  ctx.fillStyle = '#9ca3af'
  round(ctx, 10, -50, 18, 8, 2)
  ctx.fill()
  ctx.restore()
}

function drawTurret(ctx: CanvasRenderingContext2D, g: Game, e: Game['enemies'][number]): void {
  ctx.save()
  ctx.translate(e.x, e.y + e.h)
  ctx.fillStyle = '#374151'
  round(ctx, 8, -36, e.w - 16, 34, 8)
  ctx.fill()
  ctx.fillStyle = '#111827'
  for (const wx of [24, 70, 120]) {
    ctx.beginPath()
    ctx.arc(wx, -8, 14, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#4b5563'
  round(ctx, 20, -130, 120, 100, 16)
  ctx.fill()
  ctx.fillStyle = '#f0c36a'
  ctx.fillRect(20, -86, 120, 8)
  ctx.fillStyle = '#1f2937'
  round(ctx, 48, -118, 64, 28, 8)
  ctx.fill()
  ctx.fillStyle = e.beam ? '#ffb4a8' : '#ff4b4b'
  round(ctx, 60, -110, 40, 12, 4)
  ctx.fill()
  ctx.fillStyle = '#6b7280'
  ctx.fillRect(30, -150, 18, 28)
  ctx.fillStyle = e.phase === 'laser' || e.phase === 'laserTele' ? '#ffd0a8' : '#9ca3af'
  round(ctx, -8, -78, 40, 16, 6)
  ctx.fill()
  ctx.restore()
  if (e.beam) {
    let left = 0
    for (const s of g.solids) {
      if (s.hp <= 0 || !s.collides || s.kind === 'floor' || s.kind === 'piston' || s.kind === 'gate') continue
      if (s.y <= HIGH_SHOT_Y && s.y + s.h >= HIGH_SHOT_Y + 6 && s.x + s.w <= e.x + 2) {
        left = Math.max(left, s.x + s.w)
      }
    }
    ctx.save()
    ctx.globalAlpha = 0.45 + Math.sin(g.time * 40) * 0.15
    ctx.fillStyle = '#ff6a5a'
    ctx.fillRect(left, HIGH_SHOT_Y, Math.max(0, e.x - left), 6)
    ctx.restore()
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game): void {
  const p = g.player
  for (let i = 0; i < 5; i++) {
    drawHeart(ctx, 22 + i * 28, 24, 9, i < p.hp ? '#e85d4c' : '#3a2a2a')
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `700 18px ${DISPLAY}`
  ctx.fillText(`LV ${g.levelId}  ${g.levelName.toUpperCase()}`, VIEW_W / 2, 26)
  ctx.textAlign = 'right'
  ctx.font = `700 16px ${FONT}`
  ctx.fillText(`${g.score}`, 760, 22)
  ctx.fillStyle = '#7ddec2'
  ctx.font = `700 14px ${FONT}`
  ctx.fillText(`◆ ${g.runTreasure}`, 760, 40)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `700 12px ${FONT}`
  ctx.fillText(p.reloading ? 'RELOAD' : 'AMMO', 16, VIEW_H - 36)
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i < p.ammo ? '#f0c36a' : '#3a3428'
    round(ctx, 16 + i * 16, VIEW_H - 28, 12, 6, 2)
    ctx.fill()
  }
  if (p.reloading) {
    const ratio = 1 - p.reloadT / 0.85
    ctx.fillStyle = '#f0c36a'
    ctx.fillRect(16, VIEW_H - 16, 150 * Math.max(0, Math.min(1, ratio)), 3)
  }
  const ready = p.dashCd <= 0
  const dashRatio = ready ? 1 : 1 - p.dashCd / 0.78
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  round(ctx, 190, VIEW_H - 32, 110, 18, 6)
  ctx.fill()
  ctx.fillStyle = ready ? '#f0c36a' : '#8a6230'
  round(ctx, 192, VIEW_H - 30, 106 * Math.max(0, dashRatio), 14, 5)
  ctx.fill()
  ctx.fillStyle = ready ? '#2a2118' : '#f6e7c1'
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('DASH', 245, VIEW_H - 19)
  const boss = g.enemies.find((e) => e.kind === 'boss' && (e.alive || e.deathT > 0.2))
  if (boss && g.bossIntro) {
    const ratio = Math.max(0, boss.hp / boss.maxHp)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    round(ctx, 250, 40, 380, 16, 6)
    ctx.fill()
    ctx.fillStyle = '#e85d4c'
    round(ctx, 252, 42, 376 * ratio, 12, 5)
    ctx.fill()
    ctx.fillStyle = '#fff4d2'
    ctx.font = `700 11px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(boss.name, 440, 52)
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s, x - s, y - s, x - s, y)
  ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s * 1.3)
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y)
  ctx.bezierCurveTo(x + s, y - s, x, y - s, x, y + s * 0.3)
  ctx.fill()
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string, alpha: number): void {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.fillStyle = 'rgba(20,14,10,0.72)'
  round(ctx, 250, 70, 460, 36, 8)
  ctx.fill()
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `700 18px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.fillText(text, VIEW_W / 2, 94)
  ctx.restore()
}

function drawTitle(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.fillStyle = 'rgba(12, 10, 16, 0.72)'
  round(ctx, 210, 28, 540, 500, 18)
  ctx.fill()
  ctx.strokeStyle = '#e0b15a'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0c36a'
  ctx.font = `700 48px ${DISPLAY}`
  ctx.fillText('ANTLER EXPRESS', VIEW_W / 2, 92)
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `16px ${FONT}`
  ctx.fillText('A deer. A gun. Every locked train car between here and the haul.', VIEW_W / 2, 122)
  drawDeer(ctx, {
    x: VIEW_W / 2 - 40,
    y: 140,
    w: 34,
    h: 64,
    facing: 1,
    anim: g.time * 8,
    crouch: false,
    dash: false,
    hurt: false,
    flash: Math.sin(g.time * 3) > 0.65 ? 0.1 : 0,
    onGround: true,
  })
  const info = describeLevel(g.selectedLevel)
  ctx.fillStyle = '#fff4d2'
  ctx.font = `700 20px ${DISPLAY}`
  const label = info.boss ? `BOSS ${info.id}   ${info.name.toUpperCase()}` : `CAR ${info.id}   ${info.name.toUpperCase()}`
  ctx.fillText(label, VIEW_W / 2, 332)
  ctx.fillStyle = '#d9cbb3'
  ctx.font = `13px ${FONT}`
  ctx.fillText('Move A/D    Jump Space    Crouch S', VIEW_W / 2, 446)
  ctx.fillText('Dash Shift/K    Shoot Hold click or J/X    Reload R    Pause Esc', VIEW_W / 2, 466)
  ctx.fillStyle = '#c8b89a'
  ctx.fillText(`Unlocked through car ${g.unlocked}`, VIEW_W / 2, 492)
  ctx.fillText(`Best ${g.highScore}    Lifetime haul ${g.lifetimeTreasure}`, VIEW_W / 2, 510)
}

function drawPause(ctx: CanvasRenderingContext2D, g: Game): void {
  dim(ctx)
  panel(ctx, 300, 70, 360, 360)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0c36a'
  ctx.font = `700 32px ${DISPLAY}`
  ctx.fillText('PAUSED', VIEW_W / 2, 120)
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `14px ${FONT}`
  ctx.fillText(g.levelName, VIEW_W / 2, 150)
  ctx.font = `13px ${FONT}`
  ctx.fillText('Crouch under high shots. Jump the low ones.', VIEW_W / 2, 180)
  ctx.fillText('Dash across the couplers. Shoot the crates.', VIEW_W / 2, 200)
}

function drawComplete(ctx: CanvasRenderingContext2D, g: Game): void {
  dim(ctx)
  panel(ctx, 250, 80, 460, 360)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0c36a'
  ctx.font = `700 32px ${DISPLAY}`
  ctx.fillText('CAR CLEARED', VIEW_W / 2, 140)
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `18px ${DISPLAY}`
  ctx.fillText(g.levelName, VIEW_W / 2, 176)
  ctx.font = `16px ${FONT}`
  ctx.fillText(`Score  ${g.score}`, VIEW_W / 2, 230)
  ctx.fillText(`Haul this car  ${g.levelTreasure}`, VIEW_W / 2, 258)
  ctx.fillText(`Time bonus  ${g.timeBonus}`, VIEW_W / 2, 286)
  ctx.fillText(`Run haul  ${g.runTreasure}`, VIEW_W / 2, 314)
}

function drawGameOver(ctx: CanvasRenderingContext2D, g: Game): void {
  dim(ctx)
  panel(ctx, 270, 90, 420, 360)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e85d4c'
  ctx.font = `700 32px ${DISPLAY}`
  ctx.fillText('CAUGHT', VIEW_W / 2, 160)
  ctx.fillStyle = '#f6e7c1'
  ctx.font = `16px ${FONT}`
  ctx.fillText('The deer does not make it off this car.', VIEW_W / 2, 200)
  ctx.fillText(`Score  ${g.score}`, VIEW_W / 2, 250)
  ctx.fillText(`Best  ${g.highScore}`, VIEW_W / 2, 276)
}

function drawButtons(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const b of layoutButtons(g)) {
    ctx.fillStyle = b.id === 'start' || b.id === 'nextlevel' || b.id === 'resume' ? '#f0c36a' : 'rgba(28,22,16,0.85)'
    round(ctx, b.x, b.y, b.w, b.h, 8)
    ctx.fill()
    ctx.strokeStyle = '#e0b15a'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = b.id === 'start' || b.id === 'nextlevel' || b.id === 'resume' ? '#2a2118' : '#f6e7c1'
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1)
    ctx.textBaseline = 'alphabetic'
  }
}

function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.55)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(18, 14, 12, 0.92)'
  round(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = '#e0b15a'
  ctx.stroke()
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 620)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

function drawDebug(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.save()
  ctx.translate(-g.camX, 0)
  ctx.strokeStyle = '#39ff88'
  const p = g.player
  ctx.strokeRect(p.x, p.y, p.w, p.h)
  ctx.strokeStyle = '#ff5577'
  for (const s of g.solids) if (s.kind !== 'floor') ctx.strokeRect(s.x, s.y, s.w, s.h)
  ctx.restore()
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}
