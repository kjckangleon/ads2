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
