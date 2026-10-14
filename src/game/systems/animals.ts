import type { Sim, AnimalSim, AnimalKind, BossKind, V2, TreeSim } from '../types'
import { ANIMALS, BOSS, WORLD, PLAYER, deerTarget, bigGameTarget, animalRespawn } from '../balance'
import { bossDown } from './events'
import { seek, dist, clamp } from '../util'
import { spawnAnimal } from '../state'
import { sfx } from '../audio'

export function dropItem(sim: Sim, kind: 'raw' | 'hide', at: V2, spread: number) {
  // the meadow holds so much meat: a fresh kill pushes the oldest piece off to spoil
  if (kind === 'raw' && countDrops(sim, 'raw') >= ANIMALS.maxGroundMeat) {
    let old = -1
    sim.drops.forEach((d, i) => {
      if (d.kind === 'raw' && d.reservedBy === null && (old < 0 || d.age > sim.drops[old].age)) old = i
    })
    if (old >= 0) sim.drops.splice(old, 1)
  }
  sim.drops.push({
    id: sim.ids++,
    kind,
    pos: {
      x: at.x + (Math.random() - 0.5) * spread,
      z: at.z + (Math.random() - 0.5) * spread,
    },
    reservedBy: null,
    age: 0,
  })
}

export function countDrops(sim: Sim, kind: 'raw' | 'hide') {
  let n = 0
  for (const d of sim.drops) if (d.kind === kind) n++
  return n
}

const LOOT: Record<AnimalKind, { meat: number; hides: number; spread: number }> = {
  rabbit: { meat: ANIMALS.rabbitDrops, hides: 0, spread: 1.2 },
  deer: { meat: ANIMALS.deerDrops, hides: 1, spread: 1.2 },
  goat: { meat: ANIMALS.goat.drops, hides: ANIMALS.goat.hides, spread: 1.4 },
  bear: { meat: ANIMALS.bear.drops, hides: ANIMALS.bear.hides, spread: 2.0 },
  mammoth: { meat: BOSS.mammoth.drops, hides: BOSS.mammoth.hides, spread: 3.0 },
  yeti: { meat: BOSS.yeti.drops, hides: BOSS.yeti.hides, spread: 2.6 },
}

export const isBoss = (k: AnimalKind): k is BossKind => k === 'mammoth' || k === 'yeti'
/** bears and bosses fight back instead of running */
const fighter = (k: AnimalKind) => k === 'bear' || isBoss(k)
const chargeSpeed = (k: AnimalKind) => (isBoss(k) ? BOSS[k].charge : ANIMALS.bear.charge)

export function killAnimal(sim: Sim, a: AnimalSim) {
  const idx = sim.animals.indexOf(a)
  if (idx === -1) return
  sim.animals.splice(idx, 1)
  const loot = LOOT[a.kind]
  for (let i = 0; i < loot.meat; i++) dropItem(sim, 'raw', a.pos, loot.spread)
  if (sim.proc.tailor.unlocked) {
    for (let i = 0; i < loot.hides && countDrops(sim, 'hide') < ANIMALS.maxGroundHides; i++) {
      dropItem(sim, 'hide', a.pos, 1.0)
    }
  }
  sim.stats.kills++
  if (a.kind === 'bear') sim.stats.bearKills++
  if (isBoss(a.kind)) bossDown(sim, a)
  sfx.kill()
  const big = a.kind === 'bear' || a.kind === 'goat' || isBoss(a.kind)
  sim.fx.push({
    t: 'burst',
    x: a.pos.x,
    y: 0.8,
    z: a.pos.z,
    color: '#e06a5a',
    n: big ? 22 : 10,
    spread: big ? 1.6 : 0.9,
  })
  sim.fx.push({
    t: 'text',
    x: a.pos.x,
    y: big ? 2.4 : 1.6,
    z: a.pos.z,
    str: a.kind === 'bear' ? `🐻 🥩×${loot.meat}` : a.kind === 'goat' ? `🐐 🥩×${loot.meat}` : '🥩',
    color: '#ffd9a0',
    size: big ? 1.3 : 1.1,
  })
  if (a.kind === 'bear') sim.fx.push({ t: 'shake', power: 0.3 })
}

/**
 * One hit from the player or the tower. Prey bolts; a bear turns and charges
 * the player instead, so big game is a fight rather than a free meal.
 */
