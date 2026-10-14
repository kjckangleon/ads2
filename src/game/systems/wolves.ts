// Night raiders. Wolves come out of the forest, go for the nearest meat
// (ground drops, the kitchen, the meat counter), grab a mouthful and run.
// Killing one drops whatever it was carrying, a hide, and a coin bounty.

import type { Sim, WolfSim, WolfTarget, V2 } from '../types'
import { WOLVES, ANIMALS, REP, WORLD, EVENTS, wolfHp } from '../balance'
import { dist, seek } from '../util'
import { sfx } from '../audio'
import { addXp, banner } from './progress'
import { dropItem, countDrops } from './animals'

export function spawnWolf(sim: Sim) {
  const sp = WOLVES.spawnPoints[Math.floor(Math.random() * WOLVES.spawnPoints.length)]
  const hp = wolfHp(sim.raid.count)
  const w: WolfSim = {
    id: sim.ids++,
    pos: { x: sp.x + (Math.random() - 0.5) * 4, z: sp.z + (Math.random() - 0.5) * 4 },
    yaw: 0,
    hp,
    maxHp: hp,
    state: 'approach',
    target: { x: sp.x, z: sp.z },
    targetType: 'none',
    targetRef: -1,
    carry: 0,
    t: 0,
    retargetT: 0,
    hitFlash: 0,
    walkPhase: Math.random() * 6,
    exit: { x: sp.x, z: sp.z },
    siege: false,
    alpha: false,
  }
  pickTarget(sim, w)
  sim.wolves.push(w)
  return w
}

function pickTarget(sim: Sim, w: WolfSim) {
  let bestD = Infinity
  let type: WolfTarget = 'none'
  let ref = -1
  let pos: V2 = sim.proc.kitchen.unlocked ? sim.proc.kitchen.inZone : WORLD.meadow
  const consider = (t: WolfTarget, r: number, p: V2) => {
    const d = dist(w.pos, p)
    if (d < bestD) {
      bestD = d
      type = t
      ref = r
      pos = p
    }
  }
  for (const d of sim.drops) if (d.kind === 'raw') consider('drop', d.id, d.pos)
  const k = sim.proc.kitchen
  if (k.unlocked && k.inCount > 0) consider('kitchenIn', -1, k.inZone)
  if (k.unlocked && k.outCount > 0) consider('kitchenOut', -1, k.outZone)
  const m = sim.stations.meat
  if (m.unlocked && m.stock > 0) consider('meat', -1, m.restock)
  w.targetType = type
  w.targetRef = ref
  w.target = { x: pos.x, z: pos.z }
  w.retargetT = 1.2
}

function targetValid(sim: Sim, w: WolfSim): boolean {
  switch (w.targetType) {
    case 'drop':
      return sim.drops.some((d) => d.id === w.targetRef)
    case 'kitchenIn':
      return sim.proc.kitchen.inCount > 0
    case 'kitchenOut':
      return sim.proc.kitchen.outCount > 0
    case 'meat':
      return sim.stations.meat.stock > 0
    default:
      return true
  }
}

function steal(sim: Sim, w: WolfSim): number {
  const amount = WOLVES.stealAmount
  let taken = 0
  switch (w.targetType) {
    case 'drop': {
      for (let i = sim.drops.length - 1; i >= 0 && taken < amount; i--) {
        const d = sim.drops[i]
        if (d.kind === 'raw' && dist(d.pos, w.pos) < WOLVES.stealRange) {
          sim.drops.splice(i, 1)
          taken++
        }
      }
      break
    }
    case 'kitchenIn': {
      const k = sim.proc.kitchen
      taken = Math.min(amount, k.inCount)
      k.inCount -= taken
      break
    }
    case 'kitchenOut': {
      const k = sim.proc.kitchen
      taken = Math.min(amount, k.outCount)
      k.outCount -= taken
      break
    }
    case 'meat': {
      const m = sim.stations.meat
      taken = Math.min(amount, m.stock)
      m.stock -= taken
      break
    }
  }
  return taken
}

export function damageWolf(sim: Sim, w: WolfSim, dmg: number) {
  w.hp -= dmg
  w.hitFlash = 1
  sfx.hit()
  sim.fx.push({
    t: 'text',
    x: w.pos.x,
    y: 1.7,
    z: w.pos.z,
    str: `-${dmg}`,
    color: '#ffcf5e',
    size: 0.75,
  })
  if (w.hp <= 0) killWolf(sim, w)
}

