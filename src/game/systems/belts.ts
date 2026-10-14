// Conveyor belts (late-game automation): items load at the source end, ride
// along the path at belt speed keeping a fixed gap, and drop into the sink at
// the far end. A full stall backs the line up, so a stalled belt reads as a
// bottleneck at a glance. The furnace burns coal here too.

import type { Sim, BeltId, WorkerRole, CashBeltSim, PileId } from '../types'
import { BELT, BELT_IDS, BELT_RETIRES, CASH_BELT, ECONOMY, FURNACE, REP, STATION_IDS, beltSpeed } from '../balance'
import { CASH_LIFT } from '../state'
import { fmt } from '../format'
import { sfx } from '../audio'
import { addXp, banner } from './progress'
import { type Source, type Sink, procSource, depotSource, stationSink, furnaceSink } from './sinks'

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
  }
}

// ---------------- belts replace their haulers ----------------

const RETIRED_NAME: Record<string, string> = {
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
  if (role === 'logCarrier') st.wood.stock += n
  else if (role === 'runner') st.meat.stock += n
  else if (role === 'coatRunner') st.coat.stock += n
  else if (role === 'fishRunner') st.fish.stock += n
  else if (role === 'coalCarrier') sim.furnace.fuel = Math.min(sim.furnace.cap, sim.furnace.fuel + n)
}

/** world position + heading of a point `d` metres along the belt */
export function beltPoint(sim: Sim, id: BeltId, d: number, out: { x: number; z: number; yaw: number }) {
  const b = sim.belts[id]
  const p = b.path
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
  const speed = beltSpeed(b.level)
  const items = b.items

  // front item: deliver when it reaches the end and the sink has room
  if (items.length && items[0] >= b.length - 0.001) {
    if (sink.open && sink.count < sink.cap) {
      items.shift()
      sink.put()
      b.blockedT = 0
      b.pulse = 0.18
      sfx.deposit()
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
  if (src.open && src.count > 0 && last >= BELT.spacing) {
    src.take()
    items.push(0)
  }
}

// ---------------- cash belts: pay piles -> chest ----------------

const H = CASH_BELT.height

/** where a cash bundle `d` metres along its belt is: up the lift, overhead, down into the chest */
export function cashPoint(b: CashBeltSim, d: number, out: { x: number; y: number; z: number; yaw: number }) {
  const p = b.path
  if (d <= CASH_LIFT) {
    out.x = p[0].x
    out.z = p[0].z
    out.y = H - CASH_LIFT + d
    out.yaw = Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z)
    return out
  }
  const h = d - CASH_LIFT
  if (h >= b.run) {
    const end = p[p.length - 1]
    const prev = p[p.length - 2]
    out.x = end.x
    out.z = end.z
    out.y = H - Math.min(CASH_LIFT, h - b.run)
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
  out.y = H
  out.yaw = Math.atan2(c.x - a.x, c.z - a.z)
  return out
}

function updateCashBelts(sim: Sim, dt: number) {
  const cash = sim.cash
  if (cash.level <= 0) return
  const speed = beltSpeed(cash.level) * 1.2
  const chest = sim.chest.pos

  for (const id of STATION_IDS) {
    const b = cash.belts[id]
    const st = sim.stations[id]
    if (!st.unlocked) continue
    const pile = sim.piles.find((p) => p.id === st.payPileId)!

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
      const take = Math.min(Math.floor(pile.value), Math.max(ECONOMY.billValue, Math.ceil(pile.value * CASH_BELT.chunkFrac)))
      pile.value -= take
      b.items.push(0)
      b.vals.push(take)
    }
  }

  // caravan pay and wolf bounties have no stall: bank them straight into the chest
  for (const id of ['caravanPay', 'bountyPay'] as PileId[]) {
    const pile = sim.piles.find((p) => p.id === id)!
    if (pile.value < 1) continue
    const take = Math.min(pile.value, Math.max(CASH_BELT.bankRate, pile.value * 1.5) * dt)
    pile.value -= take
    sim.money += take
    sim.stats.collected += take
    cash.fxAcc += take
    if (Math.random() < dt * 8) sim.fx.push({ t: 'coin', x: pile.pos.x, y: 0.6, z: pile.pos.z, to: { x: chest.x, y: 0.8, z: chest.z } })
  }

  // one "+$" pop at the chest every so often instead of one per bundle
  cash.fxT -= dt
  if (cash.fxT <= 0 && cash.fxAcc >= 1) {
    cash.fxT = 0.7
    sim.fx.push({ t: 'text', x: chest.x, y: 1.8, z: chest.z, str: `+$${fmt(Math.floor(cash.fxAcc))}`, color: '#b8ff9a', size: 0.9 })
    sim.fx.push({ t: 'burst', x: chest.x, y: 0.8, z: chest.z, color: '#7fdc8f', n: 5, spread: 0.5 })
    sfx.coin()
    cash.fxAcc = 0
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
  }
  if (f.burnT <= 0) f.burnT = 0
  f.burning = f.burnT > 0
}

export function updateBelts(sim: Sim, dt: number) {
  for (const id of BELT_IDS) updateBelt(sim, id, dt)
  updateCashBelts(sim, dt)
  updateFurnace(sim, dt)
}
