// Linear objective track (auto-skips anything already done) plus the ground
// guide arrows that point the player at the current goal, raiding wolves and
// waiting caravans.

import type { Sim, V2, ProcessorId, StationId, WorkerRole, TreeSim, PadSim } from '../types'
import { fmt } from '../format'
import { WORLD, REP, CARAVAN, BELT_IDS } from '../balance'
import { dist } from '../util'
import { sfx } from '../audio'
import { orderText } from './caravan'
import { automated } from './belts'

interface Objective {
  text: string | ((s: Sim) => string)
  done: (s: Sim) => boolean
  target?: (s: Sim) => V2 | null
}

const hasWorker = (s: Sim, role: WorkerRole) => s.workers.some((w) => w.role === role)

const padPos =
  (id: string) =>
  (s: Sim): V2 | null => {
    const p = s.pads.find((x) => x.id === id)
    return p && p.visible && !p.locked ? p.pos : null
  }

function nearestDrop(s: Sim, kind: 'raw' | 'hide'): V2 | null {
  let best: V2 | null = null
  let bestD = Infinity
  for (const d of s.drops) {
    if (d.kind !== kind) continue
    const dd = dist(s.player.pos, d.pos)
    if (dd < bestD) {
      bestD = dd
      best = d.pos
    }
  }
  return best
}

/** where to go next in a manual hunt -> workshop -> stall chain */
function chainTarget(s: Sim, procId: ProcessorId, stationId: StationId, runner: WorkerRole): V2 | null {
  const pr = s.proc[procId]
  const st = s.stations[stationId]
  const carry = s.player.carry
  if (carry.includes(pr.outKind)) return st.restock
  if (carry.includes(pr.inKind)) return pr.inZone
  if (pr.outCount > 0 && !automated(s, runner)) return pr.outZone
  if (pr.inCount > 0 && !pr.staffed) return pr.workSpot
  return nearestDrop(s, pr.inKind as 'raw' | 'hide') ?? { x: WORLD.meadow.x, z: WORLD.meadow.z }
}

function nearestNode(s: Sim, nodes: TreeSim[]): V2 | null {
  let best: V2 | null = null
  let bestD = Infinity
  for (const n of nodes) {
    if (n.wood <= 0) continue
    const d = dist(s.player.pos, n.pos)
    if (d < bestD) {
      bestD = d
      best = n.pos
    }
  }
  return best
}

/** ice holes -> smokehouse -> fish stall, step by step */
function fishTarget(s: Sim): V2 | null {
  const pr = s.proc.smokehouse
  const carry = s.player.carry
  if (carry.includes('smoked')) return s.stations.fish.restock
  if (carry.includes('fish')) return pr.inZone
  if (pr.outCount > 0) return pr.outZone
  if (pr.inCount > 0 && !pr.staffed) return pr.workSpot
  return nearestNode(s, s.holes)
}

/** coal seams -> furnace */
function coalTarget(s: Sim): V2 | null {
  if (s.player.carry.includes('coal')) return s.furnace.feed
  if (s.coalDepot.count > 0) return s.coalDepot.pos
  return nearestNode(s, s.seams)
}

/** "🔒 Needs Coat Runner 1/2" while a pad waits on its prerequisites */
function padNeeds(s: Sim, id: string): string | null {
  const p = s.pads.find((x) => x.id === id)
  return p && p.visible && p.locked && p.lockText ? `🔒 ${p.lockText} first` : null
}

/** the cheapest belt pad that can be bought right now */
function beltPad(s: Sim): V2 | null {
  let best: V2 | null = null
  let cost = Infinity
  for (const id of [...BELT_IDS, 'cash']) {
    const p = s.pads.find((x) => x.id === `belt_${id}`)
    if (p && p.visible && !p.locked && p.level === 0 && p.cost < cost) {
      cost = p.cost
      best = p.pos
    }
  }
  return best
}