export function killWolf(sim: Sim, w: WolfSim) {
  const idx = sim.wolves.indexOf(w)
  if (idx === -1) return
  sim.wolves.splice(idx, 1)
  for (let i = 0; i < w.carry; i++) dropItem(sim, 'raw', w.pos, 1)
  if (sim.proc.tailor.unlocked && countDrops(sim, 'hide') < ANIMALS.maxGroundHides) {
    dropItem(sim, 'hide', w.pos, 0.8)
  }
  // bounty flies to the nearest coin pile
  const bounty = (WOLVES.bounty + WOLVES.bountyPerRaid * sim.raid.count) * (w.alpha ? EVENTS.alphaBountyMult : 1)
  let pile = sim.piles[0]
  let best = Infinity
  for (const p of sim.piles) {
    const d = dist(p.pos, w.pos)
    if (d < best) {
      best = d
      pile = p
    }
  }
  pile.value += bounty
  for (let i = 0; i < 3; i++) {
    sim.fx.push({
      t: 'coin',
      x: w.pos.x + (Math.random() - 0.5) * 0.6,
      y: 0.6,
      z: w.pos.z + (Math.random() - 0.5) * 0.6,
      to: { x: pile.pos.x, y: 0.3, z: pile.pos.z },
    })
  }
  sim.stats.wolvesKilled++
  addXp(sim, REP.xpWolf)
  sfx.wolfKill()
  sim.fx.push({ t: 'burst', x: w.pos.x, y: 0.8, z: w.pos.z, color: '#9aa1ad', n: 14, spread: 1 })
  sim.fx.push({ t: 'text', x: w.pos.x, y: 2.0, z: w.pos.z, str: `${w.alpha ? '🐺 ALPHA DOWN ' : '🐺 '}+$${bounty}`, color: '#ffd75e', size: w.alpha ? 1.3 : 1 })
  if (w.alpha) sim.fx.push({ t: 'shake', power: 0.4 })
}

export function updateWolves(sim: Sim, dt: number) {
  for (let i = sim.wolves.length - 1; i >= 0; i--) {
    const w = sim.wolves[i]
    if (w.hitFlash > 0) w.hitFlash -= dt * 4
    // the pack scatters at dawn (a siege pack keeps coming until its event ends)
    if (!sim.clock.night && !w.siege && w.state !== 'flee') w.state = 'flee'

    switch (w.state) {
      case 'approach': {
        w.retargetT -= dt
        if (w.retargetT <= 0 || !targetValid(sim, w)) pickTarget(sim, w)
        const arrived = seek(w, w.target, WOLVES.speed, dt, 0.7)
        if (!arrived) w.walkPhase += dt * WOLVES.speed * 2.2
        else if (w.targetType !== 'none') {
          w.state = 'steal'
          w.t = WOLVES.stealTime
        }
        break
      }
      case 'steal': {
        w.t -= dt
        if (w.t > 0) break
        const n = steal(sim, w)
        if (n > 0) {
          w.carry = n
          w.state = 'flee'
          sim.raid.stolen += n
          sfx.growl()
          sim.fx.push({ t: 'text', x: w.pos.x, y: 1.8, z: w.pos.z, str: `-${n} 🥩`, color: '#ff7b6b', size: 0.9 })
          if (!sim.raid.theftAnnounced) {
            sim.raid.theftAnnounced = true
            banner(sim, '🐺 Wolves are stealing meat!', 'Chase them down — or upgrade the tower', 'warn')
          }
        } else {
          w.state = 'approach'
          pickTarget(sim, w)
        }
        break
      }
      case 'flee': {
        w.walkPhase += dt * WOLVES.fleeSpeed * 2.2
        if (seek(w, w.exit, WOLVES.fleeSpeed, dt, 1.0)) {
          sim.wolves.splice(i, 1)
          continue
        }
        break
      }
    }
  }

  // keep the pack from stacking on one spot
  const ws = sim.wolves
  for (let i = 0; i < ws.length; i++) {
    for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i].pos
      const b = ws[j].pos
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = Math.hypot(dx, dz)
      if (d < 0.9 && d > 0.0001) {
        const push = (0.9 - d) * 0.5
        a.x -= (dx / d) * push
        a.z -= (dz / d) * push
        b.x += (dx / d) * push
        b.z += (dz / d) * push
      }
    }
  }
}
