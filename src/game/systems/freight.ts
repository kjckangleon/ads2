// Industrial Park customers: trucks queue at the Truck Depot for furniture,
// cargo ships dock at the Port for steel, cargo planes land for designer
// jackets and canned fish. Each loads from its terminal's stock (fed by the
// product belts or carried in by hand) and pays onto the terminal's pile.

import type { Sim, VehicleSim, TerminalSim, FreightLine, RoutePt, VehicleKind } from '../types'
import { FREIGHT, PARK, freightPrice, freightOrderCapacity, starSalesMult } from '../balance'
import { RES_ICON } from '../icons'
import { fmt } from '../format'
import { sfx } from '../audio'
import { addXp, banner } from './progress'

const T = FREIGHT.truck
const SHIP = FREIGHT.ship
const PLANE = FREIGHT.plane
/** a truck at the bay gives up after this long with nothing to load */
const TRUCK_PATIENCE = 40

const pt = (x: number, z: number, v: number, y = 0): RoutePt => ({ x, y, z, v })

function truckSlotX(slot: number) {
  return PARK.truckBay.x - PARK.truckSpacing * slot
}

/** the route a loaded truck drives away on: forward, U-turn, back west on the outbound lane */
function truckLeaveRoute(): RoutePt[] {
  const lz = PARK.truckLaneZ
  const oz = PARK.truckOutZ
  const tx = PARK.truckTurnX
  return [
    pt(tx - 2.5, lz, T.speed),
    pt(tx, (lz + oz) / 2, T.speed * 0.6),
    pt(tx - 2.5, oz, T.speed * 0.6),
    pt(-90, oz, T.speed),
  ]
}

function shipArriveRoute(): RoutePt[] {
  const b = PARK.berth
  return [pt(60, 80, 10), pt(b.x + 4, b.z, 4), pt(b.x, b.z, 2)]
}
function shipLeaveRoute(): RoutePt[] {
  const b = PARK.berth
  return [pt(b.x - 6, b.z + 1, 3), pt(-20, 82, 7), pt(-140, 92, 10)]
}

function planeArriveRoute(): RoutePt[] {
  const z = PARK.runwayZ
  const s = PARK.stand
  // descend from the west, touch down and roll to a stop by the cargo terminal
  return [pt(-150, z, 26, 22), pt(-56, z, 22, 0), pt(s.x - 10, z, 10), pt(s.x, s.z, 3)]
}
function planeLeaveRoute(): RoutePt[] {
  const z = PARK.runwayZ
  // carry on east and lift off over the port
  return [pt(16, z, 14), pt(40, z, 22, 4), pt(90, z, 28, 18), pt(170, z, 30, 36)]
}

function newVehicle(sim: Sim, kind: VehicleKind, route: RoutePt[]): VehicleSim {
  const start = route[0]
  const v: VehicleSim = {
    id: sim.ids++,
    kind,
    state: 'arrive',
    t: 0,
    slot: -1,
    pos: { x: start.x, z: start.z },
    y: start.y,
    yaw: 0,
    route,
    seg: 1,
    order: [],
    loadT: 0,
    timer: 0,
    maxTimer: 0,
    variant: Math.floor(Math.random() * 4),
  }
  sim.freight.vehicles.push(v)
  return v
}

/** drive along the route; true once the last waypoint is reached */
function drive(v: VehicleSim, dt: number): boolean {
  while (v.seg < v.route.length) {
    const to = v.route[v.seg]
    const dx = to.x - v.pos.x
    const dz = to.z - v.pos.z
    const dy = to.y - v.y
    const d = Math.hypot(dx, dz, dy)
    const step = to.v * dt
    if (d > 0.001) v.yaw = Math.atan2(dx, dz)
    if (d <= step) {
      v.pos.x = to.x
      v.pos.z = to.z
      v.y = to.y
      v.seg++
      dt -= d / Math.max(0.01, to.v)
      if (dt <= 0) return v.seg >= v.route.length
      continue
    }
    v.pos.x += (dx / d) * step
    v.pos.z += (dz / d) * step
    v.y += (dy / d) * step
    return false
  }
  return true
}

function leave(v: VehicleSim, route: RoutePt[]) {
  v.state = 'leave'
  v.route = route
  v.seg = 0
}

/** load from the terminal's stock; returns how many items moved this frame */
function loadFrom(sim: Sim, t: TerminalSim, v: VehicleSim, dt: number, speed = 1): number {
  v.loadT += dt * speed
  let moved = 0
  while (v.loadT >= t.loadTime) {
    const line = v.order.find((o) => o.got < o.need && (t.stock[o.kind] ?? 0) > 0)
    if (!line) {
      v.loadT = 0
      break
    }
    v.loadT -= t.loadTime
    t.stock[line.kind]!--
    line.got++
    moved++
    if (moved <= 2) {
      sim.fx.push({
        t: 'itemfly',
        kind: line.kind,
        from: { x: t.pos.x, y: 1.2, z: t.pos.z },
        to: { x: v.pos.x, y: 1.6 + v.y, z: v.pos.z },
      })
    }
  }
  if (moved) sfx.deposit()
  return moved
}

