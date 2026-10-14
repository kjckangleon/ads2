// Random events keep the late game lively: every few minutes something
// happens — a Blizzard rush, a Festival of VIPs, a Gold Rush of cash to grab,
// a daylight Wolf Siege led by an alpha, or a boss (Mammoth / Yeti) that
// drops a treasure chest. Loot on the ground is picked up here too.

import type { Sim, EventId, BossKind, AnimalSim } from '../types'
import {
  EVENTS,
  EVENT_INFO,
  BOSS,
  WORLD,
  PLAYER,
  levelGift,
  towerDps,
  wolfCount,
  xpForLevel,
} from '../balance'
import { fmt } from '../format'
import { sfx } from '../audio'
import { dist } from '../util'
import { spawnAnimal } from '../state'
import { perk } from '../perks'
import { addXp, banner } from './progress'
import { spawnWolf } from './wolves'
import { requestSave } from '../saveFlag'

// ---------------- effects other systems read ----------------

/** customers arrive this much faster */
export function eventSpawnMult(sim: Sim) {
  const id = sim.event?.id
  return id === 'blizzard' ? EVENTS.blizzardSpawn : id === 'festival' ? EVENTS.festivalSpawn : 1
}
/** every sale pays this much more */
export function eventPayMult(sim: Sim) {
  return sim.event?.id === 'blizzard' ? EVENTS.blizzardPay : 1
}
export function festivalOn(sim: Sim) {
  return sim.event?.id === 'festival'
}

// ---------------- scheduling ----------------

function available(sim: Sim): EventId[] {
  const out: EventId[] = ['blizzard', 'festival', 'goldRush']
  if (sim.tower.built && sim.clock.enabled && !sim.clock.night) out.push('siege')
  if (sim.tower.built && sim.rep.level >= EVENTS.bossLevel) out.push('boss')
  return out
}

function pick(ids: EventId[]): EventId {
  let total = 0
  for (const id of ids) total += EVENTS.weight[id]
  let r = Math.random() * total
  for (const id of ids) {
    r -= EVENTS.weight[id]
    if (r <= 0) return id
  }
  return ids[ids.length - 1]
}

function nextGap(sim: Sim) {
  const gap = EVENTS.gapMin + Math.random() * (EVENTS.gapMax - EVENTS.gapMin)
  return gap / (1 + 0.3 * perk(sim, 'events'))
}

export function startEvent(sim: Sim, id: EventId) {
  const dur = EVENTS.dur[id] * (1 + 0.25 * perk(sim, 'events'))
  sim.event = { id, t: dur, dur, bossId: -1, grabbed: 0 }
  sim.stats.eventsSeen++
  const info = EVENT_INFO[id]
  if (id === 'boss') {
    const boss = spawnBoss(sim)
    const b = BOSS[boss.kind as BossKind]
    banner(sim, `${b.icon} A ${b.label} appears!`, 'Bring it down for a treasure chest', 'warn')
    sim.focus = { x: boss.pos.x, z: boss.pos.z, t: 2.2 }
  } else {
    banner(sim, `${info.icon} ${info.name}`, info.sub, info.tone)
  }
  if (id === 'siege') startSiege(sim)
  if (id === 'blizzard') sim.fx.push({ t: 'shake', power: 0.2 })
  sfx.milestone()
}

function endEvent(sim: Sim) {
  const ev = sim.event
  if (!ev) return
  if (ev.id === 'goldRush' && ev.grabbed > 0) banner(sim, `💰 Gold Rush over`, `You grabbed $${fmt(ev.grabbed)}`, 'good')
  if (ev.id === 'siege') {
    // whoever is left of the pack runs for the woods
    for (const w of sim.wolves) if (w.siege) w.siege = false
  }
  if (ev.id === 'boss') {
    const boss = sim.animals.find((a) => a.id === ev.bossId)
    if (boss) {
      const b = BOSS[boss.kind as BossKind]
      sim.animals.splice(sim.animals.indexOf(boss), 1)
      sim.fx.push({ t: 'burst', x: boss.pos.x, y: 1.5, z: boss.pos.z, color: '#eef3f9', n: 30, spread: 2.5, up: 3 })
      banner(sim, `${b.icon} The ${b.label} wandered off`, 'Upgrade the tower and catch the next one', 'info')
    }
  }
  sim.event = null
  sim.eventNext = nextGap(sim)
}

// ---------------- bosses ----------------

function spawnBoss(sim: Sim): AnimalSim {
  const kind: BossKind = Math.random() < 0.5 ? 'mammoth' : 'yeti'
  const a = spawnAnimal(sim, kind)
  const t = sim.tower
  const dps = towerDps(t.dmgLvl, t.spdLvl, t.rngLvl, perk(sim, 'arrows'))
  a.maxHp = a.hp = Math.max(BOSS[kind].minHp, Math.round(dps * BOSS.towerSeconds))
  // it lumbers in from the far edge of the meadow
  const m = WORLD.meadow
  a.pos = { x: m.x + m.r, z: m.z - m.r * 0.4 }
  a.state = 'walk'
  a.target = { x: m.x, z: m.z }
  sim.event!.bossId = a.id
  sim.fx.push({ t: 'shake', power: 0.6 })
  return a
}