export const OBJECTIVES: Objective[] = [
  {
    text: '🪓 Chop pines (west) and stock the wood stall',
    // the stall starts stocked, so the lesson is the first chop
    done: (s) => s.trees.some((t) => t.wood < t.maxWood) || s.player.carry.includes('log'),
    target: (s) => {
      if (s.player.carry.includes('log')) return s.stations.wood.restock
      let best: V2 | null = null
      let bestD = Infinity
      for (const t of s.trees) {
        if (t.wood <= 0) continue
        const d = dist(s.player.pos, t.pos)
        if (d < bestD) {
          bestD = d
          best = t.pos
        }
      }
      return best
    },
  },
  {
    text: '💵 Serve customers, then grab the cash',
    done: (s) => s.stats.collected >= 125,
    target: (s) => {
      const pile = s.piles.find((p) => p.id === 'woodPay')!
      return pile.value > 0 ? pile.pos : null
    },
  },
  { text: '🪓 Hire a Lumberjack to chop for you', done: (s) => hasWorker(s, 'lumberjack'), target: padPos('lumberjack') },
  { text: '🍖 Build the Meat Stall (glowing pad)', done: (s) => s.stations.meat.unlocked, target: padPos('meatStall') },
  { text: '🪵 Hire a Log Carrier — wood runs itself!', done: (s) => automated(s, 'logCarrier'), target: padPos('logCarrier') },
  {
    text: '🦌 Hunt deer (east), cook at the kitchen fire, stock the counter',
    done: (s) => s.stats.meatServed >= 3,
    target: (s) => chainTarget(s, 'kitchen', 'meat', 'runner'),
  },
  { text: '🍳 Hire a Cook — no more standing at the fire', done: (s) => hasWorker(s, 'cook'), target: padPos('cook') },
  { text: '🧺 Hire a Meat Collector to gather the kills', done: (s) => hasWorker(s, 'collector'), target: padPos('collector') },
  { text: '🏃 Hire a Food Runner to restock the counter', done: (s) => automated(s, 'runner'), target: padPos('runner') },
  { text: '🏹 Build the Hunting Tower — it hunts for you', done: (s) => s.tower.built, target: padPos('tower') },
  { text: '💰 Hire a Cash Collector to bank your cash', done: (s) => automated(s, 'cashier'), target: padPos('cashier') },
  {
    text: (s) => `🔥 Never let a stall run dry — tips build a RUSH (${Math.min(s.rush.n, 10)}/10)`,
    done: (s) => s.rush.best >= 10,
  },
  {
    text: (s) =>
      !s.clock.enabled
        ? '⭐ Serve more survivors — reach Settlement Level 2'
        : s.clock.night
          ? '🐺 Defend your meat until dawn!'
          : '🌙 Survive the night — wolves will come for your meat',
    done: (s) => s.raid.count >= 1,
  },
  { text: '🛡️ Hire a Guard to fight wolves', done: (s) => hasWorker(s, 'guard'), target: padPos('guard') },
  {
    text: (s) =>
      s.rep.level < CARAVAN.unlockLevel
        ? `⭐ Reach Level ${CARAVAN.unlockLevel} to attract traders`
        : s.caravan.state === 'waiting'
          ? `🛷 Fill the caravan: ${orderText(s.caravan.order)}`
          : '🛷 A trade caravan will visit the west gate soon',
    // don't let a couple of missed caravans block the rest of the track
    done: (s) => s.stats.caravansDone >= 1 || s.stats.caravanVisits >= 3 || s.zones.tannery,
    target: (s) => (s.caravan.state === 'waiting' ? WORLD.caravanDeliver : null),
  },
  {
    text: (s) =>
      s.rep.level < REP.tanneryLevel
        ? `⭐ Reach Level ${REP.tanneryLevel} to open the Tannery`
        : '🧥 Open the Tannery district (east)',
    done: (s) => s.zones.tannery,
    target: padPos('zone_tannery'),
  },
  {
    text: '🧵 Sew hides into coats at the tailor bench, stock the Coat stall',
    done: (s) => s.stats.coatServed >= 2,
    target: (s) => chainTarget(s, 'tailor', 'coat', 'coatRunner'),
  },
  { text: '🧵 Hire a Tailor', done: (s) => hasWorker(s, 'tailor'), target: padPos('tailor') },
  { text: '🧥 Hire a Coat Runner', done: (s) => automated(s, 'coatRunner'), target: padPos('coatRunner') },
  {
    text: (s) =>
      s.rep.level < REP.beltLevel
        ? `⭐ Reach Level ${REP.beltLevel} to build conveyor belts`
        : beltPad(s)
          ? '⚙️ Build a conveyor belt — it hauls on its own'
          : '⚙️ Hire a full crew for a chain to unlock its belt',
    done: (s) => s.cash.level > 0 || BELT_IDS.some((id) => s.belts[id].level > 0),
    target: beltPad,
  },
  {
    text: (s) =>
      s.rep.level < REP.fisheryLevel
        ? `⭐ Reach Level ${REP.fisheryLevel} to open the Ice Fishery`
        : padNeeds(s, 'zone_fishery') ?? '🎣 Open the Ice Fishery (northwest)',
    done: (s) => s.zones.fishery,
    target: padPos('zone_fishery'),
  },
  {
    text: '🎣 Fish the ice holes, smoke the catch, stock the Fish stall',
    done: (s) => s.stats.fishServed >= 2,
    target: fishTarget,
  },
  { text: '🔥 Hire a Smoker', done: (s) => hasWorker(s, 'smoker'), target: padPos('smoker') },
  { text: '🎣 Hire a Fisher', done: (s) => hasWorker(s, 'fisher'), target: padPos('fisher') },
  { text: '🐟 Hire a Fish Runner', done: (s) => automated(s, 'fishRunner'), target: padPos('fishRunner') },
  {
    text: (s) =>
      s.rep.level < REP.mineLevel
        ? `⭐ Reach Level ${REP.mineLevel} to open the Coal Mine`
        : padNeeds(s, 'zone_mine') ?? '⛏️ Open the Coal Mine (north)',
    done: (s) => s.zones.mine,
    target: padPos('zone_mine'),
  },
  {
    text: '⛏️ Mine coal and feed the Furnace — it boosts every sale',
    done: (s) => s.stats.coalBurned >= 5,
    target: coalTarget,
  },
  { text: '⛏️ Hire a Miner', done: (s) => hasWorker(s, 'miner'), target: padPos('miner') },
  { text: '🪨 Hire a Coal Carrier', done: (s) => automated(s, 'coalCarrier'), target: padPos('coalCarrier') },
  {
    // the open-ended tail: always point at the next thing worth buying
    text: (s) => {
      const pad = nextPad(s)
      if (!pad) return `⭐ Grow the settlement — reach Level ${s.rep.level + 1}`
      const left = Math.ceil(pad.cost - pad.paid)
      return s.money >= left ? `⬆️ Next: ${pad.label} — $${fmt(left)}` : `💵 Save $${fmt(left - s.money)} for ${pad.label}`
    },
    done: () => false,
    target: (s) => nextPad(s)?.pos ?? null,
  },
]

