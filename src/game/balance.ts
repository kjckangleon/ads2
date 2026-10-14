import type { ResKind, StationId, ProcessorId, PileId, WorkerRole, ZoneId, BeltId, AnimalKind, V2 } from './types'

// All tuning values live here — no magic numbers scattered through systems.

export const STATION_IDS: StationId[] = ['wood', 'meat', 'coat', 'fish']
export const PROC_IDS: ProcessorId[] = ['kitchen', 'tailor', 'smokehouse']
export const ZONE_IDS: ZoneId[] = ['tannery', 'fishery', 'mine']
export const BELT_IDS: BeltId[] = ['wood', 'meat', 'coat', 'fish', 'coal']

export const WORLD = {
  bounds: { minX: -34, maxX: 34, minZ: -26, maxZ: 34 },
  customerSpawn: { x: 0, z: 28 },
  customerExit: { x: 4, z: 28 },
  campfire: { x: 0, z: -2 },
  chest: { x: -2.6, z: 0.2 },
  woodStation: { x: -9, z: 2 },
  meatStation: { x: 9, z: 2 },
  coatStation: { x: 25, z: 9 },
  kitchen: { x: 14.5, z: -6.5 },
  tailor: { x: 27, z: -1 },
  towerSpot: { x: 17, z: -11 },
  meadow: { x: 25, z: -15, r: 8 },
  treeArea: { x: -19, z: -7 },
  logDepot: { x: -14.2, z: -3.4 },
  caravanSpot: { x: -15, z: 17.6 },
  // on the camp side of the sled — that's the side the player arrives from
  caravanDeliver: { x: -15, z: 15.0 },
  caravanEntry: { x: -44, z: 17.6 },
  // ice fishery (northwest): holes on the frozen pond, smokehouse + fish stall by the west camp
  pond: { x: -21, z: -20.5, rx: 6.6, rz: 4.3 },
  smokehouse: { x: -29, z: -6 },
  fishStation: { x: -29, z: 4 },
  // coal mine (north): seams + coal pile in the district, furnace on the camp side
  coalDepot: { x: 5, z: -15.8 },
  furnace: { x: 1.5, z: -11.4 },
  furnaceFeed: { x: 1.5, z: -8.95 },
}

/** Locked districts: the player can't enter the rect until it's bought. */
export const ZONES: Record<
  ZoneId,
  { minX: number; minZ: number; maxX: number; maxZ: number; focus: { x: number; z: number } }
> = {
  tannery: { minX: 20, minZ: -4.5, maxX: 80, maxZ: 80, focus: { x: 26, z: 4 } },
  fishery: { minX: -80, minZ: -80, maxX: -8.5, maxZ: -14, focus: { x: -21, z: -18 } },
  mine: { minX: -8.5, minZ: -80, maxX: 11, maxZ: -14, focus: { x: 1.5, z: -17 } },
}

/**
 * Snowdrift walls drawn along the open edges of each district. A wall sinks
 * once every zone it separates is open (the fishery and mine share one).
 */
export const BARRIERS: { zones: ZoneId[]; from: V2; to: V2 }[] = [
  { zones: ['tannery'], from: { x: 20, z: -4.5 }, to: { x: 20, z: 34 } },
  { zones: ['tannery'], from: { x: 21.5, z: -4.5 }, to: { x: 36, z: -4.5 } },
  { zones: ['fishery'], from: { x: -36, z: -14 }, to: { x: -10, z: -14 } },
  { zones: ['fishery', 'mine'], from: { x: -8.5, z: -14 }, to: { x: -8.5, z: -28 } },
  { zones: ['mine'], from: { x: -7, z: -14 }, to: { x: 11, z: -14 } },
  { zones: ['mine'], from: { x: 11, z: -15.5 }, to: { x: 11, z: -28 } },
]

