import {
  BARRIER_H,
  CEILING_Y,
  CRATE,
  GAP_EASY,
  GAP_HARD,
  GAP_MED,
  GROUND,
  MAG_SIZE,
  MAX_HP,
  STAND_H,
  VIEW_H,
} from './constants'
import { bossLabel, bossSize } from './combat'
import { mulberry32 } from './rng'
import type { BossId, Decal, Enemy, Game, Pickup, ShotStyle, Solid } from './types'
import { emptyStats } from './types'

export interface LevelInfo {
  id: number
  name: string
  bossName: string
  boss: BossId | null
}

interface Opts {
  speed: number
  shotCd: number
  shot: ShotStyle
  barrierHp: number
  hpMul: number
}

class Builder {
  solids: Solid[] = []
  enemies: Enemy[] = []
  pickups: Pickup[] = []
  decals: Decal[] = []
  cursor = 0
  nextId = 1
  hasBoss = false

  addSolid(partial: Pick<Solid, 'kind' | 'x' | 'y' | 'w' | 'h'> & Partial<Solid>): Solid {
    const s: Solid = {
      id: this.nextId++,
      x: partial.x,
      y: partial.y,
      w: partial.w,
      h: partial.h,
      kind: partial.kind,
      hp: partial.hp ?? 1_000_000,
      maxHp: partial.maxHp ?? partial.hp ?? 1_000_000,
      destructible: partial.destructible ?? false,
      anchored: partial.anchored ?? true,
      dynamic: partial.dynamic ?? false,
      oneWay: partial.oneWay ?? false,
      collides: partial.collides ?? true,
      vx: 0,
      vy: 0,
      move: partial.move ?? 'none',
      originX: partial.originX ?? partial.x,
      originY: partial.originY ?? partial.y,
      amp: partial.amp ?? 0,
      period: partial.period ?? 2.5,
      phase: partial.phase ?? 0,
      hitFlash: 0,
      dx: 0,
      triggered: false,
    }
    this.solids.push(s)
    return s
  }

  floor(x: number, w: number): void {
    this.addSolid({ kind: 'floor', x, y: GROUND, w, h: VIEW_H - GROUND + 40 })
  }

  sign(x: number, text: string): void {
    this.decals.push({ x, y: GROUND - 108, text })
  }

  crate(x: number, elevation: number, hp: number): void {
    const kind = hp >= 3 ? 'metal' : 'crate'
    this.addSolid({
      kind,
      x,
      y: GROUND - CRATE * (elevation + 1),
      w: CRATE,
      h: CRATE,
      hp,
      maxHp: hp,
      destructible: true,
      anchored: false,
      dynamic: true,
    })
  }

  barrier(x: number, hp: number): void {
    this.addSolid({
      kind: hp >= 3 ? 'metal' : 'barrier',
      x,
      y: GROUND - BARRIER_H,
      w: 50,
      h: BARRIER_H,
      hp,
      maxHp: hp,
      destructible: true,
      anchored: true,
      dynamic: false,
    })
  }

  crawl(x: number, w: number): void {
    this.addSolid({
      kind: 'steel',
      x,
      y: 24,
      w,
      h: CEILING_Y - 24,
      destructible: false,
      anchored: true,
    })
  }

  gate(x: number): void {
    this.addSolid({
      kind: 'gate',
      x,
      y: -GROUND,
      w: 26,
      h: GROUND,
      originY: -GROUND,
      destructible: false,
      anchored: true,
    })
  }

  piston(x: number, phase = 0): void {
    this.addSolid({
      kind: 'piston',
      x,
      y: 70,
      w: 58,
      h: 36,
      originY: 70,
      period: 2.45,
      phase,
      collides: false,
      destructible: false,
      anchored: true,
    })
  }

  platform(x: number, w: number, amp: number): void {
    this.addSolid({
      kind: 'platform',
      x,
      y: GROUND - 8,
      w,
      h: 16,
      oneWay: true,
      move: 'sine-x',
      originX: x,
      amp,
      period: 1.15,
      destructible: false,
      anchored: true,
    })
  }

