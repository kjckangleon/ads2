// Market pressure (late game): every stall and freight terminal watches how
// often it runs dry. Keeping it stocked makes word spread: demand climbs
// (bigger bundles, more survivors, bigger truck orders) until your supply only
// just keeps up. Fall behind and it eases off a little, but survivors who wait
// too long at an empty counter walk away. Ships and planes grow their orders
// every time you fill one fast.

import type { Sim, StationSim, TerminalSim } from '../types'
import { PRESSURE, STATION_IDS, TERMINAL_IDS } from '../balance'
import { NEED_ICON } from '../icons'
import { banner } from './progress'

const STALL_NAME: Record<string, string> = { wood: 'Wood', meat: 'Meat', coat: 'Coat', fish: 'Fish' }
const TERM_NAME: Record<string, string> = { dock: '🚚 Truck', port: '🚢 Port', air: '✈️ Airport' }

export const pressureOn = (sim: Sim) => sim.rep.level >= PRESSURE.level

/** one pressure window: returns the new demand */
function adjust(d: number, emptyFrac: number) {
  if (emptyFrac < PRESSURE.calm) return Math.min(PRESSURE.max, d * PRESSURE.up)
  if (emptyFrac > PRESSURE.swamped) return Math.max(1, d * PRESSURE.down)
  return d
}

function step(sim: Sim, x: StationSim | TerminalSim, empty: boolean, dt: number, name: string) {
  x.winT += dt
  if (empty) x.emptyT += dt
  if (x.winT < PRESSURE.window) return
  const before = x.demand
  x.demand = adjust(x.demand, x.emptyT / x.winT)
  x.winT = 0
  x.emptyT = 0
  // a quiet alert (🔔) each time demand passes another step
  if (Math.floor(x.demand / PRESSURE.noticeStep) > Math.floor(before / PRESSURE.noticeStep)) {
    banner(sim, `📈 ${name} demand ×${x.demand.toFixed(1)}`, 'Keep up: the more you supply, the more they want', 'info')
  }
}

export function updatePressure(sim: Sim, dt: number) {
  if (!pressureOn(sim)) return
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    if (st.unlocked) step(sim, st, st.stock === 0, dt, `${NEED_ICON[id]} ${STALL_NAME[id]}`)
  }
  for (const id of TERMINAL_IDS) {
    const t = sim.terminals[id]
    // only the Truck Depot has a steady stream; ships and planes adjust per order (see freight)
    if (id === 'dock' && t.open) step(sim, t, (t.stock.furniture ?? 0) === 0, dt, TERM_NAME[id])
  }
}

/** after a ship or plane leaves: grow (or shrink) the next order */
export function afterBigOrder(sim: Sim, kind: 'ship' | 'plane', full: boolean, timeLeftFrac: number) {
  if (!pressureOn(sim)) return
  const f = sim.freight
  const cur = kind === 'ship' ? f.shipDemand : f.planeDemand
  const mult = !full ? PRESSURE.failDown : timeLeftFrac >= PRESSURE.fastFill ? PRESSURE.bigUp : PRESSURE.okUp
  const next = Math.max(1, Math.min(PRESSURE.max, cur * mult))
  if (kind === 'ship') f.shipDemand = next
  else f.planeDemand = next
}