/** fishing holes on the pond and coal seams in the mine (fixed, hand-placed) */
export const HOLE_SPOTS: V2[] = [
  { x: -25.2, z: -20.0 },
  { x: -21.8, z: -18.0 },
  { x: -17.6, z: -19.6 },
  { x: -20.4, z: -22.6 },
  { x: -24.0, z: -23.4 },
  { x: -16.9, z: -22.9 },
]
export const SEAM_SPOTS: V2[] = [
  { x: -4.6, z: -18.0 },
  { x: -1.0, z: -21.4 },
  { x: 2.6, z: -18.6 },
  { x: 6.6, z: -21.0 },
  { x: -5.2, z: -23.4 },
  { x: 2.2, z: -24.2 },
]

export const PILES: Record<PileId, { x: number; z: number }> = {
  woodPay: { x: -6.7, z: 2.6 },
  meatPay: { x: 6.7, z: 2.6 },
  coatPay: { x: 22.7, z: 9.6 },
  fishPay: { x: -26.7, z: 4.6 },
  caravanPay: { x: -19.2, z: 14.6 },
  bountyPay: { x: 15.0, z: -9.6 },
}

// Tempo: everything is tuned for an arcade pace — short actions, tall stacks,
// constant customers. Money values are big on purpose (ads-style numbers).

export const PLAYER = {
  baseSpeed: 6.2,
  speedPerLvl: 0.6,
  baseCarry: 8,
  carryPerLvl: 3,
  chopTime: 0.22,
  chopMult: 0.85,
  attackTime: 0.3,
  attackDamage: 1,
  damagePerLvl: 1,
  interactRange: 2.0,
  pickupRange: 2.4,
  depositRange: 2.3,
  transferInterval: 0.05,
  collectRange: 3.0,
  workRange: 1.8,
  dustInterval: 0.09,
}

export const CUSTOMERS = {
  maxBase: 30,
  maxPerLevel: 3,
  maxCap: 48,
  baseInterval: 2.4,
  minInterval: 0.55,
  speed: 4.2,
  weights: { wood: 1, meat: 1.2, coat: 0.9, fish: 1.0 } as Record<StationId, number>,
  /** cold nights: more survivors want firewood and coats */
  nightWoodBonus: 1.0,
  nightCoatBonus: 0.4,
  impatientAfter: 4,
  angryAfter: 10,
  vipChance: 0.06,
  vipMinLevel: 2,
  vipMult: 4,
  /** survivors already lined up when a new game starts */
  startQueue: 4,
  /** a bigger settlement means hungrier survivors: +1 item per this many levels */
  demandEvery: 3,
  maxDemand: 5,
  xpPerExtraItem: 0.5,
}

/** most items one survivor buys at this settlement level */
export function maxDemand(level: number) {
  return Math.min(CUSTOMERS.maxDemand, 1 + Math.floor((level - 1) / CUSTOMERS.demandEvery))
}

export interface StationCfg {
  baseCapacity: number
  basePrice: number
  baseServiceTime: number
  queueSize: number
  queueSpacing: number
  accepts: ResKind
  pile: PileId
  startStock: number
}

export const STATION_CFG: Record<StationId, StationCfg> = {
  wood: { baseCapacity: 30, basePrice: 20, baseServiceTime: 0.35, queueSize: 12, queueSpacing: 1.1, accepts: 'log', pile: 'woodPay', startStock: 4 },
  meat: { baseCapacity: 24, basePrice: 45, baseServiceTime: 0.4, queueSize: 12, queueSpacing: 1.1, accepts: 'cooked', pile: 'meatPay', startStock: 0 },
  coat: { baseCapacity: 18, basePrice: 110, baseServiceTime: 0.5, queueSize: 11, queueSpacing: 1.1, accepts: 'coat', pile: 'coatPay', startStock: 0 },
  fish: { baseCapacity: 24, basePrice: 150, baseServiceTime: 0.45, queueSize: 10, queueSpacing: 1.1, accepts: 'smoked', pile: 'fishPay', startStock: 0 },
}

