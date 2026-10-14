// Conveyor belts (late-game automation): items load at the source end, ride
// along the path at belt speed keeping a fixed gap, and drop into the sink at
// the far end. A full stall backs the line up, so a stalled belt reads as a
// bottleneck at a glance. The furnace burns coal here too.

import type {
  Sim,
  BeltId,
  WorkerRole,
  CashBeltSim,
  CashBeltId,
  StationId,
  MachineId,
  MachineSim,
  ResKind,
  TreeSim,
  ProcessorId,
} from '../types'
import {
  BELT,
  BELT_IDS,
  ALL_BELT_IDS,
  BELT_RETIRES,
  CASH_BELT,
  CASH_BELT_IDS,
  cashBeltSpeed,
  cashChunkFrac,
  FREIGHT,
  EXPORT_BELT_IDS,
  ECONOMY,
  FURNACE,
  REP,
  MACHINE,
  MACHINE_IDS,
  MACHINE_CFG,
  beltSpeed,
  machineWorkTime,
  furnacePay,
  starSalesMult,
  nodeRegrow,
} from '../balance'
import { dist, lerpAngle, damp } from '../util'
import { beltPerkMult } from '../perks'
import { fmt } from '../format'
import { sfx } from '../audio'
import { addXp, banner } from './progress'
import {
  type Source,
  type Sink,
  procSource,
  depotSource,
  stationSink,
  furnaceSink,
  procInSink,
  depotSink,
  terminalSink,
} from './sinks'

function beltEnds(sim: Sim, id: BeltId): { src: Source; sink: Sink } {
  switch (id) {
    case 'wood':
      return { src: depotSource(sim.depot), sink: stationSink(sim, 'wood') }
    case 'meat':
      return { src: procSource(sim.proc.kitchen), sink: stationSink(sim, 'meat') }
    case 'coat':
      return { src: procSource(sim.proc.tailor), sink: stationSink(sim, 'coat') }
    case 'fish':
      return { src: procSource(sim.proc.smokehouse), sink: stationSink(sim, 'fish') }
    case 'coal':
      return { src: depotSource(sim.coalDepot), sink: furnaceSink(sim) }
    case 'saw':
      return { src: machineSource(sim.machines.saw, 'log'), sink: depotSink(sim.depot, 'stacking logs') }
    case 'skinRaw':
      return { src: machineSource(sim.machines.skinner, 'raw'), sink: procInSink(sim.proc.kitchen) }
    case 'skinHide':
      return { src: machineSource(sim.machines.skinner, 'hide'), sink: procInSink(sim.proc.tailor) }
    case 'auger':
      return { src: machineSource(sim.machines.auger, 'fish'), sink: procInSink(sim.proc.smokehouse) }
    case 'drill':
      return { src: machineSource(sim.machines.drill, 'coal'), sink: depotSink(sim.coalDepot, 'stacking coal') }
    // Industrial Park: export lines out of the camp, product belts to the terminals
    case 'exLog':
      return { src: depotSource(sim.depot), sink: procInSink(sim.proc.furnFactory) }
    case 'exCoal':
      return { src: depotSource(sim.coalDepot), sink: procInSink(sim.proc.steelMill) }
    case 'exCoat':
      return { src: procSource(sim.proc.tailor), sink: procInSink(sim.proc.fashion) }
    case 'exFish':
      return { src: procSource(sim.proc.smokehouse), sink: procInSink(sim.proc.cannery) }
    case 'pFurn':
      return { src: procSource(sim.proc.furnFactory), sink: terminalSink(sim.terminals.dock, 'furniture') }
    case 'pSteel':
      return { src: procSource(sim.proc.steelMill), sink: terminalSink(sim.terminals.port, 'steel') }
    case 'pJacket':
      return { src: procSource(sim.proc.fashion), sink: terminalSink(sim.terminals.air, 'jacket') }
    case 'pCanned':
      return { src: procSource(sim.proc.cannery), sink: terminalSink(sim.terminals.air, 'canned') }
  }
}

/**
 * Export lines share their camp source with the stalls: they get first pick
 * of only their share of what's hauled off it (more with upgrades), plus
 * anything that piles up because nobody else is taking it.
 */
type ExportShares = Partial<Record<BeltId, { ex: number; all: number; seen: number }>>
const settlementShares = new WeakMap<Sim, ExportShares>()
function sharesFor(sim: Sim): ExportShares {
  let shares = settlementShares.get(sim)
  if (!shares) {
    shares = {}
    settlementShares.set(sim, shares)
  }
  return shares
}

