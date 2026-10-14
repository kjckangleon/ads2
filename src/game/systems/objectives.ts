// Linear objective track (auto-skips anything already done) plus the ground
// guide arrows that point the player at the current goal, raiding wolves and
// waiting caravans.

import type { Sim, V2, ProcessorId, StationId, WorkerRole } from '../types'
import { WORLD, REP, CARAVAN } from '../balance'
import { dist } from '../util'
import { sfx } from '../audio'
import { orderText } from './caravan'

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
  if (pr.outCount > 0 && !hasWorker(s, runner)) return pr.outZone
  if (pr.inCount > 0 && !pr.staffed) return pr.workSpot
  return nearestDrop(s, pr.inKind as 'raw' | 'hide') ?? { x: WORLD.meadow.x, z: WORLD.meadow.z }
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
  { text: '🪵 Hire a Log Carrier — wood runs itself!', done: (s) => hasWorker(s, 'logCarrier'), target: padPos('logCarrier') },
  {
    text: '🦌 Hunt deer (east), cook at the kitchen fire, stock the counter',
    done: (s) => s.stats.meatServed >= 3,
    target: (s) => chainTarget(s, 'kitchen', 'meat', 'runner'),
  },
  { text: '🍳 Hire a Cook — no more standing at the fire', done: (s) => hasWorker(s, 'cook'), target: padPos('cook') },
  { text: '🧺 Hire a Meat Collector to gather the kills', done: (s) => hasWorker(s, 'collector'), target: padPos('collector') },
  { text: '🏃 Hire a Food Runner to restock the counter', done: (s) => hasWorker(s, 'runner'), target: padPos('runner') },
  { text: '🏹 Build the Hunting Tower — it hunts for you', done: (s) => s.tower.built, target: padPos('tower') },
  { text: '💰 Hire a Cash Collector to bank your cash', done: (s) => hasWorker(s, 'cashier'), target: padPos('cashier') },
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
  { text: '🧥 Hire a Coat Runner', done: (s) => hasWorker(s, 'coatRunner'), target: padPos('coatRunner') },
  {
    text: (s) => `⭐ Grow the settlement — reach Level ${s.rep.level + 1}`,
    done: () => false,
  },
]

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
