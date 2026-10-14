import type { Sim, AnimalSim, V2 } from '../types'
import { ANIMALS, WORLD, deerTarget, animalRespawn } from '../balance'
import { seek, dist, clamp } from '../util'
import { spawnAnimal } from '../state'
import { sfx } from '../audio'

export function dropItem(sim: Sim, kind: 'raw' | 'hide', at: V2, spread: number) {
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

export function killAnimal(sim: Sim, a: AnimalSim) {
  const idx = sim.animals.indexOf(a)
  if (idx === -1) return
  sim.animals.splice(idx, 1)
  const n = a.kind === 'deer' ? ANIMALS.deerDrops : ANIMALS.rabbitDrops
  for (let i = 0; i < n; i++) dropItem(sim, 'raw', a.pos, 1.2)
  if (
    a.kind === 'deer' &&
    sim.proc.tailor.unlocked &&
    countDrops(sim, 'hide') < ANIMALS.maxGroundHides
  ) {
    dropItem(sim, 'hide', a.pos, 1.0)
  }
  sim.stats.kills++
  sfx.kill()
  sim.fx.push({ t: 'burst', x: a.pos.x, y: 0.8, z: a.pos.z, color: '#e06a5a', n: 10, spread: 0.9 })
  sim.fx.push({ t: 'text', x: a.pos.x, y: 1.6, z: a.pos.z, str: '🥩', size: 1.1 })
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

    const walkSpeed = a.kind === 'deer' ? ANIMALS.deerWalk : ANIMALS.rabbitWalk
    const fleeSpeed = a.kind === 'deer' ? ANIMALS.deerFlee : ANIMALS.rabbitFlee

    // player proximity triggers flee
    const dp = dist(a.pos, p.pos)
    if (dp < ANIMALS.fleeTrigger && a.state !== 'flee') {
      a.state = 'flee'
      a.t = ANIMALS.fleeTime
    }

    switch (a.state) {
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

  // respawn to keep the population up (Wild Game upgrades raise it)
  const wantDeer = deerTarget(sim.game.lvl)
  let deer = 0
  let rabbits = 0
  for (const a of sim.animals) {
    if (a.kind === 'deer') deer++
    else rabbits++
  }
  if (deer < wantDeer || rabbits < ANIMALS.rabbitCount) {
    sim.animalRespawnT -= dt
    if (sim.animalRespawnT <= 0) {
      sim.animalRespawnT = animalRespawn(sim.game.lvl)
      spawnAnimal(sim, deer < wantDeer ? 'deer' : 'rabbit')
    }
  }

  // tree regrowth lives here to keep the world tick together
  for (const t of sim.trees) {
    if (t.shake > 0) t.shake -= dt * 3
    if (t.wood <= 0) {
      t.regrowT -= dt
      if (t.regrowT <= 0) t.wood = t.maxWood
    }
  }

  for (let i = sim.drops.length - 1; i >= 0; i--) {
    const d = sim.drops[i]
    d.age += dt
    if (d.kind === 'hide' && d.reservedBy === null && d.age > ANIMALS.hideLifetime) {
      sim.drops.splice(i, 1)
      sim.fx.push({ t: 'burst', x: d.pos.x, y: 0.2, z: d.pos.z, color: '#b8a58a', n: 5, spread: 0.4, up: 1 })
    }
  }
}
