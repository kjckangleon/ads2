# FROSTLINE

*Feed them. Warm them. Build the machine.*

A 3D frozen-survival **queue-tycoon** for browser & mobile. Survivors physically
line up for wood and cooked meat; you start by doing every job yourself and
gradually replace yourself with an archer tower, collectors, cooks, runners and
cash collectors until the settlement runs itself — and the next bottleneck
appears.

## Run

```bash
npm install
npm run dev        # dev server (has debug panel + window.__ff fast-forward)
npm run build      # production build (debug excluded)
npm run preview    # serve the production build
```

## Controls

- **Desktop:** WASD / arrow keys to move.
- **Mobile:** floating virtual joystick (touch the lower-left half).
- Everything else is proximity-automatic: walk near trees to chop, near animals
  to hunt, near drops to pick up, into station zones to deposit/collect, onto
  glowing pads to buy (coins drain in while you stand there).

## The loop

1. Chop pines (west) → stock the **wood stall** → customers pay → grab the cash.
2. Build the **meat stall** + cook fire. Hunt deer (east meadow), cook raw meat
   at the fire (stand at the work spot), stock the counter.
3. Build the **hunting tower** — it shoots deer for you (visible arrows).
4. Hire helpers as soon as their station exists: **Lumberjack** (after your
   first 4 wood sales) and **Log Carrier** for wood; **Cook, Meat Collector,
   Food Runner** the moment the Meat Stall is built; **Cash Collector** after
   $300 collected. Each hire removes one manual job. Hires you can't afford yet
   show greyed out with what they need.
5. Upgrade stations, kitchen, tower (damage/rate/range → extra arrows at
   4/10/18 total levels) and yourself (boots, backpack, sharp axe). Queues,
   ground meat piles, full kitchens and coin piles *are* the dashboard — look at
   the world to find the bottleneck.

## Arcade feel

Tuned like an idle-arcade mobile ad: short actions, big numbers, and a reward
on screen every few seconds.

- **Tempo:** fast player (6.2 m/s), near-instant chopping (0.22 s per log),
  items transfer at 20/s, customers arrive every ~2 s, kitchen cooks in 0.7 s.
  A queue is already waiting on the first frame. The meat chain is fully
  automated by about 3 minutes and something is bought every ~6 s on average.
- **Stacks:** carry 8 → 26 items. The stack is instanced, every item pops in
  with a bounce, and the tower leans and wobbles behind you on a spring as you
  run and turn. A MAX tag bounces when you're full.
- **Physical inventory:** stalls and workshop tables show every item they
  hold (crisscross log piles, rows of meat, folded coats). Each delivery
  squashes the stall.
- **Cash:** money is green cash bundles that stack into towers at each pay
  spot. Bills stream from you into a pad while you pay, and the HUD counter
  rolls up and bumps. Buying something throws confetti and buzzes the phone
  (Android).
- **Feedback:** stack/unstack sounds climb in pitch, logs fly off the tree onto
  your stack, served items fly to the customer, snow puffs when running,
  buildings spring up with overshoot, and affordable pads hop.

## Late game: what keeps it moving

Once food runs itself, new pressure and new goals arrive in turn:

- **Rush & tips.** A customer served without waiting at an empty stall tips
  and adds to the 🔥 RUSH multiplier (up to ×2). Leaving someone stuck at an
  empty stall for 14 s makes them angry and breaks the rush. VIPs (gold coats)
  pay ×4.
- **Settlement levels.** Every serve, caravan, night and wolf kill earns ⭐ XP.
  Levels bring more customers and raise the cap on stall / workshop / tower
  upgrades (Lv10 max). Capped pads show a 🔒 with the level they need.
- **Night raids.** Once a Food Runner is hired, a day/night cycle starts. Each
  night a wolf pack (growing every night) goes for ground meat, the kitchen
  and the meat counter. The tower shoots wolves first, you can fight them, and
  Guards (up to 3) patrol and chase. A night with nothing stolen pays a defense
  bonus at the tower. Cold nights also send more customers to the wood stall.
- **Trade caravans** (Level 3+). A sled parks at the west gate with a timed
  bulk order for logs / food / coats. Only you can fill it, and every log you
  divert is one the wood stall doesn't get.
- **The Tannery** (Level 4, east). A locked district behind a snowdrift
  barrier: deer and wolves now drop hides → tailor bench → coats → Coat stall.
  Craft the first coats by hand, then hire a Tailor and Coat Runners.
- **Crew upgrades.** Worker Boots / Worker Packs make every worker faster and
  carry more; Wild Game raises the deer population. The camera pulls back as
  the settlement grows.

Ground chevrons around the player point at the current objective (gold), a
raiding wolf (red) and a waiting caravan (teal).

## Architecture

- **Simulation** (`src/game/`): one mutable `Sim` object (`state.ts`), ticked
  once per frame (`update.ts`) by systems in `src/game/systems/`: customers &
  queues, player, animals, wolves, day/night clock, tower/projectiles, workers
  (fetch/deliver modes + reservations shared by all carrying roles),
  processors (kitchen and tailor share one implementation), caravans,
  economy/pads, progress (XP, rush, banners), objectives + guides. Zero React
  state per frame; the HUD syncs at 10 Hz via zustand.
- **Rendering** (`src/render/`): React-Three-Fiber views that *read* the sim —
  pooled character rigs (merged vertex-colored geometry, shared materials),
  instanced forest/rocks/particles, emoji-canvas icons, staged inventory piles,
  an fx queue (floating text, bursts, coin/item flights, camera shake).
- **Balance** (`src/game/balance.ts`): every tuning number in one file,
  including derived-stat helpers shared by upgrades and the save loader.
- **Save** (`src/game/save.ts`): LocalStorage, autosave every 5 s + on purchase.
  Format v2; v1 saves migrate automatically (lifetime serves → settlement XP).
- Physics: intentionally none (proximity checks, circle and box push-out),
  which is cheaper on phones than Rapier for this design; Rapier can be added
  later for ragdolls.

## Dev tools

- 🛠️ button (dev only): money / ⭐ / spawn cheats, night now, +wolf, summon a
  caravan, open the Tannery, 1×/2×/4× speed, quality presets, live readouts of
  every stall, workshop and worker.
- `window.__sim` — inspect the live sim. `window.__ff(seconds)` — deterministic
  fast-forward. `window.__input` — drive the player (`jx`/`jz`) from a script.
  All dev only.

## Assets

Everything is procedural (code-built meshes, canvas textures, WebAudio synth
SFX) — see `ASSET_PLAN.md` for the free-asset upgrade path (Poly Haven /
Kenney / Quaternius, CC0-first) and `ASSET_LICENSES.md` for the license policy.
`ASSET_BUDGET.md` tracks download weight.
