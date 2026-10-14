import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createSim } from '../src/game/state'
import { saveNow, loadSave } from '../src/game/save'
import { updateMeta, claimOffline } from '../src/game/systems/meta'
import { OFFLINE, ECONOMY } from '../src/game/balance'

const KEY = 'frostline-save-v1'
const storage = new Map<string, string>()
const realNow = Date.now
let now = 1_800_000_000_000

beforeEach(() => {
  storage.clear()
  now = 1_800_000_000_000
  Date.now = () => now
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
})
afterEach(() => { Date.now = realNow })

function reload() {
  const next = createSim()
  assert.equal(loadSave(next), true)
  return next
}

test('refresh preserves a mixed backpack without changing upgrades', () => {
  const sim = createSim()
  sim.player.carryLvl = 2
  sim.player.carry = ['log', 'raw', 'hide', 'coal', 'furniture']
  saveNow(sim)
  const next = reload()
  assert.deepEqual(next.player.carry, sim.player.carry)
  assert.equal(next.player.carryLvl, 2)
})

test('old v3 saves without backpack or pending earnings still load', () => {
  saveNow(createSim())
  const data = JSON.parse(storage.get(KEY)!)
  delete data.player.carry
  delete data.offline
  storage.set(KEY, JSON.stringify(data))
  const next = reload()
  assert.deepEqual(next.player.carry, [])
  assert.equal(next.offline, null)
})

test('v2 economy migration remains compatible', () => {
  const sim = createSim()
  sim.money = 100
  saveNow(sim)
  const data = JSON.parse(storage.get(KEY)!)
  data.v = 2
  delete data.player.carry
  delete data.offline
  storage.set(KEY, JSON.stringify(data))
  assert.equal(reload().money, 100 * ECONOMY.scale)
})

test('invalid resources and pending earnings cannot poison the simulation', () => {
  saveNow(createSim())
  const data = JSON.parse(storage.get(KEY)!)
  data.player.carry = ['log', 'unknown', '__proto__', ...Array(100).fill('coal')]
  data.offline = { amount: -50, seconds: 60 }
  storage.set(KEY, JSON.stringify(data))
  const next = reload()
  assert.equal(next.player.carry.length, next.player.carryCap)
  assert.ok(next.player.carry.every((k) => k === 'log' || k === 'coal'))
  assert.equal(next.offline, null)
})

test('time-away payout survives immediate reload and is not credited twice', () => {
  const sim = createSim()
  sim.incomeRate = 100
  saveNow(sim)
  now += 120_000
  const returned = reload()
  updateMeta(returned, 0)
  assert.ok(returned.offline!.amount > 0)
  const next = reload()
  assert.deepEqual(next.offline, returned.offline)
  updateMeta(next, 0)
  assert.deepEqual(next.offline, returned.offline)
  now += 60_000
  updateMeta(next, 0)
  assert.ok(next.offline!.amount > returned.offline!.amount)
  assert.deepEqual(reload().offline, next.offline)
})

test('normal claim persists cash and clears the payout immediately', () => {
  const sim = createSim()
  sim.money = 10
  sim.offline = { amount: 500, seconds: 120 }
  claimOffline(sim, false)
  const next = reload()
  assert.equal(next.money, 510)
  assert.equal(next.offline, null)
  claimOffline(next, true)
  assert.equal(next.money, 510)
})

test('double claim persists the daily limit across reloads', () => {
  const sim = createSim()
  sim.offline = { amount: 500, seconds: 120 }
  claimOffline(sim, true)
  const next = reload()
  assert.equal(next.money, 1000)
  assert.equal(next.meta.doubleDay, sim.meta.doubleDay)
  next.offline = { amount: 500, seconds: 120 }
  claimOffline(next, true)
  assert.equal(reload().money, 1500)
})

test('offline payout retains the configured time cap', () => {
  const sim = createSim()
  sim.incomeRate = 100
  saveNow(sim)
  now += 48 * 3600_000
  const next = reload()
  updateMeta(next, 0)
  assert.equal(next.offline!.seconds, OFFLINE.maxHours * 3600)
})

test('saving during prestige cannot overwrite the new settlement', () => {
  const next = createSim()
  next.money = 1234
  saveNow(next)
  const old = createSim()
  old.money = 999
  old.moving = 2
  saveNow(old)
  assert.equal(reload().money, 1234)
})