  ammo(x: number): void {
    this.pickups.push({ x, y: GROUND - 28, w: 22, h: 22, kind: 'ammo', taken: false, locked: false, bob: x * 0.01 })
  }

  heart(x: number): void {
    this.pickups.push({ x, y: GROUND - 30, w: 22, h: 20, kind: 'heart', taken: false, locked: false, bob: 0.4 })
  }

  gem(x: number): void {
    this.pickups.push({ x, y: GROUND - 36, w: 18, h: 18, kind: 'gem', taken: false, locked: false, bob: x * 0.02 })
  }

  chest(x: number, locked: boolean): void {
    this.pickups.push({ x, y: GROUND - 40, w: 46, h: 36, kind: 'chest', taken: false, locked, bob: 0 })
  }

  robot(
    x: number,
    kind: 'patrol' | 'shooter',
    minX: number,
    maxX: number,
    speed: number,
    shot: ShotStyle,
    cd: number,
  ): void {
    const h = 48
    this.enemies.push(enemyBase(this.nextId++, kind, null, '', x, GROUND - h, 36, h, speed, shot, cd, minX, maxX, kind === 'patrol' ? 2 : 3))
  }

  drone(x: number, speed: number, cd: number): void {
    const y = GROUND - 168
    this.enemies.push(enemyBase(this.nextId++, 'drone', null, '', x, y, 40, 28, speed, 'mix', cd, x - 80, x + 160, 3))
  }

  boss(kind: BossId, x: number, hpMul: number): void {
    const size = bossSize(kind)
    const hp = Math.round(size.hp * hpMul)
    const e = enemyBase(
      this.nextId++,
      'boss',
      kind,
      bossLabel(kind),
      x,
      GROUND - size.h,
      size.w,
      size.h,
      kind === 'turret' ? 0 : 55,
      'mix',
      0.4,
      x - 70,
      x + 50,
      hp,
    )
    e.intro = 1.35
    e.phase = 'chase'
    this.enemies.push(e)
    this.hasBoss = true
  }
}

function enemyBase(
  id: number,
  kind: Enemy['kind'],
  boss: BossId | null,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  speed: number,
  shot: ShotStyle,
  cd: number,
  minX: number,
  maxX: number,
  hp: number,
): Enemy {
  return {
    id,
    kind,
    boss,
    name,
    x,
    y,
    w,
    h,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    facing: -1,
    minX,
    maxX,
    baseY: y,
    cooldown: 0.4 + (id % 5) * 0.08,
    shotInterval: cd,
    shot,
    speed,
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
  }
}

function optsFor(id: number): Opts {
  return {
    speed: 48 + id * 7,
    shotCd: Math.max(0.72, 1.85 - id * 0.07),
    shot: id <= 3 ? 'high' : 'mix',
    barrierHp: id < 6 ? 3 : id < 11 ? 4 : 5,
    hpMul: 1 + Math.max(0, Math.floor((id - 5) / 5)) * 0.28,
  }
}

type Part = (b: Builder, o: Opts) => void

function intro(b: Builder): void {
  const x = b.cursor
  const w = 640
  b.floor(x, w)
  b.sign(x + 70, 'ARROWS MOVE')
  b.sign(x + 250, 'CLICK OR J/X SHOOTS')
  b.crate(x + 430, 0, 1)
  b.gem(x + 520)
  b.cursor = x + w
}

function introShort(b: Builder): void {
  const x = b.cursor
  const w = 420
  b.floor(x, w)
  b.cursor = x + w
}

function crateLine(b: Builder): void {
  const x = b.cursor
  const w = 760
  b.floor(x, w)
  b.sign(x + 24, 'SHOOT OR HOP CRATES')
  b.crate(x + 160, 0, 1)
  b.crate(x + 340, 0, 1)
  b.crate(x + 340, 1, 2)
  b.sign(x + 300, 'STACKS FALL')
  b.gem(x + 560)
  b.cursor = x + w
}

