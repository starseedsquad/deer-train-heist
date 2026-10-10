import { VIEW_H, VIEW_W } from './constants'
import type { InputState } from './types'
import { emptyInput } from './types'

const HOLD = ['left', 'right', 'jump', 'crouch', 'shoot', 'dash', 'reload', 'pause', 'confirm', 'mute'] as const
type Hold = (typeof HOLD)[number]

function actionsFor(code: string): Hold[] {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      return ['left']
    case 'ArrowRight':
    case 'KeyD':
      return ['right']
    case 'ArrowUp':
    case 'KeyW':
      return ['jump']
    case 'Space':
      return ['jump', 'confirm']
    case 'ArrowDown':
    case 'KeyS':
    case 'KeyC':
      return ['crouch']
    case 'ShiftLeft':
    case 'ShiftRight':
    case 'KeyK':
      return ['dash']
    case 'KeyJ':
    case 'KeyX':
    case 'KeyZ':
      return ['shoot']
    case 'KeyR':
      return ['reload']
    case 'KeyP':
    case 'Escape':
      return ['pause']
    case 'Enter':
      return ['confirm']
    case 'KeyM':
      return ['mute']
    default:
      return []
  }
}

export class Input {
  private down = new Set<string>()
  private pressed = new Set<string>()
  private click = false
  private clickX = 0
  private clickY = 0

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return
      const actions = actionsFor(event.code)
      if (actions.length === 0) return
      event.preventDefault()
      for (const action of actions) {
        this.down.add(action)
        this.pressed.add(action)
      }
    })
    window.addEventListener('keyup', (event) => {
      for (const action of actionsFor(event.code)) this.down.delete(action)
    })
    window.addEventListener('blur', () => this.down.clear())
    canvas.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('#touch')) return
      const point = this.local(canvas, event)
      this.click = true
      this.clickX = point.x
      this.clickY = point.y
    })
    document.querySelectorAll<HTMLElement>('[data-hold]').forEach((el) => {
      const action = el.dataset.hold
      if (!action) return
      el.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.down.add(action)
        this.pressed.add(action)
        el.setPointerCapture(event.pointerId)
      })
      const release = (event: PointerEvent) => {
        this.down.delete(action)
        if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      }
      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
    })
  }

  read(): InputState {
    const input = emptyInput()
    input.left = this.down.has('left')
    input.right = this.down.has('right')
    input.jump = this.down.has('jump')
    input.crouch = this.down.has('crouch')
    input.shoot = this.down.has('shoot')
    input.reload = this.down.has('reload')
    input.jumpPressed = this.pressed.has('jump')
    input.dashPressed = this.pressed.has('dash')
    input.shootPressed = this.pressed.has('shoot')
    input.pausePressed = this.pressed.has('pause')
    input.confirmPressed = this.pressed.has('confirm')
    input.mutePressed = this.pressed.has('mute')
    input.reloadPressed = this.pressed.has('reload')
    input.leftPressed = this.pressed.has('left')
    input.rightPressed = this.pressed.has('right')
    input.click = this.click
    input.clickX = this.clickX
    input.clickY = this.clickY
    this.pressed.clear()
    this.click = false
    return input
  }

  private local(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
    }
  }
}
