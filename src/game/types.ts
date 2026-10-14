// Core simulation types. The whole game state lives in one mutable `Sim`
// object (see state.ts) that is ticked outside of React — views only read it.

export interface V2 {
  x: number
  z: number
}

export interface V3 {
  x: number
  y: number
  z: number
}

/** Physical resource kinds that can be carried / stocked / dropped. */
export type ResKind =
  | 'log'
  | 'raw'
  | 'cooked'
  | 'hide'
  | 'coat'
  | 'fish'
  | 'smoked'
  | 'coal'
  // Industrial Park products
  | 'furniture'
  | 'steel'
  | 'jacket'
  | 'canned'

/** Market stalls customers queue at. A customer's need is a stall id. */
export type StationId = 'wood' | 'meat' | 'coat' | 'fish'
export type Need = StationId

/** Workshops that turn one resource into another. */
export type ProcessorId = WorkshopId | FactoryId

/** the camp's staffed workshops */
export type WorkshopId = 'kitchen' | 'tailor' | 'smokehouse'

/** Industrial Park factories: automated workshops fed by export belts from the camp. */
export type FactoryId = 'furnFactory' | 'steelMill' | 'fashion' | 'cannery'

/** Industrial Park terminals where vehicles pick up products. */
export type TerminalId = 'dock' | 'port' | 'air'

export type PileId =
  | 'woodPay'
  | 'meatPay'
  | 'coatPay'
  | 'fishPay'
  | 'caravanPay'
  | 'bountyPay'
  | 'heatPay'
  | 'dockPay'
  | 'portPay'
  | 'airPay'

export type ZoneId = 'tannery' | 'fishery' | 'mine' | 'industry'

/** Gatherable spots: pines (logs), ice-fishing holes (fish), coal seams (coal). */
export type NodeKind = 'tree' | 'hole' | 'seam'

/** Conveyor belts: each one carries a single resource from a source to a sink. */
export type PadBeltId = 'wood' | 'meat' | 'coat' | 'fish' | 'coal'
/** pad-bought belts plus the belts that come with each machine */
export type BeltId = PadBeltId | 'saw' | 'skinRaw' | 'skinHide' | 'auger' | 'drill' | ExportBeltId | ProductBeltId

/** overhead export lines: camp supplies -> Industrial Park factories */
export type ExportBeltId = 'exLog' | 'exCoal' | 'exCoat' | 'exFish'
/** floor belts inside the park: factory -> terminal */
export type ProductBeltId = 'pFurn' | 'pSteel' | 'pJacket' | 'pCanned'

/** Machines that do a worker's job: gatherers, the meadow skinner, and workshop automatons. */
export type MachineId = 'saw' | 'skinner' | 'auger' | 'drill' | 'grill' | 'sewer' | 'autosmoker'

export type CustomerState = 'toQueue' | 'queue' | 'leaving'

export type Mood = 'none' | 'happy' | 'tip' | 'angry'

export interface CustomerSim {
  id: number
  pos: V2
  yaw: number
  state: CustomerState
  need: Need
  /** Queue slot index currently claimed (0 = at the counter). */
  slot: number
  /** Sideways offset used while travelling so groups don't walk single-file. */
  laneOff: number
  serveT: number
  /** items this survivor buys (grows with settlement level) and how many they've been handed */
  want: number
  got: number
  /** total seconds spent in line while the stall had nothing to sell */
  starveT: number
  carrying: ResKind | null
  speed: number
  variant: number
  vip: boolean
  walkPhase: number
  mood: Mood
  moodT: number
}

export interface StationSim {
  id: StationId
  unlocked: boolean
  pos: V2
  yaw: number
  stock: number
  capacity: number
  price: number
  serviceTime: number
  level: number
  /** What resource the player/workers deposit here. */
  accepts: ResKind
  queueBase: V2
  queueDir: V2
  queueSpacing: number
  queueSize: number
  /** customer ids by slot index, null = free */
  slots: (number | null)[]
  restock: V2
  payPileId: PileId
  /** market pressure: how much more customers want here (1 = normal); climbs while you keep up */
  demand: number
  /** seconds empty / seconds watched in the current pressure window */
  emptyT: number
  winT: number
}