function crawlCrate(b: Builder): void {
  const x = b.cursor
  const w = 720
  b.floor(x, w)
  b.sign(x + 20, 'CROUCH AND SHOOT')
  b.crawl(x + 250, 280)
  b.crate(x + 330, 0, 1)
  b.crate(x + 400, 0, 2)
  b.cursor = x + w
}

function steelCrawl(b: Builder): void {
  const x = b.cursor
  const w = 640
  b.floor(x, w)
  b.sign(x + 30, 'STEEL WON’T BREAK')
  b.crawl(x + 220, 240)
  b.cursor = x + w
}

function easyGap(b: Builder): void {
  const x = b.cursor
  const left = 300
  const right = 300
  b.floor(x, left)
  b.floor(x + left + GAP_EASY, right)
  b.sign(x + left - 150, 'SPACE JUMPS')
  b.cursor = x + left + GAP_EASY + right
}

function medGap(b: Builder): void {
  const x = b.cursor
  const left = 320
  const right = 340
  b.floor(x, left)
  b.floor(x + left + GAP_MED, right)
  b.cursor = x + left + GAP_MED + right
}

function hardGap(b: Builder): void {
  const x = b.cursor
  const left = 360
  const right = 380
  b.floor(x, left)
  b.floor(x + left + GAP_HARD, right)
  b.sign(x + 40, 'SHIFT / K DASHES')
  b.cursor = x + left + GAP_HARD + right
}

function movingGap(b: Builder): void {
  const x = b.cursor
  const left = 300
  const gap = 300
  const right = 320
  b.floor(x, left)
  b.floor(x + left + gap, right)
  b.platform(x + left + 70, 100, 80)
  b.sign(x + 30, 'RIDE THE PLATE')
  b.cursor = x + left + gap + right
}

function highShooter(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 760
  b.floor(x, w)
  b.sign(x + 20, 'CROUCH UNDER FIRE')
  b.crate(x + 180, 0, 1)
  b.robot(x + 560, 'shooter', x + 460, x + 680, o.speed * 0.65, 'high', o.shotCd)
  b.ammo(x + 80)
  b.cursor = x + w
}

function shooterLane(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 860
  b.floor(x, w)
  b.crate(x + 200, 0, 1)
  b.robot(x + 420, 'shooter', x + 360, x + 520, o.speed * 0.7, o.shot, o.shotCd)
  b.robot(x + 700, 'patrol', x + 620, x + 800, o.speed, 'high', 2)
  b.heart(x + 80)
  b.cursor = x + w
}

function metalWall(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 640
  b.floor(x, w)
  b.sign(x + 24, `${o.barrierHp} HITS TO BREAK`)
  b.ammo(x + 70)
  b.barrier(x + 300, o.barrierHp)
  b.gem(x + 480)
  b.cursor = x + w
}

function pistonRow(b: Builder): void {
  const x = b.cursor
  const w = 720
  b.floor(x, w)
  b.sign(x + 20, 'WAIT FOR THE RAM')
  b.piston(x + 250, 0)
  b.piston(x + 460, 0.45)
  b.cursor = x + w
}

function droneLane(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 700
  b.floor(x, w)
  b.drone(x + 280, o.speed, Math.max(1.1, o.shotCd))
  b.drone(x + 520, o.speed * 1.1, Math.max(1.2, o.shotCd + 0.2))
  b.cursor = x + w
}

function mixedCover(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 900
  b.floor(x, w)
  b.sign(x + 16, 'DUCK THE STEEL')
  b.crawl(x + 180, 90)
  b.crate(x + 320, 0, 2)
  b.barrier(x + 470, o.barrierHp)
  b.robot(x + 740, 'shooter', x + 680, x + 840, o.speed, o.shot, o.shotCd)
  b.ammo(x + 40)
  b.cursor = x + w
}

function hoard(b: Builder): void {
  const x = b.cursor
  const w = 480
  b.floor(x, w)
  b.sign(x + 40, 'THE HAUL')
  b.gem(x + 160)
  b.chest(x + w - 130, false)
  b.cursor = x + w
}

