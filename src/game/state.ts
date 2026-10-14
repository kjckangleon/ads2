import type {
  Sim,
  StationSim,
  StationId,
  ProcessorSim,
  ProcessorId,
  TreeSim,
  AnimalSim,
  PadSim,
  AnimalKind,
  PileSim,
  PileId,
  CustomerSim,
  BeltId,
  BeltSim,
  CashBeltSim,
  MachineId,
  MachineSim,
  V2,
} from './types'
import {
  WORLD,
  STATION_CFG,
  PROC_CFG,
  TREES,
  NODES,
  HOLE_SPOTS,
  SEAM_SPOTS,
  ALL_BELT_IDS,
  BELT_CFG,
  MACHINE_IDS,
  MACHINE_CFG,
  CASH_PATHS,
  STATION_IDS,
  ANIMALS,
  CARAVAN,
  CUSTOMERS,
  WORKERS,
  ECONOMY,
  PAD_DEFS,
  PILES,
  padCost,
  stationCapacity,
  stationPrice,
  stationServiceTime,
  procTime,
  procInCap,
  procOutCap,
  playerSpeed,
  playerCarry,
  animalHp,
  furnaceCap,
} from './balance'
import { mulberry32, randRange } from './util'

function makeStation(id: StationId, at: V2, unlocked: boolean): StationSim {
  const cfg = STATION_CFG[id]
  return {
    id,
    unlocked,
    pos: { x: at.x, z: at.z },
    yaw: 0,
    capacity: stationCapacity(id, 0),
    price: stationPrice(id, 0),
    serviceTime: stationServiceTime(id, 0),
    level: 0,
    stock: cfg.startStock,
    accepts: cfg.accepts,
    queueBase: { x: at.x, z: at.z + 1.6 },
    queueDir: { x: 0, z: 1 },
    queueSpacing: cfg.queueSpacing,
    queueSize: cfg.queueSize,
    slots: new Array(cfg.queueSize).fill(null),
    restock: { x: at.x, z: at.z - 1.9 },
    payPileId: cfg.pile,
  }
}

function makeProcessor(id: ProcessorId, at: V2, unlocked: boolean): ProcessorSim {
  const cfg = PROC_CFG[id]
  return {
    id,
    unlocked,
    pos: { x: at.x, z: at.z },
    inZone: { x: at.x - 2.1, z: at.z + 1.2 },
    outZone: { x: at.x + 2.1, z: at.z + 1.2 },
    workSpot: { x: at.x, z: at.z + 1.7 },
    inKind: cfg.inKind,
    outKind: cfg.outKind,
    inCount: 0,
    inCap: procInCap(id, 0),
    outCount: 0,
    outCap: procOutCap(id, 0),
    t: 0,
    time: procTime(id, 0),
    level: 0,
    active: false,
    staffed: false,
  }
}

function makeTrees(): TreeSim[] {
  const rng = mulberry32(1234)
  const trees: TreeSim[] = []
  for (let i = 0; i < TREES.count; i++) {
    let pos = { x: 0, z: 0 }
    for (let attempt = 0; attempt < 30; attempt++) {
      pos = {
        x: WORLD.treeArea.x + randRange(rng, -5.5, 5.5),
        z: WORLD.treeArea.z + randRange(rng, -5.5, 5.5),
      }
      if (trees.every((t) => Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) > 2.2)) break
    }
    trees.push({
      id: i,
      pos,
      wood: TREES.woodPer,
      maxWood: TREES.woodPer,
      regrowT: 0,
      shake: 0,
      reservedBy: null,
      scale: randRange(rng, 0.85, 1.15),
    })
  }
  return trees
}

function makeNodes(spots: V2[], per: number): TreeSim[] {
  return spots.map((p, i) => ({
    id: i,
    pos: { x: p.x, z: p.z },
    wood: per,
    maxWood: per,
    regrowT: 0,
    shake: 0,
    reservedBy: null,
    scale: 0.9 + ((i * 37) % 10) * 0.025,
  }))
}

function makeBelt(id: BeltId): BeltSim {
  const cfg = BELT_CFG[id]
  const dists = [0]
  for (let i = 1; i < cfg.path.length; i++) {
    const a = cfg.path[i - 1]
    const b = cfg.path[i]
    dists.push(dists[i - 1] + Math.hypot(b.x - a.x, b.z - a.z))
  }
  return {
    id,
    kind: cfg.kind,
    level: 0,
    path: cfg.path.map((p) => ({ x: p.x, z: p.z })),
    dists,
    length: dists[dists.length - 1],
    items: [],
    blockedT: 0,
    pulse: 0,
  }
}

