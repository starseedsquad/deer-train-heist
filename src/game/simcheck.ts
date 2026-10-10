import { buyWeapon } from './armory'
import { CEILING_Y, CROUCH_H, GROUND, HIGH_SHOT_Y, LOW_SHOT_Y, STAND_H, BULLET_H, PLAYER_W } from './constants'
import { createAutopilot } from './autopilot'
import { shieldVerdict } from './combat'
import { buildLevel, createGame, loadLevel } from './levels'
import { overlaps } from './physics'
import { defaultSave, encodeSave } from './save'
import type { BossId, Bullet, ChapterId, Enemy } from './types'
import { emptyInput } from './types'
import { update } from './update'

function assertDodgeRules(): void {
  const crouch = { x: 0, y: GROUND - CROUCH_H, w: PLAYER_W, h: CROUCH_H }
  const stand = { x: 0, y: GROUND - STAND_H, w: PLAYER_W, h: STAND_H }
  const high = { x: 8, y: HIGH_SHOT_Y, w: 12, h: BULLET_H }
  const low = { x: 8, y: LOW_SHOT_Y, w: 16, h: BULLET_H }
  const ceiling = { x: -20, y: 24, w: 200, h: CEILING_Y - 24 }
  const standGun = { x: 20, y: stand.y + 14, w: 12, h: BULLET_H }
  const crouchGun = { x: 20, y: crouch.y + 14, w: 12, h: BULLET_H }
  if (overlaps(crouch, high)) throw new Error('crouch should slip under a high shot')
  if (!overlaps(stand, high)) throw new Error('standing should catch a high shot')
  if (!overlaps(crouch, low) || !overlaps(stand, low)) throw new Error('low shots should hit both stances')
  if (!overlaps(stand, ceiling)) throw new Error('standing should not fit a crawl')
  if (overlaps(crouch, ceiling)) throw new Error('crouch should fit a crawl')
  if (!overlaps(standGun, ceiling)) throw new Error('standing shot should hit the crawl ceiling')
  if (overlaps(crouchGun, ceiling)) throw new Error('crouch shot should clear the crawl ceiling')
}

function dump(g: ReturnType<typeof createGame>): string {
  const p = g.player
  const near = g.solids
    .filter((s) => Math.abs(s.x - p.x) < 180 && s.kind !== 'floor')
    .map((s) => `${s.kind}@${Math.round(s.x)},${Math.round(s.y)} ${Math.round(s.w)}x${Math.round(s.h)} hp${s.hp}`)
    .join(' | ')
  const foes = g.enemies
    .filter((e) => e.alive)
    .map((e) => `${e.kind}${e.boss ?? ''}@${Math.round(e.x)} hp${e.hp}`)
    .join(' | ')
  return `L${g.levelId} ${g.levelName} mode=${g.mode} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} h=${p.h} hp=${p.hp} ammo=${p.ammo} t=${g.levelTime.toFixed(1)} near=${near} foes=${foes}`
}

function runThrough(target: number): { ok: boolean; reason: string } {
  const game = createGame(defaultSave())
  const bot = createAutopilot()
  let time = 0
  let levelTimer = 0
  let seenLevel = 0
  let loggedClear = 0
  const limit = target * 80
  while (time < limit) {
    if (game.mode === 'gameover') return { ok: false, reason: `died ${dump(game)}` }
    if (game.mode === 'complete' && game.levelId >= target) {
      const s = game.stats
      if (s.jumps < 1 || s.dashes < 1 || s.crouchTime < 0.2 || s.shots < 1 || s.cratesBroken < 1 || s.bosses < 1) {
        return { ok: false, reason: `missing moves ${JSON.stringify(s)}` }
      }
      return { ok: true, reason: `cleared ${target} in ${time.toFixed(1)}s score=${game.score} ${JSON.stringify(s)}` }
    }
    if (game.mode === 'playing' && game.levelId !== seenLevel) {
      seenLevel = game.levelId
      levelTimer = 0
      console.log(`enter ${game.levelId} ${game.levelName}`)
    }
    if (game.mode === 'complete' && loggedClear !== game.levelId) {
      loggedClear = game.levelId
      console.log(`cleared ${game.levelId} ${game.levelName} hp=${game.player.hp} score=${game.score}`)
    }
    const input = bot(game, 1 / 60)
    update(game, input, 1 / 60)
    time += 1 / 60
    if (game.mode === 'playing') levelTimer += 1 / 60
    if (game.mode === 'playing' && levelTimer > 75) return { ok: false, reason: `stuck ${dump(game)}` }
  }
  return { ok: false, reason: `timeout ${dump(game)}` }
}

function assertShield(): void {
  const shield = { kind: 'shield', facing: -1, y: 400 } as Enemy
  if (shieldVerdict(shield, { vx: 200, y: 400 } as Bullet) !== 'block') throw new Error('shield should block a frontal shot')
  if (shieldVerdict(shield, { vx: 200, y: 431 } as Bullet) !== 'hit') throw new Error('shield should take a crouch shot')
  if (shieldVerdict(shield, { vx: -200, y: 400 } as Bullet) !== 'hit') throw new Error('shield should take a shot from behind')
}