function approach(b: Builder): void {
  const x = b.cursor
  const w = 520
  b.floor(x, w)
  b.sign(x + 40, 'BOSS AHEAD')
  b.ammo(x + 200)
  b.heart(x + 250)
  b.cursor = x + w
}

function arena(kind: BossId): Part {
  return (b, o) => {
    const x = b.cursor
    const w = 1200
    b.floor(x, w)
    b.gate(x + 8)
    b.ammo(x + 80)
    if (kind === 'turret') {
      b.crawl(x + 220, 70)
      b.crawl(x + 420, 70)
      b.crate(x + 330, 0, 2)
    } else if (kind === 'conductor') {
      b.crawl(x + 260, 80)
      b.crate(x + 400, 0, 1)
      b.crate(x + 400, 1, 1)
    } else {
      b.crate(x + 300, 0, 1)
      b.crate(x + 390, 0, 2)
    }
    b.boss(kind, x + w - (kind === 'turret' ? 230 : 200), o.hpMul)
    b.chest(x + 140, true)
    b.cursor = x + w
  }
}

const PRESETS: { name: string; boss: BossId | null; parts: Part[] }[] = [
  { name: '', boss: null, parts: [] },
  { name: 'First Light', boss: null, parts: [intro, crateLine, steelCrawl, easyGap, highShooter, hoard] },
  { name: 'Checked Baggage', boss: null, parts: [introShort, crateLine, metalWall, medGap, shooterLane, hoard] },
  { name: 'Low Clearance', boss: null, parts: [introShort, crawlCrate, steelCrawl, highShooter, easyGap, hoard] },
  { name: 'Loose Couplers', boss: null, parts: [introShort, medGap, hardGap, pistonRow, shooterLane, hoard] },
  { name: 'Iron Warden', boss: 'mech', parts: [approach, arena('mech')] },
  { name: 'Dining Wreck', boss: null, parts: [introShort, crateLine, droneLane, metalWall, crawlCrate, medGap, hoard] },
  { name: 'Sleeper Agent', boss: null, parts: [introShort, mixedCover, shooterLane, steelCrawl, medGap, hoard] },
  { name: 'Maintenance', boss: null, parts: [introShort, pistonRow, droneLane, hardGap, metalWall, hoard] },
  { name: 'Open Air', boss: null, parts: [introShort, hardGap, movingGap, shooterLane, medGap, hoard] },
  { name: 'The Conductor', boss: 'conductor', parts: [approach, arena('conductor')] },
  { name: 'Armored Hold', boss: null, parts: [introShort, metalWall, shooterLane, crawlCrate, droneLane, hoard] },
  { name: 'Blind Tunnel', boss: null, parts: [introShort, crawlCrate, steelCrawl, crawlCrate, pistonRow, hoard] },
  { name: 'Crossfire', boss: null, parts: [introShort, shooterLane, mixedCover, droneLane, hardGap, hoard] },
  { name: 'Redline', boss: null, parts: [introShort, hardGap, pistonRow, shooterLane, droneLane, metalWall, hardGap, hoard] },
  { name: 'Loco-Lock', boss: 'turret', parts: [approach, arena('turret')] },
]

function generated(id: number): { name: string; boss: BossId | null; parts: Part[] } {
  const rng = mulberry32(id * 9176 + 13)
  const boss = id % 5 === 0 ? ((['mech', 'conductor', 'turret'] as const)[Math.floor(id / 5) % 3]) : null
  const pool: Part[] = [crateLine, metalWall, crawlCrate, steelCrawl, easyGap, medGap, hardGap, pistonRow, shooterLane, droneLane, mixedCover, movingGap]
  const parts: Part[] = [introShort]
  const n = 5 + (id % 3)
  for (let i = 0; i < n; i++) parts.push(pool[Math.floor(rng() * pool.length)])
  parts.push(boss ? arena(boss) : hoard)
  const miles = ['Night Mail', 'Caboose', 'Observation', 'Coal Tender', 'Express', 'Local Stop', 'Switchback', 'Sleeper', 'Diner', 'Baggage']
  const name = boss ? `${bossLabel(boss)} MK ${Math.ceil(id / 5)}` : `${miles[id % miles.length]} ${id}`
  return { name, boss, parts }
}

