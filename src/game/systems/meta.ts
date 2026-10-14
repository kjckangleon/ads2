// The endless layer: Frost Stars from moving the settlement (prestige), the
// smoothed income rate, and "while you were away" earnings for time spent
// with the game closed or in the background.

import type { Sim, PerkId } from '../types'
import { OFFLINE, PRESTIGE, PERKS, starsFor, offlineFrac } from '../balance'
import { perk } from '../perks'
import { grantPad } from './economy'
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
  applyStartPerks(next)
  saveNow(next)
  sim.moving = PRESTIGE.moveTime
  sim.movingStars = gained
  sfx.levelUp()
}

/** Head Start / Veteran Crew / Old Friends: what a fresh camp begins with */
function applyStartPerks(next: Sim) {
  const lvl = perk(next, 'startLevel')
  if (lvl > 0) {
    next.rep.level = 1 + lvl
    next.rep.xp = 0
  }
  if (perk(next, 'headstart') > 0) {
    grantPad(next, 'meatStall')
    grantPad(next, 'tower')
    // a stall that's already built shouldn't wait for "sell your first wood"
    next.stats.woodServed = Math.max(next.stats.woodServed, 4)
    next.stats.meatServed = Math.max(next.stats.meatServed, 1)
  }
  if (perk(next, 'crew') > 0 && perk(next, 'headstart') > 0) {
    grantPad(next, 'lumberjack')
    grantPad(next, 'cook')
    grantPad(next, 'runner')
  }
  next.fx.length = 0
  next.banners.length = 0
  next.focus = null
}

/** unspent stars available in the shop */
export function freeStars(sim: Sim) {
  return sim.meta.stars - sim.meta.spent
}

export function perkCost(sim: Sim, id: PerkId): number | null {
  const lvl = perk(sim, id)
  const def = PERKS[id]
  return lvl < def.costs.length ? def.costs[lvl] : null
}

export function canBuyPerk(sim: Sim, id: PerkId) {
  const cost = perkCost(sim, id)
  const req = PERKS[id].requires
  return cost !== null && freeStars(sim) >= cost && (!req || perk(sim, req) > 0)
}

export function buyPerk(sim: Sim, id: PerkId) {
  if (!canBuyPerk(sim, id)) return
  const cost = perkCost(sim, id)!
  sim.meta.spent += cost
  sim.meta.perks = { ...sim.meta.perks, [id]: perk(sim, id) + 1 }
  const p = sim.player.pos
  sim.fx.push({ t: 'burst', x: p.x, y: 2.2, z: p.z, color: '#bfe6ff', n: 22, spread: 1.4, up: 4 })
  banner(sim, `${PERKS[id].icon} ${PERKS[id].name} unlocked`, PERKS[id].desc, 'good')
  sfx.levelUp()
  saveNow(sim)
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
  const night = perk(sim, 'offline')
  const capped = Math.min(seconds, (OFFLINE.maxHours + 4 * night) * 3600)
  const amount = Math.floor(sim.incomeRate * capped * (offlineFrac(sim.meta.stars) + 0.1 * night))
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
  for (let i = 0; i < 8; i++)
    sim.fx.push({ t: 'coin', x: p.x + (Math.random() - 0.5) * 1.5, y: 2.4, z: p.z + (Math.random() - 0.5) * 1.5 })
  sim.fx.push({ t: 'burst', x: p.x, y: 2, z: p.z, color: '#ffe680', n: 24, spread: 1.6, up: 4 })
  banner(sim, `❄️ +$${fmt(amount)} collected`, mult === 2 ? 'Doubled! Come back tomorrow for another ×2' : '', 'good')
  sfx.combo()
}