function exportAllowed(sim: Sim, id: BeltId, srcCount: number, dt: number): boolean {
  const b = sim.belts[id]
  const total =
    id === 'exLog'
      ? sim.depot.taken
      : id === 'exCoal'
        ? sim.coalDepot.taken
        : id === 'exCoat'
          ? sim.proc.tailor.taken
          : sim.proc.smokehouse.taken
  const now = total ?? 0
  const st = (sharesFor(sim)[id] ??= { ex: 0, all: 0, seen: now })
  st.all += Math.max(0, now - st.seen)
  st.seen = now
  // forget slowly, so the split follows what's happening now
  const k = Math.exp(-dt / 40)
  st.ex *= k
  st.all *= k
  const share = FREIGHT.exportShare[Math.min(FREIGHT.exportShare.length - 1, b.level)]
  return srcCount >= FREIGHT.exportOverflow || st.ex <= share * st.all + 0.5
}

function noteExport(sim: Sim, id: BeltId) {
  const st = sharesFor(sim)[id]
  if (st) st.ex++
}

const isExport = (id: BeltId) => (EXPORT_BELT_IDS as BeltId[]).includes(id)

function machineSource(m: MachineSim, kind: ResKind): Source {
  return {
    at: m.pos,
    kind,
    open: m.level > 0,
    count: m.buf[kind] ?? 0,
    take: () => (m.buf[kind] = (m.buf[kind] ?? 0) - 1),
  }
}

// ---------------- belts replace their haulers ----------------

const RETIRED_NAME: Record<string, string> = {
  lumberjack: 'Lumberjacks',
  collector: 'Meat Collectors',
  fisher: 'Fishers',
  miner: 'Miners',
  cook: 'Cooks',
  tailor: 'Tailors',
  smoker: 'Smokers',
  logCarrier: 'Log Carriers',
  runner: 'Food Runners',
  coatRunner: 'Coat Runners',
  fishRunner: 'Fish Runners',
  coalCarrier: 'Coal Carriers',
  cashier: 'Cash Collectors',
}

/** the belt (or cash belt) that does this role's job, if it's built */
export function beltReplaces(sim: Sim, role: WorkerRole): boolean {
  if (role === 'cashier') return sim.cash.level > 0
  for (const id of BELT_IDS) if (BELT_RETIRES[id] === role && sim.belts[id].level > 0) return true
  for (const id of MACHINE_IDS) if (MACHINE_CFG[id].retires === role && sim.machines[id].level > 0) return true
  return false
}

/** a built automaton is running this workshop */
export function machineStaffs(sim: Sim, proc: ProcessorId): boolean {
  for (const id of MACHINE_IDS) if (MACHINE_CFG[id].proc === proc && sim.machines[id].level > 0) return true
  return false
}

/** this job is covered: a worker is hired for it, or a belt took it over */
export function automated(sim: Sim, role: WorkerRole): boolean {
  return beltReplaces(sim, role) || sim.workers.some((w) => w.role === role)
}

/**
 * A belt went in: the haulers it replaces finish their trip on the spot (their
 * load lands where it was headed) and leave, so the area stops being crowded.
 */
export function retireWorkers(sim: Sim, role: WorkerRole, quiet = false) {
  const leaving = sim.workers.filter((w) => w.role === role)
  if (!leaving.length) return
  for (const w of leaving) {
    if (w.coins > 0) {
      sim.money += w.coins
      sim.stats.collected += w.coins
    }
    for (const p of sim.piles) if (p.claimedBy === w.id) p.claimedBy = null
    if (w.carry.length) deliverLoad(sim, role, w.carry.length)
    if (!quiet) sim.fx.push({ t: 'burst', x: w.pos.x, y: 1.2, z: w.pos.z, color: '#cfd8e6', n: 10, spread: 0.7 })
  }
  sim.workers = sim.workers.filter((w) => w.role !== role)
  if (!quiet) banner(sim, `👋 ${RETIRED_NAME[role]} retired`, 'The belt does their job now', 'info')
}

function deliverLoad(sim: Sim, role: WorkerRole, n: number) {
  const st = sim.stations
  const pr = sim.proc
  if (role === 'lumberjack') sim.depot.count += n
  else if (role === 'collector') pr.kitchen.inCount += n
  else if (role === 'fisher') pr.smokehouse.inCount += n
  else if (role === 'miner') sim.coalDepot.count += n
  if (role === 'logCarrier') st.wood.stock += n
  else if (role === 'runner') st.meat.stock += n
  else if (role === 'coatRunner') st.coat.stock += n
  else if (role === 'fishRunner') st.fish.stock += n
  else if (role === 'coalCarrier') sim.furnace.fuel = Math.min(sim.furnace.cap, sim.furnace.fuel + n)
}