export interface ProcessorSim {
  id: ProcessorId
  unlocked: boolean
  pos: V2
  /** deposit input here */
  inZone: V2
  /** pick up output here */
  outZone: V2
  /** someone must stand here (player or hired staff) for work to run */
  workSpot: V2
  inKind: ResKind
  outKind: ResKind
  inCount: number
  inCap: number
  outCount: number
  outCap: number
  t: number
  time: number
  level: number
  /** true this frame if work is actually progressing (drives fx/sfx) */
  active: boolean
  /** a hired worker is standing at the work spot this frame */
  staffed: boolean
  /** items taken off the output table by haulers and belts (drives export belt shares) */
  taken?: number
  /** factories: fractional extra products carried between items */
  yieldAcc?: number
}

export interface TreeSim {
  id: number
  pos: V2
  wood: number
  maxWood: number
  regrowT: number
  shake: number
  reservedBy: number | null
  scale: number
}

export type AnimalKind = 'deer' | 'rabbit' | 'goat' | 'bear' | 'mammoth' | 'yeti'

/** the two boss animals */
export type BossKind = 'mammoth' | 'yeti'

/** random events that shake up the late game */
export type EventId = 'blizzard' | 'festival' | 'goldRush' | 'siege' | 'boss'

/** Frost Star shop perks (bought with unspent stars, kept forever) */
export type PerkId =
  | 'headstart'
  | 'crew'
  | 'startLevel'
  | 'vip'
  | 'tips'
  | 'belts'
  | 'arrows'
  | 'offline'
  | 'events'
  | 'bossLoot'
  // late perks that keep progress through a move
  | 'pioneer'
  | 'blueprints'
  | 'charter'

export interface AnimalSim {
  id: number
  kind: AnimalKind
  pos: V2
  yaw: number
  hp: number
  maxHp: number
  /** bears don't run: once hurt they charge the player */
  state: 'idle' | 'walk' | 'flee' | 'charge'
  target: V2
  t: number
  hitFlash: number
  walkPhase: number
  /** bear swipe cooldown */
  atkT: number
}

export type WolfTarget = 'drop' | 'kitchenIn' | 'kitchenOut' | 'meat' | 'none'

export interface WolfSim {
  id: number
  pos: V2
  yaw: number
  hp: number
  maxHp: number
  state: 'approach' | 'steal' | 'flee'
  target: V2
  targetType: WolfTarget
  targetRef: number
  /** meat held in the jaws */
  carry: number
  t: number
  retargetT: number
  hitFlash: number
  walkPhase: number
  exit: V2
  /** siege wolves raid in daylight; the alpha is the big one */
  siege: boolean
  alpha: boolean
}

/** something on the ground the player grabs by walking over it */
export interface LootSim {
  id: number
  kind: 'cash' | 'chest'
  pos: V2
  value: number
  age: number
  /** seconds before it melts away */
  ttl: number
}

export interface EventSim {
  id: EventId
  /** seconds left */
  t: number
  dur: number
  /** boss events: the animal's id */
  bossId: number
  /** gold rush: cash bundles grabbed so far */
  grabbed: number
}

export interface DropSim {
  id: number
  kind: 'raw' | 'hide'
  pos: V2
  reservedBy: number | null
  age: number
}

export interface PileSim {
  id: PileId
  pos: V2
  value: number
  /** fractional coins accumulated while player drains the pile */
  drainAcc: number
  /** cash collector heading here */
  claimedBy: number | null
}

export interface ArrowSim {
  id: number
  active: boolean
  from: V3
  pos: V3
  t: number
  dur: number
  targetId: number
  damage: number
}

export type WorkerRole =
  | 'collector'
  | 'cook'
  | 'runner'
  | 'cashier'
  | 'lumberjack'
  | 'logCarrier'
  | 'guard'
  | 'tailor'
  | 'coatRunner'
  | 'fisher'
  | 'smoker'
  | 'fishRunner'
  | 'miner'
  | 'coalCarrier'

export type WorkerMode = 'idle' | 'fetch' | 'deliver' | 'work' | 'chase' | 'patrol'

export interface WorkerSim {
  id: number
  role: WorkerRole
  pos: V2
  yaw: number
  mode: WorkerMode
  /** short human-readable state for the debug panel */
  activity: string
  carry: ResKind[]
  coins: number
  timer: number
  blockedT: number
  walkPhase: number
  /** guard post / patrol anchor */
  post: V2
  atkT: number
  swing: number
  patrolT: number
  /** guards: the wolf being chased (-1 = none) */
  targetId: number
}

