import { VIEW_H, VIEW_W } from './constants'
import type { Game, InputState } from './types'
import { emptyInput } from './types'
import { hitButton, layoutButtons } from './ui'

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
  private mouseDown = false
  private mouseEdge = false
  private mouseId: number | null = null

  constructor(canvas: HTMLCanvasElement, game: Game) {
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
    window.addEventListener('blur', () => {
      this.down.clear()
      this.mouseDown = false
      this.mouseId = null
    })
    const endMouse = (event: PointerEvent) => {
      if (this.mouseId !== event.pointerId) return
      this.mouseDown = false
      this.mouseId = null
    }
    window.addEventListener('pointerup', endMouse)
    window.addEventListener('pointercancel', endMouse)
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    canvas.addEventListener('selectstart', (event) => event.preventDefault())
    canvas.addEventListener('dragstart', (event) => event.preventDefault())
    canvas.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('#touch')) return
      event.preventDefault()
      if (event.button !== 0) return
      const point = this.local(canvas, event)
      this.click = true
      this.clickX = point.x
      this.clickY = point.y
      const onButton = hitButton(layoutButtons(game), point.x, point.y) !== null
      if (event.pointerType === 'mouse' && event.button === 0 && !onButton) {
        this.mouseDown = true
        this.mouseEdge = true
        this.mouseId = event.pointerId
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          /* pointer already released */
        }
      }
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
    input.shoot = this.down.has('shoot') || this.mouseDown
    input.reload = this.down.has('reload')
    input.jumpPressed = this.pressed.has('jump')
    input.dashPressed = this.pressed.has('dash')
    input.shootPressed = this.pressed.has('shoot') || this.mouseEdge
    this.mouseEdge = false
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
