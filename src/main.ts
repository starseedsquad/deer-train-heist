import { AudioBus, type SfxName } from './game/audio'
import { createGame, loadLevel } from './game/levels'
import { Input } from './game/input'
import { render } from './game/render'
import { loadSave } from './game/save'
import { update } from './game/update'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Missing canvas')
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Missing 2d context')

const params = new URLSearchParams(location.search)
const save = loadSave()
const game = createGame(save)
const levelParam = Number(params.get('level') || 0)
if (levelParam > 0) {
  game.selectedLevel = levelParam
  game.unlocked = Math.max(game.unlocked, levelParam)
  if (params.has('play')) loadLevel(game, levelParam)
}
game.debug = params.has('debug')
if (game.debug) (globalThis as { __antler?: typeof game }).__antler = game
if (params.has('touch')) document.querySelector('#touch')?.classList.add('force')

const audio = new AudioBus()
const input = new Input(canvas)
game.onSfx = (name) => {
  audio.muted = game.muted
  audio.unlock()
  audio.play(name as SfxName)
}

window.addEventListener('pointerdown', () => audio.unlock(), { passive: true })
window.addEventListener('keydown', () => audio.unlock())
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') game.mode = 'paused'
})

let last = performance.now()
let acc = 0

function frame(now: number): void {
  const delta = Math.min(0.05, (now - last) / 1000)
  last = now
  acc += delta
  audio.muted = game.muted
  audio.update()
  let steps = 0
  while (acc >= 1 / 60 && steps < 5) {
    update(game, input.read(), 1 / 60)
    acc -= 1 / 60
    steps++
  }
  if (steps === 5) acc = 0
  render(ctx!, game)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
