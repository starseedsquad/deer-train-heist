export type Mode = 'title' | 'playing' | 'paused' | 'complete' | 'gameover'

export type SolidKind =
  | 'floor'
  | 'crate'
  | 'metal'
  | 'barrier'
  | 'steel'
  | 'platform'
  | 'piston'
  | 'gate'

export type EnemyKind = 'patrol' | 'shooter' | 'drone' | 'boss'
export type BossId = 'mech' | 'conductor' | 'turret'
export type ShotStyle = 'high' | 'low' | 'mix'
export type Dodge = 'high' | 'low' | 'any'

export interface Solid {
  id: number
  x: number
  y: number
  w: number
  h: number
  kind: SolidKind
  hp: number
  maxHp: number
  destructible: boolean
  anchored: boolean
  dynamic: boolean
  oneWay: boolean
  collides: boolean
  vx: number
  vy: number
  move: 'none' | 'sine-x'
  originX: number
  originY: number
  amp: number
  period: number
  phase: number
  hitFlash: number
  dx: number
  triggered: boolean
}

export interface Enemy {
  id: number
  kind: EnemyKind
  boss: BossId | null
  name: string
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  facing: 1 | -1
  minX: number
  maxX: number
  baseY: number
  cooldown: number
  shotInterval: number
  shot: ShotStyle
  speed: number
  phase: string
  phaseT: number
  cycle: number
  hurtT: number
  alive: boolean
  deathT: number
  scored: boolean
  spawnedAdds: number
  beam: boolean
  intro: number
  onGround: boolean
}

export interface Bullet {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  life: number
  friendly: boolean
  damage: number
  dodge: Dodge
  gravity: boolean
}

export interface Pickup {
  x: number
  y: number
  w: number
  h: number
  kind: 'ammo' | 'heart' | 'gem' | 'chest'
  taken: boolean
  locked: boolean
  bob: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  grav: boolean
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  color: string
}

export interface Decal {
  x: number
  y: number
  text: string
}

export interface Trail {
  x: number
  y: number
  h: number
  facing: 1 | -1
  life: number
}

export interface Player {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  facing: 1 | -1
  onGround: boolean
  wasOnGround: boolean
  crouching: boolean
  slideT: number
  dashT: number
  dashCd: number
  fireCd: number
  ammo: number
  reloading: boolean
  reloadT: number
  hp: number
  hurtT: number
  coyote: number
  jumpBuf: number
  jumpCut: boolean
  shootFlash: number
  anim: number
  alive: boolean
  deadT: number
  platformId: number
  checkpointX: number
  checkpointY: number
  trail: Trail[]
}

export interface Stats {
  jumps: number
  dashes: number
  crouchTime: number
  shots: number
  cratesBroken: number
  bosses: number
}

export interface InputState {
  left: boolean
  right: boolean
  jump: boolean
  crouch: boolean
  shoot: boolean
  reload: boolean
  jumpPressed: boolean
  dashPressed: boolean
  shootPressed: boolean
  pausePressed: boolean
  confirmPressed: boolean
  mutePressed: boolean
  reloadPressed: boolean
  leftPressed: boolean
  rightPressed: boolean
  click: boolean
  clickX: number
  clickY: number
}

export interface Game {
  mode: Mode
  levelId: number
  levelName: string
  bossName: string
  levelWidth: number
  solids: Solid[]
  enemies: Enemy[]
  bullets: Bullet[]
  pickups: Pickup[]
  particles: Particle[]
  floaters: Floater[]
  decals: Decal[]
  player: Player
  camX: number
  shake: number
  time: number
  levelTime: number
  score: number
  levelScore: number
  runTreasure: number
  levelTreasure: number
  timeBonus: number
  message: string
  messageT: number
  selectedLevel: number
  unlocked: number
  highScore: number
  lifetimeTreasure: number
  muted: boolean
  bossIntro: boolean
  bossDeathT: number
  nextId: number
  stats: Stats
  debug: boolean
  onSfx?: (name: string) => void
}

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    jump: false,
    crouch: false,
    shoot: false,
    reload: false,
    jumpPressed: false,
    dashPressed: false,
    shootPressed: false,
    pausePressed: false,
    confirmPressed: false,
    mutePressed: false,
    reloadPressed: false,
    leftPressed: false,
    rightPressed: false,
    click: false,
    clickX: 0,
    clickY: 0,
  }
}

export function emptyStats(): Stats {
  return { jumps: 0, dashes: 0, crouchTime: 0, shots: 0, cratesBroken: 0, bosses: 0 }
}
