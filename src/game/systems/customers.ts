import type { Sim, CustomerSim, StationSim, StationId } from '../types'
import {
  CUSTOMERS,
  PRESSURE,
  WORLD,
  RUSH,
  REP,
  STATION_IDS,
  maxCustomers,
  maxDemand,
  levelDemandMult,
  bulkDemand,
  minSpawnInterval,
  furnaceBonus,
  starSalesMult,
} from '../balance'
import { seek, dist } from '../util'
import { sfx } from '../audio'
import { addXp, rushMult } from './progress'
import { eventSpawnMult, eventPayMult, festivalOn } from './events'
import { perk } from '../perks'
import { pressureOn } from './pressure'

export const VIP_VARIANT = 6
const NORMAL_VARIANTS = 6

export function slotPos(st: StationSim, slot: number) {
  return {
    x: st.queueBase.x + st.queueDir.x * st.queueSpacing * slot,
    z: st.queueBase.z + st.queueDir.z * st.queueSpacing * slot,
  }
}

/** New arrivals always join at the back of the line, never into a gap ahead of others. */
function backSlot(st: StationSim): number {
  let last = -1
  for (let i = 0; i < st.slots.length; i++) if (st.slots[i] !== null) last = i
  return last + 1 < st.slots.length ? last + 1 : -1
}

/**
 * Close gaps and order the line by who actually got there first: customers already
 * standing in line keep their order ahead of anyone still walking over, so nobody
 * waits behind a slot reserved by someone who hasn't arrived yet.
 */
function reorderQueue(st: StationSim, byId: Map<number, CustomerSim>) {
  const waiting: CustomerSim[] = []
  const walking: CustomerSim[] = []
  for (const id of st.slots) {
    if (id === null) continue
    const c = byId.get(id)
    if (!c) continue
    if (c.state === 'queue') waiting.push(c)
    else if (c.state === 'toQueue') walking.push(c)
  }
  st.slots.fill(null)
  let i = 0
  for (const c of waiting) {
    c.slot = i
    st.slots[i++] = c.id
  }
  for (const c of walking) {
    c.slot = i
    st.slots[i++] = c.id
  }
}

export function queueLength(st: StationSim): number {
  let n = 0
  for (const s of st.slots) if (s !== null) n++
  return n
}

function spawnInterval(sim: Sim): number {
  let score = -1 // the starting wood stall is the baseline
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    if (st.unlocked) score += 1 + st.level * 0.5
  }
  if (sim.tower.built) score += 1
  score += sim.workers.length * 0.6
  const f = 1 + 0.12 * score + REP.spawnPerLevel * (sim.rep.level - 1)
  return Math.max(minSpawnInterval(sim.rep.level), CUSTOMERS.baseInterval / f) / eventSpawnMult(sim)
}

/** Weighted pick among unlocked stalls that still have room in line. */
function pickStation(sim: Sim): StationId | null {
  let total = 0
  const options: [StationId, number][] = []
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    if (!st.unlocked || backSlot(st) === -1) continue
    let w = CUSTOMERS.weights[id]
    if (sim.clock.night && id === 'wood') w += CUSTOMERS.nightWoodBonus
    if (sim.clock.night && id === 'coat') w += CUSTOMERS.nightCoatBonus
    // market pressure: a hot stall draws more of the crowd
    w *= Math.sqrt(st.demand)
    // a stall piled high draws the crowd
    if (sim.rep.level >= CUSTOMERS.bulkMinLevel)
      w *= 1 + CUSTOMERS.bulkPull * Math.min(1, st.stock / CUSTOMERS.bulkPullStock)
    options.push([id, w])
    total += w
  }
  if (!options.length) return null
  let r = Math.random() * total
  for (const [id, w] of options) {
    r -= w
    if (r <= 0) return id
  }
  return options[options.length - 1][0]
}