export const STATION_SCALE = {
  capacityMult: 1.35,
  priceMult: 1.2,
  serviceMult: 0.9,
  minService: 0.12,
  maxLevel: 10,
}

export const PROC_CFG: Record<
  ProcessorId,
  { inKind: ResKind; outKind: ResKind; baseTime: number; baseInCap: number; baseOutCap: number }
> = {
  kitchen: { inKind: 'raw', outKind: 'cooked', baseTime: 0.7, baseInCap: 24, baseOutCap: 16 },
  tailor: { inKind: 'hide', outKind: 'coat', baseTime: 1.1, baseInCap: 16, baseOutCap: 12 },
  smokehouse: { inKind: 'fish', outKind: 'smoked', baseTime: 0.8, baseInCap: 24, baseOutCap: 16 },
}

export const PROC_SCALE = {
  timeMult: 0.88,
  capMult: 1.3,
  maxLevel: 10,
}

export const TREES = {
  count: 8,
  woodPer: 12,
  regrowTime: 9,
  chopRange: 2.2,
}

/** fishing holes and coal seams work like trees: tap until empty, then they refill */
export const NODES = {
  hole: { per: 8, regrowTime: 7, workMult: 1.5, kind: 'fish' as ResKind },
  seam: { per: 14, regrowTime: 12, workMult: 1.25, kind: 'coal' as ResKind },
  tree: { per: 12, regrowTime: 9, workMult: 1, kind: 'log' as ResKind },
}

export const ANIMALS = {
  deerCount: 6,
  deerPerLvl: 1,
  rabbitCount: 2,
  deerHp: 2,
  rabbitHp: 1,
  deerWalk: 2.0,
  deerFlee: 4.6,
  rabbitWalk: 2.8,
  rabbitFlee: 6,
  fleeTrigger: 2.6,
  fleeTime: 0.8,
  respawnTime: 2.5,
  respawnMult: 0.85,
  deerDrops: 3,
  rabbitDrops: 1,
  /** big game arrives as the settlement grows: tougher, and worth more meat */
  goat: { level: 5, hp: 7, hpPerLevel: 1, walk: 2.4, flee: 6.2, drops: 4, hides: 1, base: 2, perLevel: 1, max: 6 },
  bear: { level: 7, hp: 24, hpPerLevel: 4, walk: 1.5, charge: 5.4, drops: 8, hides: 2, base: 1, perLevel: 0.5, max: 4 },
  /** bears charge whoever hurt them if the player is this close */
  bearAggro: 10,
  bearChaseTime: 2.6,
  bearReach: 1.35,
  bearSwipeCd: 1.2,
  bearKnockback: 3.2,
  respawnPerLevel: 0.1,
  /** every level past this adds a deer */
  deerFromLevel: 4,
  deerMax: 16,
  /** tower stops hunting game while this much raw meat lies uncollected */
  maxGroundMeat: 45,
  maxGroundHides: 20,
  /** uncollected hides spoil so they never clog the meadow */
  hideLifetime: 60,
}

export const WOLVES = {
  spawnPoints: [
    { x: 37, z: -24 },
    { x: 12, z: -30 },
    { x: 38, z: -9 },
  ],
  baseCount: 2,
  perRaid: 0.6,
  maxCount: 8,
  baseHp: 3,
  hpPerRaid: 1,
  maxHp: 16,
  speed: 5.4,
  fleeSpeed: 6.5,
  stealTime: 0.7,
  stealAmount: 3,
  stealRange: 1.6,
  spawnStagger: 0.9,
  bounty: 30,
  bountyPerRaid: 10,
  /** paid at dawn when nothing was stolen */
  cleanBonus: 150,
}

export const CLOCK = {
  dayLength: 70,
  nightLength: 28,
  warnBefore: 6,
}

export const GUARD = {
  aggro: 11,
  leash: 20,
  baseDamage: 2,
  attackTime: 0.4,
  range: 1.4,
  speedMult: 1.25,
  posts: [
    { x: 12.5, z: -1.5 },
    { x: 21, z: -9.5 },
    { x: 4, z: -9 },
  ],
}