/**
 * world position + heading of a point `d` metres along the belt. Overhead
 * belts climb a lift at the start and drop down one at the end (`y` is set
 * when the out object has one).
 */
export function beltPoint(sim: Sim, id: BeltId, d: number, out: { x: number; z: number; yaw: number; y?: number }) {
  const b = sim.belts[id]
  const p = b.path
  if (b.h > 0) {
    if (d <= b.lift) {
      out.x = p[0].x
      out.z = p[0].z
      out.y = b.h - b.lift + d
      out.yaw = Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z)
      return out
    }
    if (d >= b.lift + b.run) {
      const end = p[p.length - 1]
      const prev = p[p.length - 2]
      out.x = end.x
      out.z = end.z
      out.y = b.h - Math.min(b.lift, d - b.lift - b.run)
      out.yaw = Math.atan2(end.x - prev.x, end.z - prev.z)
      return out
    }
    d -= b.lift
    out.y = b.h
  }
  let i = 1
  while (i < p.length - 1 && b.dists[i] < d) i++
  const a = p[i - 1]
  const c = p[i]
  const seg = b.dists[i] - b.dists[i - 1] || 1
  const t = Math.max(0, Math.min(1, (d - b.dists[i - 1]) / seg))
  out.x = a.x + (c.x - a.x) * t
  out.z = a.z + (c.z - a.z) * t
  out.yaw = Math.atan2(c.x - a.x, c.z - a.z)
  return out
}

function updateBelt(sim: Sim, id: BeltId, dt: number) {
  const b = sim.belts[id]
  if (b.level <= 0) return
  if (b.pulse > 0) b.pulse -= dt
  const { src, sink } = beltEnds(sim, id)
  const speed = beltSpeed(b.level) * beltPerkMult(sim)
  const items = b.items

  // front item: deliver when it reaches the end and the sink has room
  if (items.length && items[0] >= b.length - 0.001) {
    if (sink.open && sink.count < sink.cap) {
      items.shift()
      sink.put()
      b.blockedT = 0
      b.pulse = 0.18
      sfx.beltDrop()
      const end = b.path[b.path.length - 1]
      sim.fx.push({ t: 'itemfly', kind: b.kind, from: { x: end.x, y: 0.55, z: end.z }, to: sink.to })
    } else {
      b.blockedT += dt
    }
  }

  // advance, keeping the gap to the item in front
  const step = speed * dt
  let limit = b.length
  for (let i = 0; i < items.length; i++) {
    items[i] = Math.min(items[i] + step, limit)
    limit = items[i] - BELT.spacing
  }

  // load a new item once the start is clear
  const last = items.length ? items[items.length - 1] : Infinity
  const exp = isExport(id)
  if (exp && !exportAllowed(sim, id, src.count, dt)) return
  if (src.open && src.count > 0 && last >= BELT.spacing) {
    src.take()
    items.push(0)
    if (exp) noteExport(sim, id)
  }
}

// ---------------- cash belts: pay piles -> chest ----------------

/** where a cash bundle `d` metres along its belt is: up the lift, overhead, down into the chest */
export function cashPoint(b: CashBeltSim, d: number, out: { x: number; y: number; z: number; yaw: number }) {
  const p = b.path
  if (d <= b.lift) {
    out.x = p[0].x
    out.z = p[0].z
    out.y = b.h - b.lift + d
    out.yaw = Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z)
    return out
  }
  const h = d - b.lift
  if (h >= b.run) {
    const end = p[p.length - 1]
    const prev = p[p.length - 2]
    out.x = end.x
    out.z = end.z
    out.y = b.h - Math.min(b.lift, h - b.run)
    out.yaw = Math.atan2(end.x - prev.x, end.z - prev.z)
    return out
  }
  let i = 1
  while (i < p.length - 1 && b.dists[i] < h) i++
  const a = p[i - 1]
  const c = p[i]
  const t = (h - b.dists[i - 1]) / (b.dists[i] - b.dists[i - 1] || 1)
  out.x = a.x + (c.x - a.x) * t
  out.z = a.z + (c.z - a.z) * t
  out.y = b.h
  out.yaw = Math.atan2(c.x - a.x, c.z - a.z)
  return out
}

