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
npm run typecheck  # check TypeScript
npm test           # save, progression, freight and settlement regression tests
```

**Always the latest build on phones.** Every build writes `dist/version.json`
with a build id. The game fetches it uncached on start, every 3 minutes and
whenever the app comes back to the foreground; if a newer build is live it
saves and reloads onto it. When hosting, serve `index.html` and
`version.json` with `Cache-Control: no-cache` (the `assets/` files are
content-hashed and can be cached forever).

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
- **Conveyor belts** (Level 5+). Buy a belt and items ride on their own from
  the log pile / kitchen / tailor / smokehouse / coal pile to their stall or
  the furnace. Upgrades speed them up; a full stall backs the line up. A belt
  unlocks only once its chain is fully staffed (e.g. the Food Belt needs the
  Cook, 3 Meat Collectors and 2 Food Runners), and when it's built the haulers
  it replaces retire and their hire pad goes away.
- **Machines** (Level 5+, after the full crew). Each replaces a job and
  brings its own belt; the crew retires: 🪚 Auto-Saw (Lumberjacks, logs →
  log pile), 🔪 Skinning Machine (Meat Collectors: pulls in every kill, meat →
  kitchen, hides → tailor), 🌀 Ice Auger (Fishers, fish → smokehouse),
  ⛏️ Coal Drill (Miners, coal → coal pile) and 🤖 automatons that run the
  kitchen, tailor bench and smokehouse (Cook, Tailor, Smoker). Upgrades stay available beyond Lv3 (capped by settlement level) and make
  gathering, cooking and smoking faster. Camp delivery belts also keep upgrading. The Hunting Tower is the hunting machine; Guards stay human.
- **Cash belts** (after the Log + Food belts and 2 Cash Collectors). Overhead
  money conveyors lift each stall's cash pile into the chest, and two more
  carry the Great Furnace's heat money and wolf bounties (riding higher, over
  the others). Caravan pay is banked automatically. The Cash Collectors
  retire.
- **Endless upgrades.** Stall, workshop, Arrow Damage and Furnace upgrades
  keep going past Lv10 as ⭐ star levels (still capped by settlement level,
  2 + level), so there is always something to buy.
- **Move the Settlement (prestige).** Once the Coal Mine is open, a 🧳 pad by
  the entry road lets you start a fresh camp for ❄️ Frost Stars
  (√(sales this run / 25K)). Stand on it 3 s to confirm. Each star is
  permanent: +10% sales, +2% worker speed (up to +60%), +$1K starting cash
  and better offline earnings. The new camp starts directly after the moving animation; no page reload is required.
- **Offline earnings.** Close the game (or leave it in the background) and
  your crew keeps earning: 40% of your recent income rate (+3% per Frost Star)
  for up to 8 hours, collected from a "While you were away" popup, with a free
  ×2 once a day.
- **Frost Star shop.** The ❄️ button opens a shop: spend Frost Stars on
  permanent perks (Head Start, Veteran Crew, Old Friends, Royal Favor,
  Generous Folk, Greased Gears, Eagle Eye, Night Shift, Lucky Season, Trophy
  Hunter). Spending never lowers the per-star bonuses.
- **Random events** (Level 5+, every ~2–4 min): ❄️ Blizzard (double
  customers who pay double), 🎪 Festival (everyone's a VIP), 💰 Gold Rush
  (cash drops around camp — grab it before it melts), 🐺 Wolf Siege (a
  daylight pack led by a giant alpha).
- **Bosses** (Level 8+): a 🦣 Mammoth or ❄️ Yeti invades the meadow with
  health sized to your tower, fights back, and drops a treasure chest when the
  tower, guards and you bring it down within 2 minutes.
- **Quiet HUD.** Alerts go to the 🔔 dropdown (badge = unread) instead of
  popping up; the task board and furnace status live in the 🎯 dropdown. On
  phones the joystick starts wherever you touch.
- **Prerequisites.** Locked pads say what they need ("Needs Food Runner 1/2 ·
  Cook"). The Ice Fishery needs a full Tannery crew, the Coal Mine a full
  Fishery crew.
- **Ice Fishery** (Level 6, northwest). Fish the holes on the frozen pond,
  smoke the catch at the Smokehouse, sell it at the Fish stall. Hire a Fisher,
  Smoker and Fish Runners.
- **Coal Mine** (Level 8, north). Mine coal seams, feed the Great Furnace by
  camp. Every lump it burns sells heat (cash on the pile beside it, more with
  Furnace upgrades), and while it burns every stall sale pays +25% or more.
  Hire Miners and Coal Carriers.
- **Where does this go?** While you carry something, blue ground arrows point
  to where it's dropped off (coal → furnace, fish → smokehouse, …), with a
  one-time hint per resource. Once the log / coal pile is automated it takes
  matching items back instead of handing them to you.
- **Big game.** Mountain goats (Level 5+) and bears (Level 7+) join the deer;
  they take many hits, drop more meat and hides, and a hurt bear charges and
  swipes you away. More animals roam as the settlement grows.
- **Hungrier survivors.** From Level 4 each survivor buys a bundle, shown as
  ×N over their head (VIPs always the most): up to 5 items by Level 13, then
  +1 every 2 levels, up to 25. From Level 6 a stall piled high with stock
  draws bulk buyers (+1 item per 25 on the shelf, up to double the bundle)
  and more of the crowd, and at high levels survivors arrive faster, so a
  big stockpile sells off instead of piling up.
- **Unlimited storage.** A stall or workshop at its max level (Lv10) never
  fills up.
- **Task board** (Level 3+). Three rotating goals (sell X fish, hunt a bear,
  hit a rush...) pay cash + XP and are replaced by new ones scaled to your
  level. Every level-up also pays a cash gift, and once the objective track is
  done it always points at the next upgrade worth buying.

## The Industrial Park (Level 12+)

South of the camp, behind a wall, a modern park turns the camp's goods into
products that vehicles come to buy. The frozen camp becomes its supply chain.

| Stage | Export line from the camp | Factory → product | Customer |
|---|---|---|---|
| 🏭 Industrial Park (Lv 12) | 🪵 log pile | Furniture Factory → 🪑 furniture | 🚚 trucks queue at the Truck Depot |
| 🚢 Port (Lv 14) | 🪨 coal pile | Steel Mill → 🔩 steel | 🚢 cargo ships dock at the berth |
| ✈️ Airport (Lv 16) | 🧥 tailor + 🍣 smokehouse | Fashion House → 🧥 designer jackets, Cannery → 🥫 canned fish | ✈️ cargo planes land on the runway |

- **Export lines** are overhead conveyors with orange rails, riding above the
  cash belts (the crossing pairs ride at different heights). They share their
  camp source with the stalls: each line gets first pick of only its share
  (40% / 55% / 70% by level) plus anything piling up, so the stalls keep
  selling, and upgrading an export line is a real choice between the two camps.
- **Factories** run on their own (no crew). Upgrades make them faster and,
  at Lv10, give them unlimited storage.
- **Product belts** carry products to the Truck Depot, the Port and the
  Airport. Before they're built, carry products there yourself.
- **Trucks** queue along the depot road and leave once their order is
  loaded. **Ships** and **planes** bring big orders with a timer: fill the
  whole order for a 100% / 150% bonus, or they leave half full. Their orders
  show in a small pill while you're in the park.
- Freight cash rides overhead cash belts into the park's 🏦 Vault. Terminal
  upgrades (Truck Depot + / Port + / Airport +) raise prices, load speed,
  storage, vehicle cargo capacity and frequency. Each terminal upgrade adds 20%
  of the baseline cargo capacity to newly dispatched trucks, ships and planes,
  including past Lv10; active orders keep their current size. Large ship/plane
  orders receive enough loading time to complete. Ships first dispatch after 3 seconds and planes
  after 2 seconds; return waits are 15 / 12 seconds, improving to 6 / 5 seconds
  with terminal upgrades. Travel time is additional. The park HUD shows the next
  dispatch countdown and inbound ETA as well as active orders.
- The objective track, the task board (load trucks, ships, planes) and the
  level-up messages cover the park too. Moving the Settlement resets it with
  everything else.

## Market pressure (Level 8+): demand always outruns you

Every stall and the Truck Depot watch how often they run dry. Keep one
stocked and word spreads: its demand climbs (bigger bundles, more of the
crowd, bigger truck orders, shown as 🔥×N on the stall's roof) until your
supply only just keeps up. Fall behind and it eases off a little, but a
survivor who waits about 20 s at an empty counter walks away (a lost sale,
and your rush breaks). Ships and planes bring bigger orders every time you
fill one fast, and smaller ones after a miss. Upgrading production always
has a payoff: there's always more demand waiting for it.

## More ships and planes, hungrier survivors

- **Extra Berth / Extra Gate** pads at the Port and the Airport add up to 4
  more berths and cargo gates (5 each), so several ships and planes load at
  once from the same stock. They're big late-game money sinks (5B / 8B and
  ×5 per level). Planes park nose-in on a cargo apron north of the runway;
  ships dock side by side along the quay. The HUD pill shows how many are in
  and the order that leaves soonest.
- **Bundles grow with √level** (×2 at Level 4, ×4 at Level 16, ×5 at Level 25),
  on top of market pressure (up to 150 items per survivor). A survivor who
  gives up mid-bundle pays for what they already got.
- **⚙️ Settings → Reset game** wipes everything (money, levels, districts, the
  park, Frost Stars and perks) after a "Do you really want to reset the game
  to start?" warning.

## Your own powers (late game)

- **🚀 Jetpack** (Level 6+, needs Boots maxed, endless levels). You hover and
  fly 1.6× faster, +0.1× per level up to 2.3× walking speed at Lv8 (the max), straight over
  buildings, trees and the caravan; locked district walls still stop you.
  You lean into the flight like a superhero. The 🚀 / 🏃 button switches
  between flying and walking.
- **🔫 Laser Blaster** (Level 7+, needs the Sharp Axe maxed, endless levels).
  You fire a laser on your own at the nearest wolf, bear, goat or boss in
  range. The beam pierces: it hits every monster along its line. Each level
  adds a Sharp Axe hit of damage per shot, fires faster (down to 0.15 s) and
  reaches further (9 m, up to 15 m). Bears and bosses also knock you back
  less (not at all from Level 4).

## Frost Stars late game

Most perks now keep levelling with rising costs (Old Friends, Royal Favor,
Generous Folk, Greased Gears, Night Shift, Trophy Hunter), and three perks
keep your progress when you move:

- **🗺️ Pioneers**: new camps open with the Tannery, then the Fishery, then the
  Coal Mine already built.
- **📐 Blueprints**: every conveyor and cash belt built, then every machine.
- **🏭 Industrial Charter**: the Industrial Park, then the Port, then the
  Airport.

## Tuning notes

- **Hands off (✋ / 🙅 button).** Stops you chopping, fishing, mining and
  picking anything up, so walking around while buying never grabs logs.
  Dropping off, buying and collecting cash still work. Saved with the game.
- **Supply keeps up.** Trees hold 20 logs and regrow in 4 s, fishing holes
  hold 16 fish (3 s), coal seams 20 lumps (6 s), all regrowing faster as the
  settlement grows; animals respawn twice as fast.
- **Upgrades always speed things up.** Every stall level (star levels too)
  hands items over faster, down to 0.025 s per item. Factory upgrades work
  faster and each level turns one input into 10% more products.
- **Belt cap.** Item and cash belts upgrade up to Lv10 (about 12 m/s). Past
  that a belt would outrun what feeds it. Cash belts run twice as fast as item
  belts and carry bigger bundles, so cash doesn't pile up.
- **Calmer sound.** Every sound has a minimum gap and there's a per-second
  budget, so a fully automated camp hums instead of machine-gunning. What
  the camp does on its own (belts, crew, customers, the tower) uses a quieter,
  rarer "ambient" voice; big moments (buying, level-ups, events) always play.
- **Stall counts** sit above the roof so you can read them from the camera.
- **Sound on phones.** Every tap restarts audio if the phone paused it
  (backgrounding, the lock screen or a call). On iPhone, the silent switch
  also mutes the game.

Ground chevrons around the player point at the current objective (gold), a
raiding wolf (red), a waiting caravan (teal) and where your load goes (blue).

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
  Format v3; v1/v2 saves migrate automatically (XP and economy scaling).
  The player's backpack and unclaimed offline earnings survive a refresh;
  claiming a reward immediately saves its cash and daily-double status.
- Physics: intentionally none (proximity checks, circle and box push-out),
  which is cheaper on phones than Rapier for this design; Rapier can be added
  later for ragdolls.

## Dev tools

- 🛠️ button (dev only): money / ⭐ / spawn cheats, night now, +wolf, summon a
  caravan, open each district, +park (the whole Industrial Park), 1×/2×/4× speed, quality presets, live readouts of
  every stall, workshop and worker.
- `window.__sim` — inspect the live sim. `window.__ff(seconds)` — deterministic
  fast-forward. `window.__input` — drive the player (`jx`/`jz`) from a script.
  All dev only.

## Assets

Everything is procedural (code-built meshes, canvas textures, WebAudio synth
SFX) — see `ASSET_PLAN.md` for the free-asset upgrade path (Poly Haven /
Kenney / Quaternius, CC0-first) and `ASSET_LICENSES.md` for the license policy.
`ASSET_BUDGET.md` tracks download weight.