// Progression regression checks use the same simulation systems as the game.
import { grantPad, updateEconomy } from '../src/game/systems/economy'
import { updateProcessors } from '../src/game/systems/processors'
import { updateBelts } from '../src/game/systems/belts'
import { updateFreight, bigOrderView } from '../src/game/systems/freight'
import { moveSettlement } from '../src/game/systems/meta'
import { tick } from '../src/game/update'
import { sim as liveSim, replaceSim } from '../src/game/state'
import { input } from '../src/game/input'
import { useUI } from '../src/game/uiStore'
import { PAD_DEFS, FREIGHT, PRESTIGE, freightPrice } from '../src/game/balance'
import type { Sim } from '../src/game/types'

function matureCamp() {
  const sim = createSim()
  sim.rep.level = 25
  for (const def of PAD_DEFS) {
    if (def.id === 'prestige') continue
    for (let i = 0; i < Math.min(def.maxLevel, 5); i++) grantPad(sim, def.id)
  }
  sim.stats.woodServed = sim.stats.meatServed = sim.stats.coatServed = sim.stats.fishServed = 100
  sim.stats.coalBurned = sim.stats.collected = 1000
  return sim
}

const automationPads = ['m_saw', 'm_skinner', 'm_grill', 'm_sewer', 'm_auger', 'm_autosmoker', 'm_drill',
  'belt_wood', 'belt_meat', 'belt_coat', 'belt_fish', 'belt_coal', 'furnace_up']

test('fully unlocked automation pads remain purchasable, including after loading', () => {
  const sim = matureCamp()
  saveNow(sim)
  const next = reload()
  updateEconomy(next, 0)
  for (const id of automationPads) {
    const pad = next.pads.find((p) => p.id === id)!
    assert.ok(pad.visible && !pad.done && !pad.locked, `${id}: ${pad.lockText}`)
  }
  const saw = next.pads.find((p) => p.id === 'm_saw')!
  next.player.pos = { ...saw.pos }
  next.player.swing = 0
  saw.hold = saw.holdNeed
  next.money = saw.cost
  for (let i = 0; i < 300 && saw.level === 5; i++) updateEconomy(next, 1 / 60)
  assert.equal(saw.level, 6)
  assert.equal(next.machines.saw.level, 6)
  assert.ok(saw.visible && !saw.done)
})

test('auto-grill and auto-smoker upgrades increase actual production', () => {
  for (const [mid, pid] of [['grill', 'kitchen'], ['autosmoker', 'smokehouse']] as const) {
    function produce(level: number) {
      const sim = createSim()
      const proc = sim.proc[pid]
      proc.unlocked = true
      proc.inCount = 1000
      proc.outCap = Infinity
      sim.machines[mid].level = level
      for (let i = 0; i < 600; i++) updateProcessors(sim, 1 / 60)
      return proc.outCount
    }
    assert.ok(produce(6) > produce(3), mid)
  }
})

test('auto-saw upgrades past level 3 increase harvested supply', () => {
  function harvest(level: number) {
    const sim = createSim()
    for (const tree of sim.trees) tree.wood = 1000
    sim.machines.saw.level = level
    sim.belts.saw.level = level
    for (let i = 0; i < 300; i++) updateBelts(sim, 1 / 60)
    return sim.depot.count + sim.belts.saw.items.length + (sim.machines.saw.buf.log ?? 0)
  }
  assert.ok(harvest(6) > harvest(3))
})

function advanceFreightUntil(sim: Sim, condition: () => boolean, maxSeconds: number) {
  let elapsed = 0
  while (!condition() && elapsed < maxSeconds) {
    updateFreight(sim, 1 / 60)
    elapsed += 1 / 60
  }
  assert.ok(condition(), `condition not reached within ${maxSeconds}s`)
  return elapsed
}

