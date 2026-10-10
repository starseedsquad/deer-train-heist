import {
  BARRIER_H,
  CEILING_Y,
  CRATE,
  GAP_EASY,
  GAP_HARD,
  GAP_MED,
  GROUND,
  VIEW_H,
} from './constants'
import { bossLabel, bossSize } from './combat'
import { mulberry32 } from './rng'
import type { Arena, BossId, CarSkin, CarSpan, ChapterId, Decal, Enemy, Hazard, Pickup, ShotStyle, Solid } from './types'

/** One jump lands here, and a standing hitbox still clears the underside. */
const STEP_Y = GROUND - 84
/** Catwalk under the clerestory. Too high to reach without a ladder. */
const ROOF_Y = GROUND - 176

interface Opts {
  speed: number
  shotCd: number
  shot: ShotStyle
  barrierHp: number
  hpMul: number
}

export class Builder {
  solids: Solid[] = []
  enemies: Enemy[] = []
  pickups: Pickup[] = []
  decals: Decal[] = []
  hazards: Hazard[] = []
  cars: CarSpan[] = []
  cursor = 0
  nextId = 1
  hasBoss = false
  arena: Arena | null = null

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

  floor(x: number, w: number, skin: CarSkin): void {
    this.addSolid({ kind: 'floor', x, y: GROUND, w, h: VIEW_H - GROUND + 40 })
    this.cars.push({ x, w, skin })
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

  /** Crate that shares a sled's sine motion so a stack can ride cargo. */
  rideCrate(x: number, elevation: number, hp: number, amp: number, period: number, phase: number, yTop: number): void {
    const kind = hp >= 3 ? 'metal' : 'crate'
    this.addSolid({
      kind,
      x,
      y: yTop - CRATE * (elevation + 1),
      w: CRATE,
      h: CRATE,
      hp,
      maxHp: hp,
      destructible: true,
      anchored: false,
      dynamic: true,
      move: 'sine-x',
      originX: x,
      amp,
      period,
      phase,
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

  backstop(x: number): void {
    this.addSolid({
      kind: 'steel',
      x,
      y: -180,
      w: 46,
      h: GROUND + 180,
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

  deck(x: number, y: number, w: number): void {
    this.addSolid({
      kind: 'platform',
      x,
      y,
      w,
      h: 14,
      oneWay: true,
      originX: x,
      originY: y,
      destructible: false,
      anchored: true,
    })
  }

  sled(x: number, w: number, amp: number, period: number, phase = 0): void {
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
      period,
      phase,
      destructible: false,
      anchored: true,
    })
  }

  ladder(x: number, top: number): void {
    this.addSolid({
      kind: 'ladder',
      x,
      y: top,
      w: 28,
      h: GROUND - top,
      collides: false,
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

  gem(x: number, y = GROUND - 36): void {
    this.pickups.push({ x, y, w: 18, h: 18, kind: 'gem', taken: false, locked: false, bob: x * 0.02 })
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

  drone(x: number, speed: number, cd: number, hp = 3, y = GROUND - 168): void {
    this.enemies.push(enemyBase(this.nextId++, 'drone', null, '', x, y, 40, 28, speed, 'mix', cd, x - 80, x + 160, hp))
  }

  foe(
    kind: 'shield' | 'dasher' | 'grenadier' | 'heavy' | 'sniper',
    x: number,
    minX: number,
    maxX: number,
    speed: number,
    hp: number,
    armor = 0,
  ): void {
    const h = kind === 'sniper' ? 58 : kind === 'heavy' ? 64 : 48
    const w = kind === 'heavy' ? 52 : kind === 'sniper' ? 34 : 36
    const e = enemyBase(this.nextId++, kind, null, '', x, GROUND - h, w, h, speed, 'mix', kind === 'sniper' ? 2.1 : 1.5, minX, maxX, hp)
    e.armor = armor
    this.enemies.push(e)
  }

  cargo(x: number, w: number, amp: number): void {
    this.addSolid({
      kind: 'cargo',
      x,
      y: GROUND - 78,
      w,
      h: 78,
      move: 'sine-x',
      originX: x,
      amp,
      period: 1.35,
      destructible: false,
      anchored: true,
    })
  }

  rail(x: number, w: number, phase = 0): void {
    this.hazards.push({ kind: 'rail', x, y: GROUND - 14, w, h: 16, phase, period: 2.4, timer: 0 })
  }

  wind(x: number, w: number, phase = 0): void {
    this.hazards.push({ kind: 'wind', x, y: GROUND - 160, w, h: 160, phase, period: 1.3, timer: 0 })
  }

  debris(x: number, w: number, phase = 0): void {
    this.hazards.push({ kind: 'debris', x, y: 40, w, h: 20, phase, period: 2.2, timer: phase })
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
    armor: 0,
  }
}

export function difficultyCap(id: number): 1 | 2 | 3 | 4 {
  if (id <= 1) return 1
  if (id <= 4) return 2
  if (id <= 8) return 3
  return 4
}

function optsFor(id: number, chapter: ChapterId): Opts {
  const n = id + (chapter === 2 ? 8 : 0)
  return {
    speed: 48 + n * 7,
    shotCd: Math.max(0.55, 1.85 - n * 0.06),
    shot: chapter === 1 && id <= 3 ? 'high' : 'mix',
    barrierHp: n < 6 ? 3 : n < 11 ? 4 : 5,
    hpMul: (chapter === 2 ? 1.2 : 1) * (1 + Math.max(0, Math.floor((n - 5) / 5)) * 0.28),
  }
}

type Build = (b: Builder, o: Opts) => void

interface Chunk {
  id: string
  difficulty: 1 | 2 | 3 | 4
  chapter: 0 | ChapterId
  minLevel: number
  maxLevel?: number
  tags: string[]
  skin: CarSkin
  pool: boolean
  build: Build
}

/** Catwalk overlapping the ladders, with short hops between plates. */
function catwalk(b: Builder, x: number, w: number): void {
  const deckW = 140
  const step = 176
  for (let cursor = 12; cursor < w - 36; cursor += step) {
    const width = Math.min(deckW, w - 16 - cursor)
    if (width < 80) break
    b.deck(x + cursor, ROOF_Y, width)
  }
  b.gem(x + 70, ROOF_Y - 28)
}

/** Crates you can hop, then a coupler you have to jump. The first car teaches the verbs. */
function crateGap(b: Builder): void {
  const x = b.cursor
  const left = 460
  const right = 280
  b.floor(x, left, 'passenger')
  b.floor(x + left + GAP_EASY, right, 'passenger')
  b.sign(x + 24, 'ARROWS MOVE')
  b.sign(x + 210, 'CLICK OR J/X SHOOTS')
  b.sign(x + left - 170, 'SPACE JUMPS')
  b.crate(x + 150, 0, 1)
  b.crate(x + 250, 0, 1)
  b.crate(x + 250, 1, 2)
  b.crate(x + left + GAP_EASY + 80, 0, 1)
  b.gem(x + 360)
  b.cursor = x + left + GAP_EASY + right
}

/** Easy coupler with a crate waiting on the far lip. */
function gapCrate(b: Builder): void {
  const x = b.cursor
  const left = 300
  const right = 320
  b.floor(x, left, 'passenger')
  b.floor(x + left + GAP_EASY, right, 'passenger')
  b.crate(x + 80, 0, 1)
  b.crate(x + left + GAP_EASY + 70, 0, 2)
  b.gem(x + left + GAP_EASY + 180)
  b.cursor = x + left + GAP_EASY + right
}

/** Crouch the steel and shoot the crate that fills the gap. */
function crouchStack(b: Builder): void {
  const x = b.cursor
  const w = 700
  b.floor(x, w, 'cargo')
  b.sign(x + 24, 'CROUCH AND SHOOT')
  b.crawl(x + 180, 300)
  b.crate(x + 260, 0, 1)
  b.crate(x + 360, 0, 2)
  b.gem(x + 560)
  b.cursor = x + w
}

/** High fire over a crate, plus a one-jump step with a gem. */
function highNest(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 760
  b.floor(x, w, 'engine')
  b.sign(x + 20, 'CROUCH UNDER FIRE')
  b.ammo(x + 60)
  b.crate(x + 180, 0, 1)
  b.deck(x + 300, STEP_Y, 110)
  b.gem(x + 330, STEP_Y - 28)
  b.robot(x + 580, 'shooter', x + 480, x + 700, o.speed * 0.65, 'high', o.shotCd)
  b.cursor = x + w
}

/** Break the plate while a shooter on your side of it keeps firing. */
function metalShooter(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 820
  b.floor(x, w, 'vault')
  b.sign(x + 20, 'SHOOT THE PLATE')
  b.ammo(x + 50)
  b.crate(x + 140, 0, 1)
  b.robot(x + 300, 'shooter', x + 220, x + 400, o.speed * 0.6, 'high', o.shotCd)
  b.barrier(x + 520, o.barrierHp)
  b.gem(x + 680)
  b.cursor = x + w
}

/** Dash the wide coupler, then wait out the ram on the landing. */
function dashPiston(b: Builder): void {
  const x = b.cursor
  const left = 340
  const right = 420
  b.floor(x, left, 'engine')
  b.floor(x + left + GAP_HARD, right, 'engine')
  b.sign(x + 24, 'SHIFT / K DASHES')
  b.piston(x + left + GAP_HARD + 130, 0.15)
  b.crate(x + left + GAP_HARD + 260, 0, 2)
  b.cursor = x + left + GAP_HARD + right
}

/** Medium coupler, then a ram and a crate on the next car. */
function gapPiston(b: Builder): void {
  const x = b.cursor
  const left = 300
  const right = 400
  b.floor(x, left, 'engine')
  b.floor(x + left + GAP_MED, right, 'engine')
  b.piston(x + left + GAP_MED + 150, 0.2)
  b.crate(x + left + GAP_MED + 270, 0, 1)
  b.ammo(x + 40)
  b.cursor = x + left + GAP_MED + right
}

/** Two rams out of step, and a crate you shoot between them. */
function pistonLane(b: Builder): void {
  const x = b.cursor
  const w = 740
  b.floor(x, w, 'engine')
  b.sign(x + 20, 'WAIT FOR THE RAM')
  b.crate(x + 160, 0, 1)
  b.piston(x + 300, 0)
  b.piston(x + 520, 0.48)
  b.ammo(x + 70)
  b.cursor = x + w
}

/**
 * Crawl ends before the lip so a jump still happens, and a drone owns the air over the coupler.
 */
function crawlGapDrone(b: Builder, o: Opts): void {
  const x = b.cursor
  const left = 460
  const right = 340
  b.floor(x, left, 'cargo')
  b.floor(x + left + GAP_MED, right, 'cargo')
  b.sign(x + 16, 'DUCK, THEN THE GAP')
  b.crawl(x + 30, left - 110)
  b.crate(x + 160, 0, 1)
  b.drone(x + left + 20, o.speed, Math.max(1.15, o.shotCd), Math.round(3 * o.hpMul))
  b.gem(x + left + GAP_MED + 160)
  b.cursor = x + left + GAP_MED + right
}

/** Medium coupler with a drone over the open air and a crate on the landing. */
function couplerDrone(b: Builder, o: Opts): void {
  const x = b.cursor
  const left = 300
  const right = 360
  b.floor(x, left, 'passenger')
  b.floor(x + left + GAP_MED, right, 'passenger')
  b.drone(x + left + 10, o.speed, Math.max(1.2, o.shotCd), Math.round(3 * o.hpMul))
  b.crate(x + left + GAP_MED + 90, 0, 2)
  b.ammo(x + 40)
  b.cursor = x + left + GAP_MED + right
}

/** Ladder to a roof catwalk. The aisle underneath still has a ram and a stack. */
function roofAisle(b: Builder): void {
  const x = b.cursor
  const w = 820
  b.floor(x, w, 'passenger')
  b.sign(x + 16, 'UP CLIMBS THE ROOF')
  b.sign(x + 280, 'OR TAKE THE AISLE')
  b.ladder(x + 28, ROOF_Y)
  catwalk(b, x, w)
  b.piston(x + 360, 0.25)
  b.crate(x + 520, 0, 1)
  b.crate(x + 570, 0, 1)
  b.crate(x + 570, 1, 2)
  b.cursor = x + w
}

/** Roof over the rams, drone in the clerestory, crates in the aisle. */
function mezzanine(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 860
  b.floor(x, w, 'passenger')
  b.sign(x + 16, 'ROOF OVER THE RAM')
  b.ladder(x + 24, ROOF_Y)
  b.ladder(x + w - 70, ROOF_Y)
  catwalk(b, x, w)
  b.piston(x + 300, 0.1)
  b.piston(x + 470, 0.55)
  b.crate(x + 600, 0, 2)
  b.drone(x + 340, o.speed, Math.max(1.15, o.shotCd), Math.round(3 * o.hpMul), ROOF_Y - 78)
  b.cursor = x + w
}

/** Shield behind a stack. Crouch the plate or get around it. */
function shieldStack(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 780
  b.floor(x, w, 'cargo')
  b.sign(x + 16, 'CROUCH OR FLANK')
  b.crate(x + 180, 0, 1)
  b.crate(x + 250, 0, 2)
  b.crate(x + 250, 1, 1)
  b.foe('shield', x + 460, x + 300, x + 620, o.speed * 0.55, Math.round(4 * o.hpMul))
  b.gem(x + 680)
  b.cursor = x + w
}

/**
 * Wide coupler bridged by a moving sled. A stack rides the sled.
 * A shield waits on the far car.
 */
function cargoRide(b: Builder, o: Opts): void {
  const x = b.cursor
  const left = 320
  const gap = 240
  const right = 380
  const sledW = 160
  const amp = 70
  const period = 1.75
  const px = x + left + (gap - sledW) / 2
  b.floor(x, left, 'cargo')
  b.floor(x + left + gap, right, 'cargo')
  b.sign(x + 16, 'RIDE THE STACK')
  b.sled(px, sledW, amp, period, 0)
  b.rideCrate(px + 57, 0, 2, amp, period, 0, GROUND - 8)
  b.rideCrate(px + 57, 1, 1, amp, period, 0, GROUND - 8)
  b.foe('shield', x + left + gap + 160, x + left + gap + 40, x + left + gap + right - 40, o.speed * 0.5, Math.round(4 * o.hpMul))
  b.ammo(x + 40)
  b.cursor = x + left + gap + right
}

/** Freight sled you hop, crates beside it, then a short coupler. */
function cargoIntro(b: Builder): void {
  const x = b.cursor
  const left = 520
  const right = 260
  b.floor(x, left, 'cargo')
  b.floor(x + left + GAP_EASY, right, 'cargo')
  b.sign(x + 20, 'MOVING CARGO')
  b.cargo(x + 180, 120, 56)
  b.crate(x + 80, 0, 1)
  b.crate(x + 360, 0, 1)
  b.crate(x + 360, 1, 2)
  b.gem(x + left + GAP_EASY + 80)
  b.cursor = x + left + GAP_EASY + right
}

/** Low tunnel with a live rail in the middle. Crouch-dash clears the pulse. */
function railTunnel(b: Builder): void {
  const x = b.cursor
  const w = 760
  b.floor(x, w, 'engine')
  b.sign(x + 16, 'CROUCH-DASH THE RAIL')
  b.crawl(x + 150, 320)
  b.rail(x + 250, 110, 0.4)
  b.crate(x + 540, 0, 1)
  b.gem(x + 640)
  b.cursor = x + w
}

/** Wind on a coupler, crate on the landing. Jump in the lull. */
function gustCoupler(b: Builder): void {
  const x = b.cursor
  const left = 300
  const right = 340
  b.floor(x, left, 'passenger')
  b.floor(x + left + GAP_MED, right, 'passenger')
  b.sign(x + 16, 'GUSTS ON THE GAP')
  b.wind(x + left - 10, GAP_MED + 20, 0.3)
  b.crate(x + left + GAP_MED + 80, 0, 2)
  b.gem(x + left + GAP_MED + 200)
  b.cursor = x + left + GAP_MED + right
}

/** Ice falls over a crate you can use, with a drone in the same bay. */
function debrisLane(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 800
  b.floor(x, w, 'cargo')
  b.sign(x + 16, 'FALLING ICE')
  b.debris(x + 180, 150, 0.2)
  b.debris(x + 420, 160, 1.05)
  b.crate(x + 260, 0, 1)
  b.crate(x + 320, 0, 2)
  b.drone(x + 560, o.speed, Math.max(1.2, o.shotCd), Math.round(3 * o.hpMul))
  b.cursor = x + w
}

/** Dasher in the aisle, then a crawl with a crate in it. */
function dasherCrawl(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 780
  b.floor(x, w, 'engine')
  b.sign(x + 16, 'DASHER, THEN DUCK')
  b.foe('dasher', x + 220, x + 80, x + 360, o.speed * 0.75, Math.round(3 * o.hpMul))
  b.crawl(x + 430, 220)
  b.crate(x + 500, 0, 1)
  b.gem(x + 700)
  b.cursor = x + w
}

/** Grenades arc while you break the plate in front of them. */
function grenadeYard(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 820
  b.floor(x, w, 'vault')
  b.sign(x + 16, 'LOBS OVER THE PLATE')
  b.ammo(x + 40)
  b.crate(x + 150, 0, 2)
  b.barrier(x + 340, o.barrierHp)
  b.foe('grenadier', x + 560, x + 460, x + 740, o.speed * 0.4, Math.round(4 * o.hpMul))
  b.cursor = x + w
}

/** Heavy on the near car, a coupler, then a plate on the landing. */
function heavyGap(b: Builder, o: Opts): void {
  const x = b.cursor
  const left = 420
  const right = 360
  b.floor(x, left, 'engine')
  b.floor(x + left + GAP_MED, right, 'engine')
  b.sign(x + 16, 'ARMOR, THEN THE GAP')
  b.ammo(x + 40)
  b.foe('heavy', x + 200, x + 80, x + 340, 36, Math.round(10 * o.hpMul), 1)
  b.barrier(x + left + GAP_MED + 140, o.barrierHp)
  b.cursor = x + left + GAP_MED + right
}

/**
 * Two plates in the aisle and a sniper at the end.
 * The roof runs over the plates and drops you beside the nest.
 */
function sniperVault(b: Builder, o: Opts): void {
  const x = b.cursor
  const w = 920
  b.floor(x, w, 'vault')
  b.sign(x + 16, 'ROOF FLANKS THE NEST')
  b.ammo(x + 50)
  b.ladder(x + 24, ROOF_Y)
  b.ladder(x + 640, ROOF_Y)
  catwalk(b, x, w)
  b.barrier(x + 280, o.barrierHp)
  b.barrier(x + 470, o.barrierHp)
  b.foe('sniper', x + 760, x + 700, x + 860, 0, Math.round(4 * o.hpMul))
  b.cursor = x + w
}

function haul(b: Builder): void {
  const x = b.cursor
  const w = 440
  b.floor(x, w, 'vault')
  b.sign(x + 30, 'THE HAUL')
  b.crate(x + 90, 0, 1)
  b.gem(x + 180)
  b.chest(x + w - 130, false)
  b.cursor = x + w
}

function bossWalk(b: Builder, o: Opts, skin: CarSkin): void {
  const x = b.cursor
  const w = 560
  b.floor(x, w, skin)
  b.sign(x + 24, 'BOSS AHEAD')
  b.ammo(x + 80)
  b.heart(x + 140)
  b.crawl(x + 230, 120)
  b.crate(x + 400, 0, 1)
  void o
  b.cursor = x + w
}

function arena(b: Builder, o: Opts, kind: BossId, skin: CarSkin): void {
  const x = b.cursor
  const w = 1200
  b.floor(x, w, skin)
  b.gate(x + 8)
  b.ammo(x + 80)
  if (kind === 'turret') {
    b.crawl(x + 220, 70)
    b.crawl(x + 420, 70)
    b.crate(x + 330, 0, 2)
  } else if (kind === 'conductor' || kind === 'hawk') {
    b.crawl(x + 260, 80)
    b.crate(x + 400, 0, 1)
    b.crate(x + 400, 1, 1)
  } else {
    b.crate(x + 300, 0, 1)
    b.crate(x + 390, 0, 2)
  }
  const bossX = x + w - (kind === 'turret' ? 230 : 200)
  b.boss(kind, bossX, o.hpMul)
  const wall = bossX + 52
  b.backstop(wall)
  b.sign(wall - 210, 'SEALED')
  b.arena = { x, w: wall - x }
  b.chest(x + 140, true)
  b.cursor = x + w
}

const CHUNKS: Chunk[] = [
  { id: 'crate-gap', difficulty: 1, chapter: 0, minLevel: 1, maxLevel: 1, tags: ['crate', 'gap'], skin: 'passenger', pool: true, build: crateGap },
  { id: 'gap-crate', difficulty: 1, chapter: 0, minLevel: 1, tags: ['gap', 'crate'], skin: 'passenger', pool: true, build: gapCrate },
  { id: 'crouch-stack', difficulty: 1, chapter: 0, minLevel: 1, tags: ['crawl', 'crate'], skin: 'cargo', pool: true, build: crouchStack },
  { id: 'high-nest', difficulty: 1, chapter: 0, minLevel: 1, tags: ['shooter', 'crate', 'step'], skin: 'engine', pool: true, build: highNest },
  { id: 'metal-shooter', difficulty: 2, chapter: 0, minLevel: 2, tags: ['barrier', 'shooter', 'crate'], skin: 'vault', pool: true, build: metalShooter },
  { id: 'dash-piston', difficulty: 2, chapter: 0, minLevel: 2, tags: ['gap', 'piston', 'crate'], skin: 'engine', pool: true, build: dashPiston },
  { id: 'gap-piston', difficulty: 2, chapter: 0, minLevel: 2, tags: ['gap', 'piston', 'crate'], skin: 'engine', pool: true, build: gapPiston },
  { id: 'piston-lane', difficulty: 2, chapter: 0, minLevel: 2, tags: ['piston', 'crate'], skin: 'engine', pool: true, build: pistonLane },
  { id: 'crawl-gap-drone', difficulty: 2, chapter: 0, minLevel: 3, tags: ['crawl', 'gap', 'drone'], skin: 'cargo', pool: true, build: crawlGapDrone },
  { id: 'coupler-drone', difficulty: 2, chapter: 0, minLevel: 3, tags: ['gap', 'drone', 'crate'], skin: 'passenger', pool: true, build: couplerDrone },
  { id: 'roof-aisle', difficulty: 2, chapter: 0, minLevel: 2, tags: ['ladder', 'roof', 'piston', 'crate'], skin: 'passenger', pool: true, build: roofAisle },
  { id: 'mezzanine', difficulty: 3, chapter: 0, minLevel: 6, tags: ['ladder', 'roof', 'piston', 'drone'], skin: 'passenger', pool: true, build: mezzanine },
  { id: 'shield-stack', difficulty: 3, chapter: 0, minLevel: 6, tags: ['shield', 'crate'], skin: 'cargo', pool: true, build: shieldStack },
  { id: 'cargo-ride', difficulty: 3, chapter: 0, minLevel: 6, tags: ['cargo', 'crate', 'shield', 'gap'], skin: 'cargo', pool: true, build: cargoRide },
  { id: 'cargo-intro', difficulty: 1, chapter: 2, minLevel: 1, tags: ['cargo', 'crate', 'gap'], skin: 'cargo', pool: true, build: cargoIntro },
  { id: 'rail-tunnel', difficulty: 2, chapter: 2, minLevel: 2, tags: ['rail', 'crawl', 'crate'], skin: 'engine', pool: true, build: railTunnel },
  { id: 'gust-coupler', difficulty: 2, chapter: 2, minLevel: 4, tags: ['wind', 'gap', 'crate'], skin: 'passenger', pool: true, build: gustCoupler },
  { id: 'debris-lane', difficulty: 3, chapter: 2, minLevel: 6, tags: ['debris', 'drone', 'crate'], skin: 'cargo', pool: true, build: debrisLane },
  { id: 'dasher-crawl', difficulty: 3, chapter: 0, minLevel: 7, tags: ['dasher', 'crawl', 'crate'], skin: 'engine', pool: true, build: dasherCrawl },
  { id: 'grenade-yard', difficulty: 3, chapter: 0, minLevel: 8, tags: ['grenade', 'barrier', 'crate'], skin: 'vault', pool: true, build: grenadeYard },
  { id: 'heavy-gap', difficulty: 4, chapter: 0, minLevel: 9, tags: ['heavy', 'gap', 'barrier'], skin: 'engine', pool: true, build: heavyGap },
  { id: 'sniper-vault', difficulty: 4, chapter: 0, minLevel: 9, tags: ['sniper', 'barrier', 'ladder', 'roof'], skin: 'vault', pool: true, build: sniperVault },
]

const BY_ID = new Map(CHUNKS.map((chunk) => [chunk.id, chunk]))

export interface PlannedChunk {
  id: string
  difficulty: 1 | 2 | 3 | 4
  tags: string[]
  skin: CarSkin
}

export interface LevelPlan {
  name: string
  boss: BossId | null
  chunks: PlannedChunk[]
}

const NIGHT: { name: string; boss: BossId | null; ids: string[] }[] = [
  { name: '', boss: null, ids: [] },
  { name: 'First Light', boss: null, ids: ['crate-gap', 'crouch-stack', 'high-nest', 'haul'] },
  { name: 'Checked Baggage', boss: null, ids: ['metal-shooter', 'dash-piston', 'roof-aisle', 'haul'] },
  { name: 'Low Clearance', boss: null, ids: ['crawl-gap-drone', 'piston-lane', 'coupler-drone', 'haul'] },
  { name: 'Loose Couplers', boss: null, ids: ['gap-piston', 'high-nest', 'roof-aisle', 'haul'] },
  { name: 'Iron Warden', boss: 'mech', ids: ['boss-walk', 'arena'] },
  { name: 'Dining Wreck', boss: null, ids: ['shield-stack', 'crawl-gap-drone', 'metal-shooter', 'roof-aisle', 'haul'] },
  { name: 'Sleeper Agent', boss: null, ids: ['dasher-crawl', 'cargo-ride', 'mezzanine', 'haul'] },
  { name: 'Maintenance', boss: null, ids: ['grenade-yard', 'dash-piston', 'shield-stack', 'piston-lane', 'haul'] },
  { name: 'Open Air', boss: null, ids: ['heavy-gap', 'cargo-ride', 'roof-aisle', 'coupler-drone', 'haul'] },
  { name: 'The Conductor', boss: 'conductor', ids: ['boss-walk', 'arena'] },
  { name: 'Armored Hold', boss: null, ids: ['sniper-vault', 'shield-stack', 'crawl-gap-drone', 'haul'] },
  { name: 'Blind Tunnel', boss: null, ids: ['sniper-vault', 'mezzanine', 'dasher-crawl', 'piston-lane', 'haul'] },
  { name: 'Crossfire', boss: null, ids: ['grenade-yard', 'cargo-ride', 'heavy-gap', 'roof-aisle', 'haul'] },
  { name: 'Redline', boss: null, ids: ['sniper-vault', 'dash-piston', 'shield-stack', 'mezzanine', 'coupler-drone', 'haul'] },
  { name: 'Loco-Lock', boss: 'turret', ids: ['boss-walk', 'arena'] },
]

const SNOW: { name: string; boss: BossId | null; ids: string[] }[] = [
  { name: '', boss: null, ids: [] },
  { name: 'First Snow', boss: null, ids: ['cargo-intro', 'crouch-stack', 'haul'] },
  { name: 'Live Rail', boss: null, ids: ['rail-tunnel', 'gap-crate', 'metal-shooter', 'haul'] },
  { name: 'White Tunnel', boss: null, ids: ['crawl-gap-drone', 'roof-aisle', 'gap-piston', 'haul'] },
  { name: 'Crosswind', boss: null, ids: ['gust-coupler', 'rail-tunnel', 'cargo-intro', 'haul'] },
  { name: 'Glacier Ram', boss: 'ram', ids: ['boss-walk', 'arena'] },
  { name: 'Icefall', boss: null, ids: ['debris-lane', 'shield-stack', 'cargo-ride', 'haul'] },
  { name: 'Shield Yard', boss: null, ids: ['dasher-crawl', 'mezzanine', 'rail-tunnel', 'shield-stack', 'haul'] },
  { name: 'Switchback', boss: null, ids: ['cargo-ride', 'gust-coupler', 'grenade-yard', 'debris-lane', 'haul'] },
  { name: 'Sniper Ridge', boss: null, ids: ['sniper-vault', 'heavy-gap', 'gust-coupler', 'haul'] },
  { name: 'Whiteout Hawk', boss: 'hawk', ids: ['boss-walk', 'arena'] },
  { name: 'Drift Armor', boss: null, ids: ['heavy-gap', 'debris-lane', 'grenade-yard', 'cargo-ride', 'haul'] },
  { name: 'Coupler Gulch', boss: null, ids: ['rail-tunnel', 'sniper-vault', 'shield-stack', 'dash-piston', 'haul'] },
  { name: 'Night Glass', boss: null, ids: ['mezzanine', 'heavy-gap', 'crawl-gap-drone', 'dasher-crawl', 'haul'] },
  { name: 'Summit Road', boss: null, ids: ['gust-coupler', 'heavy-gap', 'sniper-vault', 'cargo-ride', 'roof-aisle', 'haul'] },
  { name: 'Summit Breaker', boss: 'summit', ids: ['boss-walk', 'arena'] },
]

function arenaSkin(kind: BossId): CarSkin {
  if (kind === 'mech' || kind === 'hawk') return 'passenger'
  if (kind === 'conductor' || kind === 'ram') return 'vault'
  return 'engine'
}

function leadSkin(kind: BossId): CarSkin {
  return arenaSkin(kind) === 'engine' ? 'passenger' : 'cargo'
}

function nightBoss(id: number): BossId {
  const night: BossId[] = ['mech', 'conductor', 'turret']
  return night[Math.floor(id / 5) % 3]
}

function snowBoss(id: number): BossId {
  const snow: BossId[] = ['ram', 'hawk', 'summit']
  return snow[Math.floor(id / 5) % 3]
}

function specialChunk(id: string, boss: BossId | null): PlannedChunk {
  if (id === 'haul') return { id, difficulty: 1, tags: ['crate', 'chest'], skin: 'vault' }
  if (id === 'boss-walk') {
    return { id, difficulty: 2, tags: ['crawl', 'crate'], skin: leadSkin(boss ?? 'mech') }
  }
  return { id: 'arena', difficulty: 2, tags: ['boss', 'gate'], skin: arenaSkin(boss ?? 'mech') }
}

function plannedFrom(chunk: Chunk): PlannedChunk {
  return { id: chunk.id, difficulty: chunk.difficulty, tags: chunk.tags, skin: chunk.skin }
}

function handPlan(id: number, chapter: ChapterId): LevelPlan | null {
  const table = chapter === 2 ? SNOW : NIGHT
  if (id > 15) return null
  const row = table[id]
  const boss = row.boss
  return {
    name: row.name,
    boss,
    chunks: row.ids.map((chunkId) => {
      const found = BY_ID.get(chunkId)
      return found ? plannedFrom(found) : specialChunk(chunkId, boss)
    }),
  }
}

function generatedPlan(id: number, chapter: ChapterId): LevelPlan {
  const rng = mulberry32(id * 9176 + chapter * 409 + 13)
  const cap = difficultyCap(id)
  const prev = levelPlan(id - 1, chapter).chunks.at(-1)?.id ?? ''
  const pool = CHUNKS.filter(
    (chunk) =>
      chunk.pool &&
      chunk.difficulty <= cap &&
      chunk.minLevel <= id &&
      (chunk.maxLevel === undefined || chunk.maxLevel >= id) &&
      (chunk.chapter === 0 || chunk.chapter === chapter),
  )
  const n = Math.min(pool.length, 4 + (id % 3))
  const available = pool.slice()
  const picked: Chunk[] = []
  let last = prev
  for (let i = 0; i < n; i++) {
    let choices = available.filter((chunk) => chunk.id !== last)
    if (choices.length === 0) choices = pool.filter((chunk) => chunk.id !== last)
    const skins = new Set(picked.map((chunk) => chunk.skin))
    if (skins.size < 2 && i >= Math.max(0, n - 2)) {
      const other = choices.filter((chunk) => !skins.has(chunk.skin))
      if (other.length > 0) choices = other
    }
    const choice = choices[Math.floor(rng() * choices.length)]
    picked.push(choice)
    last = choice.id
    const index = available.findIndex((chunk) => chunk.id === choice.id)
    if (index >= 0) available.splice(index, 1)
  }
  if (!picked.some((chunk) => chunk.difficulty === cap)) {
    const tops = pool.filter((chunk) => chunk.difficulty === cap && !picked.some((have) => have.id === chunk.id))
    let best: Chunk | null = null
    let bestScore = -1
    for (const candidate of tops) {
      const trial = picked.slice(0, -1).concat(candidate)
      if (trial.some((chunk, index) => index > 0 && chunk.id === trial[index - 1].id)) continue
      const score = new Set(trial.map((chunk) => chunk.skin)).size
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (best && bestScore >= 2) picked[picked.length - 1] = best
  }
  const boss = id % 5 === 0 ? (chapter === 2 ? snowBoss(id) : nightBoss(id)) : null
  const chunks = picked.map(plannedFrom)
  if (boss) {
    chunks.push(specialChunk('boss-walk', boss))
    chunks.push(specialChunk('arena', boss))
  } else chunks.push(specialChunk('haul', null))
  const miles =
    chapter === 2
      ? ['Spur', 'Siding', 'Cornice', 'Drift', 'Pass', 'Viaduct', 'Couloir', 'Basin', 'Ridge', 'Summit']
      : ['Night Mail', 'Caboose', 'Observation', 'Coal Tender', 'Express', 'Local Stop', 'Switchback', 'Sleeper', 'Diner', 'Baggage']
  const name = boss ? `${bossLabel(boss)} MK ${Math.ceil(id / 5)}` : `${miles[id % miles.length]} ${id}`
  return { name, boss, chunks }
}

export function levelPlan(id: number, chapter: ChapterId = 1): LevelPlan {
  const safe = Math.max(1, id)
  return handPlan(safe, chapter) ?? generatedPlan(safe, chapter)
}

export interface BuiltWorld {
  width: number
  solids: Solid[]
  enemies: Enemy[]
  pickups: Pickup[]
  decals: Decal[]
  hazards: Hazard[]
  cars: CarSpan[]
  arena: Arena | null
  nextId: number
}

export function buildWorld(id: number, chapter: ChapterId = 1): BuiltWorld {
  const plan = levelPlan(id, chapter)
  const b = new Builder()
  const o = optsFor(id, chapter)
  for (const step of plan.chunks) {
    if (step.id === 'arena' && plan.boss) arena(b, o, plan.boss, step.skin)
    else if (step.id === 'boss-walk') bossWalk(b, o, step.skin)
    else if (step.id === 'haul') haul(b)
    else {
      const chunk = BY_ID.get(step.id)
      if (!chunk) throw new Error(`missing chunk ${step.id}`)
      chunk.build(b, o)
    }
  }
  b.addSolid({ kind: 'steel', x: -48, y: 0, w: 48, h: GROUND })
  b.addSolid({ kind: 'steel', x: b.cursor, y: 0, w: 48, h: GROUND })
  return {
    width: b.cursor + 48,
    solids: b.solids,
    enemies: b.enemies,
    pickups: b.pickups,
    decals: b.decals,
    hazards: b.hazards,
    cars: b.cars,
    arena: b.arena,
    nextId: b.nextId,
  }
}