/** vertical distance a cash bundle climbs off the pile (and drops into the chest) */
export const CASH_LIFT = 2.9

function makeCashBelt(id: StationId): CashBeltSim {
  const path = CASH_PATHS[id].map((p) => ({ x: p.x, z: p.z }))
  const dists = [0]
  for (let i = 1; i < path.length; i++) {
    dists.push(dists[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z))
  }
  const run = dists[dists.length - 1]
  return { station: id, path, dists, run, length: run + CASH_LIFT * 2, items: [], vals: [] }
}

export function spawnAnimal(sim: Sim, kind: AnimalKind): AnimalSim {
  const m = WORLD.meadow
  const ang = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * (m.r - 1)
  const hp = animalHp(kind, sim.rep.level)
  const a: AnimalSim = {
    id: sim.ids++,
    kind,
    pos: { x: m.x + Math.cos(ang) * r, z: m.z + Math.sin(ang) * r },
    yaw: Math.random() * Math.PI * 2,
    hp,
    maxHp: hp,
    state: 'idle',
    target: { x: m.x, z: m.z },
    t: Math.random() * 2,
    hitFlash: 0,
    walkPhase: Math.random() * 6,
    atkT: 0,
  }
  sim.animals.push(a)
  return a
}

function makePads(): PadSim[] {
  return PAD_DEFS.map((d) => ({
    id: d.id,
    pos: { x: d.x, z: d.z },
    radius: 1.35,
    label: d.label,
    icon: d.icon,
    cost: padCost(d, 0),
    paid: 0,
    visible: false,
    done: false,
    locked: false,
    needLevel: 0,
    lockText: '',
    level: 0,
    maxLevel: d.maxLevel,
    pulse: 0,
    hold: 0,
    holdNeed: d.holdSeconds ?? ECONOMY.padHoldSeconds,
    streak: 0,
  }))
}

function makePiles(): PileSim[] {
  return (Object.keys(PILES) as PileId[]).map((id) => ({
    id,
    pos: { x: PILES[id].x, z: PILES[id].z },
    value: 0,
    drainAcc: 0,
    claimedBy: null,
  }))
}

