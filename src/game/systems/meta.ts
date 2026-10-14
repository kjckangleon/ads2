// The endless layer: Frost Stars from moving the settlement (prestige), the
// smoothed income rate, and "while you were away" earnings for time spent
// with the game closed or in the background.

import type { Sim } from '../types'
import { OFFLINE, PRESTIGE, starsFor, offlineFrac } from '../balance'
import { fmt } from '../format'
import { sfx } from '../audio'
import { createSim } from '../state'
import { saveNow } from '../save'
import { banner } from './progress'

/** Frost Stars this run would earn if the settlement moved now */
export function pendingStars(sim: Sim) {
  return starsFor(sim.stats.earned)
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** the free ×2 offline claim is once per calendar day */
export function canDoubleOffline(sim: Sim) {
  return sim.meta.doubleDay !== today()
}

/**
 * Pack up: a brand-new camp is written to the save with the Frost Stars added,
 * then the page reloads into it once the "moving" fade has played.
 */
export function moveSettlement(sim: Sim) {
  const gained = pendingStars(sim)
  if (gained < 1 || sim.moving > 0) return
  const next = createSim()
  next.meta = {
    ...sim.meta,
    stars: sim.meta.stars + gained,
    runs: sim.meta.runs + 1,
    bestLevel: Math.max(sim.meta.bestLevel, sim.rep.level),
  }
  next.money = PRESTIGE.startCashPerStar * next.meta.stars
  next.incomeRate = 0
  saveNow(next)
  sim.moving = PRESTIGE.moveTime
  sim.movingStars = gained
  sfx.levelUp()
}

/** called every tick: income smoothing, time-away detection, the move countdown */
export function updateMeta(sim: Sim, dt: number) {
  // smoothed $/s from stall sales: what the crew would keep earning while you're away
  sim.rateT += dt
  if (sim.rateT >= OFFLINE.sampleEvery) {
    const sample = (sim.stats.earned - sim.rateEarned) / sim.rateT
    sim.incomeRate += (sample - sim.incomeRate) * OFFLINE.smoothing
    sim.rateEarned = sim.stats.earned
    sim.rateT = 0
  }

  // a long gap between ticks = the game was closed or in the background
  if (typeof Date !== 'undefined') {
    const now = Date.now()
    if (sim.lastWall > 0) {
      const away = (now - sim.lastWall) / 1000
      if (away >= OFFLINE.minSeconds) grantOffline(sim, away)
    }
    sim.lastWall = now
  }
}

function grantOffline(sim: Sim, seconds: number) {
  const capped = Math.min(seconds, OFFLINE.maxHours * 3600)
  const amount = Math.floor(sim.incomeRate * capped * offlineFrac(sim.meta.stars))
  if (amount < 1) return
  // stack with an unclaimed payout rather than replacing it
  const prev = sim.offline
  sim.offline = { amount: amount + (prev?.amount ?? 0), seconds: capped + (prev?.seconds ?? 0) }
}

export function claimOffline(sim: Sim, double: boolean) {
  const o = sim.offline
  if (!o) return
  const mult = double && canDoubleOffline(sim) ? 2 : 1
  if (mult === 2) sim.meta.doubleDay = today()
  const amount = o.amount * mult
  sim.money += amount
  sim.offline = null
  const p = sim.player.pos
  for (let i = 0; i < 8; i++) sim.fx.push({ t: 'coin', x: p.x + (Math.random() - 0.5) * 1.5, y: 2.4, z: p.z + (Math.random() - 0.5) * 1.5 })
  sim.fx.push({ t: 'burst', x: p.x, y: 2, z: p.z, color: '#ffe680', n: 24, spread: 1.6, up: 4 })
  banner(sim, `❄️ +$${fmt(amount)} collected`, mult === 2 ? 'Doubled! Come back tomorrow for another ×2' : '', 'good')
  sfx.combo()
}
