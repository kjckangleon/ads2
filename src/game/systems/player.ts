import type { Sim, ResKind, AnimalSim, WolfSim, DropSim, V2, PlayerSim } from '../types'
import {
  PLAYER,
  TREES,
  WORLD,
  ECONOMY,
  ANIMALS,
  ZONES,
  ZONE_IDS,
  STATION_IDS,
  PROC_IDS,
  CARAVAN,
  playerChopTime,
  playerDamage,
} from '../balance'
import { input, pollInput } from '../input'
import { clamp, dist, lerpAngle, damp } from '../util'
import { sfx, haptic } from '../audio'
import { killAnimal } from './animals'
import { damageWolf } from './wolves'
import { caravanDeliver, caravanNeeds, caravanX } from './caravan'

interface Circle {
  x: number
  z: number
  r: number
}

function staticColliders(sim: Sim): Circle[] {
  const c: Circle[] = [
    { x: WORLD.campfire.x, z: WORLD.campfire.z, r: 0.95 },
    { x: sim.chest.pos.x, z: sim.chest.pos.z, r: 0.55 },
  ]
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    if (st.unlocked) c.push({ x: st.pos.x, z: st.pos.z, r: 1.25 })
  }
  for (const id of PROC_IDS) {
    const pr = sim.proc[id]
    if (pr.unlocked) c.push({ x: pr.pos.x, z: pr.pos.z, r: 1.1 })
  }
  if (sim.tower.built) c.push({ x: sim.tower.pos.x, z: sim.tower.pos.z, r: 1.0 })
  for (const t of sim.trees) if (t.wood > 0) c.push({ x: t.pos.x, z: t.pos.z, r: 0.42 })
  return c
}

interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Long obstacles use boxes: two overlapping circles leave a crease that traps the player. */
function staticBoxes(sim: Sim): Box[] {
  if (sim.caravan.state === 'away') return []
  const x = caravanX(sim)
  const z = WORLD.caravanSpot.z
  // sled body behind the centre, reindeer out front in the direction of travel
  const f = sim.caravan.state === 'leaving' ? -1 : 1
  const a = x - 1.7 * f
  const b = x + 3.1 * f
  return [{ minX: Math.min(a, b), maxX: Math.max(a, b), minZ: z - 0.8, maxZ: z + 0.8 }]
}

function pushOutOfBox(p: V2, b: Box, r: number) {
  if (p.x <= b.minX - r || p.x >= b.maxX + r || p.z <= b.minZ - r || p.z >= b.maxZ + r) return
  const left = p.x - (b.minX - r)
  const right = b.maxX + r - p.x
  const top = p.z - (b.minZ - r)
  const bottom = b.maxZ + r - p.z
  const m = Math.min(left, right, top, bottom)
  if (m === left) p.x = b.minX - r
  else if (m === right) p.x = b.maxX + r
  else if (m === top) p.z = b.minZ - r
  else p.z = b.maxZ + r
}

/** The player's stack may mix kinds; each building takes only what it uses. */
function hasRoom(sim: Sim): boolean {
  return sim.player.carry.length < sim.player.carryCap
}

/** Remove the top-most carried item of `kind`; false if none is carried. */
function takeFromStack(carry: ResKind[], kind: ResKind): boolean {
  const i = carry.lastIndexOf(kind)
  if (i === -1) return false
  carry.splice(i, 1)
  return true
}

function hint(sim: Sim, str: string) {
  const p = sim.player
  if (p.hintCd > 0) return
  p.hintCd = 2.5
  sim.fx.push({ t: 'text', x: p.pos.x, y: 2.3, z: p.pos.z, str, color: '#ffb0a0', size: 0.8 })
}

function face(p: PlayerSim, at: V2, dt: number) {
  p.yaw = lerpAngle(p.yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z), damp(10, dt))
}

function move(sim: Sim, dt: number) {
  const p = sim.player
  const mx = input.x
  const mz = input.z
  p.moving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01
  if (p.moving) {
    p.pos.x += mx * p.speed * dt
    p.pos.z += mz * p.speed * dt
    p.yaw = lerpAngle(p.yaw, Math.atan2(mx, mz), damp(14, dt))
    p.walkPhase += dt * p.speed * 2.3
    p.dustT -= dt
    if (p.dustT <= 0) {
      p.dustT = PLAYER.dustInterval
      sim.fx.push({ t: 'burst', x: p.pos.x, y: 0.12, z: p.pos.z, color: '#f4f8ff', n: 2, spread: 0.18, up: 0.9 })
    }
  }
  const b = WORLD.bounds
  p.pos.x = clamp(p.pos.x, b.minX, b.maxX)
  p.pos.z = clamp(p.pos.z, b.minZ, b.maxZ)

  for (const col of staticColliders(sim)) {
    const dx = p.pos.x - col.x
    const dz = p.pos.z - col.z
    const d = Math.hypot(dx, dz)
    const min = col.r + 0.35
    if (d < min && d > 0.001) {
      p.pos.x = col.x + (dx / d) * min
      p.pos.z = col.z + (dz / d) * min
    }
  }
  for (const box of staticBoxes(sim)) pushOutOfBox(p.pos, box, 0.35)

  // locked districts: push back out across the nearest barrier edge
  for (const id of ZONE_IDS) {
    if (sim.zones[id]) continue
    const r = ZONES[id]
    const m = 0.45
    if (p.pos.x > r.minX - m && p.pos.z > r.minZ - m && p.pos.x < r.maxX && p.pos.z < r.maxZ) {
      const penX = p.pos.x - (r.minX - m)
      const penZ = p.pos.z - (r.minZ - m)
      if (penX < penZ) p.pos.x = r.minX - m
      else p.pos.z = r.minZ - m
    }
  }
}

