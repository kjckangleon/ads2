import type { ResKind, StationId, ProcessorId, PileId, WorkerRole, ZoneId } from './types'

// All tuning values live here — no magic numbers scattered through systems.

export const STATION_IDS: StationId[] = ['wood', 'meat', 'coat']
export const PROC_IDS: ProcessorId[] = ['kitchen', 'tailor']
export const ZONE_IDS: ZoneId[] = ['tannery']

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
}

/** Locked districts: the player can't enter the rect until it's bought. */
export const ZONES: Record<
  ZoneId,
  { minX: number; minZ: number; maxX: number; maxZ: number; focus: { x: number; z: number } }
> = {
  tannery: { minX: 20, minZ: -4.5, maxX: 80, maxZ: 80, focus: { x: 26, z: 4 } },
}

export const PILES: Record<PileId, { x: number; z: number }> = {
  woodPay: { x: -6.7, z: 2.6 },
  meatPay: { x: 6.7, z: 2.6 },
  coatPay: { x: 22.7, z: 9.6 },
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
  weights: { wood: 1, meat: 1.2, coat: 0.9 } as Record<StationId, number>,
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
  qty: { log: [15, 5, 80], cooked: [10, 4, 60], coat: [6, 2, 30] } as Partial<
    Record<ResKind, [number, number, number]>
  >,
  payPerItem: { log: 30, raw: 0, cooked: 70, hide: 0, coat: 150 } as Record<ResKind, number>,
  bonusFrac: 0.6,
  bonusFlat: 100,
}

export const WORKERS = {
  speed: 5.2,
  speedPerLvl: 0.12,
  caps: { collector: 6, runner: 6, coatRunner: 6, lumberjack: 8, logCarrier: 8 } as Partial<Record<WorkerRole, number>>,
  depotCap: 60,
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
  autosaveInterval: 5,
  /** value of one cash bundle in a pile */
  billValue: 25,
  /** stats gates that used to be single coins are scaled by this */
  scale: 5,
}

// ---- derived stat helpers (used by upgrades AND save-load reconstruction) ----

export function stationCapacity(id: StationId, lvl: number) {
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
  return Math.round(PROC_CFG[id].baseInCap * Math.pow(PROC_SCALE.capMult, lvl))
}
export function procOutCap(id: ProcessorId, lvl: number) {
  return Math.round(PROC_CFG[id].baseOutCap * Math.pow(PROC_SCALE.capMult, lvl))
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
export function deerTarget(gameLvl: number) {
  return ANIMALS.deerCount + ANIMALS.deerPerLvl * gameLvl
}
export function animalRespawn(gameLvl: number) {
  return ANIMALS.respawnTime * Math.pow(ANIMALS.respawnMult, gameLvl)
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
]

export const PAD_BY_ID: Record<string, PadDef> = Object.fromEntries(PAD_DEFS.map((d) => [d.id, d]))

export function padCost(def: PadDef, level: number) {
  return Math.round(def.baseCost * Math.pow(def.costMult, level))
}
