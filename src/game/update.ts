import {
  AIR_ACCEL,
  BULLET_H,
  BULLET_SPEED,
  COYOTE,
  CROUCH_H,
  CROUCH_SPEED,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  FIRE_COOLDOWN,
  GRAVITY,
  GROUND,
  GROUND_ACCEL,
  HIGH_SHOT_Y,
  HURT_TIME,
  JUMP_BUFFER,
  JUMP_V,
  MAG_SIZE,
  MAX_FALL,
  MAX_HP,
  MOVE_SPEED,
  RELOAD_TIME,
  SCORE_CHEST,
  SCORE_GEM,
  SLIDE_SPEED,
  SLIDE_TIME,
  STAND_H,
  VIEW_H,
} from './constants'
import { updateBoss } from './bosses'
import { burst, damageSolid, fireBullet, floatText, gunOrigin, hurtPlayer, killEnemy, shotY } from './combat'
import { loadLevel } from './levels'
import { blocks, lineBlocked, moveBody, pistonExt, pistonT } from './physics'
import { saveFromGame } from './save'
import type { Enemy, Game, InputState, Solid } from './types'
import { hitButton, layoutButtons } from './ui'

export function update(g: Game, input: InputState, dt: number): void {
  const step = Math.min(dt, 1 / 30)
  g.time += step
  if (input.mutePressed || pressed(g, input, 'mute')) {
    g.muted = !g.muted
    saveFromGame(g)
    g.onSfx?.('ui')
  }
  if (g.mode === 'title') {
    updateTitle(g, input)
    return
  }
  if (g.mode === 'paused') {
    updatePaused(g, input)
    return
  }
  if (g.mode === 'complete') {
    if (input.confirmPressed || pressed(g, input, 'nextlevel')) {
      loadLevel(g, g.levelId + 1)
      g.onSfx?.('ui')
    }
    return
  }
  if (g.mode === 'gameover') {
    if (input.confirmPressed || pressed(g, input, 'retry')) retryLevel(g)
    else if (pressed(g, input, 'title')) toTitle(g)
    return
  }
  updatePlaying(g, input, step)
}

function pressed(g: Game, input: InputState, id: string): boolean {
  if (!input.click) return false
  return hitButton(layoutButtons(g), input.clickX, input.clickY) === id
}

function updateTitle(g: Game, input: InputState): void {
  const max = Math.max(1, g.unlocked)
  if (input.leftPressed || pressed(g, input, 'prev')) {
    g.selectedLevel = Math.max(1, g.selectedLevel - 1)
    g.onSfx?.('ui')
  }
  if (input.rightPressed || pressed(g, input, 'next')) {
    g.selectedLevel = Math.min(max, g.selectedLevel + 1)
    g.onSfx?.('ui')
  }
  if (input.confirmPressed || pressed(g, input, 'start')) {
    g.score = 0
    g.runTreasure = 0
    g.stats = { jumps: 0, dashes: 0, crouchTime: 0, shots: 0, cratesBroken: 0, bosses: 0 }
    loadLevel(g, g.selectedLevel)
    g.onSfx?.('ui')
  }
}

function updatePaused(g: Game, input: InputState): void {
  if (input.pausePressed || input.confirmPressed || pressed(g, input, 'resume')) {
    g.mode = 'playing'
    g.onSfx?.('ui')
    return
  }
  if (pressed(g, input, 'retry')) retryLevel(g)
  if (pressed(g, input, 'title')) toTitle(g)
}

function retryLevel(g: Game): void {
  g.score = Math.max(0, g.score - g.levelScore)
  g.runTreasure = Math.max(0, g.runTreasure - g.levelTreasure)
  loadLevel(g, g.levelId)
  g.onSfx?.('ui')
}

function toTitle(g: Game): void {
  if (g.score > g.highScore) g.highScore = g.score
  saveFromGame(g)
  g.mode = 'title'
  g.selectedLevel = Math.min(g.unlocked, Math.max(1, g.levelId))
  g.onSfx?.('ui')
}

