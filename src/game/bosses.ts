import { GROUND, HIGH_SHOT_Y, LOW_SHOT_Y } from './constants'
import { burst, fireBullet, killEnemy } from './combat'
import { lineBlocked } from './physics'
import type { Enemy, Game } from './types'

function facePlayer(e: Enemy, g: Game): void {
  e.facing = g.player.x + g.player.w / 2 < e.x + e.w / 2 ? -1 : 1
}

function steer(e: Enemy, target: number): void {
  if (Math.abs(e.x - target) < 10) e.vx = 0
  else e.vx = e.x < target ? e.speed : -e.speed
  e.x = Math.max(e.minX, Math.min(e.maxX, e.x))
}

export function updateBoss(g: Game, e: Enemy, dt: number): void {
  if (!e.alive) return
  facePlayer(e, g)
  if (e.intro > 0) {
    e.intro -= dt
    e.vx = 0
    return
  }
  if (e.boss === 'mech') updateMech(g, e, dt)
  else if (e.boss === 'conductor') updateConductor(g, e, dt)
  else if (e.boss === 'turret') updateTurret(g, e, dt)
  else if (e.boss === 'ram') updateRam(g, e, dt)
  else if (e.boss === 'hawk') updateHawk(g, e, dt)
  else if (e.boss === 'summit') updateSummit(g, e, dt)

  if (e.hp <= 0) killEnemy(g, e)
}

function updateMech(g: Game, e: Enemy, dt: number): void {
  e.phaseT += dt
  const phase2 = e.hp < e.maxHp * 0.5
  const chaseFor = phase2 ? 1.45 : 2.25
  const home = (e.minX + e.maxX) / 2
  if (e.phase === 'chase') {
    steer(e, home + Math.sin(g.levelTime * 1.3) * 36)
    e.cooldown -= dt
    if (e.cooldown <= 0) {
      e.cooldown = phase2 ? 0.34 : 0.52
      shootHigh(g, e, phase2 ? 420 : 340)
      e.cycle++
    }
    if (e.phaseT > chaseFor) {
      e.phase = 'telegraph'
      e.phaseT = 0
      e.vx = 0
      g.onSfx?.('ui')
    }
  } else if (e.phase === 'telegraph') {
    e.vx = 0
    if (e.phaseT > 0.52) {
      slam(g, e, phase2 ? 340 : 260)
      e.phase = 'recover'
      e.phaseT = 0
    }
  } else {
    steer(e, home)
    if (e.phaseT > 0.7) {
      e.phase = 'chase'
      e.phaseT = 0
    }
  }
}

function updateConductor(g: Game, e: Enemy, dt: number): void {
  e.phaseT += dt
  const home = e.minX + 20 + Math.sin(g.levelTime * 1.6) * 40
  if (e.hp < e.maxHp * 0.66 && e.spawnedAdds < 1) {
    spawnAdd(g, e, 'patrol')
    e.spawnedAdds = 1
  }
  if (e.hp < e.maxHp * 0.33 && e.spawnedAdds < 2) {
    spawnAdd(g, e, 'shooter')
    e.spawnedAdds = 2
  }
  if (e.phase === 'chase') {
    steer(e, home)
    if (e.phaseT > 1.15) {
      tossArcs(g, e)
      e.phase = 'move'
      e.phaseT = 0
    }
  } else if (e.phase === 'move') {
    steer(e, home)
    if (e.phaseT > 1.2) {
      e.phase = 'telegraph'
      e.phaseT = 0
      e.vx = 0
    }
  } else if (e.phase === 'telegraph') {
    e.vx = 0
    if (e.phaseT > 0.48) {
      if (e.cycle % 2 === 0) slam(g, e, 300)
      else {
        for (let i = 0; i < 4; i++) shootHigh(g, e, 300 + i * 30)
      }
      e.cycle++
      e.phase = 'recover'
      e.phaseT = 0
    }
  } else {
    steer(e, home)
    if (e.phaseT > 0.75) {
      e.phase = 'chase'
      e.phaseT = 0
    }
  }
}

