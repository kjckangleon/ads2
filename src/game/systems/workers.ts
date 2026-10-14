// Reusable worker/job layer. Carrying roles run the same two-mode loop —
// fetch until full (or nothing left), then deliver until empty — so loads
// travel as visible stacks. Role functions only choose sources and sinks;
// reservations stop two workers claiming the same drop, tree or coin pile.

import type { Sim, WorkerSim, WorkerRole, ResKind, ProcessorSim, ProcessorId, V2, DropSim, TreeSim, DepotSim } from '../types'
import { WORKERS, WORLD, GUARD, TREES, NODES, PROC_IDS, workerSpeed, workerCap, guardDamage } from '../balance'
import { RES_NAME } from '../icons'
import { fmt } from '../format'
import { seek, dist, lerpAngle, damp } from '../util'
import { sfx } from '../audio'
import { damageWolf } from './wolves'
import { dropItem } from './animals'
import {
  type Source,
  type Sink,
  procSource,
  depotSource,
  stationSink,
  procInSink,
  furnaceSink,
  depotSink,
} from './sinks'

export function hireWorker(sim: Sim, role: WorkerRole, at?: V2) {
  const guards = sim.workers.filter((w) => w.role === 'guard').length
  const post = role === 'guard' ? GUARD.posts[guards % GUARD.posts.length] : WORLD.campfire
  const spawn = at ?? { x: WORLD.campfire.x, z: WORLD.campfire.z + 1.5 }
  const w: WorkerSim = {
    id: sim.ids++,
    role,
    pos: { x: spawn.x + (Math.random() - 0.5) * 0.6, z: spawn.z + (Math.random() - 0.5) * 0.6 },
    yaw: 0,
    mode: 'fetch',
    activity: 'hired',
    carry: [],
    coins: 0,
    timer: 0,
    blockedT: 0,
    walkPhase: 0,
    post: { x: post.x, z: post.z },
    atkT: 0,
    swing: 0,
    patrolT: Math.random() * 6,
  }
  sim.workers.push(w)
  sim.fx.push({ t: 'burst', x: w.pos.x, y: 1.2, z: w.pos.z, color: '#9fd0ff', n: 12, spread: 0.8 })
  return w
}

const capOf = (sim: Sim, role: WorkerRole) => workerCap(role, sim.lodge.capLvl)

function walk(sim: Sim, w: WorkerSim, target: V2, dt: number, arrive = 0.35, mult = 1) {
  const sp = workerSpeed(sim.lodge.spdLvl) * mult
  const done = seek(w, target, sp, dt, arrive)
  if (!done) w.walkPhase += dt * sp * 2.3
  return done
}

function transferTick(w: WorkerSim, dt: number): boolean {
  w.timer -= dt
  if (w.timer <= 0) {
    w.timer = WORKERS.transferInterval
    return true
  }
  return false
}

// ground drops (raw meat, hides) only ever feed the kitchen and the tailor
function procAccepting(sim: Sim, kind: ResKind): ProcessorSim | null {
  for (const id of PROC_IDS) {
    const pr = sim.proc[id]
    if (pr.unlocked && pr.inKind === kind) return pr
  }
  return null
}

/** inputs already promised to a workshop: collector loads + reserved drops */
function inFlight(sim: Sim, kind: ResKind): number {
  let n = 0
  for (const w of sim.workers) if (w.role === 'collector') for (const k of w.carry) if (k === kind) n++
  for (const d of sim.drops) if (d.reservedBy !== null && d.kind === kind) n++
  return n
}

function roomFor(sim: Sim, kind: ResKind): boolean {
  const pr = procAccepting(sim, kind)
  if (!pr) return false
  return pr.inCount + inFlight(sim, kind) < pr.inCap
}

// ---------------- collector: ground drops -> workshop input ----------------