export const RUSH = {
  /** a customer who starved less than this tips and grows the rush */
  tipStarve: 1.5,
  window: 5,
  perStack: 0.025,
  maxStack: 40,
  tipFrac: 0.5,
  announceEvery: 10,
}

export const REP = {
  xpBase: 50,
  xpMult: 1.6,
  xpServe: 1,
  xpTip: 1,
  xpVip: 5,
  xpCaravan: 30,
  xpNight: 10,
  xpWolf: 2,
  upgradeCapBase: 2,
  spawnPerLevel: 0.12,
  nightsLevel: 2,
  tanneryLevel: 4,
  beltLevel: 5,
  fisheryLevel: 6,
  mineLevel: 8,
  xpCoal: 0.2,
}

export const CARAVAN = {
  unlockLevel: 3,
  firstDelay: 10,
  intervalMin: 45,
  intervalMax: 70,
  travelTime: 3,
  baseTime: 40,
  perItem: 1,
  maxTime: 90,
  deliverRange: 2.6,
  /** [base, per completed caravan, max] */
  qty: { log: [15, 5, 80], cooked: [10, 4, 60], coat: [6, 2, 30], smoked: [8, 3, 40], coal: [14, 5, 70] } as Partial<
    Record<ResKind, [number, number, number]>
  >,
  payPerItem: { log: 30, raw: 0, cooked: 70, hide: 0, coat: 150, fish: 0, smoked: 190, coal: 60 } as Record<ResKind, number>,
  bonusFrac: 0.6,
  bonusFlat: 100,
}

export const WORKERS = {
  speed: 5.2,
  speedPerLvl: 0.12,
  caps: {
    collector: 6,
    runner: 6,
    coatRunner: 6,
    lumberjack: 8,
    logCarrier: 8,
    fisher: 6,
    fishRunner: 6,
    miner: 8,
    coalCarrier: 10,
  } as Partial<Record<WorkerRole, number>>,
  depotCap: 60,
  coalDepotCap: 80,
  fisherTime: 0.5,
  minerTime: 0.42,
  capPerLvl: 2,
  lumberjackChopTime: 0.35,
  cashierTripMax: 600,
  cashierTripPerLvl: 400,
  cashierMinPile: 50,
  transferInterval: 0.06,
  /** a collector stuck at a full workshop puts its load down after this */
  blockedDropAfter: 3,
}

export const TOWER = {
  baseDamage: 1,
  damagePerLvl: 1,
  baseCooldown: 1.1,
  cooldownMult: 0.85,
  baseRange: 12.5,
  rangePerLvl: 2,
  arrowSpeed: 26,
  buildTime: 0.8,
  maxLvl: 10,
  /** total upgrade levels for 2nd / 3rd / 4th arrow */
  multishot: [4, 10, 18],
}

export const ECONOMY = {
  /** cash/sec the player vacuums from a pile (scales with pile size) */
  collectBase: 120,
  padDrainSeconds: 0.7,
  /** stand on a pad this long before money starts draining, so walking across one doesn't buy it */
  padHoldSeconds: 0.8,
  autosaveInterval: 5,
  /** value of one cash bundle in a pile */
  billValue: 25,
  /** stats gates that used to be single coins are scaled by this */
  scale: 5,
}

// ---- task board: three rotating goals with cash + XP rewards ----

export const TASKS = {
  /** the board opens once the basics are learned */
  level: 3,
  slots: 3,
  /** a finished task shows its tick this long before paying out */
  claimDelay: 1.4,
  rewardBase: 450,
  rewardMult: 1.5,
  /** share of the current level's XP each task pays */
  xpFrac: 0.12,
}

/** cash for a level-up (and the scale for task rewards) */
export function levelGift(level: number) {
  return niceRound(300 * Math.pow(1.55, Math.max(0, level - 2)))
}