export function hurtAnimal(sim: Sim, a: AnimalSim, dmg: number, byTower: boolean) {
  a.hp -= dmg
  a.hitFlash = 1
  if (fighter(a.kind)) {
    if (dist(a.pos, sim.player.pos) < ANIMALS.bearAggro * (isBoss(a.kind) ? 1.6 : 1)) {
      if (a.state !== 'charge') {
        const roar = a.kind === 'mammoth' ? '🦣 HRRUUMPH!' : a.kind === 'yeti' ? '❄️ RAAWR!' : '🐻 GRRR!'
        sim.fx.push({
          t: 'text',
          x: a.pos.x,
          y: isBoss(a.kind) ? 4 : 2.6,
          z: a.pos.z,
          str: roar,
          color: '#ff9a6a',
          size: 1,
        })
      }
      a.state = 'charge'
      a.t = ANIMALS.bearChaseTime
    }
  } else {
    a.state = 'flee'
    a.t = ANIMALS.fleeTime * (byTower ? 0.7 : 1)
  }
  const y = isBoss(a.kind) ? 4.2 : a.kind === 'bear' ? 2.3 : 1.6
  if (byTower) {
    sfx.hit()
    sim.fx.push({ t: 'text', x: a.pos.x, y, z: a.pos.z, str: `-${dmg}`, color: '#ffcf5e', size: 0.75 })
    sim.fx.push({ t: 'burst', x: a.pos.x, y: 0.7, z: a.pos.z, color: '#ffe0a0', n: 5, spread: 0.5 })
  } else {
    sim.fx.push({ t: 'text', x: a.pos.x, y, z: a.pos.z, str: `-${dmg}`, color: '#ff7b6b', size: 0.8 })
  }
  if (a.hp <= 0) killAnimal(sim, a)
}

const WALK: Record<AnimalKind, number> = {
  deer: ANIMALS.deerWalk,
  rabbit: ANIMALS.rabbitWalk,
  goat: ANIMALS.goat.walk,
  bear: ANIMALS.bear.walk,
  mammoth: BOSS.mammoth.walk,
  yeti: BOSS.yeti.walk,
}
const FLEE: Record<AnimalKind, number> = {
  deer: ANIMALS.deerFlee,
  rabbit: ANIMALS.rabbitFlee,
  goat: ANIMALS.goat.flee,
  bear: ANIMALS.bear.walk,
  mammoth: BOSS.mammoth.walk,
  yeti: BOSS.yeti.walk,
}

function regrow(nodes: TreeSim[], dt: number) {
  for (const t of nodes) {
    if (t.shake > 0) t.shake -= dt * 3
    if (t.wood <= 0) {
      t.regrowT -= dt
      if (t.regrowT <= 0) t.wood = t.maxWood
    }
  }
}

/** A charging bear that reaches the player bats them away. */
function bearSwipe(sim: Sim, a: AnimalSim) {
  const p = sim.player
  a.atkT = ANIMALS.bearSwipeCd
  const dx = p.pos.x - a.pos.x
  const dz = p.pos.z - a.pos.z
  const d = Math.hypot(dx, dz) || 1
  // the Laser Blaster level also makes you harder to bat away
  const tough = Math.max(0, 1 - PLAYER.slayKnockbackCut * p.slayLvl)
  const k = (isBoss(a.kind) ? BOSS[a.kind].knockback : ANIMALS.bearKnockback) * tough
  p.pos.x += (dx / d) * k
  p.pos.z += (dz / d) * k
  sim.fx.push({ t: 'shake', power: 0.45 })
  sim.fx.push({ t: 'burst', x: p.pos.x, y: 1.0, z: p.pos.z, color: '#f4f8ff', n: 12, spread: 0.9, up: 2 })
  sim.fx.push({ t: 'text', x: p.pos.x, y: 2.6, z: p.pos.z, str: '💥 SWIPE!', color: '#ff9a6a', size: 1 })
  sfx.thud()
}

function pickWanderTarget(a: AnimalSim) {
  const m = WORLD.meadow
  const ang = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * (m.r - 1)
  a.target = { x: m.x + Math.cos(ang) * r, z: m.z + Math.sin(ang) * r }
}