function updateTurret(g: Game, e: Enemy, dt: number): void {
  e.vx = 0
  e.phaseT += dt
  if (e.phase === 'chase' || e.phase === 'laserTele') {
    e.phase = 'laserTele'
    e.beam = false
    if (e.phaseT > 0.55) {
      e.phase = 'laser'
      e.phaseT = 0
      e.beam = true
      g.onSfx?.('ui')
    }
  } else if (e.phase === 'laser') {
    e.beam = true
    if (e.phaseT > 1.25) {
      e.beam = false
      e.phase = 'waves'
      e.phaseT = 0
      e.cycle = 0
    }
  } else if (e.phase === 'waves') {
    if (e.phaseT > 0.32 * (e.cycle + 1) && e.cycle < 3) {
      fireBullet(g, e.x - 8, LOW_SHOT_Y, -300 - e.cycle * 20, 0, false, 'low')
      e.cycle++
      g.onSfx?.('shoot')
    }
    if (e.phaseT > 1.35) {
      e.phase = 'burst'
      e.phaseT = 0
      e.cycle = 0
    }
  } else if (e.phase === 'burst') {
    if (e.phaseT > 0.16 * (e.cycle + 1) && e.cycle < 6) {
      const high = e.cycle % 2 === 0
      fireBullet(g, e.x - 8, high ? HIGH_SHOT_Y : LOW_SHOT_Y, -460, 0, false, high ? 'high' : 'low')
      e.cycle++
    }
    if (e.phaseT > 1.5) {
      e.phase = 'laserTele'
      e.phaseT = 0
    }
  }
}

function shootHigh(g: Game, e: Enemy, speed: number): void {
  const dir = e.facing
  const muzzle = dir === 1 ? e.x + e.w : e.x - 12
  if (lineBlocked(g.solids, muzzle, HIGH_SHOT_Y + 2, g.player.x + g.player.w / 2, HIGH_SHOT_Y + 2)) {
    // still fire; the cover can eat it
  }
  fireBullet(g, muzzle, HIGH_SHOT_Y, dir * speed, 0, false, 'high')
  g.onSfx?.('shoot')
}

function slam(g: Game, e: Enemy, speed: number): void {
  fireBullet(g, e.x - 10, LOW_SHOT_Y, -speed, 0, false, 'low')
  fireBullet(g, e.x + e.w, LOW_SHOT_Y, speed, 0, false, 'low')
  g.shake = Math.max(g.shake, 10)
  burst(g, e.x + e.w / 2, GROUND, '#e7d2a4', 10, 100)
  g.onSfx?.('boss')
}

function tossArcs(g: Game, e: Enemy): void {
  const px = g.player.x + g.player.w / 2
  for (let i = -1; i <= 1; i++) {
    const tx = px + i * 70
    const dx = tx - (e.x + e.w / 2)
    fireBullet(g, e.x + e.w / 2, e.y + 30, dx * 0.85, -430, false, 'any', true)
  }
  g.onSfx?.('shoot')
}

function updateRam(g: Game, e: Enemy, dt: number): void {
  e.phaseT += dt
  if (e.phase === 'chase') {
    steer(e, g.player.x)
    e.cooldown -= dt
    if (e.cooldown <= 0) {
      e.cooldown = 0.9
      dropIce(g, g.player.x + (e.cycle % 2 === 0 ? -30 : 40))
      e.cycle++
    }
    if (e.phaseT > 2.1) {
      e.phase = 'windup'
      e.phaseT = 0
      e.vx = 0
      facePlayer(e, g)
    }
  } else if (e.phase === 'windup') {
    e.vx = 0
    if (e.phaseT > 0.45) {
      e.phase = 'charge'
      e.phaseT = 0
      e.facing = g.player.x < e.x ? -1 : 1
    }
  } else if (e.phase === 'charge') {
    e.vx = e.facing * 420
    if (e.phaseT > 0.55) {
      e.phase = 'slam'
      e.phaseT = 0
      slam(g, e, 360)
    }
  } else {
    e.vx = 0
    if (e.phaseT > 0.7) {
      e.phase = 'chase'
      e.phaseT = 0
    }
  }
}

