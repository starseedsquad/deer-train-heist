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

Progress (furthest car, snow line, best score, coins, guns, upgrades, mute) is stored in `localStorage`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or A / D | Left and right buttons |
| Jump | Space, W, or Up | Jump |
| Crouch / slide | Down, S, or C | Crouch (hold) |
| Dash | Shift or K | Dash |
| Shoot | Left click (hold), J, or X | Fire |
| Switch gun | 1–5 or the mouse wheel | Gun |
| Reload | R, or automatic when the magazine is empty | Automatic |
| Pause | Esc or P | II |
| Mute | M | Mute |

Dash is a short burst with a cooldown, on the ground or in the air. Hold crouch to shrink your hitbox. A running crouch slides. High security shots pass over a crouch. Low shots have to be jumped. Some gaps between cars are too wide to clear without a dash.

Hold the left mouse button to keep firing, the same way holding J or X does. The charge rifle is the exception: hold to charge, release to fire. Clicks on the on-screen buttons still press those buttons. The touch Fire button is unchanged. Gun cycles the weapons you already own.

## Armory

Each gem and the chest pay coins. After a car, Armory opens a shop. The same shop is on the title once car 1 is cleared. Prices stay in `localStorage` with the rest of the save (`antler-express-v1`).

| Gun | What it does |
| --- | --- |
| Revolver | The starting sidearm. Owned from the first run. |
| Scattergun | Short-range spread. Damage ranks add pellets. |
| Antler SMG | A fast, light magazine. |
| Charge rifle | Hold, then release. A full charge pierces. |
| Haul rocket | Slow, explosive, and it breaks metal barriers in one hit. |

Upgrades run three ranks: damage, fire rate, ammo and reload, max health, dash cooldown, and armor. Armor shrugs off every few hits. A full clear of the night line buys a couple of guns and a few ranks, not the whole wall.

## Shooting the scenery

- Wooden crates break in one or two shots. Stacks fall if you shoot the bottom.
- Metal barriers take several hits and are too tall to jump.
- Steel ceilings, gates, and pillars do not break. Crouch through the gap underneath.
- Robot fire also chews up destructible cover.

## Levels

### Night line

Fifteen cars are hand-built and get meaner. From car 6 the yard adds new machines, and their health scales as the cars go on:

- Shield robots block a shot to the plate. Crouch and shoot under it, or hit them from behind.
- Drones hover and mix their fire.
- Dashers lunge. Grenadiers lob arcs. Heavies shrug off light rounds. Snipers paint a laser, then fire.

Cars 5, 10, and 15 are bosses (Iron Warden, the Conductor, Loco-Lock) with their own health bars and patterns. A bulkhead seals the far side of every boss room, so a dash or an air dash cannot slip behind them, and the camera stays on the arena once you enter it. After car 15 the night line keeps going, generated from the same knobs, with a boss every five cars. Beating car 15 also opens the snow line.

### Snow line

The white line is a mountain railway: moving cargo, live rails that pulse, crosswinds on the gaps, ice tunnels, and falling debris. Its bosses are the Glacier Ram, the Whiteout Hawk, and the Summit Breaker, again every five cars, and the same arena seal holds. After car 15 the snow line keeps generating.

On the title screen, left and right pick any unlocked car. Night and Snow appear once the snow line is open.

## Checks

`npm run sim` drives an autopilot from car 1 through the first boss and checks that jumping, crouching, dashing, shooting, and breaking cover all happened.

`?debug=1` draws hitboxes. `?level=5&play=1` starts on a chosen car. `?touch=1` forces the on-screen buttons.