test('ship and plane arrive promptly, pay full-order bonuses, and return', () => {
  for (const kind of ['ship', 'plane'] as const) {
    const sim = createSim()
    sim.rep.level = kind === 'ship' ? 14 : 16
    const terminal = kind === 'ship' ? sim.terminals.port : sim.terminals.air
    terminal.open = true
    for (const k of terminal.kinds) terminal.stock[k] = 10_000
    assert.equal(bigOrderView(sim, kind).text, 'Next dispatch')
    advanceFreightUntil(sim, () => sim.freight.vehicles.some((v) => v.kind === kind), 4)
    assert.equal(bigOrderView(sim, kind).text, 'Arriving')
    const v = sim.freight.vehicles.find((v) => v.kind === kind)!
    const expected = Math.round(v.order.reduce((sum, o) => sum + o.need * freightPrice(o.kind, 0), 0) * (1 + FREIGHT[kind].bonus))
    advanceFreightUntil(sim, () => v.state === 'leave', 40)
    assert.equal(sim.piles.find((p) => p.id === terminal.pile)!.value, expected)
    const earned = sim.stats.earned
    const gap = advanceFreightUntil(sim, () => sim.freight.vehicles.some((x) => x.kind === kind && x.id !== v.id), FREIGHT[kind].every + 1)
    assert.ok(gap <= FREIGHT[kind].every + 0.1)
    assert.equal(sim.stats.earned, earned, 'departing vehicle cannot pay twice')
  }
})

test('incomplete freight pays only loaded goods, without a completion bonus', () => {
  const sim = createSim()
  sim.terminals.port.open = true
  sim.terminals.port.stock.steel = 1
  advanceFreightUntil(sim, () => sim.freight.vehicles.some((v) => v.kind === 'ship' && v.state === 'leave'), 110)
  assert.equal(sim.piles.find((p) => p.id === sim.terminals.port.pile)!.value, freightPrice('steel', 0))
})

test('next settlement replaces live camp, preserves perks, and supports another move', () => {
  let current = matureCamp()
  current.meta = { ...current.meta, stars: 10, spent: 3, perks: { headstart: 1, crew: 1, startLevel: 2 } }
  replaceSim(current)
  for (let run = 1; run <= 2; run++) {
    current.stats.earned = PRESTIGE.starDiv * 4
    const stars = current.meta.stars + 2
    input.jx = 1
    moveSettlement(current)
    moveSettlement(current) // repeated trigger must not duplicate stars
    tick(current, PRESTIGE.moveTime + 0.01)
    assert.notEqual(liveSim, current)
    current = liveSim
    assert.equal(current.meta.runs, run)
    assert.equal(current.meta.stars, stars)
    assert.equal(current.meta.spent, 3)
    assert.equal(current.rep.level, 3)
    assert.equal(current.moving, 0)
    assert.equal(current.zones.industry, false)
    assert.equal(current.freight.vehicles.length, 0)
    assert.equal(current.workers.length, 3)
    assert.equal(input.jx, 0)
    assert.equal(useUI.getState().settlementRun, run)
    assert.equal(useUI.getState().moving, false)
    assert.equal(reload().meta.stars, stars)
    const before = current.time
    tick(current, 1 / 60)
    assert.ok(current.time > before, 'new camp must keep ticking')
    assert.ok(current.customers.length > 0)
    assert.ok(current.pads.find((p) => p.id === 'collector')!.visible)
  }
})

test('next settlement works even if saving is unavailable', () => {
  const sim = createSim()
  sim.stats.earned = PRESTIGE.starDiv
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    setItem: () => { throw new Error('Storage blocked') },
  } })
  replaceSim(sim)
  moveSettlement(sim)
  tick(sim, PRESTIGE.moveTime + 0.01)
  assert.notEqual(liveSim, sim)
  assert.equal(liveSim.meta.stars, 1)
  assert.equal(liveSim.moving, 0)
  tick(liveSim, 1 / 60)
  assert.ok(liveSim.time > 0)
})

test('standing on the prestige pad starts and completes a playable settlement', () => {
  const old = matureCamp()
  old.stats.earned = PRESTIGE.starDiv
  old.player.pos = { ...old.pads.find((p) => p.id === 'prestige')!.pos }
  old.player.swing = 0
  replaceSim(old)
  for (let i = 0; i < 200 && old.moving === 0; i++) updateEconomy(old, 1 / 60)
  assert.ok(old.moving > 0, '3-second pad hold should start moving')
  tick(old, PRESTIGE.moveTime + 0.01)
  assert.equal(liveSim.meta.runs, 1)
  assert.equal(liveSim.money, PRESTIGE.startCashPerStar)
  tick(liveSim, 1 / 60)
  assert.ok(liveSim.time > 0)
})