export function updateAnimals(sim: Sim, dt: number) {
  const m = WORLD.meadow
  const p = sim.player

  for (const a of sim.animals) {
    if (a.hitFlash > 0) a.hitFlash -= dt * 4
    if (a.atkT > 0) a.atkT -= dt

    const walkSpeed = WALK[a.kind]
    const fleeSpeed = FLEE[a.kind]

    // player proximity triggers flee (bears stand their ground)
    const dp = dist(a.pos, p.pos)
    if (!fighter(a.kind) && dp < ANIMALS.fleeTrigger && a.state !== 'flee') {
      a.state = 'flee'
      a.t = ANIMALS.fleeTime
    }

    switch (a.state) {
      case 'charge': {
        a.t -= dt
        const reach = ANIMALS.bearReach * (isBoss(a.kind) ? 1.8 : 1)
        a.walkPhase += dt * chargeSpeed(a.kind) * 2.2
        if (dp > reach) seek(a, p.pos, chargeSpeed(a.kind), dt, reach * 0.9)
        else if (a.atkT <= 0) bearSwipe(sim, a)
        if (a.t <= 0 || dp > ANIMALS.bearAggro * (isBoss(a.kind) ? 2.4 : 1.5)) {
          a.state = 'idle'
          a.t = 1 + Math.random()
        }
        break
      }
      case 'idle': {
        a.t -= dt
        if (a.t <= 0) {
          pickWanderTarget(a)
          a.state = 'walk'
        }
        break
      }
      case 'walk': {
        a.walkPhase += dt * walkSpeed * 2.5
        if (seek(a, a.target, walkSpeed, dt, 0.4)) {
          a.state = 'idle'
          a.t = 1 + Math.random() * 3
        }
        break
      }
      case 'flee': {
        a.walkPhase += dt * fleeSpeed * 2.5
        a.t -= dt
        // run away from player, biased back toward meadow center when at edge
        let dx = a.pos.x - p.pos.x
        let dz = a.pos.z - p.pos.z
        const d = Math.hypot(dx, dz) || 1
        dx /= d
        dz /= d
        const distFromCenter = Math.hypot(a.pos.x - m.x, a.pos.z - m.z)
        if (distFromCenter > m.r) {
          const cx = (m.x - a.pos.x) / distFromCenter
          const cz = (m.z - a.pos.z) / distFromCenter
          dx = dx * 0.35 + cx * 0.65
          dz = dz * 0.35 + cz * 0.65
          const len = Math.hypot(dx, dz) || 1
          dx /= len
          dz /= len
        }
        a.pos.x += dx * fleeSpeed * dt
        a.pos.z += dz * fleeSpeed * dt
        a.yaw = Math.atan2(dx, dz)
        if (a.t <= 0) {
          a.state = 'idle'
          a.t = 0.6 + Math.random()
        }
        break
      }
    }

    // keep game in the meadow (and out of the tannery district)
    a.pos.x = clamp(a.pos.x, m.x - m.r - 2, m.x + m.r + 2)
    a.pos.z = clamp(a.pos.z, m.z - m.r - 2, m.z + m.r + 2)
  }

  // respawn to keep the population up (Wild Game upgrades and settlement level raise it)
  const lvl = sim.rep.level
  const counts: Record<AnimalKind, number> = { deer: 0, rabbit: 0, goat: 0, bear: 0, mammoth: 0, yeti: 0 }
  for (const a of sim.animals) counts[a.kind]++
  const want: Record<AnimalKind, number> = {
    deer: deerTarget(sim.game.lvl, lvl),
    goat: bigGameTarget('goat', lvl),
    bear: bigGameTarget('bear', lvl),
    rabbit: ANIMALS.rabbitCount,
    // bosses only arrive with their event
    mammoth: 0,
    yeti: 0,
  }
  // refill whichever kind is furthest below its target, so big game shows up even
  // while the tower keeps thinning the deer
  let next: AnimalKind | null = null
  let worst = 1
  for (const k of ['deer', 'goat', 'bear', 'rabbit'] as AnimalKind[]) {
    if (want[k] <= 0) continue
    const fill = counts[k] / want[k]
    if (fill < worst) {
      worst = fill
      next = k
    }
  }
  if (next) {
    sim.animalRespawnT -= dt
    if (sim.animalRespawnT <= 0) {
      sim.animalRespawnT = animalRespawn(sim.game.lvl, lvl)
      const a = spawnAnimal(sim, next)
      if (next === 'bear' || next === 'goat') {
        sim.fx.push({ t: 'text', x: a.pos.x, y: 2.6, z: a.pos.z, str: next === 'bear' ? '🐻' : '🐐', size: 1.2 })
      }
    }
  }

  // tree / fishing hole / coal seam regrowth lives here to keep the world tick together
  regrow(sim.trees, dt)
  regrow(sim.holes, dt)
  regrow(sim.seams, dt)

  let meat = countDrops(sim, 'raw')
  for (let i = sim.drops.length - 1; i >= 0; i--) {
    const d = sim.drops[i]
    d.age += dt
    const spoiled =
      d.reservedBy === null &&
      (d.kind === 'hide'
        ? d.age > ANIMALS.hideLifetime
        : meat > ANIMALS.meatKeep && d.age > ANIMALS.meatLifetime && meat-- > 0)
    if (spoiled) {
      sim.drops.splice(i, 1)
      sim.fx.push({ t: 'burst', x: d.pos.x, y: 0.2, z: d.pos.z, color: '#b8a58a', n: 5, spread: 0.4, up: 1 })
    }
  }
}
