import { CATALOG, UPGRADES, upgradePrice, WEAPONS } from './armory'
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
    const buttons: Btn[] = [
      { id: 'prev', x: 292, y: 300, w: 52, h: 48, label: '<' },
      { id: 'next', x: 616, y: 300, w: 52, h: 48, label: '>' },
      { id: 'start', x: 352, y: 366, w: 256, h: 54, label: g.selectedLevel > 1 ? 'CONTINUE' : 'START RUN' },
      mute,
    ]
    if (g.chapter2 > 0) {
      buttons.push(
        { id: 'ch1', x: 300, y: 252, w: 160, h: 36, label: g.selectedChapter === 1 ? 'NIGHT *' : 'NIGHT' },
        { id: 'ch2', x: 500, y: 252, w: 160, h: 36, label: g.selectedChapter === 2 ? 'SNOW *' : 'SNOW' },
      )
    }
    if (g.unlocked > 1) buttons.push({ id: 'armory', x: 36, y: 18, w: 132, h: 36, label: 'ARMORY' })
    return buttons
  }
  if (g.mode === 'armory') {
    const buttons: Btn[] = WEAPONS.map((id, index) => {
      const spec = CATALOG[id]
      const owned = g.owned.includes(id)
      const label = !owned ? `${spec.name}  ${spec.price}c` : g.weapon === id ? `${spec.name}  EQUIPPED` : `${spec.name}  EQUIP`
      return { id: `gun-${id}`, x: 48, y: 78 + index * 62, w: 420, h: 54, label }
    })
    UPGRADES.forEach((up, index) => {
      const price = upgradePrice(g.ranks, up.id)
      const rank = g.ranks[up.id]
      const label = price === null ? `${up.name}  MAX` : `${up.name} ${rank}/3  ${price}c`
      buttons.push({ id: `up-${up.id}`, x: 500, y: 78 + index * 52, w: 412, h: 46, label })
    })
    buttons.push({
      id: 'continue',
      x: 300,
      y: 478,
      w: 360,
      h: 46,
      label: g.armoryFrom === 'next' ? 'NEXT CAR' : 'BACK',
    })
    return buttons
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
      { id: 'armory', x: 360, y: 332, w: 240, h: 44, label: 'ARMORY' },
      { id: 'nextlevel', x: 360, y: 386, w: 240, h: 48, label: 'NEXT CAR' },
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