function updateHawk(g: Game, e: Enemy, dt: number): void {
  e.phaseT += dt
  e.y = e.baseY + Math.sin(g.levelTime * 2.4) * 36
  const gust = Math.sin(g.levelTime * 1.4)
  if (gust > 0.4 && Math.abs(g.player.x - e.x) < 700) g.player.vx -= 220 * dt
  if (e.phase === 'chase') {
    steer(e, g.player.x - 80)
    e.cooldown -= dt
    if (e.cooldown <= 0) {
      e.cooldown = 0.7
      const dx = g.player.x + 16 - (e.x + e.w / 2)
      const dy = g.player.y + 20 - (e.y + e.h / 2)
      const len = Math.hypot(dx, dy) || 1
      fireBullet(g, e.x + e.w / 2, e.y + e.h, (dx / len) * 280, (dy / len) * 280, false, 'any')
      g.onSfx?.('shoot')
    }
    if (e.phaseT > 2.4) {
      e.phase = 'dive'
      e.phaseT = 0
      facePlayer(e, g)
    }
  } else if (e.phase === 'dive') {
    e.vy = 520
    e.y = Math.min(GROUND - e.h - 8, e.y + e.vy * dt)
    e.x += e.facing * 180 * dt
    if (e.phaseT > 0.45 || e.y > GROUND - e.h - 20) {
      slam(g, e, 280)
      dropIce(g, e.x)
      dropIce(g, e.x + 80)
      e.phase = 'rise'
      e.phaseT = 0
    }
  } else {
    e.y = Math.max(e.baseY, e.y - 220 * dt)
    if (e.phaseT > 0.8) {
      e.phase = 'chase'
      e.phaseT = 0
    }
  }
}

function updateSummit(g: Game, e: Enemy, dt: number): void {
  e.phaseT += dt
  e.vx = 0
  const angry = e.hp < e.maxHp * 0.5
  if (e.phase === 'chase') {
    e.cooldown -= dt
    if (e.cooldown <= 0) {
      e.cooldown = angry ? 0.45 : 0.7
      fireBullet(g, e.x - 8, LOW_SHOT_Y, -380, 0, false, 'low')
      if (angry) dropIce(g, g.player.x)
      e.cycle++
    }
    if (e.phaseT > (angry ? 1.6 : 2.3)) {
      e.phase = 'beam'
      e.phaseT = 0
      e.beam = false
    }
  } else if (e.phase === 'beam') {
    if (e.phaseT > 0.45) e.beam = true
    if (e.phaseT > 1.15) {
      e.beam = false
      e.phase = 'rain'
      e.phaseT = 0
      e.cycle = 0
    }
  } else {
    if (e.phaseT > 0.22 * (e.cycle + 1) && e.cycle < 5) {
      dropIce(g, e.minX + 40 + e.cycle * 70)
      e.cycle++
    }
    if (e.phaseT > 1.6) {
      e.phase = 'chase'
      e.phaseT = 0
    }
  }
}

function dropIce(g: Game, x: number): void {
  fireBullet(g, x, 70, 40, 80, false, 'any', true, { kind: 'shard', damage: 1, life: 2.4, w: 10, h: 10 })
  g.onSfx?.('shoot')
}

function spawnAdd(g: Game, e: Enemy, kind: 'patrol' | 'shooter'): void {
  const x = e.x - 48
  g.enemies.push({
    id: ++g.nextId,
    kind,
    boss: null,
    name: '',
    x,
    y: GROUND - 48,
    w: 36,
    h: 48,
    vx: -40,
    vy: 0,
    hp: kind === 'patrol' ? 2 : 3,
    maxHp: kind === 'patrol' ? 2 : 3,
    facing: -1,
    minX: x - 420,
    maxX: e.x,
    baseY: GROUND - 48,
    cooldown: 0.4,
    shotInterval: 1.1,
    shot: 'mix',
    speed: 70,
    phase: 'chase',
    phaseT: 0,
    cycle: 0,
    hurtT: 0,
    alive: true,
    deathT: 0,
    scored: false,
    spawnedAdds: 0,
    beam: false,
    intro: 0,
    onGround: false,
    armor: 0,
  })
  burst(g, x, GROUND - 20, '#9eb0c4', 8, 80)
}