const orderDone = (o: FreightLine[]) => o.every((l) => l.got >= l.need)

/** pay for what was loaded (plus a bonus) onto the terminal's cash pile */
function pay(sim: Sim, t: TerminalSim, v: VehicleSim, bonus: number): number {
  let sum = 0
  for (const l of v.order) sum += l.got * freightPrice(l.kind, t.level)
  const total = Math.round(sum * (1 + bonus) * starSalesMult(sim.meta.stars))
  if (total <= 0) return 0
  sim.piles.find((p) => p.id === t.pile)!.value += total
  sim.stats.earned += total
  sim.stats.freightEarned += total
  const at = sim.piles.find((p) => p.id === t.pile)!.pos
  sim.fx.push({ t: 'text', x: at.x, y: 2, z: at.z, str: `+$${fmt(total)}`, color: '#b8ff9a', size: 1.2 })
  sim.fx.push({ t: 'burst', x: v.pos.x, y: 1.5 + v.y, z: v.pos.z, color: '#7fdc8f', n: 16, spread: 1.6 })
  sfx.coin()
  return total
}

export function orderLine(o: FreightLine[]) {
  return o.map((l) => `${RES_ICON[l.kind]} ${l.got}/${l.need}`).join('  ')
}

// ---------------- trucks ----------------

function freeTruckSlot(sim: Sim): number {
  const taken = new Set(
    sim.freight.vehicles.filter((v) => v.kind === 'truck' && v.state !== 'leave').map((v) => v.slot),
  )
  for (let i = 0; i < T.slots; i++) if (!taken.has(i)) return i
  return -1
}

function truckWant(sim: Sim) {
  const lvl = Math.max(0, sim.rep.level - 12)
  return freightOrderCapacity(
    Math.round(T.baseWant + T.wantPerLevel * lvl + Math.random() * 4),
    T.maxWant,
    sim.terminals.dock.level,
  )
}

function spawnTruck(sim: Sim) {
  const slot = freeTruckSlot(sim)
  if (slot < 0) return
  const v = newVehicle(sim, 'truck', [pt(-90, PARK.truckLaneZ, T.speed)])
  v.slot = slot
  v.yaw = Math.PI / 2
  v.order = [{ kind: 'furniture', need: truckWant(sim), got: 0 }]
}

function updateTruck(sim: Sim, v: VehicleSim, dt: number) {
  const t = sim.terminals.dock
  if (v.state === 'leave') return
  // move up the lane: never past the truck in front
  const ahead = sim.freight.vehicles.filter((o) => o.kind === 'truck' && o.state !== 'leave' && o.slot < v.slot)
  const taken = new Set(ahead.map((o) => o.slot))
  while (v.slot > 0 && !taken.has(v.slot - 1)) v.slot--
  const tx = truckSlotX(v.slot)
  const dx = tx - v.pos.x
  const step = T.speed * dt
  v.yaw = Math.PI / 2
  if (Math.abs(dx) > step) {
    v.pos.x += Math.sign(dx) * step
    v.state = 'arrive'
    return
  }
  v.pos.x = tx
  if (v.slot !== 0) {
    v.state = 'queue'
    return
  }
  v.state = 'load'
  const moved = loadFrom(sim, t, v, dt)
  v.t = moved ? 0 : v.t + dt
  const full = orderDone(v.order)
  if (full || (v.t > TRUCK_PATIENCE && v.order[0].got > 0)) {
    pay(sim, t, v, full ? 0 : -0.25)
    sim.freight.trucks++
    sim.stats.trucksDone++
    addXp(sim, FREIGHT.xpTruck)
    v.slot = -1
    leave(v, truckLeaveRoute())
  }
}

// ---------------- ships + planes ----------------

function shipOrder(sim: Sim): FreightLine[] {
  const lvl = Math.max(0, sim.rep.level - 14)
  const need = freightOrderCapacity(
    SHIP.base + SHIP.perShip * sim.freight.ships + SHIP.perLevel * lvl,
    SHIP.max,
    sim.terminals.port.level,
  )
  return [{ kind: 'steel', need, got: 0 }]
}

function planeOrder(sim: Sim): FreightLine[] {
  const lvl = Math.max(0, sim.rep.level - 16)
  const need = freightOrderCapacity(
    PLANE.base + PLANE.perPlane * sim.freight.planes + PLANE.perLevel * lvl,
    PLANE.max,
    sim.terminals.air.level,
  )
  return [
    { kind: 'jacket', need, got: 0 },
    { kind: 'canned', need: Math.round(need * 1.5), got: 0 },
  ]
}

