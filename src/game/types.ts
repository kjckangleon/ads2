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
export type ResKind = 'log' | 'raw' | 'cooked' | 'hide' | 'coat'

/** Market stalls customers queue at. A customer's need is a stall id. */
export type StationId = 'wood' | 'meat' | 'coat'
export type Need = StationId

/** Workshops that turn one resource into another. */
export type ProcessorId = 'kitchen' | 'tailor'

export type PileId = 'woodPay' | 'meatPay' | 'coatPay' | 'caravanPay' | 'bountyPay'

export type ZoneId = 'tannery'

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

export type AnimalKind = 'deer' | 'rabbit'

export interface AnimalSim {
  id: number
  kind: AnimalKind
  pos: V2
  yaw: number
  hp: number
  maxHp: number
  state: 'idle' | 'walk' | 'flee'
  target: V2
  t: number
  hitFlash: number
  walkPhase: number
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
}

export interface PlayerSim {
  pos: V2
  yaw: number
  carry: ResKind[]
  carryCap: number
  speed: number
  spdLvl: number
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
  color: 'gold' | 'red' | 'teal'
}

export type BannerTone = 'good' | 'warn' | 'info'

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

export interface Stats {
  served: number
  woodServed: number
  meatServed: number
  coatServed: number
  kills: number
  earned: number
  collected: number
  tips: number
  vips: number
  angry: number
  wolvesKilled: number
  caravansDone: number
  caravanVisits: number
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
  depot: { pos: V2; count: number; cap: number }
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
  banners: Banner[]
  banner: Banner
  bannerT: number
}