function chop(sim: Sim, dt: number) {
  const p = sim.player
  let tree = null
  let best = TREES.chopRange
  for (const t of sim.trees) {
    if (t.wood <= 0) continue
    const d = dist(p.pos, t.pos)
    if (d < best) {
      best = d
      tree = t
    }
  }
  if (!tree) {
    p.chopT = 0
    return
  }
  if (!hasRoom(sim)) return
  if (!p.moving) face(p, tree.pos, dt)
  p.chopT += dt
  if (p.chopT < playerChopTime(p.powerLvl)) return
  p.chopT = 0
  p.swing = 0.25
  tree.wood--
  tree.shake = 1
  p.carry.push('log')
  sfx.chop()
  sfx.stack(p.carry.length)
  sim.fx.push({
    t: 'itemfly',
    kind: 'log',
    from: { x: tree.pos.x, y: 1.2, z: tree.pos.z },
    to: { x: p.pos.x, y: 1.8 + p.carry.length * 0.24, z: p.pos.z },
  })
  sim.fx.push({ t: 'burst', x: tree.pos.x, y: 1.0, z: tree.pos.z, color: '#b08968', n: 7, spread: 0.7 })
  if (tree.wood <= 0) tree.regrowT = TREES.regrowTime
}

function fight(sim: Sim, dt: number) {
  const p = sim.player
  // wolves take priority over game
  let wolf: WolfSim | null = null
  let bw = PLAYER.interactRange + 0.4
  for (const w of sim.wolves) {
    const d = dist(p.pos, w.pos)
    if (d < bw) {
      bw = d
      wolf = w
    }
  }
  let prey: AnimalSim | null = null
  if (!wolf) {
    let ba = PLAYER.interactRange
    for (const a of sim.animals) {
      const d = dist(p.pos, a.pos)
      if (d < ba) {
        ba = d
        prey = a
      }
    }
  }
  const target = wolf ?? prey
  if (!target) {
    p.attackT = 0
    return
  }
  if (!p.moving) face(p, target.pos, dt)
  p.attackT += dt
  if (p.attackT < PLAYER.attackTime) return
  p.attackT = 0
  p.swing = 0.25
  const dmg = playerDamage(p.powerLvl)
  sfx.thud()
  if (wolf) {
    damageWolf(sim, wolf, dmg)
    return
  }
  if (!prey) return
  prey.hp -= dmg
  prey.hitFlash = 1
  prey.state = 'flee'
  prey.t = ANIMALS.fleeTime
  sim.fx.push({ t: 'text', x: prey.pos.x, y: 1.6, z: prey.pos.z, str: `-${dmg}`, color: '#ff7b6b', size: 0.8 })
  if (prey.hp <= 0) killAnimal(sim, prey)
}

function pickUpDrops(sim: Sim) {
  const p = sim.player
  if (p.transferCd > 0 || !hasRoom(sim)) return
  let near: DropSim | null = null
  let best = PLAYER.pickupRange
  for (const d of sim.drops) {
    const dd = dist(p.pos, d.pos)
    if (dd < best) {
      best = dd
      near = d
    }
  }
  if (!near) return
  sim.drops.splice(sim.drops.indexOf(near), 1)
  p.carry.push(near.kind)
  p.transferCd = PLAYER.transferInterval
  sfx.stack(p.carry.length)
  sim.fx.push({
    t: 'itemfly',
    kind: near.kind,
    from: { x: near.pos.x, y: 0.3, z: near.pos.z },
    to: { x: p.pos.x, y: 1.8, z: p.pos.z },
  })
}

