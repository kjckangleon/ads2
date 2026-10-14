import type { Sim, WorkerRole, StationId, ProcessorId, ZoneId, PileId, BeltId, TaskSim } from './types'
import {
  PAD_BY_ID,
  padCost,
  STATION_IDS,
  PROC_IDS,
  ZONE_IDS,
  BELT_IDS,
  BELT_RETIRES,
  CLOCK,
  CARAVAN,
  ECONOMY,
  stationCapacity,
  stationPrice,
  stationServiceTime,
  procTime,
  procInCap,
  procOutCap,
  playerSpeed,
  playerCarry,
  furnaceCap,
} from './balance'
import { hireWorker } from './systems/workers'
import { levelFromTotalXp } from './systems/progress'
import { retireWorkers } from './systems/belts'

const KEY = 'frostline-save-v1'

interface SaveV2 {
  v: 2 | 3
  money: number
  objective: number
  stats: Partial<Sim['stats']>
  stations: Partial<Record<StationId, { level: number; stock: number; unlocked: boolean }>>
  proc: Partial<Record<ProcessorId, { level: number; inCount: number; outCount: number; unlocked: boolean }>>
  tower: { built: boolean; dmgLvl: number; spdLvl: number; rngLvl: number }
  workers: WorkerRole[]
  player: { spdLvl: number; carryLvl: number; powerLvl?: number }
  pads: Record<string, { level: number; paid: number }>
  piles: Partial<Record<PileId, number>>
  rep: { xp: number; level: number }
  clock: { enabled: boolean; t: number; day: number }
  raid: { count: number }
  zones: Partial<Record<ZoneId, boolean>>
  lodge: { spdLvl: number; capLvl: number }
  game: { lvl: number }
  caravan: { count: number; nextIn: number }
  rushBest: number
  depot?: number
  coalDepot?: number
  furnaceFuel?: number
  tasks?: TaskSim[]
}

const PROC_BELT: Record<ProcessorId, BeltId> = { kitchen: 'meat', tailor: 'coat', smokehouse: 'fish' }

export function saveNow(sim: Sim) {
  try {
    const data: SaveV2 = {
      v: 3,
      money: Math.floor(sim.money),
      objective: sim.objective,
      stats: { ...sim.stats },
      stations: Object.fromEntries(
        STATION_IDS.map((id) => {
          const st = sim.stations[id]
          return [id, { level: st.level, stock: st.stock, unlocked: st.unlocked }]
        }),
      ),
      proc: Object.fromEntries(
        PROC_IDS.map((id) => {
          const pr = sim.proc[id]
          // items riding a belt go back on the table they came from
          const outCount = pr.outCount + sim.belts[PROC_BELT[id]].items.length
          return [id, { level: pr.level, inCount: pr.inCount, outCount, unlocked: pr.unlocked }]
        }),
      ),
      tower: {
        built: sim.tower.built,
        dmgLvl: sim.tower.dmgLvl,
        spdLvl: sim.tower.spdLvl,
        rngLvl: sim.tower.rngLvl,
      },
      workers: sim.workers.map((w) => w.role),
      player: { spdLvl: sim.player.spdLvl, carryLvl: sim.player.carryLvl, powerLvl: sim.player.powerLvl },
      pads: Object.fromEntries(sim.pads.map((p) => [p.id, { level: p.level, paid: p.paid }])),
      // cash riding a belt goes back on its pile so none is lost
      piles: Object.fromEntries(
        sim.piles.map((p) => {
          let v = p.value
          for (const id of STATION_IDS) if (sim.stations[id].payPileId === p.id) for (const c of sim.cash.belts[id].vals) v += c
          return [p.id, v]
        }),
      ),
      rep: { ...sim.rep },
      // a save taken mid-raid resumes at the start of that night's dusk
      clock: { enabled: sim.clock.enabled, t: sim.clock.night ? CLOCK.dayLength - 15 : sim.clock.t, day: sim.clock.day },
      raid: { count: sim.raid.count },
      zones: { ...sim.zones },
      lodge: { ...sim.lodge },
      game: { ...sim.game },
      caravan: { count: sim.caravan.count, nextIn: sim.caravan.state === 'away' ? sim.caravan.nextIn : 20 },
      rushBest: sim.rush.best,
      depot: sim.depot.count + sim.belts.wood.items.length,
      coalDepot: sim.coalDepot.count + sim.belts.coal.items.length,
      furnaceFuel: sim.furnace.fuel,
      // finished-but-unpaid tasks are kept open so the reward isn't lost
      tasks: sim.tasks.map((t) => ({ ...t, doneT: -1 })),
    }
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage unavailable — play without saves
  }
}

