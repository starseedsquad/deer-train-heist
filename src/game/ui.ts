import { VIEW_W } from './constants'
import type { Game } from './types'

export interface Btn {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

export function layoutButtons(g: Game): Btn[] {
  const mute: Btn = {
    id: 'mute',
    x: VIEW_W - 118,
    y: 14,
    w: 102,
    h: 34,
    label: g.muted ? 'SOUND' : 'MUTE',
  }
  if (g.mode === 'title') {
    return [
      { id: 'prev', x: 292, y: 300, w: 52, h: 48, label: '<' },
      { id: 'next', x: 616, y: 300, w: 52, h: 48, label: '>' },
      { id: 'start', x: 352, y: 366, w: 256, h: 54, label: g.selectedLevel > 1 ? 'CONTINUE' : 'START RUN' },
      mute,
    ]
  }
  if (g.mode === 'paused') {
    return [
      { id: 'resume', x: 360, y: 220, w: 240, h: 48, label: 'RESUME' },
      { id: 'retry', x: 360, y: 280, w: 240, h: 48, label: 'RETRY LEVEL' },
      { id: 'title', x: 360, y: 340, w: 240, h: 48, label: 'TITLE' },
      mute,
    ]
  }
  if (g.mode === 'complete') {
    return [
      { id: 'nextlevel', x: 360, y: 360, w: 240, h: 50, label: 'NEXT CAR' },
      mute,
    ]
  }
  if (g.mode === 'gameover') {
    return [
      { id: 'retry', x: 360, y: 320, w: 240, h: 48, label: 'TRY AGAIN' },
      { id: 'title', x: 360, y: 380, w: 240, h: 48, label: 'TITLE' },
      mute,
    ]
  }
  return [
    { id: 'pause', x: VIEW_W - 64, y: 12, w: 48, h: 32, label: 'II' },
    { id: 'mute', x: VIEW_W - 120, y: 12, w: 48, h: 32, label: g.muted ? 'M' : 'M' },
  ]
}

export function hitButton(btns: Btn[], x: number, y: number): string | null {
  for (let i = btns.length - 1; i >= 0; i--) {
    const b = btns[i]
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id
  }
  return null
}

