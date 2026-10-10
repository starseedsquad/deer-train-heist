/** Tuned so crouch, dash, and shooting each solve a different obstacle. */

export const VIEW_W = 960
export const VIEW_H = 540

export const GROUND = 460
export const STAND_H = 64
export const CROUCH_H = 32
export const PLAYER_W = 34

/** Opening under a crawl ceiling. Crouch (32px) fits; standing does not. */
export const CRAWL_CLEAR = 40
export const CEILING_Y = GROUND - CRAWL_CLEAR

export const GRAVITY = 1680
export const JUMP_HEIGHT = 88
export const JUMP_V = -Math.sqrt(2 * GRAVITY * JUMP_HEIGHT)
export const MAX_FALL = 900
export const MOVE_SPEED = 275
export const CROUCH_SPEED = 120
export const SLIDE_SPEED = 370
export const SLIDE_TIME = 0.3
export const AIR_ACCEL = 1600
export const GROUND_ACCEL = 3600

export const DASH_SPEED = 560
export const DASH_TIME = 0.18
export const DASH_COOLDOWN = 0.78

export const MAG_SIZE = 10
export const FIRE_COOLDOWN = 0.2
export const RELOAD_TIME = 0.85
export const MAX_HP = 5

export const BULLET_SPEED = 700
export const BULLET_W = 12
export const BULLET_H = 6

/**
 * Standing gun sits in the head band that a crawl ceiling occupies.
 * Crouch gun sits in the gap, so tunnels must be shot while low.
 */
export const GUN_OFFSET = 14
export const HIGH_SHOT_Y = 408
export const LOW_SHOT_Y = 446

export const CRATE = 46
export const BARRIER_H = 120

export const GAP_EASY = 116
export const GAP_MED = 148
export const GAP_HARD = 196

export const COYOTE = 0.12
export const JUMP_BUFFER = 0.12
export const HURT_TIME = 1.15

export const SCORE_CRATE = 20
export const SCORE_METAL = 40
export const SCORE_ROBOT = 150
export const SCORE_DRONE = 200
export const SCORE_BOSS = 2500
export const SCORE_GEM = 300
export const SCORE_CHEST = 1000
