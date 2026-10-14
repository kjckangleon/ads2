// Trade caravans: a sled parks at the west gate with a timed bulk order.
// Only the player can fill it, which keeps them busy once the settlement
// runs itself — and every log they divert is one the wood stall doesn't get.

import type { Sim, ResKind, CaravanOrder } from '../types'
import { CARAVAN, WORLD, REP } from '../balance'
import { RES_ICON } from '../icons'
import { sfx } from '../audio'
import { addXp, banner } from './progress'
import { requestSave } from '../saveFlag'
import { automated } from './belts'

/** Traders come once the settlement is big enough and food runs itself. */
export function caravansReady(sim: Sim) {
  return sim.rep.level >= CARAVAN.unlockLevel && automated(sim, 'runner')
}

/** world x of the sled along its road (z is fixed) */
export function caravanX(sim: Sim): number {
  const t = sim.caravan.travel
  const e = t * t * (3 - 2 * t)
  return WORLD.caravanEntry.x + (WORLD.caravanSpot.x - WORLD.caravanEntry.x) * e
}

export function orderText(order: CaravanOrder[]): string {
  return order.map((o) => `${RES_ICON[o.kind]} ${o.got}/${o.need}`).join('   ')
}

function makeOrder(sim: Sim): CaravanOrder[] {
  const n = sim.caravan.count
  const kinds: ResKind[] = ['log']
  if (sim.proc.kitchen.unlocked) kinds.push('cooked')
  if (sim.proc.tailor.unlocked) kinds.push('coat')
  if (sim.proc.smokehouse.unlocked) kinds.push('smoked')
  if (sim.furnace.built) kinds.push('coal')
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  const pick = kinds.length >= 3 && n >= 3 && Math.random() < 0.5 ? 3 : Math.min(2, kinds.length)
  return kinds.slice(0, pick).map((kind) => {
    const [base, per, max] = CARAVAN.qty[kind]!
    return { kind, need: Math.min(max, base + per * n), got: 0 }
  })
}

export function caravanNeeds(sim: Sim, kind: ResKind): boolean {
  const cv = sim.caravan
  if (cv.state !== 'waiting') return false
  return cv.order.some((o) => o.kind === kind && o.got < o.need)
}

/** Hand one item to the caravan. Returns false if it isn't wanted. */
export function caravanDeliver(sim: Sim, kind: ResKind): boolean {
  if (!caravanNeeds(sim, kind)) return false
  const cv = sim.caravan
  const o = cv.order.find((x) => x.kind === kind && x.got < x.need)!
  o.got++
  const pay = CARAVAN.payPerItem[kind]
  sim.piles.find((p) => p.id === 'caravanPay')!.value += pay
  cv.earned += pay
  sfx.deposit()
  return true
}

function finish(sim: Sim, ok: boolean) {
  const cv = sim.caravan
  cv.state = 'leaving'
  const at = { x: WORLD.caravanSpot.x, z: WORLD.caravanSpot.z }
  if (ok) {
    cv.count++
    const bonus = Math.round(cv.earned * CARAVAN.bonusFrac) + CARAVAN.bonusFlat
    sim.piles.find((p) => p.id === 'caravanPay')!.value += bonus
    sim.stats.caravansDone++
    addXp(sim, REP.xpCaravan)
    banner(sim, '🛷 Order complete!', `Bonus +$${bonus} waiting at the west gate`, 'good')
    sfx.fanfare()
    sim.fx.push({ t: 'burst', x: at.x, y: 2, z: at.z, color: '#ffe680', n: 30, spread: 2, up: 4 })
    sim.fx.push({ t: 'shake', power: 0.3 })
  } else {
    banner(
      sim,
      '🛷 The caravan moved on',
      cv.earned > 0 ? `You still earned $${cv.earned}` : 'Bring goods faster next time',
      'info',
    )
  }
  requestSave()
}

/** Debug helper: start an arrival right now regardless of level. */
export function summonCaravan(sim: Sim) {
  if (sim.caravan.state !== 'away') return
  startArrival(sim)
}

function startArrival(sim: Sim) {
  const cv = sim.caravan
  cv.order = makeOrder(sim)
  cv.earned = 0
  const total = cv.order.reduce((s, o) => s + o.need, 0)
  cv.maxTimer = cv.timer = Math.min(CARAVAN.maxTime, CARAVAN.baseTime + CARAVAN.perItem * total)
  cv.state = 'arriving'
  cv.travel = 0
  sim.stats.caravanVisits++
  banner(sim, '🛷 A trade caravan approaches!', `West gate — wants ${orderText(cv.order)}`, 'info')
  sfx.bell()
}

export function updateCaravan(sim: Sim, dt: number) {
  const cv = sim.caravan
  switch (cv.state) {
    case 'away': {
      if (!caravansReady(sim)) return
      cv.nextIn -= dt
      if (cv.nextIn <= 0) startArrival(sim)
      break
    }
    case 'arriving': {
      cv.travel = Math.min(1, cv.travel + dt / CARAVAN.travelTime)
      if (cv.travel >= 1) cv.state = 'waiting'
      break
    }
    case 'waiting': {
      if (cv.order.every((o) => o.got >= o.need)) {
        finish(sim, true)
        break
      }
      cv.timer -= dt
      if (cv.timer <= 0) finish(sim, false)
      break
    }
    case 'leaving': {
      cv.travel = Math.max(0, cv.travel - dt / CARAVAN.travelTime)
      if (cv.travel <= 0) {
        cv.state = 'away'
        cv.order = []
        cv.nextIn = CARAVAN.intervalMin + Math.random() * (CARAVAN.intervalMax - CARAVAN.intervalMin)
      }
      break
    }
  }
}