function updateCollector(sim: Sim, w: WorkerSim, dt: number) {
  const cap = capOf(sim, 'collector')
  const kind = w.carry[0]

  if (w.mode === 'deliver') {
    if (!kind) {
      w.mode = 'fetch'
      return
    }
    const pr = procAccepting(sim, kind)
    if (!pr) {
      w.carry.length = 0
      w.mode = 'fetch'
      return
    }
    w.activity = `delivering ${RES_NAME[kind]}`
    if (!walk(sim, w, pr.inZone, dt)) return
    if (pr.inCount < pr.inCap) {
      w.blockedT = 0
      if (transferTick(w, dt)) {
        w.carry.pop()
        pr.inCount++
        sfx.deposit()
        sim.fx.push({
          t: 'itemfly',
          kind,
          from: { x: w.pos.x, y: 1.6, z: w.pos.z },
          to: { x: pr.inZone.x, y: 0.8, z: pr.inZone.z },
        })
        if (w.carry.length === 0) w.mode = 'fetch'
      }
    } else {
      // workshop is full: wait a moment, then set the load down so this
      // collector can keep the other chain moving
      w.activity = `${pr.id} full!`
      w.blockedT += dt
      if (w.blockedT > WORKERS.blockedDropAfter) {
        for (const k of w.carry) if (k === 'raw' || k === 'hide') dropItem(sim, k, w.pos, 1.4)
        w.carry.length = 0
        w.blockedT = 0
        w.mode = 'fetch'
      }
    }
    return
  }

  let myDrop: DropSim | undefined = sim.drops.find((d) => d.reservedBy === w.id)
  if (!myDrop && w.carry.length < cap) {
    let best: DropSim | undefined
    let bestD = Infinity
    for (const d of sim.drops) {
      if (d.reservedBy !== null) continue
      if (kind && d.kind !== kind) continue
      const dd = dist(w.pos, d.pos)
      if (dd < bestD && roomFor(sim, d.kind)) {
        bestD = dd
        best = d
      }
    }
    if (best) {
      best.reservedBy = w.id
      myDrop = best
    }
  }

  if (myDrop) {
    w.activity = `fetching ${RES_NAME[myDrop.kind]}`
    if (walk(sim, w, myDrop.pos, dt, 0.45) && transferTick(w, dt)) {
      const idx = sim.drops.indexOf(myDrop)
      if (idx !== -1) sim.drops.splice(idx, 1)
      w.carry.push(myDrop.kind)
      sfx.pick()
      if (w.carry.length >= cap) w.mode = 'deliver'
    }
    return
  }

  if (w.carry.length > 0) {
    w.mode = 'deliver'
    return
  }
  w.activity = 'waiting for kills'
  walk(sim, w, { x: WORLD.meadow.x - WORLD.meadow.r - 1.5, z: WORLD.meadow.z + 2 }, dt, 1.2)
}

// ---------------- staff: stand at a workshop so it runs ----------------

const STAFF_VERB: Record<ProcessorId, string> = { kitchen: 'cooking', tailor: 'sewing coats', smokehouse: 'smoking fish' }

function updateStaff(sim: Sim, w: WorkerSim, dt: number, procId: ProcessorId) {
  const pr = sim.proc[procId]
  w.mode = 'work'
  walk(sim, w, pr.workSpot, dt, 0.25)
  if (dist(w.pos, pr.workSpot) < 0.5) pr.staffed = true
  w.activity = !pr.staffed
    ? 'walking to work'
    : pr.active
      ? STAFF_VERB[procId]
      : pr.inCount === 0
        ? `waiting for ${RES_NAME[pr.inKind]}`
        : 'output full!'
}

// ---------------- hauler: pickup point -> stall / furnace ----------------