/** round to 2 significant figures so rewards read as clean numbers */
export function niceRound(v: number) {
  if (v < 100) return Math.round(v / 5) * 5
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / p) * p
}

// ---- conveyor belts: items ride on their own from a pickup point to a stall ----

export const BELT = {
  /** metres per second at level 1, plus this much per upgrade */
  speed: 2.2,
  speedPerLvl: 1.1,
  /** gap between items riding the belt */
  spacing: 0.62,
  width: 0.8,
}

export const BELT_CFG: Record<BeltId, { kind: ResKind; path: V2[] }> = {
  wood: {
    kind: 'log',
    path: [
      { x: -13.0, z: -5.45 },
      { x: -9.0, z: -5.45 },
      { x: -9.0, z: -1.05 },
    ],
  },
  meat: {
    kind: 'cooked',
    path: [
      { x: 16.1, z: -4.15 },
      { x: 16.1, z: -0.6 },
      { x: 10.55, z: -0.6 },
    ],
  },
  coat: {
    kind: 'coat',
    path: [
      { x: 29.1, z: 1.4 },
      { x: 29.1, z: 2.3 },
      { x: 26.5, z: 2.3 },
      { x: 26.5, z: 6.55 },
    ],
  },
  fish: {
    kind: 'smoked',
    path: [
      { x: -26.9, z: -3.7 },
      { x: -26.9, z: 1.6 },
    ],
  },
  coal: {
    kind: 'coal',
    path: [
      { x: 5.0, z: -14.35 },
      { x: 5.0, z: -11.4 },
      { x: 3.05, z: -11.4 },
    ],
  },
}

export function beltSpeed(level: number) {
  return BELT.speed + BELT.speedPerLvl * Math.max(0, level - 1)
}

// ---- furnace: burns coal; while lit, every sale pays a bonus ----

export const FURNACE = {
  baseCap: 40,
  capPerLvl: 12,
  /** seconds one lump of coal keeps it lit */
  burnTime: 1.4,
  bonusBase: 0.25,
  bonusPerLvl: 0.05,
  radius: 1.35,
}

export function furnaceCap(level: number) {
  return FURNACE.baseCap + FURNACE.capPerLvl * level
}
export function furnaceBonus(level: number) {
  return FURNACE.bonusBase + FURNACE.bonusPerLvl * level
}

// ---- derived stat helpers (used by upgrades AND save-load reconstruction) ----

/** a fully upgraded stall or workshop never fills up, so nobody is left holding a stack */
export const UNLIMITED = Infinity

export function stationCapacity(id: StationId, lvl: number) {
  if (lvl >= STATION_SCALE.maxLevel) return UNLIMITED
  return Math.round(STATION_CFG[id].baseCapacity * Math.pow(STATION_SCALE.capacityMult, lvl))
}
export function stationPrice(id: StationId, lvl: number) {
  return Math.round(STATION_CFG[id].basePrice * Math.pow(STATION_SCALE.priceMult, lvl))
}
export function stationServiceTime(id: StationId, lvl: number) {
  return Math.max(
    STATION_SCALE.minService,
    STATION_CFG[id].baseServiceTime * Math.pow(STATION_SCALE.serviceMult, lvl),
  )
}
export function procTime(id: ProcessorId, lvl: number) {
  return PROC_CFG[id].baseTime * Math.pow(PROC_SCALE.timeMult, lvl)
}
export function procInCap(id: ProcessorId, lvl: number) {
  if (lvl >= PROC_SCALE.maxLevel) return UNLIMITED
  return Math.round(PROC_CFG[id].baseInCap * Math.pow(PROC_SCALE.capMult, lvl))
}
export function procOutCap(id: ProcessorId, lvl: number) {
  if (lvl >= PROC_SCALE.maxLevel) return UNLIMITED
  return Math.round(PROC_CFG[id].baseOutCap * Math.pow(PROC_SCALE.capMult, lvl))
}