function updatePlaying(g: Game, input: InputState, dt: number): void {
  if (input.pausePressed || pressed(g, input, 'pause')) {
    g.mode = 'paused'
    g.onSfx?.('ui')
    return
  }
  g.levelTime += dt
  g.messageT = Math.max(0, g.messageT - dt)
  updateMovers(g, dt)
  updatePlayer(g, input, dt)
  updateEnemies(g, dt)
  updateBullets(g, dt)
  updateDynamics(g, dt)
  updatePickups(g, dt)
  updateBossUnlock(g, dt)
  updateFx(g, dt)
  updateCamera(g, dt)
}

function updateMovers(g: Game, dt: number): void {
  const p = g.player
  for (const s of g.solids) {
    s.hitFlash = Math.max(0, s.hitFlash - dt)
    s.dx = 0
    if (s.move === 'sine-x') {
      const prev = s.x
      s.x = s.originX + Math.sin(g.levelTime * s.period + s.phase) * s.amp
      s.dx = s.x - prev
    }
    if (s.kind === 'piston') {
      const t = pistonT(s, g.levelTime)
      const ext = pistonExt(t)
      const reach = GROUND - 28 - s.originY
      s.y = s.originY
      s.h = 28 + ext * reach
    }
    if (s.kind === 'gate' && !s.triggered && p.x > s.x + 36) s.triggered = true
    if (s.kind === 'gate' && s.triggered && s.y < 0) s.y = Math.min(0, s.y + 780 * dt)
  }
  if (p.platformId && p.onGround) {
    const plat = g.solids.find((s) => s.id === p.platformId)
    if (plat) p.x += plat.dx
  }
}

function updatePlayer(g: Game, input: InputState, dt: number): void {
  const p = g.player
  p.hurtT = Math.max(0, p.hurtT - dt)
  p.fireCd = Math.max(0, p.fireCd - dt)
  p.dashCd = Math.max(0, p.dashCd - dt)
  p.shootFlash = Math.max(0, p.shootFlash - dt)
  p.jumpBuf = Math.max(0, p.jumpBuf - dt)

  if (p.deadT > 0) {
    p.deadT -= dt
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt)
    p.y += p.vy * dt
    if (p.deadT <= 0) {
      if (!p.alive) finishRun(g)
      else respawn(g)
    }
    return
  }

  if (p.reloading) {
    p.reloadT -= dt
    if (p.reloadT <= 0) {
      p.reloading = false
      p.ammo = MAG_SIZE
      g.onSfx?.('reload')
    }
  } else if (input.reloadPressed && p.ammo < MAG_SIZE) {
    p.reloading = true
    p.reloadT = RELOAD_TIME
  }

  if (input.crouch && !p.crouching && p.onGround && Math.abs(p.vx) > 150) {
    p.slideT = SLIDE_TIME
    p.vx = (Math.sign(p.vx) || p.facing) * SLIDE_SPEED
    g.onSfx?.('slide')
  }
  if (p.slideT > 0) p.slideT = Math.max(0, p.slideT - dt)
  applyStance(g, input.crouch || p.slideT > 0)
  if (p.crouching) g.stats.crouchTime += dt

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (input.dashPressed && p.dashCd <= 0) {
    const dashDir = dir !== 0 ? dir : p.facing
    p.facing = dashDir as 1 | -1
    p.dashT = DASH_TIME
    p.dashCd = DASH_COOLDOWN
    p.vx = dashDir * DASH_SPEED
    g.stats.dashes++
    g.shake = Math.max(g.shake, 3)
    burst(g, p.x, p.y + p.h, '#f0d7b0', 6, 80)
    g.onSfx?.('dash')
  }

  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - dt)
    p.vx = p.facing * DASH_SPEED
  } else if (p.slideT > 0) {
    const sdir = Math.sign(p.vx) || p.facing
    p.vx = sdir * SLIDE_SPEED * (0.45 + 0.55 * (p.slideT / SLIDE_TIME))
    p.facing = sdir as 1 | -1
  } else {
    const speed = p.crouching ? CROUCH_SPEED : MOVE_SPEED
    const target = dir * speed
    const accel = (p.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt
    const diff = target - p.vx
    p.vx += Math.max(-accel, Math.min(accel, diff))
    if (Math.abs(p.vx) < 8 && dir === 0) p.vx = 0
    if (dir !== 0 && p.dashT <= 0) p.facing = dir as 1 | -1
  }

  if (input.jumpPressed) p.jumpBuf = JUMP_BUFFER
  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
    if (p.crouching) applyStance(g, false)
    if (!p.crouching) {
      p.vy = JUMP_V
      p.onGround = false
      p.coyote = 0
      p.jumpBuf = 0
      p.jumpCut = false
      p.slideT = 0
      g.stats.jumps++
      burst(g, p.x + 6, p.y + p.h, '#e6d3b4', 4, 50)
      g.onSfx?.('jump')
    }
  }
  if (!input.jump && p.vy < 0 && !p.jumpCut) {
    p.vy *= 0.48
    p.jumpCut = true
  }

  if (!p.onGround) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt)
  else if (p.vy > 0) p.vy = 0

  const wasGround = p.onGround
  const moved = moveBody(p, g.solids, dt)
  p.onGround = moved.onGround
  p.platformId = moved.platformId
  if (p.onGround) {
    p.coyote = COYOTE
    p.jumpCut = false
    if (!wasGround && p.wasOnGround === false) g.onSfx?.('land')
  } else p.coyote = Math.max(0, p.coyote - dt)
  p.wasOnGround = p.onGround

  if (p.x < 8) {
    p.x = 8
    if (p.vx < 0) p.vx = 0
  }
  if (p.y > VIEW_H + 60) {
    hurtPlayer(g, 1, true)
    if (p.alive) {
      p.deadT = 0.45
    }
  }

  const moving = Math.abs(p.vx) > 30 && p.onGround
  p.anim += dt * (moving ? 10 : 2)

  if (p.dashT > 0) {
    p.trail.push({ x: p.x, y: p.y, h: p.h, facing: p.facing, life: 0.16 })
    if (p.trail.length > 6) p.trail.shift()
  }

  tryShoot(g, input)
  updateCheckpoint(g)
}