function updateHauler(sim: Sim, w: WorkerSim, dt: number, src: Source, sink: Sink) {
  const cap = capOf(sim, w.role)
  const what = RES_NAME[src.kind]

  if (w.mode === 'deliver') {
    if (w.carry.length === 0) {
      w.mode = 'fetch'
      return
    }
    w.activity = sink.label
    if (!walk(sim, w, sink.at, dt)) return
    if (sink.count < sink.cap) {
      if (transferTick(w, dt)) {
        const k = w.carry.pop()!
        sink.put()
        sfx.deposit()
        sim.fx.push({ t: 'itemfly', kind: k, from: { x: w.pos.x, y: 1.6, z: w.pos.z }, to: sink.to })
        if (w.carry.length === 0) w.mode = 'fetch'
      }
    } else {
      w.activity = sink.full
    }
    return
  }

  const wanted = sink.open && sink.count + w.carry.length < sink.cap
  if (src.open && src.count > 0 && wanted && w.carry.length < cap) {
    w.activity = `fetching ${what}`
    if (walk(sim, w, src.at, dt, 0.6) && transferTick(w, dt)) {
      src.take()
      w.carry.push(src.kind)
      sfx.pick()
      if (w.carry.length >= cap) w.mode = 'deliver'
    }
    return
  }
  if (w.carry.length > 0) {
    w.mode = 'deliver'
    return
  }
  w.activity = wanted ? `waiting for ${what}` : sink.full
  walk(sim, w, { x: src.at.x + 1.2, z: src.at.z + 1.5 }, dt, 0.8)
}

// ---------------- cashier: coin piles -> chest ----------------

function updateCashier(sim: Sim, w: WorkerSim, dt: number) {
  const tripMax = WORKERS.cashierTripMax + WORKERS.cashierTripPerLvl * sim.lodge.capLvl

  if (w.mode === 'deliver') {
    w.activity = 'banking coins'
    if (walk(sim, w, sim.chest.pos, dt, 0.9)) {
      sim.money += w.coins
      sim.stats.collected += w.coins
      sim.fx.push({ t: 'text', x: sim.chest.pos.x, y: 1.6, z: sim.chest.pos.z, str: `+$${fmt(w.coins)}`, color: '#ffd75e' })
      for (let i = 0; i < 3; i++) sim.fx.push({ t: 'coin', x: sim.chest.pos.x, y: 0.6, z: sim.chest.pos.z })
      sfx.coin()
      w.coins = 0
      w.mode = 'fetch'
    }
    return
  }

  let pile = sim.piles.find((p) => p.claimedBy === w.id)
  if (!pile) {
    const min = w.coins > 0 ? 1 : WORKERS.cashierMinPile
    let bestV = min - 1
    for (const p of sim.piles) {
      if (p.claimedBy !== null) continue
      if (p.value > bestV) {
        bestV = p.value
        pile = p
      }
    }
    if (pile) pile.claimedBy = w.id
  }

  if (pile) {
    w.activity = 'collecting payment'
    if (walk(sim, w, pile.pos, dt, 0.9)) {
      const take = Math.min(Math.floor(pile.value), tripMax - w.coins)
      pile.value -= take
      w.coins += take
      pile.claimedBy = null
      if (take > 0) {
        sfx.coin()
        sim.fx.push({ t: 'burst', x: pile.pos.x, y: 0.6, z: pile.pos.z, color: '#ffd75e', n: 6, spread: 0.5 })
      }
      if (w.coins >= tripMax) w.mode = 'deliver'
    }
    return
  }

  if (w.coins > 0) {
    w.mode = 'deliver'
    return
  }
  w.activity = 'waiting for payments'
  walk(sim, w, { x: WORLD.campfire.x + 2, z: WORLD.campfire.z + 2 }, dt, 0.8)
}

// ---------------- gatherers: trees / fishing holes / coal seams ----------------

interface GatherCfg {
  nodes: TreeSim[]
  kind: ResKind
  workTime: number
  /** with a carrier hired, gatherers only stack their haul on this pile */
  depot: DepotSim | null
  carrier: WorkerRole | null
  /** where the haul goes when nobody carries it on */
  direct: Sink
  idle: V2
  verb: string
  idleText: string
}