/** a cash belt runs once its pile has something feeding it */
export function cashBeltOn(sim: Sim, id: CashBeltId) {
  if (sim.cash.level <= 0) return false
  if (id === 'heat') return sim.furnace.built
  if (id === 'bounty') return sim.clock.enabled
  if (id === 'dock' || id === 'port' || id === 'air') return sim.terminals[id].open
  return sim.stations[id as StationId].unlocked
}

function updateCashBelts(sim: Sim, dt: number) {
  const cash = sim.cash
  if (cash.level <= 0) return
  // Greased Gears helps too, but never past the easy-to-watch cap
  const speed = Math.min(CASH_BELT.maxSpeed, cashBeltSpeed(cash.level) * beltPerkMult(sim))
  const chest = sim.chest.pos

  for (const id of CASH_BELT_IDS) {
    const b = cash.belts[id]
    if (!cashBeltOn(sim, id)) continue
    const pile = sim.piles.find((p) => p.id === b.pile)!

    // the front bundle drops into the chest
    while (b.items.length && b.items[0] >= b.length - 0.001) {
      b.items.shift()
      const v = b.vals.shift()!
      sim.money += v
      sim.stats.collected += v
      cash.fxAcc += v
    }
    const step = speed * dt
    let limit = b.length
    for (let i = 0; i < b.items.length; i++) {
      b.items[i] = Math.min(b.items[i] + step, limit)
      limit = b.items[i] - BELT.spacing
    }
    // load a bundle off the pile once the lift is clear
    const last = b.items.length ? b.items[b.items.length - 1] : Infinity
    if (pile.value >= 1 && pile.claimedBy === null && last >= BELT.spacing) {
      const take = Math.min(
        Math.floor(pile.value),
        Math.max(ECONOMY.billValue, Math.ceil(pile.value * cashChunkFrac(cash.level))),
      )
      pile.value -= take
      b.items.push(0)
      b.vals.push(take)
    }
  }

  // caravan pay has no belt: bank it straight into the chest
  const caravan = sim.piles.find((p) => p.id === 'caravanPay')!
  if (caravan.value >= 1) {
    const take = Math.min(caravan.value, Math.max(CASH_BELT.bankRate, caravan.value * 1.5) * dt)
    caravan.value -= take
    sim.money += take
    sim.stats.collected += take
    cash.fxAcc += take
    if (Math.random() < dt * 8) {
      sim.fx.push({ t: 'coin', x: caravan.pos.x, y: 0.6, z: caravan.pos.z, to: { x: chest.x, y: 0.8, z: chest.z } })
    }
  }

  // one "+$" pop at the chest every so often instead of one per bundle
  cash.fxT -= dt
  if (cash.fxT <= 0 && cash.fxAcc >= 1) {
    cash.fxT = 0.7
    sim.fx.push({
      t: 'text',
      x: chest.x,
      y: 1.8,
      z: chest.z,
      str: `+$${fmt(Math.floor(cash.fxAcc))}`,
      color: '#b8ff9a',
      size: 0.9,
    })
    sim.fx.push({ t: 'burst', x: chest.x, y: 0.8, z: chest.z, color: '#7fdc8f', n: 5, spread: 0.5 })
    sfx.softCoin()
    cash.fxAcc = 0
  }
}

// ---------------- machines ----------------

function machineNodes(sim: Sim, id: MachineId): TreeSim[] {
  const k = MACHINE_CFG[id].nodes
  if (k === 'tree') return sim.trees
  if (k === 'hole') return sim.zones.fishery ? sim.holes : []
  if (k === 'seam') return sim.zones.mine ? sim.seams : []
  return []
}

/** saw / auger / drill: swing to the nearest stocked node in reach and work it */
function updateGatherMachine(sim: Sim, m: MachineSim, dt: number) {
  const cfg = MACHINE_CFG[m.id]
  const kind = cfg.out!
  const nodes = machineNodes(sim, m.id)
  m.active = false
  if ((m.buf[kind] ?? 0) >= MACHINE.bufCap) return
  let node = nodes[m.target]
  if (!node || node.wood <= 0 || dist(node.pos, m.pos) > cfg.reach!) {
    m.target = -1
    let best = cfg.reach!
    nodes.forEach((n, i) => {
      if (n.wood <= 0) return
      const d = dist(n.pos, m.pos)
      if (d < best) {
        best = d
        m.target = i
      }
    })
    node = nodes[m.target]
  }
  if (!node) return
  m.active = true
  m.spin += dt
  m.yaw = lerpAngle(m.yaw, Math.atan2(node.pos.x - m.pos.x, node.pos.z - m.pos.z), damp(6, dt))
  m.workT += dt
  if (m.workT < machineWorkTime(m.id, m.level) / beltPerkMult(sim)) return
  m.workT = 0
  node.wood--
  node.shake = 1
  m.buf[kind] = (m.buf[kind] ?? 0) + 1
  if (node.wood <= 0) node.regrowT = nodeRegrow(cfg.nodes!, sim.rep.level)
  sim.fx.push({
    t: 'itemfly',
    kind,
    from: { x: node.pos.x, y: 1.0, z: node.pos.z },
    to: { x: m.pos.x, y: 1.4, z: m.pos.z },
  })
  if (kind === 'log') sfx.chop()
  else if (kind === 'coal') sfx.thud()
}