function depositAndTake(sim: Sim) {
  const p = sim.player

  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    if (!st.unlocked || p.carry.length === 0 || dist(p.pos, st.restock) >= PLAYER.depositRange) continue
    if (p.carry.includes(st.accepts)) {
      if (p.transferCd <= 0 && st.stock < st.capacity) {
        takeFromStack(p.carry, st.accepts)
        st.stock++
        p.transferCd = PLAYER.transferInterval
        sfx.unstack(p.carry.length)
        sim.fx.push({
          t: 'itemfly',
          kind: st.accepts,
          from: { x: p.pos.x, y: 1.8, z: p.pos.z },
          to: { x: st.pos.x, y: 1.2, z: st.pos.z },
        })
      }
    } else if (id === 'meat' && p.carry.includes('raw')) {
      hint(sim, 'Cook it first! 🔥')
    } else if (id === 'coat' && p.carry.includes('hide')) {
      hint(sim, 'Sew it at the tailor first! 🧵')
    }
  }

  for (const id of PROC_IDS) {
    const pr = sim.proc[id]
    if (!pr.unlocked) continue
    if (
      p.transferCd <= 0 &&
      pr.inCount < pr.inCap &&
      dist(p.pos, pr.inZone) < PLAYER.depositRange &&
      takeFromStack(p.carry, pr.inKind)
    ) {
      pr.inCount++
      p.transferCd = PLAYER.transferInterval
      sfx.unstack(p.carry.length)
      sim.fx.push({
        t: 'itemfly',
        kind: pr.inKind,
        from: { x: p.pos.x, y: 1.8, z: p.pos.z },
        to: { x: pr.inZone.x, y: 0.8, z: pr.inZone.z },
      })
    }
    if (
      pr.outCount > 0 &&
      p.transferCd <= 0 &&
      hasRoom(sim) &&
      dist(p.pos, pr.outZone) < PLAYER.depositRange * 0.8
    ) {
      pr.outCount--
      p.carry.push(pr.outKind)
      p.transferCd = PLAYER.transferInterval
      sfx.stack(p.carry.length)
      sim.fx.push({
        t: 'itemfly',
        kind: pr.outKind,
        from: { x: pr.outZone.x, y: 0.8, z: pr.outZone.z },
        to: { x: p.pos.x, y: 1.8, z: p.pos.z },
      })
    }
  }
}

/** Walk past the forest log pile to scoop logs off it. */
function takeFromDepot(sim: Sim) {
  const p = sim.player
  const d = sim.depot
  if (d.count <= 0 || p.transferCd > 0 || !hasRoom(sim)) return
  if (dist(p.pos, d.pos) >= PLAYER.depositRange) return
  d.count--
  p.carry.push('log')
  p.transferCd = PLAYER.transferInterval
  sfx.stack(p.carry.length)
  sim.fx.push({
    t: 'itemfly',
    kind: 'log',
    from: { x: d.pos.x, y: 0.6, z: d.pos.z },
    to: { x: p.pos.x, y: 1.8, z: p.pos.z },
  })
}

function supplyCaravan(sim: Sim) {
  const p = sim.player
  if (sim.caravan.state !== 'waiting' || p.carry.length === 0) return
  if (dist(p.pos, WORLD.caravanDeliver) >= CARAVAN.deliverRange) return
  let kind: ResKind | null = null
  for (let i = p.carry.length - 1; i >= 0; i--) {
    if (caravanNeeds(sim, p.carry[i])) {
      kind = p.carry[i]
      break
    }
  }
  if (!kind) {
    hint(sim, "The caravan doesn't want that")
    return
  }
  if (p.transferCd > 0) return
  caravanDeliver(sim, kind)
  takeFromStack(p.carry, kind)
  p.transferCd = PLAYER.transferInterval
  sim.fx.push({
    t: 'itemfly',
    kind,
    from: { x: p.pos.x, y: 1.8, z: p.pos.z },
    to: { x: caravanX(sim), y: 1.4, z: WORLD.caravanSpot.z },
  })
}

function collectMoney(sim: Sim, dt: number) {
  const p = sim.player
  for (const pile of sim.piles) {
    if (pile.value <= 0) continue
    if (dist(p.pos, pile.pos) < PLAYER.collectRange) {
      pile.drainAcc += dt * Math.max(ECONOMY.collectBase, pile.value * 2.2)
      const take = Math.min(pile.value, Math.floor(pile.drainAcc))
      if (take > 0) {
        pile.drainAcc -= take
        pile.value -= take
        sim.money += take
        sim.stats.collected += take
        sfx.coin()
        haptic(6, 'cash', 0.12)
        for (let i = 0; i < Math.min(Math.ceil(take / 25), 4); i++) {
          sim.fx.push({
            t: 'coin',
            x: pile.pos.x + (Math.random() - 0.5) * 0.8,
            y: 0.4,
            z: pile.pos.z + (Math.random() - 0.5) * 0.8,
          })
        }
      }
    } else {
      pile.drainAcc = 0
    }
  }
}

export function updatePlayer(sim: Sim, dt: number) {
  const p = sim.player
  pollInput()
  move(sim, dt)
  if (p.transferCd > 0) p.transferCd -= dt
  if (p.hintCd > 0) p.hintCd -= dt
  if (p.swing > 0) p.swing -= dt
  chop(sim, dt)
  fight(sim, dt)
  pickUpDrops(sim)
  depositAndTake(sim)
  takeFromDepot(sim)
  supplyCaravan(sim)
  collectMoney(sim, dt)
}