export function describeLevel(id: number): LevelInfo {
  const safe = Math.max(1, id)
  const preset = safe <= 15 ? PRESETS[safe] : generated(safe)
  return {
    id: safe,
    name: preset.name,
    boss: preset.boss,
    bossName: preset.boss ? bossLabel(preset.boss) : '',
  }
}

export interface BuiltLevel extends LevelInfo {
  width: number
  solids: Solid[]
  enemies: Enemy[]
  pickups: Pickup[]
  decals: Decal[]
  nextId: number
}

export function buildLevel(id: number): BuiltLevel {
  const info = describeLevel(id)
  const preset = id <= 15 ? PRESETS[id] : generated(id)
  const b = new Builder()
  const o = optsFor(id)
  for (const part of preset.parts) part(b, o)
  b.addSolid({ kind: 'steel', x: -48, y: 0, w: 48, h: GROUND })
  b.addSolid({ kind: 'steel', x: b.cursor, y: 0, w: 48, h: GROUND })
  return {
    ...info,
    width: b.cursor + 48,
    solids: b.solids,
    enemies: b.enemies,
    pickups: b.pickups,
    decals: b.decals,
    nextId: b.nextId,
  }
}

export function makePlayer(x: number): Game['player'] {
  return {
    x,
    y: GROUND - STAND_H,
    w: 34,
    h: STAND_H,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    wasOnGround: true,
    crouching: false,
    slideT: 0,
    dashT: 0,
    dashCd: 0,
    fireCd: 0,
    ammo: MAG_SIZE,
    reloading: false,
    reloadT: 0,
    hp: MAX_HP,
    hurtT: 0,
    coyote: 0.12,
    jumpBuf: 0,
    jumpCut: false,
    shootFlash: 0,
    anim: 0,
    alive: true,
    deadT: 0,
    platformId: 0,
    checkpointX: x,
    checkpointY: GROUND - STAND_H,
    trail: [],
  }
}

export function createGame(save: { unlocked: number; highScore: number; treasure: number; muted: boolean }): Game {
  return {
    mode: 'title',
    levelId: 1,
    levelName: 'First Light',
    bossName: '',
    levelWidth: 960,
    solids: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    decals: [],
    player: makePlayer(80),
    camX: 0,
    shake: 0,
    time: 0,
    levelTime: 0,
    score: 0,
    levelScore: 0,
    runTreasure: 0,
    levelTreasure: 0,
    timeBonus: 0,
    message: '',
    messageT: 0,
    selectedLevel: save.unlocked,
    unlocked: save.unlocked,
    highScore: save.highScore,
    lifetimeTreasure: save.treasure,
    muted: save.muted,
    bossIntro: false,
    bossDeathT: 0,
    nextId: 1,
    stats: emptyStats(),
    debug: false,
  }
}

export function loadLevel(g: Game, id: number): void {
  const built = buildLevel(id)
  g.levelId = built.id
  g.levelName = built.name
  g.bossName = built.bossName
  g.levelWidth = built.width
  g.solids = built.solids
  g.enemies = built.enemies
  g.pickups = built.pickups
  g.decals = built.decals
  g.bullets = []
  g.particles = []
  g.floaters = []
  g.player = makePlayer(72)
  g.camX = 0
  g.shake = 0
  g.levelTime = 0
  g.levelScore = 0
  g.levelTreasure = 0
  g.timeBonus = 0
  g.message = built.bossName ? `BOSS  ${built.bossName}` : built.name
  g.messageT = 2.5
  g.bossIntro = false
  g.bossDeathT = 0
  g.nextId = built.nextId
  g.mode = 'playing'
}