function applyStance(g: Game, wantCrouch: boolean): void {
  const p = g.player
  if (wantCrouch) {
    if (!p.crouching) {
      p.y += p.h - CROUCH_H
      p.h = CROUCH_H
      p.crouching = true
    }
    return
  }
  if (!p.crouching) return
  const newY = p.y - (STAND_H - CROUCH_H)
  const rect = { x: p.x, y: newY, w: p.w, h: STAND_H }
  const blocked = g.solids.some((s) => blocks(s) && !s.oneWay && s.kind !== 'floor' && overlap(rect, s))
  if (!blocked) {
    p.y = newY
    p.h = STAND_H
    p.crouching = false
  }
}

function tryShoot(g: Game, input: InputState): void {
  const p = g.player
  if (!input.shoot && !input.shootPressed) return
  if (p.reloading || p.ammo <= 0 || p.fireCd > 0) {
    if (input.shootPressed && (p.reloading || p.ammo <= 0)) g.onSfx?.('dry')
    return
  }
  const origin = gunOrigin(p)
  fireBullet(g, origin.x, origin.y, p.facing * BULLET_SPEED, 0, true, 'any')
  p.ammo--
  p.fireCd = FIRE_COOLDOWN
  p.shootFlash = 0.07
  g.stats.shots++
  burst(g, origin.x + (p.facing === 1 ? 10 : 0), origin.y, '#ffe1a0', 3, 40)
  g.onSfx?.('shoot')
  if (p.ammo <= 0) {
    p.reloading = true
    p.reloadT = RELOAD_TIME
  }
}

function updateCheckpoint(g: Game): void {
  const p = g.player
  if (!p.onGround || p.crouching || p.x < p.checkpointX + 420) return
  const head = { x: p.x, y: p.y, w: p.w, h: 20 }
  const tight = g.solids.some((s) => s.kind === 'steel' && s.y < 80 && overlap(head, s))
  if (tight) return
  p.checkpointX = p.x
  p.checkpointY = GROUND - STAND_H
}