/** "12/30", or just "12 · ∞" once storage is unlimited */
export function capText(count: number, cap: number) {
  return cap === UNLIMITED ? `${count} · ∞` : `${count}/${cap}`
}
export function towerDamage(dmgLvl: number) {
  return TOWER.baseDamage + TOWER.damagePerLvl * dmgLvl
}
export function towerCooldown(spdLvl: number) {
  return TOWER.baseCooldown * Math.pow(TOWER.cooldownMult, spdLvl)
}
export function towerRange(rngLvl: number) {
  return TOWER.baseRange + TOWER.rangePerLvl * rngLvl
}
export function towerArrows(totalLvls: number) {
  let n = 1
  for (const t of TOWER.multishot) if (totalLvls >= t) n++
  return n
}
export function playerSpeed(lvl: number) {
  return PLAYER.baseSpeed + PLAYER.speedPerLvl * lvl
}
export function playerCarry(lvl: number) {
  return PLAYER.baseCarry + PLAYER.carryPerLvl * lvl
}
export function playerChopTime(lvl: number) {
  return PLAYER.chopTime * Math.pow(PLAYER.chopMult, lvl)
}
export function playerDamage(lvl: number) {
  return PLAYER.attackDamage + PLAYER.damagePerLvl * lvl
}
/** XP needed to go from `level` to `level + 1` */
export function xpForLevel(level: number) {
  return Math.round(REP.xpBase * Math.pow(REP.xpMult, level - 1))
}
/** highest upgrade level a gated pad may reach at this settlement level */
export function upgradeCap(level: number) {
  return REP.upgradeCapBase + level
}
export function maxCustomers(level: number) {
  return Math.min(CUSTOMERS.maxCap, CUSTOMERS.maxBase + CUSTOMERS.maxPerLevel * (level - 1))
}
export function wolfCount(raid: number) {
  return Math.min(WOLVES.maxCount, Math.floor(WOLVES.baseCount + WOLVES.perRaid * raid))
}
export function wolfHp(raid: number) {
  return Math.min(WOLVES.maxHp, Math.round(WOLVES.baseHp + WOLVES.hpPerRaid * raid))
}
export function workerSpeed(lodgeLvl: number) {
  return WORKERS.speed * (1 + WORKERS.speedPerLvl * lodgeLvl)
}
export function workerCap(role: WorkerRole, lodgeLvl: number) {
  return (WORKERS.caps[role] ?? 0) + WORKERS.capPerLvl * lodgeLvl
}
export function deerTarget(gameLvl: number, level = 1) {
  const extra = Math.max(0, level - ANIMALS.deerFromLevel)
  return Math.min(ANIMALS.deerMax, ANIMALS.deerCount + ANIMALS.deerPerLvl * gameLvl + extra)
}
/** how many goats / bears roam the meadow at this settlement level */
export function bigGameTarget(kind: 'goat' | 'bear', level: number) {
  const c = ANIMALS[kind]
  if (level < c.level) return 0
  return Math.min(c.max, Math.floor(c.base + c.perLevel * (level - c.level)))
}
export function animalHp(kind: AnimalKind, level: number) {
  if (kind === 'deer') return ANIMALS.deerHp
  if (kind === 'rabbit') return ANIMALS.rabbitHp
  const c = ANIMALS[kind]
  return c.hp + c.hpPerLevel * Math.max(0, level - c.level)
}
/** seconds between respawns: Wild Game upgrades and settlement level both speed it up */
export function animalRespawn(gameLvl: number, level = 1) {
  return (ANIMALS.respawnTime * Math.pow(ANIMALS.respawnMult, gameLvl)) / (1 + ANIMALS.respawnPerLevel * (level - 1))
}
export function guardDamage(settlementLevel: number) {
  return GUARD.baseDamage + Math.floor(settlementLevel / 3)
}

// ---- purchase pads: base costs + repeat scaling ----

