import { CEILING_Y, CROUCH_H, GROUND, HIGH_SHOT_Y, LOW_SHOT_Y, STAND_H, BULLET_H, PLAYER_W } from './constants'
import { createAutopilot } from './autopilot'
import { buildLevel, createGame } from './levels'
import { overlaps } from './physics'
import { defaultSave } from './save'
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

assertDodgeRules()
const generated = buildLevel(20)
if (generated.boss !== 'conductor' || generated.width < 1500 || generated.enemies.every((enemy) => enemy.kind !== 'boss')) {
  throw new Error('level generator did not scale to a later boss')
}
const target = Number(process.argv[2] ?? 5)
const result = runThrough(target)
console.log(result.reason)
if (!result.ok) process.exit(1)
console.log('sim ok')