test('prestige without enough earnings leaves the current game playable', () => {
  const old = createSim()
  replaceSim(old)
  moveSettlement(old)
  assert.equal(old.moving, 0)
  assert.equal(liveSim, old)
  tick(old, 1 / 60)
  assert.ok(old.time > 0)
})

function freightCamp(kind: 'truck' | 'ship' | 'plane', upgrades: number, completed = 0) {
  const sim = createSim()
  grantPad(sim, 'zone_industry')
  grantPad(sim, 'zone_port')
  grantPad(sim, 'zone_airport')
  sim.rep.level = kind === 'truck' ? 12 : kind === 'ship' ? 14 : 16
  sim.freight.trucks = sim.freight.ships = sim.freight.planes = completed
  const pad = kind === 'truck' ? 'dock_up' : kind === 'ship' ? 'port_up' : 'air_up'
  for (let i = 0; i < upgrades; i++) grantPad(sim, pad)
  return sim
}

function dispatch(sim: Sim, kind: 'truck' | 'ship' | 'plane') {
  sim.freight.truckT = sim.freight.shipT = sim.freight.planeT = 0
  updateFreight(sim, 1 / 60)
  return sim.freight.vehicles.find((v) => v.kind === kind)!
}

test('truck, ship and plane cargo capacity grows with each terminal upgrade', () => {
  const random = Math.random
  Math.random = () => 0.25
  try {
    for (const kind of ['truck', 'ship', 'plane'] as const) {
      let previous = 0
      for (const level of [0, 1, 5, 10, 11, 20]) {
        const sim = freightCamp(kind, level)
        const v = dispatch(sim, kind)
        const base = kind === 'truck' ? 7 : kind === 'ship' ? 40 : 12
        const expected = Math.round(base * (1 + 0.2 * level))
        assert.equal(v.order[0].need, expected)
        assert.ok(v.order[0].need > previous, `${kind} level ${level}`)
        if (kind === 'plane') assert.equal(v.order[1].need, Math.round(expected * 1.5))
        previous = v.order[0].need
      }
    }
  } finally { Math.random = random }
})

test('old freight order ceilings scale with terminal upgrades', () => {
  for (const kind of ['truck', 'ship', 'plane'] as const) {
    const sim = freightCamp(kind, 10, 1000)
    sim.rep.level = 200
    const v = dispatch(sim, kind)
    const oldMax = kind === 'truck' ? FREIGHT.truck.maxWant : FREIGHT[kind].max
    assert.equal(v.order[0].need, oldMax * 3)
  }
})

test('terminal capacity upgrades survive saves and leave active orders fixed', () => {
  const random = Math.random
  Math.random = () => 0.25
  try {
    for (const kind of ['truck', 'ship', 'plane'] as const) {
      const sim = freightCamp(kind, 0)
      const active = dispatch(sim, kind)
      const before = active.order.map((line) => ({ ...line }))
      const pad = kind === 'truck' ? 'dock_up' : kind === 'ship' ? 'port_up' : 'air_up'
      grantPad(sim, pad)
      assert.deepEqual(active.order, before)
      saveNow(sim)
      const next = reload()
      assert.ok(dispatch(next, kind).order[0].need > before[0].need)
    }
  } finally { Math.random = random }
})

test('large upgraded ship and plane orders can finish loading before timeout', () => {
  for (const kind of ['ship', 'plane'] as const) {
    const sim = freightCamp(kind, 50, 1000)
    const terminal = kind === 'ship' ? sim.terminals.port : sim.terminals.air
    for (const k of terminal.kinds) terminal.stock[k] = 100_000
    const v = dispatch(sim, kind)
    advanceFreightUntil(sim, () => v.state === 'load', 30)
    const minimumLoad = v.order.reduce((sum, o) => sum + o.need, 0) * terminal.loadTime / 2
    assert.ok(v.maxTimer >= minimumLoad * 1.25)
    advanceFreightUntil(sim, () => v.state === 'leave', v.maxTimer + 1)
    assert.ok(v.order.every((o) => o.got === o.need), kind)
    const pay = Math.round(v.order.reduce((sum, o) => sum + o.got * freightPrice(o.kind, terminal.level), 0) * (1 + FREIGHT[kind].bonus))
    assert.equal(sim.piles.find((p) => p.id === terminal.pile)!.value, pay)
  }
})