export function createSim(): Sim {
  const sim: Sim = {
    time: 0,
    speed: 1,
    money: 0,
    objective: 0,
    objectiveFlash: 0,
    player: {
      pos: { x: 0, z: 4 },
      yaw: Math.PI,
      carry: [],
      carryCap: playerCarry(0),
      speed: playerSpeed(0),
      spdLvl: 0,
      carryLvl: 0,
      powerLvl: 0,
      chopT: 0,
      attackT: 0,
      swing: 0,
      moving: false,
      walkPhase: 0,
      transferCd: 0,
      hintCd: 0,
      collectAcc: 0,
      dustT: 0,
    },
    customers: [],
    spawnT: 2,
    stations: {
      wood: makeStation('wood', WORLD.woodStation, true),
      meat: makeStation('meat', WORLD.meatStation, false),
      coat: makeStation('coat', WORLD.coatStation, false),
      fish: makeStation('fish', WORLD.fishStation, false),
    },
    proc: {
      kitchen: makeProcessor('kitchen', WORLD.kitchen, false),
      tailor: makeProcessor('tailor', WORLD.tailor, false),
      smokehouse: makeProcessor('smokehouse', WORLD.smokehouse, false),
    },
    trees: makeTrees(),
    holes: makeNodes(HOLE_SPOTS, NODES.hole.per),
    seams: makeNodes(SEAM_SPOTS, NODES.seam.per),
    animals: [],
    animalRespawnT: 0,
    wolves: [],
    drops: [],
    piles: makePiles(),
    arrows: [],
    workers: [],
    tower: {
      built: false,
      pos: { x: WORLD.towerSpot.x, z: WORLD.towerSpot.z },
      yaw: 0,
      dmgLvl: 0,
      spdLvl: 0,
      rngLvl: 0,
      timer: 0,
      targetId: null,
      drawT: 0,
      buildT: 0,
      pending: [],
    },
    pads: makePads(),
    chest: { pos: { x: WORLD.chest.x, z: WORLD.chest.z } },
    depot: { pos: { x: WORLD.logDepot.x, z: WORLD.logDepot.z }, count: 0, cap: WORKERS.depotCap, kind: 'log' },
    coalDepot: { pos: { x: WORLD.coalDepot.x, z: WORLD.coalDepot.z }, count: 0, cap: WORKERS.coalDepotCap, kind: 'coal' },
    belts: Object.fromEntries(ALL_BELT_IDS.map((id) => [id, makeBelt(id)])) as Record<BeltId, BeltSim>,
    machines: Object.fromEntries(
      MACHINE_IDS.map((id) => [
        id,
        { id, level: 0, pos: { ...MACHINE_CFG[id].pos }, yaw: 0, workT: 0, target: -1, buf: {}, spin: 0, active: false },
      ]),
    ) as Record<MachineId, MachineSim>,
    cash: {
      level: 0,
      belts: Object.fromEntries(STATION_IDS.map((id) => [id, makeCashBelt(id)])) as Record<StationId, CashBeltSim>,
      fxAcc: 0,
      fxT: 0,
    },
    furnace: {
      built: false,
      pos: { x: WORLD.furnace.x, z: WORLD.furnace.z },
      feed: { x: WORLD.furnaceFeed.x, z: WORLD.furnaceFeed.z },
      fuel: 0,
      cap: furnaceCap(0),
      burnT: 0,
      level: 0,
      burning: false,
    },
    stats: {
      served: 0,
      woodServed: 0,
      meatServed: 0,
      coatServed: 0,
      fishServed: 0,
      coalBurned: 0,
      bearKills: 0,
      bought: 0,
      tasksDone: 0,
      kills: 0,
      earned: 0,
      collected: 0,
      tips: 0,
      vips: 0,
      angry: 0,
      wolvesKilled: 0,
      caravansDone: 0,
      caravanVisits: 0,
    },
    fx: [],
    focus: null,
    shake: 0,
    ids: 1,
    saveT: 0,
    loaded: false,
    clock: { enabled: false, t: 0, day: 1, night: false, dark: 0 },
    raid: { count: 0, toSpawn: 0, spawnT: 0, warned: false, stolen: 0, theftAnnounced: false },
    rep: { xp: 0, level: 1 },
    rush: { n: 0, t: 0, best: 0 },
    caravan: {
      state: 'away',
      travel: 0,
      timer: 0,
      maxTimer: 0,
      nextIn: CARAVAN.firstDelay,
      order: [],
      earned: 0,
      count: 0,
    },
    zones: { tannery: false, fishery: false, mine: false },
    lodge: { spdLvl: 0, capLvl: 0 },
    game: { lvl: 0 },
    guides: [],
    tasks: [],
    banners: [],
    banner: { text: '', sub: '', tone: 'info', id: 0 },
    bannerT: 0,
    meta: { stars: 0, runs: 0, bestLevel: 1, doubleDay: '' },
    incomeRate: 0,
    rateT: 0,
    rateEarned: 0,
    lastWall: 0,
    offline: null,
    moving: 0,
    movingStars: 0,
  }
  for (let i = 0; i < ANIMALS.deerCount; i++) spawnAnimal(sim, 'deer')
  for (let i = 0; i < ANIMALS.rabbitCount; i++) spawnAnimal(sim, 'rabbit')
  seedQueue(sim)
  return sim
}

/** Open on action: a few survivors are already waiting at the wood stall. */
function seedQueue(sim: Sim) {
  const st = sim.stations.wood
  for (let i = 0; i < CUSTOMERS.startQueue; i++) {
    const pos = { x: st.queueBase.x + st.queueDir.x * st.queueSpacing * i, z: st.queueBase.z + st.queueDir.z * st.queueSpacing * i }
    const c: CustomerSim = {
      id: sim.ids++,
      pos,
      yaw: Math.PI,
      state: 'queue',
      need: 'wood',
      slot: i,
      laneOff: 0,
      serveT: 0,
      want: 1,
      got: 0,
      starveT: 0,
      carrying: null,
      speed: CUSTOMERS.speed,
      variant: i % 6,
      vip: false,
      walkPhase: 0,
      mood: 'none',
      moodT: 0,
    }
    st.slots[i] = c.id
    sim.customers.push(c)
  }
}

/** The one global sim instance. Recreated on reset. */
export let sim: Sim = createSim()

export function replaceSim(next: Sim) {
  sim = next
  if (typeof window !== 'undefined') (window as any).__sim = sim
}

if (typeof window !== 'undefined') (window as any).__sim = sim