function migrateV1(d: any): SaveV2 {
  const { level, xp } = levelFromTotalXp(d.stats?.served ?? 0)
  return {
    v: 2,
    money: d.money ?? 0,
    objective: d.objective ?? 0,
    stats: d.stats ?? {},
    stations: d.stations ?? {},
    proc: d.kitchen
      ? {
          kitchen: {
            level: d.kitchen.level ?? 0,
            inCount: d.kitchen.raw ?? 0,
            outCount: d.kitchen.cooked ?? 0,
            unlocked: !!d.kitchen.unlocked,
          },
        }
      : {},
    tower: d.tower ?? { built: false, dmgLvl: 0, spdLvl: 0, rngLvl: 0 },
    workers: d.workers ?? [],
    player: d.player ?? { spdLvl: 0, carryLvl: 0 },
    pads: d.pads ?? {},
    piles: d.piles ?? {},
    rep: { xp, level },
    clock: { enabled: false, t: 0, day: 1 },
    raid: { count: 0 },
    zones: {},
    lodge: { spdLvl: 0, capLvl: 0 },
    game: { lvl: 0 },
    caravan: { count: 0, nextIn: CARAVAN.firstDelay },
    rushBest: 0,
  }
}

/** v3 multiplied every price and cost; keep old savings worth the same. */
function rescaleEconomy(d: SaveV2): SaveV2 {
  const k = ECONOMY.scale
  const piles: SaveV2['piles'] = {}
  for (const [id, v] of Object.entries(d.piles)) piles[id as PileId] = (v ?? 0) * k
  const pads: SaveV2['pads'] = {}
  for (const [id, pv] of Object.entries(d.pads)) pads[id] = { level: pv.level, paid: pv.paid * k }
  return { ...d, v: 3, money: d.money * k, piles, pads }
}

function apply(sim: Sim, d: SaveV2) {
  sim.money = d.money
  sim.objective = d.objective
  sim.stats = { ...sim.stats, ...d.stats }

  for (const id of STATION_IDS) {
    const sv = d.stations[id]
    if (!sv) continue
    const st = sim.stations[id]
    st.level = sv.level
    st.unlocked = sv.unlocked
    st.capacity = stationCapacity(id, sv.level)
    st.price = stationPrice(id, sv.level)
    st.serviceTime = stationServiceTime(id, sv.level)
    st.stock = Math.min(sv.stock, st.capacity)
  }

  for (const id of PROC_IDS) {
    const pv = d.proc[id]
    if (!pv) continue
    const pr = sim.proc[id]
    pr.level = pv.level
    pr.unlocked = pv.unlocked
    pr.time = procTime(id, pr.level)
    pr.inCap = procInCap(id, pr.level)
    pr.outCap = procOutCap(id, pr.level)
    pr.inCount = Math.min(pv.inCount, pr.inCap)
    pr.outCount = Math.min(pv.outCount, pr.outCap)
  }

  Object.assign(sim.tower, d.tower)

  sim.player.spdLvl = d.player.spdLvl
  sim.player.carryLvl = d.player.carryLvl
  sim.player.powerLvl = d.player.powerLvl ?? 0
  sim.player.speed = playerSpeed(sim.player.spdLvl)
  sim.player.carryCap = playerCarry(sim.player.carryLvl)

  for (const pad of sim.pads) {
    const pv = d.pads[pad.id]
    if (!pv) continue
    const def = PAD_BY_ID[pad.id]
    pad.level = pv.level
    pad.paid = pv.paid
    pad.done = pad.level >= def.maxLevel
    if (!pad.done) pad.cost = padCost(def, pad.level)
  }

  for (const pile of sim.piles) {
    const v = d.piles[pile.id]
    if (v != null) pile.value = v
  }

  sim.rep = { ...d.rep }
  sim.clock.enabled = d.clock.enabled
  sim.clock.t = Math.min(d.clock.t, CLOCK.dayLength - 15)
  sim.clock.day = d.clock.day
  sim.raid.count = d.raid.count
  for (const id of ZONE_IDS) sim.zones[id] = !!d.zones[id]
  sim.lodge = { ...d.lodge }
  sim.game = { ...d.game }
  sim.caravan.count = d.caravan.count
  sim.caravan.nextIn = Math.min(d.caravan.nextIn, 30)
  sim.rush.best = d.rushBest
  sim.depot.count = Math.min(d.depot ?? 0, sim.depot.cap)
  sim.coalDepot.count = Math.min(d.coalDepot ?? 0, sim.coalDepot.cap)

  // belts and the furnace are rebuilt from their pads
  for (const id of BELT_IDS) sim.belts[id].level = d.pads[`belt_${id}`]?.level ?? 0
  const f = sim.furnace
  f.built = sim.zones.mine
  f.level = d.pads.furnace_up?.level ?? 0
  f.cap = furnaceCap(f.level)
  f.fuel = Math.min(d.furnaceFuel ?? 0, f.cap)

  sim.tasks = (d.tasks ?? []).map((t) => ({ ...t, id: sim.ids++ }))

  sim.cash.level = d.pads.belt_cash?.level ?? 0

  for (const role of d.workers) hireWorker(sim, role)
  // haulers a belt has replaced don't come back
  for (const id of BELT_IDS) if (sim.belts[id].level > 0) retireWorkers(sim, BELT_RETIRES[id], true)
  if (sim.cash.level > 0) retireWorkers(sim, 'cashier', true)
}

export function loadSave(sim: Sim): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const d = JSON.parse(raw)
    if (!d || ![1, 2, 3].includes(d.v)) return false
    const save: SaveV2 = d.v === 1 ? migrateV1(d) : (d as SaveV2)
    apply(sim, save.v === 3 ? save : rescaleEconomy(save))
    sim.loaded = true
    return true
  } catch {
    return false
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
