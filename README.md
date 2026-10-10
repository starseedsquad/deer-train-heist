# Antler Express

A deer with a revolver is robbing trains. Run, jump, crouch, and dash through passenger cars, shoot security robots, break the crates in your way, and get the haul off each car. Every fifth car is a boss.

The game is a static Vite + TypeScript canvas app. `npm run build` writes a `dist/` folder Vercel can host as-is.

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints. Production build:

```bash
npm run build
npm run preview
```

Progress (furthest car, best score, lifetime haul, mute) is stored in `localStorage`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or A / D | Left and right buttons |
| Jump | Space, W, or Up | Jump |
| Crouch / slide | Down, S, or C | Crouch (hold) |
| Dash | Shift or K | Dash |
| Shoot | Left click (hold), J, or X | Fire |
| Reload | R, or automatic when the cylinder is empty | Automatic |
| Pause | Esc or P | II |
| Mute | M | Mute |

Dash is a short burst with a cooldown, on the ground or in the air. Hold crouch to shrink your hitbox. A running crouch slides. High security shots pass over a crouch. Low shots have to be jumped. Some gaps between cars are too wide to clear without a dash.

Hold the left mouse button to keep firing, the same way holding J or X does. Clicks on the on-screen buttons still press those buttons. The touch Fire button is unchanged.

## Shooting the scenery

- Wooden crates break in one or two shots. Stacks fall if you shoot the bottom.
- Metal barriers take several hits and are too tall to jump.
- Steel ceilings, gates, and pillars do not break. Crouch through the gap underneath.
- Robot fire also chews up destructible cover.

## Levels

Fifteen cars are hand-built and get meaner: more robots, low shots, crawl tunnels, pistons, drones, and dash gaps. Cars 5, 10, and 15 are bosses (Iron Warden, the Conductor, Loco-Lock) with their own health bars and patterns. After car 15 the line keeps going, generated from the same difficulty knobs, with a boss every five cars.

On the title screen, left and right pick any unlocked car.

## Checks

`npm run sim` drives an autopilot from car 1 through the first boss and checks that jumping, crouching, dashing, shooting, and breaking cover all happened.

`?debug=1` draws hitboxes. `?level=5&play=1` starts on a chosen car. `?touch=1` forces the on-screen buttons.