/** called by killAnimal when a boss falls: a treasure chest and a big XP hit */
export function bossDown(sim: Sim, a: AnimalSim) {
  const value = Math.round(levelGift(sim.rep.level) * BOSS.chestMult * (1 + 0.5 * perk(sim, 'bossLoot')))
  sim.loot.push({ id: sim.ids++, kind: 'chest', pos: { x: a.pos.x, z: a.pos.z }, value, age: 0, ttl: 90 })
  sim.stats.bossesKilled++
  addXp(sim, Math.round(xpForLevel(sim.rep.level) * BOSS.xpFrac))
  const b = BOSS[a.kind as BossKind]
  banner(sim, `${b.icon} ${b.label} defeated!`, `A treasure chest worth $${fmt(value)} — go grab it`, 'good')
  sim.fx.push({ t: 'shake', power: 0.7 })
  for (const color of ['#ffd75e', '#ffffff', '#7fdc8f']) {
    sim.fx.push({ t: 'burst', x: a.pos.x, y: 1.5, z: a.pos.z, color, n: 16, spread: 2.4, up: 5 })
  }
  requestSave()
}

// ---------------- wolf siege ----------------

function startSiege(sim: Sim) {
  const n = wolfCount(sim.raid.count) + EVENTS.siegeExtra
  for (let i = 0; i < n; i++) spawnWolf(sim).siege = true
  const alpha = spawnWolf(sim)
  alpha.siege = true
  alpha.alpha = true
  alpha.maxHp = alpha.hp = alpha.hp * EVENTS.alphaHpMult
}

// ---------------- loot on the ground ----------------

function updateLoot(sim: Sim, dt: number) {
  const p = sim.player
  for (let i = sim.loot.length - 1; i >= 0; i--) {
    const l = sim.loot[i]
    l.age += dt
    const reach = l.kind === 'chest' ? 2.2 : PLAYER.pickupRange
    if (dist(p.pos, l.pos) < reach) {
      sim.loot.splice(i, 1)
      sim.money += l.value
      sim.stats.collected += l.value
      if (sim.event?.id === 'goldRush' && l.kind === 'cash') sim.event.grabbed += l.value
      sim.fx.push({ t: 'text', x: l.pos.x, y: 1.8, z: l.pos.z, str: `+$${fmt(l.value)}`, color: '#b8ff9a', size: l.kind === 'chest' ? 1.4 : 0.9 })
      for (let k = 0; k < (l.kind === 'chest' ? 10 : 2); k++) {
        sim.fx.push({ t: 'coin', x: l.pos.x + (Math.random() - 0.5), y: 0.8, z: l.pos.z + (Math.random() - 0.5) })
      }
      if (l.kind === 'chest') {
        sim.fx.push({ t: 'burst', x: l.pos.x, y: 1, z: l.pos.z, color: '#ffd75e', n: 26, spread: 1.6, up: 5 })
        sfx.combo()
      } else sfx.coin()
      continue
    }
    if (l.age > l.ttl) {
      sim.loot.splice(i, 1)
      sim.fx.push({ t: 'burst', x: l.pos.x, y: 0.3, z: l.pos.z, color: '#cfeaff', n: 4, spread: 0.4, up: 1 })
    }
  }
}

let goldT = 0

export function updateEvents(sim: Sim, dt: number) {
  updateLoot(sim, dt)
  if (sim.rep.level < EVENTS.unlockLevel || !sim.tower.built) return

  const ev = sim.event
  if (!ev) {
    sim.eventNext -= dt
    if (sim.eventNext <= 0) startEvent(sim, pick(available(sim)))
    return
  }

  ev.t -= dt
  if (ev.id === 'goldRush') {
    goldT -= dt
    if (goldT <= 0) {
      goldT = EVENTS.goldEvery
      const c = WORLD.campfire
      const ang = Math.random() * Math.PI * 2
      const r = 3 + Math.random() * EVENTS.goldRadius
      const value = Math.max(25, Math.round(levelGift(sim.rep.level) * EVENTS.goldShare))
      sim.loot.push({ id: sim.ids++, kind: 'cash', pos: { x: c.x + Math.cos(ang) * r, z: c.z + 4 + Math.sin(ang) * r }, value, age: 0, ttl: EVENTS.goldTtl })
    }
  }
  if (ev.id === 'siege' && !sim.wolves.some((w) => w.siege)) ev.t = 0
  if (ev.id === 'boss' && !sim.animals.some((a) => a.id === ev.bossId)) {
    // killed: end now (the chest stays on the ground)
    sim.event = null
    sim.eventNext = nextGap(sim)
    return
  }
  if (ev.t <= 0) endEvent(sim)
}