function assertArmorySave(): void {
  const save = defaultSave()
  save.coins = 30
  const game = createGame(save)
  if (!buyWeapon(game, 'shotgun')) throw new Error('shotgun should be affordable')
  if (game.coins !== 22 || game.weapon !== 'shotgun' || !game.owned.includes('shotgun')) {
    throw new Error(`armory buy failed coins=${game.coins} gun=${game.weapon}`)
  }
  const again = createGame(encodeSave(game))
  if (again.coins !== 22 || again.weapon !== 'shotgun' || !again.owned.includes('shotgun')) {
    throw new Error('armory save did not round-trip')
  }
}

function assertChapter(): void {
  if (buildLevel(5, 2).boss !== 'ram' || buildLevel(10, 2).boss !== 'hawk' || buildLevel(15, 2).boss !== 'summit') {
    throw new Error('snow bosses are in the wrong cars')
  }
  if (!buildLevel(2, 2).hazards.some((hazard) => hazard.kind === 'rail')) throw new Error('snow car 2 should have a live rail')
  if (!buildLevel(4, 2).hazards.some((hazard) => hazard.kind === 'wind')) throw new Error('snow car 4 should have wind')
  if (!buildLevel(6, 2).hazards.some((hazard) => hazard.kind === 'debris')) throw new Error('snow car 6 should drop debris')
  if (!buildLevel(1, 2).solids.some((solid) => solid.kind === 'cargo')) throw new Error('snow car 1 should have cargo')
  if (!buildLevel(6).enemies.some((enemy) => enemy.kind === 'shield')) throw new Error('night car 6 should introduce shields')
  if (buildLevel(1).enemies.some((enemy) => enemy.kind === 'shield')) throw new Error('car 1 should stay a simple yard')
}

function assertArenas(): void {
  const fights: { id: number; chapter: ChapterId; boss: BossId }[] = [
    { id: 5, chapter: 1, boss: 'mech' },
    { id: 10, chapter: 1, boss: 'conductor' },
    { id: 15, chapter: 1, boss: 'turret' },
    { id: 5, chapter: 2, boss: 'ram' },
    { id: 10, chapter: 2, boss: 'hawk' },
    { id: 15, chapter: 2, boss: 'summit' },
  ]
  for (const fight of fights) {
    const built = buildLevel(fight.id, fight.chapter)
    const foe = built.enemies.find((enemy) => enemy.kind === 'boss')
    const wall = built.solids.find((solid) => solid.kind === 'steel' && solid.y < 0 && solid.x >= (foe?.x ?? 0))
    if (built.boss !== fight.boss || !built.arena || !foe || !wall) throw new Error(`${fight.boss} arena missing`)
    if (wall.y > -100 || wall.y + wall.h < GROUND) throw new Error(`${fight.boss} backstop is too short to stop a jump`)
    if (wall.x > foe.x + 80) throw new Error(`${fight.boss} backstop leaves a pocket behind the boss`)
    const game = createGame(defaultSave())
    game.chapter = fight.chapter
    loadLevel(game, fight.id)
    const boss = game.enemies.find((enemy) => enemy.kind === 'boss')
    if (!boss || !game.arena) throw new Error(`${fight.boss} did not spawn`)
    boss.intro = 0
    game.player.x = boss.x - 16
    game.player.y = GROUND - STAND_H - 70
    game.player.onGround = false
    game.player.vy = -280
    const input = emptyInput()
    input.right = true
    for (let i = 0; i < 240; i++) {
      game.player.hurtT = 30
      if (i % 45 === 0) {
        game.player.dashCd = 0
        input.dashPressed = true
        const airborne = i % 90 !== 0
        game.player.y = airborne ? GROUND - STAND_H - 76 : GROUND - STAND_H
        game.player.vy = airborne ? -360 : 0
        game.player.onGround = !airborne
      } else input.dashPressed = false
      input.jumpPressed = i % 45 === 8
      update(game, input, 1 / 60)
      if (game.mode !== 'playing') throw new Error(`${fight.boss} left the fight (${game.mode})`)
      const wallX = game.arena.x + game.arena.w
      const limit = boss.alive ? Math.min(wallX, boss.x) : wallX
      if (game.player.x + game.player.w > limit + 0.75) {
        throw new Error(`${fight.boss} slipped behind x=${game.player.x.toFixed(1)} boss=${boss.x.toFixed(1)} wall=${wallX.toFixed(1)}`)
      }
      if (!game.arenaLock) continue
      const max = game.arena.x + game.arena.w - 960
      if (game.camX < game.arena.x - 0.5 || game.camX > max + 0.5) {
        throw new Error(`${fight.boss} camera left the arena cam=${game.camX.toFixed(1)}`)
      }
    }
    if (!game.arenaLock) throw new Error(`${fight.boss} camera never locked`)
    console.log(`arena ${fight.boss} held`)
  }
}

assertDodgeRules()
assertShield()
assertArmorySave()
assertChapter()
assertArenas()
const generated = buildLevel(20)
if (
  generated.boss !== 'conductor' ||
  generated.width < 1500 ||
  generated.enemies.every((enemy) => enemy.kind !== 'boss') ||
  !generated.arena
) {
  throw new Error('level generator did not scale to a later boss')
}
const target = Number(process.argv[2] ?? 5)
const result = runThrough(target)
console.log(result.reason)
if (!result.ok) process.exit(1)
console.log('sim ok')
