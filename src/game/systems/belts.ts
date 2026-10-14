// Conveyor belts (late-game automation): items load at the source end, ride
// along the path at belt speed keeping a fixed gap, and drop into the sink at
// the far end. A full stall backs the line up, so a stalled belt reads as a
// bottleneck at a glance. The furnace burns coal here too.

import type { Sim, BeltId } from '../types'
import { BELT, BELT_IDS, FURNACE, REP, beltSpeed } from '../balance'
import { sfx } from '../audio'
import { addXp } from './progress'
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
  updateFurnace(sim, dt)
}