function trySpawnCustomer(sim: Sim) {
  if (sim.customers.length >= maxCustomers(sim.rep.level)) return
  const id = pickStation(sim)
  if (!id) return
  const st = sim.stations[id]
  const slot = backSlot(st)
  // endless Royal Favor tops out at half the crowd being VIPs
  const vipChance = Math.min(0.5, CUSTOMERS.vipChance * (1 + 0.5 * perk(sim, 'vip')))
  const vip = festivalOn(sim) || (sim.rep.level >= CUSTOMERS.vipMinLevel && Math.random() < vipChance)
  // higher levels: each survivor buys a bundle (VIPs always the biggest one)
  const most = maxDemand(sim.rep.level)
  const least = Math.ceil(most / 2)
  // ...and a stall piled high with stock sells in bulk
  const bulk = bulkDemand(sim.rep.level, st.stock, most)
  const base = Math.min(
    CUSTOMERS.demandCap,
    (vip ? most : least + Math.floor(Math.random() * (most - least + 1))) + bulk,
  )
  // a bigger settlement is hungrier (×√level), and market pressure adds more on top
  const want = Math.max(1, Math.min(PRESSURE.maxWant, Math.round(base * levelDemandMult(sim.rep.level) * st.demand)))
  const c: CustomerSim = {
    id: sim.ids++,
    pos: {
      x: WORLD.customerSpawn.x + (Math.random() - 0.5) * 3,
      z: WORLD.customerSpawn.z + (Math.random() - 0.5) * 1.5,
    },
    yaw: 0,
    state: 'toQueue',
    need: id,
    slot,
    laneOff: (Math.random() - 0.5) * 1.4,
    serveT: 0,
    want,
    got: 0,
    starveT: 0,
    carrying: null,
    speed: CUSTOMERS.speed * (0.9 + Math.random() * 0.25),
    variant: vip ? VIP_VARIANT : Math.floor(Math.random() * NORMAL_VARIANTS),
    vip,
    walkPhase: Math.random() * 6,
    mood: 'none',
    moodT: 0,
  }
  st.slots[slot] = c.id
  sim.customers.push(c)
}

/** Hand over one item; the sale completes once the whole bundle is handed over. */
function handOver(sim: Sim, c: CustomerSim, st: StationSim) {
  st.stock--
  c.got++
  c.carrying = st.accepts
  // a fast stall shows every few items flying over, not all of them
  if (st.serviceTime > 0.08 || c.got % 3 === 1) {
    sim.fx.push({
      t: 'itemfly',
      kind: st.accepts,
      from: { x: st.pos.x, y: 1.1, z: st.pos.z },
      to: { x: c.pos.x, y: 1.8 + c.got * 0.15, z: c.pos.z },
    })
  }
  if (c.got < c.want) {
    sfx.serve()
    return
  }
  serve(sim, c, st)
}

/** gave up waiting: a lost sale, a broken rush */
function walkAway(sim: Sim, c: CustomerSim, st: StationSim) {
  // half a bundle handed over: they pay for what they got and go (no tip, rush broken)
  if (c.got > 0) {
    c.want = c.got
    serve(sim, c, st)
    return
  }
  c.state = 'leaving'
  if (st.slots[c.slot] === c.id) st.slots[c.slot] = null
  c.mood = 'angry'
  c.moodT = 1.6
  sim.stats.lostSales++
  sim.stats.angry++
  if (sim.rush.n >= RUSH.announceEvery) {
    sim.fx.push({ t: 'text', x: st.pos.x, y: 3.6, z: st.pos.z, str: '💔 RUSH LOST', color: '#ff8a7a', size: 1.1 })
  }
  sim.rush.n = 0
  sim.rush.t = 0
  sim.fx.push({ t: 'text', x: c.pos.x, y: 2.4, z: c.pos.z, str: '💢 walked away', color: '#ff9a8a', size: 0.75 })
  sfx.angry()
}