/** a docked ship / parked plane loads until full or out of time, pays, and goes */
function updateBig(sim: Sim, v: VehicleSim, t: TerminalSim, dt: number, cfg: typeof SHIP | typeof PLANE) {
  if (v.state === 'arrive') {
    if (drive(v, dt)) {
      v.state = 'load'
      // Endless capacity upgrades must leave enough time to physically load the order.
      const loadSeconds = (v.order.reduce((sum, line) => sum + line.need - line.got, 0) * t.loadTime) / 2
      v.timer = v.maxTimer = Math.max(cfg.timer, Math.ceil(loadSeconds * 1.25))
      sfx.fanfare()
    }
    return
  }
  if (v.state !== 'load') return
  loadFrom(sim, t, v, dt, 2)
  v.timer -= dt
  const full = orderDone(v.order)
  if (!full && v.timer > 0) return
  const total = pay(sim, t, v, full ? cfg.bonus : 0)
  const ship = v.kind === 'ship'
  if (ship) {
    sim.freight.ships++
    sim.stats.shipsDone++
    addXp(sim, full ? FREIGHT.xpShip : FREIGHT.xpShip / 3)
  } else {
    sim.freight.planes++
    sim.stats.planesDone++
    addXp(sim, full ? FREIGHT.xpPlane : FREIGHT.xpPlane / 3)
  }
  const icon = ship ? '🚢' : '✈️'
  if (full) {
    banner(sim, `${icon} Order filled!`, `+$${fmt(total)} with a ${Math.round(cfg.bonus * 100)}% bonus`, 'good')
    sim.fx.push({ t: 'shake', power: 0.3 })
  } else if (total > 0) {
    banner(sim, `${icon} Left half full`, `+$${fmt(total)}, fill the whole order for the bonus`, 'info')
  }
  leave(v, ship ? shipLeaveRoute() : planeLeaveRoute())
}

export function updateFreight(sim: Sim, dt: number) {
  const f = sim.freight
  const { dock, port, air } = sim.terminals

  if (dock.open) {
    f.truckT -= dt
    if (f.truckT <= 0) {
      f.truckT = Math.max(T.minEvery, T.every * Math.pow(T.everyMult, dock.level))
      spawnTruck(sim)
    }
  }
  const has = (k: VehicleKind) => f.vehicles.some((v) => v.kind === k && v.state !== 'leave')
  if (port.open && !has('ship')) {
    f.shipT -= dt
    if (f.shipT <= 0) {
      f.shipT = Math.max(SHIP.minEvery, SHIP.every * Math.pow(0.9, port.level))
      const v = newVehicle(sim, 'ship', shipArriveRoute())
      v.order = shipOrder(sim)
      banner(sim, '🚢 Cargo ship inbound', `Wants ${orderLine(v.order)} at the Port`, 'info')
    }
  }
  if (air.open && !has('plane')) {
    f.planeT -= dt
    if (f.planeT <= 0) {
      f.planeT = Math.max(PLANE.minEvery, PLANE.every * Math.pow(0.9, air.level))
      const v = newVehicle(sim, 'plane', planeArriveRoute())
      v.order = planeOrder(sim)
      banner(sim, '✈️ Cargo plane landing', `Wants ${orderLine(v.order)} at the Airport`, 'info')
    }
  }

  for (let i = f.vehicles.length - 1; i >= 0; i--) {
    const v = f.vehicles[i]
    if (v.state === 'leave') {
      if (drive(v, dt)) f.vehicles.splice(i, 1)
      continue
    }
    if (v.kind === 'truck') updateTruck(sim, v, dt)
    else if (v.kind === 'ship') updateBig(sim, v, port, dt, SHIP)
    else updateBig(sim, v, air, dt, PLANE)
  }
}

/** HUD pill text for the docked ship / parked plane */
export function bigOrderView(sim: Sim, kind: 'ship' | 'plane') {
  const terminal = kind === 'ship' ? sim.terminals.port : sim.terminals.air
  if (!terminal.open) return { text: '', frac: 0, time: 0 }
  const v = sim.freight.vehicles.find((x) => x.kind === kind && x.state !== 'leave')
  if (!v)
    return { text: 'Next dispatch', frac: 0, time: Math.ceil(kind === 'ship' ? sim.freight.shipT : sim.freight.planeT) }
  if (v.state === 'arrive') {
    let seconds = 0
    let from = { ...v.pos, y: v.y }
    for (const to of v.route.slice(v.seg)) {
      seconds += Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / to.v
      from = to
    }
    return { text: 'Arriving', frac: 0, time: Math.ceil(seconds) }
  }
  return { text: orderLine(v.order), frac: v.timer / v.maxTimer, time: Math.ceil(v.timer) }
}