export interface TowerSim {
  built: boolean
  pos: V2
  yaw: number
  dmgLvl: number
  spdLvl: number
  rngLvl: number
  timer: number
  targetId: number | null
  drawT: number
  /** construction animation countdown (seconds) */
  buildT: number
  /** queued extra shots for multishot, seconds until fire + target */
  pending: { delay: number; targetId: number }[]
}

export interface PadSim {
  id: string
  pos: V2
  radius: number
  label: string
  icon: string
  cost: number
  paid: number
  visible: boolean
  done: boolean
  /** visible but not purchasable yet (level cap or an unmet requirement) */
  locked: boolean
  needLevel: number
  /** requirement shown on a locked pad, e.g. "Build the Meat Stall" ('' = level lock) */
  lockText: string
  level: number
  maxLevel: number
  pulse: number
  /** seconds the player has stood on this pad; paying starts once it reaches holdNeed */
  hold: number
  holdNeed: number
  /** levels bought in a row without stepping off (speeds up the drain) */
  streak: number
}

export interface PlayerSim {
  pos: V2
  yaw: number
  carry: ResKind[]
  /** hands-off mode: no chopping, fishing, mining or picking anything up (dropping off and buying still work) */
  noGrab: boolean
  carryCap: number
  speed: number
  spdLvl: number
  /** 🚀 Jetpack level (0 = not bought) */
  flyLvl: number
  /** jetpack switched on (you can still walk with it off) */
  flying: boolean
  /** 🔫 Laser Blaster level */
  slayLvl: number
  /** seconds until the laser can fire again */
  laserT: number
  /** beams on screen right now (from, to, seconds left) */
  beams: { x0: number; z0: number; x1: number; z1: number; t: number }[]
  carryLvl: number
  powerLvl: number
  chopT: number
  attackT: number
  /** swing animation timer (counts down) */
  swing: number
  moving: boolean
  walkPhase: number
  transferCd: number
  hintCd: number
  collectAcc: number
  dustT: number
}

export interface CaravanOrder {
  kind: ResKind
  need: number
  got: number
}

export interface CaravanSim {
  state: 'away' | 'arriving' | 'waiting' | 'leaving'
  /** 0 = off-map at the entry point, 1 = parked */
  travel: number
  timer: number
  maxTimer: number
  nextIn: number
  order: CaravanOrder[]
  earned: number
  /** completed orders — scales order size */
  count: number
}

export interface ClockSim {
  enabled: boolean
  t: number
  day: number
  night: boolean
  /** eased 0 (day) .. 1 (night) for lighting */
  dark: number
}

export interface RaidSim {
  /** nights survived so far — scales pack size / wolf hp */
  count: number
  toSpawn: number
  spawnT: number
  warned: boolean
  stolen: number
  theftAnnounced: boolean
}

export interface RepSim {
  xp: number
  level: number
}

export interface RushSim {
  n: number
  t: number
  best: number
}

export interface Guide {
  x: number
  z: number
  /** gold = objective, red = raiding wolf, teal = caravan, blue = where your load goes */
  color: 'gold' | 'red' | 'teal' | 'blue'
}

export type BannerTone = 'good' | 'warn' | 'info'

export interface Notice {
  id: number
  text: string
  sub: string
  tone: BannerTone
  /** sim.time when it happened */
  at: number
}

export interface Banner {
  text: string
  sub: string
  tone: BannerTone
  id: number
}

export type Fx =
  | { t: 'text'; x: number; y: number; z: number; str: string; color?: string; size?: number }
  | { t: 'burst'; x: number; y: number; z: number; color: string; n: number; spread?: number; up?: number }
  | { t: 'coin'; x: number; y: number; z: number; to?: V3 }
  | { t: 'itemfly'; kind: ResKind; from: V3; to: V3 }
  | { t: 'shake'; power: number }

/** A pile workers stack onto and haulers load from (forest log pile, mine coal pile). */
export interface DepotSim {
  pos: V2
  count: number
  cap: number
  kind: ResKind
  /** items hauled off it so far (drives export belt shares) */
  taken?: number
}