function serve(sim: Sim, c: CustomerSim, st: StationSim) {
  c.state = 'leaving'
  st.slots[0] = null

  // Fast service tips and grows the rush; a long wait at an empty stall breaks it.
  const tipped = c.starveT < RUSH.tipStarve
  const angry = c.starveT > CUSTOMERS.angryAfter
  // a lit furnace warms the whole market: every sale pays more
  const heat = sim.furnace.burning ? 1 + furnaceBonus(sim.furnace.level) : 1
  const base = Math.round(
    st.price * c.want * (c.vip ? CUSTOMERS.vipMult : 1) * heat * starSalesMult(sim.meta.stars) * eventPayMult(sim),
  )
  let pay = base
  if (tipped) {
    const r = sim.rush
    r.n++
    r.t = RUSH.window
    r.best = Math.max(r.best, r.n)
    const tipFrac = RUSH.tipFrac * (1 + 0.25 * perk(sim, 'tips'))
    pay = Math.round((base + Math.ceil(base * tipFrac)) * rushMult(r.n))
    sim.stats.tips++
  } else if (angry) {
    if (sim.rush.n >= RUSH.announceEvery) {
      sim.fx.push({ t: 'text', x: st.pos.x, y: 3.6, z: st.pos.z, str: '💔 RUSH LOST', color: '#ff8a7a', size: 1.1 })
    }
    sim.rush.n = 0
    sim.rush.t = 0
    sim.stats.angry++
  }
  c.mood = angry ? 'angry' : tipped ? 'tip' : 'happy'
  c.moodT = 1.6

  const pile = sim.piles.find((p) => p.id === st.payPileId)!
  pile.value += pay
  sim.stats.served++
  if (st.id === 'wood') sim.stats.woodServed++
  else if (st.id === 'meat') sim.stats.meatServed++
  else if (st.id === 'coat') sim.stats.coatServed++
  else sim.stats.fishServed++
  if (c.vip) sim.stats.vips++
  sim.stats.earned += pay
  addXp(
    sim,
    // bulk extras pay cash, not XP, so levels don't snowball off a full shelf
    REP.xpServe +
      CUSTOMERS.xpPerExtraItem * (Math.min(c.want, maxDemand(sim.rep.level)) - 1) +
      (tipped ? REP.xpTip : 0) +
      (c.vip ? REP.xpVip : 0),
  )

  sim.fx.push({
    t: 'text',
    x: pile.pos.x,
    y: 1.4,
    z: pile.pos.z,
    str: (c.vip ? `👑 +$${pay}` : `+$${pay}`) + (heat > 1 ? ' 🔥' : ''),
    color: c.vip ? '#ffe680' : tipped ? '#ffd75e' : angry ? '#ff9a8a' : '#efe2bc',
    size: c.vip ? 1.25 : tipped ? 1 : 0.85,
  })
  sim.fx.push({
    t: 'burst',
    x: c.pos.x,
    y: 1.2,
    z: c.pos.z,
    color: angry ? '#ff7b6b' : c.vip ? '#ffe680' : '#9fe08a',
    n: c.vip ? 14 : 6,
  })
  if (tipped && sim.rush.n % RUSH.announceEvery === 0) {
    sim.fx.push({
      t: 'text',
      x: st.pos.x,
      y: 3.6,
      z: st.pos.z,
      str: `🔥 RUSH ×${rushMult(sim.rush.n).toFixed(2)}`,
      color: '#ffb347',
      size: 1.2,
    })
    sfx.combo()
  }
  sfx.pop()
  if (tipped) sfx.tip()
  if (angry) sfx.angry()
  if (c.vip) sfx.coin()
}

export function updateCustomers(sim: Sim, dt: number) {
  sim.spawnT -= dt
  if (sim.spawnT <= 0) {
    trySpawnCustomer(sim)
    sim.spawnT = spawnInterval(sim)
  }

  const byId = new Map<number, CustomerSim>()
  for (const c of sim.customers) byId.set(c.id, c)
  for (const id of STATION_IDS) reorderQueue(sim.stations[id], byId)

  for (let i = sim.customers.length - 1; i >= 0; i--) {
    const c = sim.customers[i]
    const st = sim.stations[c.need]

    if (c.state === 'toQueue') {
      const target = slotPos(st, c.slot)
      // lane offset while far away so arrivals don't overlap on the road
      const d = dist(c.pos, target)
      const t = d > 4 ? { x: target.x + c.laneOff, z: target.z } : target
      c.walkPhase += dt * c.speed * 2.4
      if (seek(c, t, c.speed, dt, 0.3) && d <= 4.2) c.state = 'queue'
      continue
    }

    if (c.state === 'queue') {
      // reorderQueue has already moved us up if the slot ahead opened
      const arrived = seek(c, slotPos(st, c.slot), c.speed * 0.9, dt, 0.12)
      if (!arrived) c.walkPhase += dt * c.speed * 2.2
      if (st.stock === 0) c.starveT += dt
      // under market pressure, nobody waits forever at an empty counter
      if (pressureOn(sim) && c.starveT > PRESSURE.walkAway) {
        walkAway(sim, c, st)
        continue
      }

      if (c.slot === 0 && arrived && st.stock > 0) {
        // an upgraded stall can hand over several items in one frame
        c.serveT += dt
        while (c.serveT >= st.serviceTime && st.stock > 0 && c.state === 'queue') {
          c.serveT -= st.serviceTime
          handOver(sim, c, st)
        }
        if (c.state !== 'queue') c.serveT = 0
      }
      continue
    }

    // leaving
    c.walkPhase += dt * c.speed * 2.4
    if (c.moodT > 0) c.moodT -= dt
    const exit = { x: WORLD.customerExit.x + c.laneOff * 2, z: WORLD.customerExit.z }
    if (seek(c, exit, c.speed, dt, 0.8)) sim.customers.splice(i, 1)
  }
}
