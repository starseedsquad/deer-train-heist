import { GROUND, MAG_SIZE, MAX_HP, STAND_H } from './constants'
import { bossLabel } from './combat'
import { applyLoadout } from './armory'
import { buildWorld, levelPlan } from './chunks'
import type { SaveData } from './save'
import type { Arena, BossId, CarSpan, ChapterId, Decal, Enemy, Game, Hazard, Pickup, Solid } from './types'
import { emptyStats } from './types'

export interface LevelInfo {
  id: number
  name: string
  bossName: string
  boss: BossId | null
}

export function describeLevel(id: number, chapter: ChapterId = 1): LevelInfo {
  const safe = Math.max(1, id)
  const plan = levelPlan(safe, chapter)
  return {
    id: safe,
    name: plan.name,
    boss: plan.boss,
    bossName: plan.boss ? bossLabel(plan.boss) : '',
  }
}

export interface BuiltLevel extends LevelInfo {
  width: number
  solids: Solid[]
  enemies: Enemy[]
  pickups: Pickup[]
  decals: Decal[]
  hazards: Hazard[]
  cars: CarSpan[]
  arena: Arena | null
  nextId: number
  chapter: ChapterId
}

export function buildLevel(id: number, chapter: ChapterId = 1): BuiltLevel {
  const info = describeLevel(id, chapter)
  const world = buildWorld(id, chapter)
  return { ...info, ...world, chapter }
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
    charge: 0,
    maxHp: MAX_HP,
    armorClock: 0,
  }
}

export function createGame(save: SaveData): Game {
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
    selectedLevel: save.chapter === 2 && save.chapter2 > 0 ? Math.min(save.chapter2, 15) : save.unlocked,
    unlocked: save.unlocked,
    highScore: save.highScore,
    lifetimeTreasure: save.treasure,
    muted: save.muted,
    chapter: save.chapter === 2 && save.chapter2 > 0 ? 2 : 1,
    selectedChapter: save.chapter === 2 && save.chapter2 > 0 ? 2 : 1,
    chapter2: save.chapter2,
    coins: save.coins,
    weapon: save.weapon,
    owned: save.owned.slice(),
    ranks: { ...save.ranks },
    armoryFrom: 'title',
    hazards: [],
    cars: [],
    arena: null,
    arenaLock: false,
    bossIntro: false,
    bossDeathT: 0,
    nextId: 1,
    stats: emptyStats(),
    debug: false,
  }
}

export function loadLevel(g: Game, id: number): void {
  const built = buildLevel(id, g.chapter)
  g.levelId = built.id
  g.levelName = built.name
  g.bossName = built.bossName
  g.levelWidth = built.width
  g.solids = built.solids
  g.enemies = built.enemies
  g.pickups = built.pickups
  g.decals = built.decals
  g.hazards = built.hazards
  g.cars = built.cars
  g.arena = built.arena
  g.arenaLock = false
  g.bullets = []
  g.particles = []
  g.floaters = []
  g.player = makePlayer(72)
  applyLoadout(g)
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