export interface BeltSim {
  id: BeltId
  kind: ResKind
  /** 0 = not built; higher levels run faster */
  level: number
  path: V2[]
  /** cumulative distance at each path point */
  dists: number[]
  length: number
  /** distance along the path of every item on the belt, front-most first */
  items: number[]
  /** seconds items have spent waiting at the end (sink full) */
  blockedT: number
  /** delivered this frame (drives the end-of-belt squash) */
  pulse: number
  /** overhead belts (export lines): riding height, the climb at each end and the flat run (0 = floor belt) */
  h: number
  lift: number
  run: number
}

/** a stall's cash belt, or one of the stall-less pay piles (furnace heat, wolf bounties) */
export type CashBeltId = StationId | 'heat' | 'bounty' | TerminalId

/**
 * Elevated money belt from a pay pile to the chest: bundles lift off the
 * pile, ride overhead and drop into storage, so nobody walks the cash.
 */
export interface CashBeltSim {
  id: CashBeltId
  pile: PileId
  /** height the bundles ride at (the long belts cross over the others) */
  h: number
  /** vertical climb off the pile (and drop into the chest) */
  lift: number
  /** ground path, pile -> chest intake (items ride above it) */
  path: V2[]
  dists: number[]
  /** horizontal run; the lift up and the drop down add `lift` at each end */
  run: number
  length: number
  items: number[]
  /** cash carried by each bundle */
  vals: number[]
}

export interface MachineSim {
  id: MachineId
  /** 0 = not built; upgrades make it work faster */
  level: number
  pos: V2
  /** facing toward what it's working on */
  yaw: number
  workT: number
  /** node index it's working (gatherers) */
  target: number
  /** finished goods waiting for the machine's belt */
  buf: Partial<Record<ResKind, number>>
  /** animates the saw / drill / gears (seconds of activity) */
  spin: number
  active: boolean
  /** skinner: fractional hide skinned from meat so far */
  skin: number
}

/** Coal burns here; while lit, every stall sale pays a bonus. */
export interface FurnaceSim {
  built: boolean
  pos: V2
  /** where coal is dropped in */
  feed: V2
  fuel: number
  cap: number
  burnT: number
  level: number
  burning: boolean
}

export type TaskKind =
  'serve' | 'kills' | 'bears' | 'earn' | 'tips' | 'caravan' | 'coal' | 'buy' | 'rush' | 'trucks' | 'ships' | 'planes'

/** A rotating bounty-board goal: progress is a stat counted from when it was posted. */
export interface TaskSim {
  id: number
  kind: TaskKind
  station: StationId | null
  need: number
  /** stat value when the task was posted */
  start: number
  reward: number
  xp: number
  /** seconds since completion (-1 while open); paid out, then replaced */
  doneT: number
}

/** a vehicle customer's order line */
export interface FreightLine {
  kind: ResKind
  need: number
  got: number
}

/** Where vehicles collect products: stock per product it ships. */
export interface TerminalSim {
  id: TerminalId
  open: boolean
  pos: V2
  /** where products are dropped off (player or belt) */
  restock: V2
  kinds: ResKind[]
  stock: Partial<Record<ResKind, number>>
  cap: number
  level: number
  /** seconds per item loaded onto a vehicle */
  loadTime: number
  pile: PileId
  /** market pressure on what vehicles order here (1 = normal) */
  demand: number
  emptyT: number
  winT: number
}

export type VehicleKind = 'truck' | 'ship' | 'plane'
export type VehicleState = 'arrive' | 'queue' | 'load' | 'leave'

/** a waypoint on a vehicle's route: position (y = altitude for planes) and the speed to drive it at */
export interface RoutePt {
  x: number
  y: number
  z: number
  v: number
}

export interface VehicleSim {
  id: number
  kind: VehicleKind
  state: VehicleState
  /** seconds in the current state (trucks: time waiting at the bay with nothing to load) */
  t: number
  /** trucks: queue slot (0 = at the bay) */
  slot: number
  pos: V2
  /** altitude (planes) */
  y: number
  yaw: number
  /** waypoints being driven ('arrive' for ships/planes, 'leave' for all); seg = index of the next one */
  route: RoutePt[]
  seg: number
  order: FreightLine[]
  loadT: number
  /** seconds left to fill the order (ships + planes) */
  timer: number
  maxTimer: number
  /** paint variant */
  variant: number
}