export interface PadDef {
  id: string
  x: number
  z: number
  label: string
  icon: string
  baseCost: number
  costMult: number
  maxLevel: number
  /** max level is also limited by settlement level (see upgradeCap) */
  gated?: boolean
}

export const PAD_DEFS: PadDef[] = [
  // core chain
  { id: 'meatStall', x: 9, z: 5, label: 'Meat Stall', icon: '🍖', baseCost: 200, costMult: 1, maxLevel: 1 },
  { id: 'tower', x: 17, z: -11, label: 'Hunting Tower', icon: '🏹', baseCost: 600, costMult: 1, maxLevel: 1 },
  { id: 'collector', x: 19.5, z: -7.5, label: 'Meat Collector', icon: '🧺', baseCost: 350, costMult: 2.2, maxLevel: 3 },
  { id: 'cook', x: 12, z: -8.5, label: 'Cook', icon: '🍳', baseCost: 400, costMult: 1, maxLevel: 1 },
  { id: 'runner', x: 11.5, z: -3.5, label: 'Food Runner', icon: '🏃', baseCost: 500, costMult: 2.2, maxLevel: 2 },
  { id: 'cashier', x: -4.8, z: 2.6, label: 'Cash Collector', icon: '💰', baseCost: 600, costMult: 2.5, maxLevel: 2 },
  { id: 'lumberjack', x: -13.5, z: 1.5, label: 'Lumberjack', icon: '🪓', baseCost: 150, costMult: 2.2, maxLevel: 3 },
  { id: 'logCarrier', x: -11.2, z: -3.0, label: 'Log Carrier', icon: '🪵', baseCost: 250, costMult: 2.2, maxLevel: 3 },
  // stall + workshop upgrades
  { id: 'wood_up', x: -11.8, z: 4.5, label: 'Wood Stall +', icon: '⬆️', baseCost: 300, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'meat_up', x: 11.8, z: 4.5, label: 'Meat Stall +', icon: '⬆️', baseCost: 400, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'kitchen_up', x: 18.2, z: -2.6, label: 'Kitchen +', icon: '⬆️', baseCost: 450, costMult: 1.6, maxLevel: 10, gated: true },
  // hunting
  { id: 'tower_dmg', x: 14.5, z: -13.5, label: 'Arrow Damage', icon: '⚔️', baseCost: 350, costMult: 1.55, maxLevel: 10, gated: true },
  { id: 'tower_spd', x: 17.5, z: -14.5, label: 'Fire Rate', icon: '⚡', baseCost: 350, costMult: 1.55, maxLevel: 10, gated: true },
  { id: 'tower_rng', x: 20.5, z: -13.5, label: 'Range', icon: '🎯', baseCost: 300, costMult: 1.55, maxLevel: 10, gated: true },
  { id: 'game_up', x: 17.5, z: -18.4, label: 'Wild Game', icon: '🦌', baseCost: 750, costMult: 1.8, maxLevel: 5, gated: true },
  // player
  { id: 'p_speed', x: -2.5, z: 6.5, label: 'Boots', icon: '👟', baseCost: 250, costMult: 1.9, maxLevel: 5 },
  { id: 'p_carry', x: 2.5, z: 6.5, label: 'Backpack', icon: '🎒', baseCost: 250, costMult: 1.9, maxLevel: 6 },
  { id: 'p_power', x: 0, z: 9.8, label: 'Sharp Axe', icon: '🪓', baseCost: 400, costMult: 1.9, maxLevel: 5 },
  // defense + crew
  { id: 'guard', x: 5.0, z: -5.8, label: 'Guard', icon: '🛡️', baseCost: 1300, costMult: 2, maxLevel: 3 },
  { id: 'w_speed', x: -5.0, z: -5.8, label: 'Worker Boots', icon: '🥾', baseCost: 1000, costMult: 1.8, maxLevel: 5, gated: true },
  { id: 'w_carry', x: -1.6, z: -7.8, label: 'Worker Packs', icon: '🧳', baseCost: 1100, costMult: 1.8, maxLevel: 4, gated: true },
  // tannery district
  { id: 'zone_tannery', x: 17.5, z: 6.5, label: 'Open Tannery', icon: '🧥', baseCost: 3750, costMult: 1, maxLevel: 1 },
  { id: 'tailor', x: 23.5, z: -2.6, label: 'Tailor', icon: '🧵', baseCost: 2100, costMult: 1, maxLevel: 1 },
  { id: 'coatRunner', x: 30, z: 4.5, label: 'Coat Runner', icon: '🏃', baseCost: 2400, costMult: 1.9, maxLevel: 2 },
  { id: 'coat_up', x: 27.8, z: 11.5, label: 'Coat Stall +', icon: '⬆️', baseCost: 800, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'tailor_up', x: 31.5, z: -2.6, label: 'Tailor +', icon: '⬆️', baseCost: 900, costMult: 1.6, maxLevel: 10, gated: true },
  // conveyor belts (Level 5+): build, then speed them up
  { id: 'belt_wood', x: -7.6, z: -7.6, label: 'Log Belt', icon: '⚙️', baseCost: 4000, costMult: 2.2, maxLevel: 3 },
  { id: 'belt_meat', x: 13.6, z: 1.7, label: 'Food Belt', icon: '⚙️', baseCost: 5500, costMult: 2.2, maxLevel: 3 },
  { id: 'belt_coat', x: 31.7, z: 1.1, label: 'Coat Belt', icon: '⚙️', baseCost: 8000, costMult: 2.2, maxLevel: 3 },
  // ice fishery (Level 6)
  { id: 'zone_fishery', x: -11.0, z: -11.3, label: 'Open Ice Fishery', icon: '🎣', baseCost: 15000, costMult: 1, maxLevel: 1 },
  { id: 'fisher', x: -12.6, z: -17.6, label: 'Fisher', icon: '🎣', baseCost: 5000, costMult: 2, maxLevel: 3 },
  { id: 'smoker', x: -31.6, z: -9.4, label: 'Smoker', icon: '🔥', baseCost: 6000, costMult: 1, maxLevel: 1 },
  { id: 'fishRunner', x: -24.2, z: 6.8, label: 'Fish Runner', icon: '🏃', baseCost: 6500, costMult: 1.9, maxLevel: 2 },
  { id: 'fish_up', x: -31.8, z: 6.6, label: 'Fish Stall +', icon: '⬆️', baseCost: 1600, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'smoke_up', x: -32.2, z: -1.6, label: 'Smokehouse +', icon: '⬆️', baseCost: 1800, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'belt_fish', x: -24.4, z: 0.6, label: 'Fish Belt', icon: '⚙️', baseCost: 11000, costMult: 2.2, maxLevel: 3 },
  // coal mine (Level 8)
  { id: 'zone_mine', x: 7.2, z: -11.5, label: 'Open Coal Mine', icon: '⛏️', baseCost: 40000, costMult: 1, maxLevel: 1 },
  { id: 'miner', x: 8.6, z: -17.6, label: 'Miner', icon: '⛏️', baseCost: 12000, costMult: 2, maxLevel: 3 },
  { id: 'coalCarrier', x: -5.3, z: -12.0, label: 'Coal Carrier', icon: '🪨', baseCost: 14000, costMult: 1.9, maxLevel: 2 },
  { id: 'furnace_up', x: -1.9, z: -11.2, label: 'Furnace +', icon: '⬆️', baseCost: 6000, costMult: 1.6, maxLevel: 10, gated: true },
  { id: 'belt_coal', x: 8.4, z: -10.6, label: 'Coal Belt', icon: '⚙️', baseCost: 16000, costMult: 2.2, maxLevel: 3 },
]

export const PAD_BY_ID: Record<string, PadDef> = Object.fromEntries(PAD_DEFS.map((d) => [d.id, d]))

export function padCost(def: PadDef, level: number) {
  return Math.round(def.baseCost * Math.pow(def.costMult, level))
}