/** the cheapest pad on sale right now, preferring ones the player can already afford */
function nextPad(s: Sim): PadSim | null {
  let best: PadSim | null = null
  let bestCost = Infinity
  let bestAfford = false
  for (const p of s.pads) {
    if (!p.visible || p.locked || p.done) continue
    const left = p.cost - p.paid
    const afford = s.money >= left
    if ((afford && !bestAfford) || (afford === bestAfford && left < bestCost)) {
      best = p
      bestCost = left
      bestAfford = afford
    }
  }
  return best
}

function current(sim: Sim): Objective {
  return OBJECTIVES[Math.min(sim.objective, OBJECTIVES.length - 1)]
}

export function objectiveText(sim: Sim): string {
  const o = current(sim)
  return typeof o.text === 'function' ? o.text(sim) : o.text
}

function updateGuides(sim: Sim, obj: Objective) {
  const g = sim.guides
  g.length = 0
  const p = sim.player.pos
  const tgt = obj.target?.(sim) ?? null
  if (tgt && dist(p, tgt) > 4.5) g.push({ x: tgt.x, z: tgt.z, color: 'gold' })

  let wolf = null
  let wd = Infinity
  for (const w of sim.wolves) {
    if (w.state === 'flee' && w.carry === 0) continue
    const d = dist(p, w.pos)
    if (d < wd) {
      wd = d
      wolf = w
    }
  }
  if (wolf && wd > 7) g.push({ x: wolf.pos.x, z: wolf.pos.z, color: 'red' })

  const cvSpot = WORLD.caravanDeliver
  if (sim.caravan.state === 'waiting' && tgt !== cvSpot && dist(p, cvSpot) > 6) {
    g.push({ x: cvSpot.x, z: cvSpot.z, color: 'teal' })
  }
}

export function updateObjectives(sim: Sim, dt: number) {
  if (sim.objectiveFlash > 0) sim.objectiveFlash -= dt
  const idx = Math.min(sim.objective, OBJECTIVES.length - 1)
  const cur = OBJECTIVES[idx]
  if (idx < OBJECTIVES.length - 1 && cur.done(sim)) {
    sim.objective++
    sim.objectiveFlash = 2
    sfx.milestone()
    const p = sim.player
    sim.fx.push({ t: 'burst', x: p.pos.x, y: 1.8, z: p.pos.z, color: '#ffe9b0', n: 18, spread: 1.4 })
  }
  updateGuides(sim, current(sim))
}