function releaseNodes(nodes: TreeSim[], w: WorkerSim) {
  for (const t of nodes) if (t.reservedBy === w.id) t.reservedBy = null
}

function updateGatherer(sim: Sim, w: WorkerSim, dt: number, cfg: GatherCfg) {
  const cap = capOf(sim, w.role)
  const toPile = !!cfg.depot && !!cfg.carrier && sim.workers.some((x) => x.role === cfg.carrier)
  const sink = toPile ? depotSink(cfg.depot!, `stacking ${RES_NAME[cfg.kind]}`) : cfg.direct

  if (w.mode === 'deliver') {
    if (w.carry.length === 0) {
      w.mode = 'fetch'
      return
    }
    w.activity = sink.label
    if (!walk(sim, w, sink.at, dt, 0.6)) return
    if (sink.count < sink.cap) {
      if (transferTick(w, dt)) {
        const k = w.carry.pop()!
        sink.put()
        sfx.deposit()
        sim.fx.push({ t: 'itemfly', kind: k, from: { x: w.pos.x, y: 1.6, z: w.pos.z }, to: sink.to })
        if (w.carry.length === 0) w.mode = 'fetch'
      }
    } else {
      w.activity = sink.full
    }
    return
  }

  if (w.carry.length >= cap) {
    releaseNodes(cfg.nodes, w)
    w.mode = 'deliver'
    return
  }

  let node = cfg.nodes.find((t) => t.reservedBy === w.id && t.wood > 0)
  if (!node) {
    releaseNodes(cfg.nodes, w)
    let bestD = Infinity
    for (const t of cfg.nodes) {
      if (t.wood <= 0 || t.reservedBy !== null) continue
      const d = dist(w.pos, t.pos)
      if (d < bestD) {
        bestD = d
        node = t
      }
    }
    if (node) node.reservedBy = w.id
  }

  if (node) {
    w.activity = cfg.verb
    if (walk(sim, w, { x: node.pos.x + 0.9, z: node.pos.z + 0.4 }, dt, 0.5)) {
      w.yaw = lerpAngle(w.yaw, Math.atan2(node.pos.x - w.pos.x, node.pos.z - w.pos.z), damp(10, dt))
      w.timer -= dt
      if (w.timer <= 0) {
        w.timer = cfg.workTime
        w.swing = 0.25
        node.wood--
        node.shake = 1
        w.carry.push(cfg.kind)
        if (cfg.kind === 'log') sfx.chop()
        else if (cfg.kind === 'coal') sfx.thud()
        else sfx.pick()
        if (node.wood <= 0) {
          node.regrowT = regrowTime(cfg.kind)
          node.reservedBy = null
        }
      }
    }
    return
  }

  if (w.carry.length > 0) {
    w.mode = 'deliver'
    return
  }
  w.activity = cfg.idleText
  walk(sim, w, cfg.idle, dt, 1)
}

function regrowTime(kind: ResKind) {
  return kind === 'fish' ? NODES.hole.regrowTime : kind === 'coal' ? NODES.seam.regrowTime : TREES.regrowTime
}

const lumberjack = (sim: Sim, w: WorkerSim, dt: number) =>
  updateGatherer(sim, w, dt, {
    nodes: sim.trees,
    kind: 'log',
    workTime: WORKERS.lumberjackChopTime,
    depot: sim.depot,
    carrier: 'logCarrier',
    direct: stationSink(sim, 'wood'),
    idle: { x: WORLD.treeArea.x + 6, z: WORLD.treeArea.z + 5 },
    verb: 'chopping',
    idleText: 'waiting for trees',
  })

const fisher = (sim: Sim, w: WorkerSim, dt: number) =>
  updateGatherer(sim, w, dt, {
    nodes: sim.holes,
    kind: 'fish',
    workTime: WORKERS.fisherTime,
    depot: null,
    carrier: null,
    direct: procInSink(sim.proc.smokehouse),
    idle: { x: WORLD.pond.x + WORLD.pond.rx + 1, z: WORLD.pond.z + 1 },
    verb: 'fishing',
    idleText: 'waiting for a bite',
  })