function respawn(g: Game): void {
  const p = g.player
  p.x = p.checkpointX
  p.y = p.checkpointY
  p.h = STAND_H
  p.crouching = false
  p.vx = 0
  p.vy = 0
  p.deadT = 0
  p.hurtT = HURT_TIME
  p.dashT = 0
  p.slideT = 0
  p.alive = true
}

function finishRun(g: Game): void {
  if (g.score > g.highScore) g.highScore = g.score
  saveFromGame(g)
  g.mode = 'gameover'
}

function updateEnemies(g: Game, dt: number): void {
  const list = g.enemies.slice()
  for (const e of list) {
    e.hurtT = Math.max(0, e.hurtT - dt)
    if (!e.alive) {
      e.deathT -= dt
      continue
    }
    if (e.kind === 'boss') {
      updateBoss(g, e, dt)
      if (e.boss !== 'turret') groundEnemy(g, e, dt)
      else e.y = GROUND - e.h
      damageTouch(g, e)
      continue
    }
    if (e.kind === 'drone') updateDrone(g, e, dt)
    else updateWalker(g, e, dt)
    damageTouch(g, e)
    if (e.hp <= 0) killEnemy(g, e)
  }
  g.enemies = g.enemies.filter((e) => e.alive || e.deathT > 0)

  const boss = g.enemies.find((e) => e.kind === 'boss' && e.alive)
  if (boss && !g.bossIntro && g.player.x > boss.x - 620) {
    g.bossIntro = true
    g.message = `BOSS   ${boss.name}`
    g.messageT = 2.4
  }
  if (boss?.beam) {
    const rect = beamRect(g, boss)
    if (rect && overlap(g.player, rect)) hurtPlayer(g, 1)
  }
}

function groundEnemy(g: Game, e: Enemy, dt: number): void {
  e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt)
  const moved = moveBody(e, g.solids, dt)
  e.onGround = moved.onGround
  if (e.x < e.minX) e.x = e.minX
  if (e.x + e.w > e.maxX) e.x = e.maxX - e.w
}

function updateWalker(g: Game, e: Enemy, dt: number): void {
  if (e.x <= e.minX + 2) e.facing = 1
  else if (e.x + e.w >= e.maxX - 2) e.facing = -1
  const ahead = e.x + (e.facing === 1 ? e.w + 10 : -10)
  const floorAhead = g.solids.some(
    (s) => (s.kind === 'floor' || s.kind === 'platform') && ahead >= s.x && ahead <= s.x + s.w && Math.abs(s.y - GROUND) < 30,
  )
  if (!floorAhead) e.facing = e.facing === 1 ? -1 : 1
  e.vx = e.facing * e.speed
  const prevVx = e.vx
  groundEnemy(g, e, dt)
  if (prevVx !== 0 && Math.abs(e.vx) < 4) e.facing = e.facing === 1 ? -1 : 1

  if (e.kind === 'shooter') {
    e.cooldown -= dt
    const px = g.player.x + g.player.w / 2
    const ex = e.x + e.w / 2
    const dir = px < ex ? -1 : 1
    const dist = Math.abs(px - ex)
    if (e.cooldown <= 0 && dist < 460 && dist > 40) {
      e.facing = dir as 1 | -1
      const aim = shotY(e.shot, e.cycle)
      if (!lineBlocked(g.solids, ex, aim.y + 2, px, aim.y + 2)) {
        fireBullet(g, dir === 1 ? e.x + e.w : e.x - 12, aim.y, dir * 340, 0, false, aim.dodge)
        g.onSfx?.('shoot')
        e.cycle++
        e.cooldown = e.shotInterval
      }
    }
  }
}