export interface FreightSim {
  vehicles: VehicleSim[]
  truckT: number
  shipT: number
  planeT: number
  /** completed vehicles (scales order sizes) */
  trucks: number
  ships: number
  planes: number
  /** market pressure on ship / plane order sizes: grows each time you fill one fast */
  shipDemand: number
  planeDemand: number
  /** berths at the Port and gates at the Airport (each loads its own ship / plane) */
  berths: number
  gates: number
}

export interface MetaSim {
  /** permanent prestige currency: each one boosts sales, workers, start cash, offline pay */
  stars: number
  /** settlements moved so far */
  runs: number
  bestLevel: number
  /** local date (YYYY-MM-DD) the free ×2 offline claim was last used */
  doubleDay: string
  /** stars spent in the shop (bonuses still count every star ever earned) */
  spent: number
  perks: Partial<Record<PerkId, number>>
}

export interface StatsExtra {
  bossesKilled: number
  eventsSeen: number
}

export interface Stats extends StatsExtra {
  served: number
  woodServed: number
  meatServed: number
  coatServed: number
  fishServed: number
  coalBurned: number
  bearKills: number
  bought: number
  tasksDone: number
  kills: number
  earned: number
  collected: number
  tips: number
  vips: number
  angry: number
  wolvesKilled: number
  caravansDone: number
  caravanVisits: number
  /** survivors who gave up waiting at an empty stall */
  lostSales: number
  trucksDone: number
  shipsDone: number
  planesDone: number
  freightEarned: number
}

export interface Sim {
  time: number
  /** debug time multiplier */
  speed: number
  money: number
  objective: number
  objectiveFlash: number
  player: PlayerSim
  customers: CustomerSim[]
  spawnT: number
  stations: Record<StationId, StationSim>
  proc: Record<ProcessorId, ProcessorSim>
  trees: TreeSim[]
  /** ice-fishing holes in the fishery */
  holes: TreeSim[]
  /** coal seams in the mine */
  seams: TreeSim[]
  animals: AnimalSim[]
  animalRespawnT: number
  wolves: WolfSim[]
  drops: DropSim[]
  piles: PileSim[]
  arrows: ArrowSim[]
  workers: WorkerSim[]
  tower: TowerSim
  pads: PadSim[]
  chest: { pos: V2 }
  /** forest log pile: lumberjacks stack here once a carrier is hired */
  depot: DepotSim
  /** mine-mouth coal pile: miners stack here once a Coal Carrier is hired */
  coalDepot: DepotSim
  belts: Record<BeltId, BeltSim>
  machines: Record<MachineId, MachineSim>
  /** cash belts share one level (0 = not built) */
  cash: { level: number; belts: Record<CashBeltId, CashBeltSim>; fxAcc: number; fxT: number }
  furnace: FurnaceSim
  stats: Stats
  fx: Fx[]
  /** camera focus override (world pos + remaining seconds) */
  focus: { x: number; z: number; t: number } | null
  shake: number
  ids: number
  saveT: number
  loaded: boolean
  clock: ClockSim
  raid: RaidSim
  rep: RepSim
  rush: RushSim
  caravan: CaravanSim
  zones: Record<ZoneId, boolean>
  lodge: { spdLvl: number; capLvl: number }
  game: { lvl: number }
  /** ground arrows around the player pointing at what matters right now */
  guides: Guide[]
  tasks: TaskSim[]
  /** alert history for the 🔔 dropdown (newest last) */
  notices: Notice[]
  banners: Banner[]
  banner: Banner
  bannerT: number
  /** survives "Move the Settlement": Frost Stars and run history */
  meta: MetaSim
  /** smoothed sales income ($/s), drives offline earnings */
  incomeRate: number
  rateT: number
  rateEarned: number
  /** wall-clock ms of the last tick (a long gap = time away) */
  lastWall: number
  /** "while you were away" payout waiting to be claimed */
  offline: { amount: number; seconds: number } | null
  /** the running random event (null between events) and the countdown to the next */
  event: EventSim | null
  eventNext: number
  loot: LootSim[]
  /** Industrial Park: terminals + vehicle customers */
  terminals: Record<TerminalId, TerminalSim>
  freight: FreightSim
  /** > 0 while packing up for a new settlement (seconds left before the reload) */
  moving: number
  movingStars: number
}