const miner = (sim: Sim, w: WorkerSim, dt: number) =>
  updateGatherer(sim, w, dt, {
    nodes: sim.seams,
    kind: 'coal',
    workTime: WORKERS.minerTime,
    depot: sim.coalDepot,
    carrier: 'coalCarrier',
    direct: furnaceSink(sim),
    idle: { x: WORLD.coalDepot.x - 2, z: WORLD.coalDepot.z - 1.5 },
    verb: 'mining coal',
    idleText: 'waiting for the seams',
  })

// ---------------- guard: chase and fight wolves near the post ----------------

function updateGuard(sim: Sim, w: WorkerSim, dt: number) {
  let target = null
  let bestD = Infinity
  for (const wolf of sim.wolves) {
    // let empty-handed wolves run off; chase thieves and raiders
    if (wolf.state === 'flee' && wolf.carry === 0) continue
    const dPost = dist(wolf.pos, w.post)
    if (dPost > GUARD.leash) continue
    const d = dist(wolf.pos, w.pos)
    const reach = GUARD.aggro + (w.mode === 'chase' ? 6 : 0)
    if ((d < reach || dPost < GUARD.aggro) && d < bestD) {
      bestD = d
      target = wolf
    }
  }

  if (target) {
    w.mode = 'chase'
    w.activity = 'fighting wolves!'
    if (bestD > GUARD.range) {
      walk(sim, w, target.pos, dt, GUARD.range * 0.8, GUARD.speedMult)
    } else {
      w.yaw = lerpAngle(w.yaw, Math.atan2(target.pos.x - w.pos.x, target.pos.z - w.pos.z), damp(12, dt))
      w.atkT -= dt
      if (w.atkT <= 0) {
        w.atkT = GUARD.attackTime
        w.swing = 0.25
        damageWolf(sim, target, guardDamage(sim.rep.level))
      }
    }
    return
  }

  w.mode = 'patrol'
  w.activity = sim.clock.night ? 'standing watch' : 'on patrol'
  w.patrolT += dt
  const ang = w.patrolT * 0.35
  walk(sim, w, { x: w.post.x + Math.cos(ang) * 2.2, z: w.post.z + Math.sin(ang) * 1.4 }, dt, 0.4, 0.55)
}

// ---------------- dispatcher ----------------

const updaters: Record<WorkerRole, (sim: Sim, w: WorkerSim, dt: number) => void> = {
  collector: updateCollector,
  cook: (s, w, dt) => updateStaff(s, w, dt, 'kitchen'),
  tailor: (s, w, dt) => updateStaff(s, w, dt, 'tailor'),
  smoker: (s, w, dt) => updateStaff(s, w, dt, 'smokehouse'),
  runner: (s, w, dt) => updateHauler(s, w, dt, procSource(s.proc.kitchen), stationSink(s, 'meat')),
  coatRunner: (s, w, dt) => updateHauler(s, w, dt, procSource(s.proc.tailor), stationSink(s, 'coat')),
  fishRunner: (s, w, dt) => updateHauler(s, w, dt, procSource(s.proc.smokehouse), stationSink(s, 'fish')),
  logCarrier: (s, w, dt) => updateHauler(s, w, dt, depotSource(s.depot), stationSink(s, 'wood')),
  coalCarrier: (s, w, dt) => updateHauler(s, w, dt, depotSource(s.coalDepot), furnaceSink(s)),
  cashier: updateCashier,
  lumberjack,
  fisher,
  miner,
  guard: updateGuard,
}

export function updateWorkers(sim: Sim, dt: number) {
  for (const id of PROC_IDS) sim.proc[id].staffed = false
  for (const w of sim.workers) {
    if (w.swing > 0) w.swing -= dt
    updaters[w.role](sim, w, dt)
  }
}