function updateDrone(g: Game, e: Enemy, dt: number): void {
  e.x += Math.sin(g.levelTime * 1.4 + e.id) * 20 * dt
  e.y = e.baseY + Math.sin(g.levelTime * 2.2 + e.id) * 26
  e.cooldown -= dt
  const p = g.player
  if (e.cooldown <= 0 && Math.abs(p.x - e.x) < 520) {
    const dx = p.x + p.w / 2 - (e.x + e.w / 2)
    const dy = p.y + 18 - (e.y + e.h / 2)
    const len = Math.hypot(dx, dy) || 1
    fireBullet(g, e.x + e.w / 2, e.y + e.h / 2, (dx / len) * 250, (dy / len) * 250, false, 'any')
    e.cooldown = e.shotInterval
    e.facing = dx < 0 ? -1 : 1
    g.onSfx?.('shoot')
  }
}

function damageTouch(g: Game, e: Enemy): void {
  if (!e.alive) return
  if (overlap(g.player, e)) hurtPlayer(g, 1)
}

function beamRect(g: Game, e: Enemy): { x: number; y: number; w: number; h: number } | null {
  let left = 40
  const y = HIGH_SHOT_Y
  for (const s of g.solids) {
    if (!blocks(s) || s.oneWay || s.kind === 'floor' || s.kind === 'gate') continue
    if (s.y <= y && s.y + s.h >= y + BULLET_H && s.x + s.w <= e.x && s.x + s.w > left) {
      if (s.x < e.x) left = Math.max(left, s.x + s.w)
    }
  }
  const w = e.x - left
  if (w < 8) return null
  return { x: left, y, w, h: BULLET_H }
}

function updateBullets(g: Game, dt: number): void {
  for (const b of g.bullets) {
    if (b.life <= 0) continue
    b.life -= dt
    if (b.gravity) b.vy = Math.min(700, b.vy + 1100 * dt)
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y > VIEW_H || b.x < -80 || b.x > g.levelWidth + 80) {
      b.life = 0
      continue
    }
    for (const s of g.solids) {
      if (s.kind === 'floor' || s.kind === 'platform') {
        if (overlap(b, s)) {
          b.life = 0
          break
        }
        continue
      }
      if (!blocks(s) || s.oneWay || s.kind === 'piston') continue
      if (!overlap(b, s)) continue
      if (s.destructible) damageSolid(g, s.id, b.damage)
      else {
        s.hitFlash = 0.06
        burst(g, b.x, b.y, '#d5dde8', 3, 50)
        g.onSfx?.('metal')
      }
      b.life = 0
      break
    }
    if (b.life <= 0) continue
    if (b.friendly) {
      for (const e of g.enemies) {
        if (!e.alive || !overlap(b, e)) continue
        if (e.intro > 0 && e.kind === 'boss') {
          burst(g, b.x, b.y, '#f0e2bf', 4, 40)
          g.onSfx?.('metal')
          b.life = 0
          break
        }
        e.hp -= b.damage
        e.hurtT = 0.08
        burst(g, b.x, b.y, '#f2f6fb', 4, 60)
        g.onSfx?.('hit')
        b.life = 0
        if (e.hp <= 0) killEnemy(g, e)
        break
      }
    } else if (g.player.alive && g.player.deadT <= 0 && overlap(b, g.player)) {
      hurtPlayer(g, 1)
      b.life = 0
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0)

  for (const s of g.solids) {
    if (s.kind !== 'piston') continue
    const t = pistonT(s, g.levelTime)
    if (pistonExt(t) < 0.72) continue
    if (overlap(g.player, { x: s.x + 6, y: s.y, w: s.w - 12, h: s.h })) hurtPlayer(g, 1)
  }
}

function updateDynamics(g: Game, dt: number): void {
  for (const s of g.solids) {
    if (!s.dynamic || s.hp <= 0) continue
    if (supported(s, g.solids)) {
      s.vy = 0
      continue
    }
    s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt)
    s.y += s.vy * dt
    for (const o of g.solids) {
      if (o.id === s.id || o.hp <= 0 || !o.collides || o.kind === 'piston') continue
      if (!overlap(s, o)) continue
      if (o.y >= s.y + s.h - 20) {
        s.y = o.y - s.h
        s.vy = 0
      }
    }
  }
}