/** skinner: pulls every kill on the map into the machine, meat and hides apart */
function updateSkinner(sim: Sim, m: MachineSim, dt: number) {
  m.active = false
  const room = (k: ResKind) => (m.buf[k] ?? 0) < MACHINE.bufCap * 2
  let near = -1
  let best = Infinity
  sim.drops.forEach((d, i) => {
    if (d.reservedBy !== null || !room(d.kind)) return
    const dd = dist(d.pos, m.pos)
    if (dd < best) {
      best = dd
      near = i
    }
  })
  if (near < 0) return
  m.active = true
  m.spin += dt
  m.workT += dt
  if (m.workT < machineWorkTime(m.id, m.level) / beltPerkMult(sim)) return
  m.workT = 0
  const d = sim.drops[near]
  sim.drops.splice(near, 1)
  m.buf[d.kind] = (m.buf[d.kind] ?? 0) + 1
  // it skins the carcass too: meat comes with a share of a hide (coats need lots of them)
  if (d.kind === 'raw' && sim.proc.tailor.unlocked && room('hide')) {
    m.skin += MACHINE.hidePerMeat[Math.min(MACHINE.hidePerMeat.length, m.level) - 1]
    while (m.skin >= 1 && room('hide')) {
      m.skin -= 1
      m.buf.hide = (m.buf.hide ?? 0) + 1
    }
  }
  sim.fx.push({
    t: 'itemfly',
    kind: d.kind,
    from: { x: d.pos.x, y: 0.3, z: d.pos.z },
    to: { x: m.pos.x, y: 1.6, z: m.pos.z },
  })
}

function updateMachines(sim: Sim, dt: number) {
  for (const id of MACHINE_IDS) {
    const m = sim.machines[id]
    if (m.level <= 0) continue
    const cfg = MACHINE_CFG[id]
    if (cfg.kind === 'gather') updateGatherMachine(sim, m, dt)
    else if (cfg.kind === 'collect') updateSkinner(sim, m, dt)
    else {
      m.active = sim.proc[cfg.proc!].active
      if (m.active) m.spin += dt
    }
  }
}

function updateFurnace(sim: Sim, dt: number) {
  const f = sim.furnace
  if (!f.built) {
    f.burning = false
    return
  }
  if (f.burnT > 0) f.burnT -= dt
  if (f.burnT <= 0 && f.fuel > 0) {
    f.fuel--
    f.burnT += FURNACE.burnTime
    sim.stats.coalBurned++
    addXp(sim, REP.xpCoal)
    // every lump burned is heat sold: cash lands on the pile by the furnace
    const pay = Math.round(furnacePay(f.level) * starSalesMult(sim.meta.stars))
    const pile = sim.piles.find((p) => p.id === 'heatPay')!
    pile.value += pay
    sim.stats.earned += pay
    if (sim.stats.coalBurned % 4 === 0) {
      sim.fx.push({ t: 'coin', x: f.pos.x, y: 2.2, z: f.pos.z, to: { x: pile.pos.x, y: 0.4, z: pile.pos.z } })
      sim.fx.push({
        t: 'text',
        x: pile.pos.x,
        y: 1.6,
        z: pile.pos.z,
        str: `+$${fmt(pay * 4)} 🔥`,
        color: '#ffd29a',
        size: 0.8,
      })
    }
  }
  if (f.burnT <= 0) f.burnT = 0
  f.burning = f.burnT > 0
}

export function updateBelts(sim: Sim, dt: number) {
  updateMachines(sim, dt)
  // export lines pick first (their share keeps the stalls supplied), then everything else
  for (const id of EXPORT_BELT_IDS) updateBelt(sim, id, dt)
  for (const id of ALL_BELT_IDS) if (!isExport(id)) updateBelt(sim, id, dt)
  updateCashBelts(sim, dt)
  updateFurnace(sim, dt)
}
