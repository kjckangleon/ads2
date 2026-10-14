// Where carried resources come from and go to. Haulers, gatherers and
// conveyor belts all move items between a Source and a Sink, so a new chain
// only has to name its endpoints.

import type { Sim, ResKind, V2, V3, ProcessorSim, StationId, DepotSim, TerminalSim } from '../types'

/** Somewhere items are loaded from: a workshop's output table or a depot pile. */
export interface Source {
  at: V2
  kind: ResKind
  open: boolean
  count: number
  take: () => void
}

/** Somewhere items are dropped into: a stall counter, a workshop input, the furnace. */
export interface Sink {
  at: V2
  /** where delivered items fly to */
  to: V3
  open: boolean
  count: number
  cap: number
  put: () => void
  /** worker activity while unloading */
  label: string
  full: string
}

export function procSource(pr: ProcessorSim): Source {
  return {
    at: pr.outZone,
    kind: pr.outKind,
    open: pr.unlocked,
    count: pr.outCount,
    take: () => {
      pr.outCount--
      pr.taken = (pr.taken ?? 0) + 1
    },
  }
}

export function depotSource(d: DepotSim): Source {
  return {
    at: d.pos,
    kind: d.kind,
    open: true,
    count: d.count,
    take: () => {
      d.count--
      d.taken = (d.taken ?? 0) + 1
    },
  }
}

export function stationSink(sim: Sim, id: StationId): Sink {
  const st = sim.stations[id]
  return {
    at: st.restock,
    to: { x: st.pos.x, y: 1.2, z: st.pos.z },
    open: st.unlocked,
    count: st.stock,
    cap: st.capacity,
    put: () => st.stock++,
    label: 'restocking counter',
    full: 'counter full!',
  }
}

export function procInSink(pr: ProcessorSim): Sink {
  return {
    at: pr.inZone,
    to: { x: pr.inZone.x, y: 0.8, z: pr.inZone.z },
    open: pr.unlocked,
    count: pr.inCount,
    cap: pr.inCap,
    put: () => pr.inCount++,
    label: `stocking the ${pr.id}`,
    full: `${pr.id} full!`,
  }
}

export function furnaceSink(sim: Sim): Sink {
  const f = sim.furnace
  return {
    at: f.feed,
    to: { x: f.pos.x, y: 1.0, z: f.pos.z },
    open: f.built,
    count: f.fuel,
    cap: f.cap,
    put: () => f.fuel++,
    label: 'stoking the furnace',
    full: 'furnace full!',
  }
}

export function depotSink(d: DepotSim, label: string): Sink {
  return {
    at: d.pos,
    to: { x: d.pos.x, y: 0.6, z: d.pos.z },
    open: true,
    count: d.count,
    cap: d.cap,
    put: () => d.count++,
    label,
    full: `${label.replace(/^stacking /, '')} pile full!`,
  }
}

/** an Industrial Park terminal's stock of one product */
export function terminalSink(t: TerminalSim, kind: ResKind): Sink {
  return {
    at: t.restock,
    to: { x: t.pos.x, y: 1.0, z: t.pos.z },
    open: t.open,
    count: t.stock[kind] ?? 0,
    cap: t.cap,
    put: () => (t.stock[kind] = (t.stock[kind] ?? 0) + 1),
    label: `stocking the ${t.id}`,
    full: `${t.id} full!`,
  }
}