function supported(s: Solid, solids: Solid[]): boolean {
  const foot = s.y + s.h
  for (const o of solids) {
    if (o.id === s.id || o.hp <= 0 || !o.collides || o.kind === 'piston') continue
    const overlapX = Math.min(s.x + s.w, o.x + o.w) - Math.max(s.x, o.x)
    if (overlapX < 8) continue
    if (Math.abs(o.y - foot) <= 3) return true
  }
  return false
}

function updatePickups(g: Game, dt: number): void {
  const p = g.player
  if (!p.alive || p.deadT > 0) return
  for (const item of g.pickups) {
    if (item.taken) continue
    item.bob += dt
    if (item.kind === 'chest' && item.locked) continue
    const near =
      overlap(p, item) ||
      (item.kind === 'chest' && p.onGround && p.x + p.w > item.x - 4 && p.x < item.x + item.w + 36)
    if (!near) continue
    item.taken = true
    if (item.kind === 'ammo') {
      p.ammo = MAG_SIZE
      p.reloading = false
      floatText(g, item.x, item.y, 'RELOAD', '#f0c36a')
      g.onSfx?.('pickup')
    } else if (item.kind === 'heart') {
      p.hp = Math.min(MAX_HP, p.hp + 2)
      floatText(g, item.x, item.y, '+HP', '#e85d4c')
      g.onSfx?.('pickup')
    } else if (item.kind === 'gem') {
      g.levelTreasure++
      g.runTreasure++
      g.score += SCORE_GEM
      g.levelScore += SCORE_GEM
      floatText(g, item.x, item.y, `+${SCORE_GEM}`, '#7ddec2')
      g.onSfx?.('gem')
    } else if (item.kind === 'chest') {
      collectChest(g, item.x, item.y)
    }
  }
}

function collectChest(g: Game, x: number, y: number): void {
  g.levelTreasure++
  g.runTreasure++
  g.score += SCORE_CHEST
  g.levelScore += SCORE_CHEST
  const bonus = Math.max(0, Math.floor(1600 - g.levelTime * 8))
  g.timeBonus = bonus
  g.score += bonus
  g.levelScore += bonus
  g.lifetimeTreasure += g.levelTreasure
  if (g.levelId >= g.unlocked) g.unlocked = g.levelId + 1
  if (g.score > g.highScore) g.highScore = g.score
  saveFromGame(g)
  floatText(g, x, y, 'HAUL', '#ffd76a')
  burst(g, x, y, '#ffd76a', 16, 120)
  g.mode = 'complete'
  g.onSfx?.('chest')
  g.onSfx?.('win')
}

function updateBossUnlock(g: Game, dt: number): void {
  if (g.bossDeathT <= 0) return
  g.bossDeathT -= dt
  if (g.bossDeathT > 0) return
  g.bossDeathT = 0
  for (const item of g.pickups) {
    if (item.kind === 'chest') item.locked = false
  }
  g.message = 'TREASURE UNLOCKED'
  g.messageT = 1.8
  g.onSfx?.('gem')
}

function updateFx(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 22)
  for (const particle of g.particles) {
    particle.life -= dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    if (particle.grav) particle.vy += GRAVITY * 0.35 * dt
  }
  g.particles = g.particles.filter((p) => p.life > 0)
  for (const f of g.floaters) {
    f.life -= dt
    f.y -= 28 * dt
  }
  g.floaters = g.floaters.filter((f) => f.life > 0)
  for (const t of g.player.trail) t.life -= dt
  g.player.trail = g.player.trail.filter((t) => t.life > 0)
}

function updateCamera(g: Game, dt: number): void {
  const p = g.player
  const look = p.facing * 80
  const max = Math.max(0, g.levelWidth - 960)
  const target = Math.max(0, Math.min(max, p.x + p.w / 2 - 960 * 0.36 + look))
  g.camX += (target - g.camX) * Math.min(1, dt * 5)
}

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export { beamRect }
