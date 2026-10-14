import type { Sim, ResKind, AnimalSim, WolfSim, DropSim, V2, PlayerSim, TreeSim, DepotSim } from '../types'
import {
  PLAYER,
  TREES,
  NODES,
  FURNACE,
  WORLD,
  ECONOMY,
  ZONES,
  ZONE_IDS,
  STATION_IDS,
  PROC_IDS,
  CARAVAN,
  FACTORY_IDS,
  TERMINAL_IDS,
  playerChopTime,
  playerDamage,
  flyMult,
  laserCooldown,
  laserRange,
  nodeRegrow,
} from '../balance'
import { input, pollInput } from '../input'
import { clamp, dist, lerpAngle, damp } from '../util'
import { sfx, haptic } from '../audio'
import { hurtAnimal, isBoss } from './animals'
import { damageWolf } from './wolves'
import { caravanDeliver, caravanNeeds, caravanX } from './caravan'
import { automated } from './belts'

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
    // factories are big buildings: they use boxes (staticBoxes)
    if (pr.unlocked && !(FACTORY_IDS as string[]).includes(id)) c.push({ x: pr.pos.x, z: pr.pos.z, r: 1.1 })
  }
  if (sim.tower.built) c.push({ x: sim.tower.pos.x, z: sim.tower.pos.z, r: 1.0 })
  if (sim.furnace.built) c.push({ x: sim.furnace.pos.x, z: sim.furnace.pos.z, r: FURNACE.radius })
  for (const t of sim.trees) if (t.wood > 0) c.push({ x: t.pos.x, z: t.pos.z, r: 0.42 })
  if (sim.zones.mine) for (const t of sim.seams) if (t.wood > 0) c.push({ x: t.pos.x, z: t.pos.z, r: 0.5 })
  return c
}

interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Long obstacles use boxes: two overlapping circles leave a crease that traps the player. */
/** half sizes of the park's buildings (factories, then each terminal) */
const FACTORY_HALF = { x: 2.5, z: 2.0 }
const TERMINAL_HALF: Record<string, { x: number; z: number }> = {
  dock: { x: 2.5, z: 1.7 },
  port: { x: 3.4, z: 1.8 },
  air: { x: 3.0, z: 1.6 },
}

function parkBoxes(sim: Sim): Box[] {
  const out: Box[] = []
  if (!sim.zones.industry) return out
  for (const id of FACTORY_IDS) {
    const pr = sim.proc[id]
    if (!pr.unlocked) continue
    const h = FACTORY_HALF
    out.push({ minX: pr.pos.x - h.x, maxX: pr.pos.x + h.x, minZ: pr.pos.z - h.z, maxZ: pr.pos.z + h.z })
  }
  for (const id of TERMINAL_IDS) {
    const t = sim.terminals[id]
    if (!t.open) continue
    const h = TERMINAL_HALF[id]
    out.push({ minX: t.pos.x - h.x, maxX: t.pos.x + h.x, minZ: t.pos.z - h.z, maxZ: t.pos.z + h.z })
  }
  return out
}

function staticBoxes(sim: Sim): Box[] {
  const park = parkBoxes(sim)
  if (sim.caravan.state === 'away') return park
  const x = caravanX(sim)
  const z = WORLD.caravanSpot.z
  // sled body behind the centre, reindeer out front in the direction of travel
  const f = sim.caravan.state === 'leaving' ? -1 : 1
  const a = x - 1.7 * f
  const b = x + 3.1 * f
  return [...park, { minX: Math.min(a, b), maxX: Math.max(a, b), minZ: z - 0.8, maxZ: z + 0.8 }]
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
  // 🚀 the Jetpack: faster, and you fly straight over buildings, trees and the caravan
  const flying = p.flyLvl > 0 && p.flying
  const speed = p.speed * flyMult(p.flyLvl)
  if (p.moving) {
    p.pos.x += mx * speed * dt
    p.pos.z += mz * speed * dt
    p.yaw = lerpAngle(p.yaw, Math.atan2(mx, mz), damp(14, dt))
    p.walkPhase += dt * p.speed * 2.3
    p.dustT -= dt
    if (p.dustT <= 0) {
      if (flying) {
        // a jet trail streaming out behind you, so the speed reads on screen
        p.dustT = PLAYER.dustInterval * 0.5
        const bx = p.pos.x - mx * 0.9
        const bz = p.pos.z - mz * 0.9
        sim.fx.push({
          t: 'burst',
          x: bx,
          y: PLAYER.flyHover + 0.5,
          z: bz,
          color: '#ffc37a',
          n: 2,
          spread: 0.12,
          up: 0.2,
        })
        sim.fx.push({
          t: 'burst',
          x: bx,
          y: PLAYER.flyHover + 0.4,
          z: bz,
          color: '#eef3fa',
          n: 2,
          spread: 0.25,
          up: 0.4,
        })
      } else {
        p.dustT = PLAYER.dustInterval
        sim.fx.push({ t: 'burst', x: p.pos.x, y: 0.12, z: p.pos.z, color: '#f4f8ff', n: 2, spread: 0.18, up: 0.9 })
      }
    }
  }
  const b = WORLD.bounds
  p.pos.x = clamp(p.pos.x, b.minX, b.maxX)
  p.pos.z = clamp(p.pos.z, b.minZ, b.maxZ)

  for (const col of flying ? [] : staticColliders(sim)) {
    const dx = p.pos.x - col.x
    const dz = p.pos.z - col.z
    const d = Math.hypot(dx, dz)
    const min = col.r + 0.35
    if (d < min && d > 0.001) {
      p.pos.x = col.x + (dx / d) * min
      p.pos.z = col.z + (dz / d) * min
    }
  }
  if (!flying) for (const box of staticBoxes(sim)) pushOutOfBox(p.pos, box, 0.35)

  // locked districts: push back out across the nearest barrier edge
  // (edges outside the world bounds are far away, so they never win)
  for (const id of ZONE_IDS) {
    if (sim.zones[id]) continue
    const r = ZONES[id]
    const m = 0.45
    if (p.pos.x > r.minX - m && p.pos.x < r.maxX + m && p.pos.z > r.minZ - m && p.pos.z < r.maxZ + m) {
      const left = p.pos.x - (r.minX - m)
      const right = r.maxX + m - p.pos.x
      const top = p.pos.z - (r.minZ - m)
      const bottom = r.maxZ + m - p.pos.z
      const pen = Math.min(left, right, top, bottom)
      if (pen === left) p.pos.x = r.minX - m
      else if (pen === right) p.pos.x = r.maxX + m
      else if (pen === top) p.pos.z = r.minZ - m
      else p.pos.z = r.maxZ + m
    }
  }
}

const GATHER_FX = {
  tree: { y: 1.2, burst: '#b08968' },
  hole: { y: 0.2, burst: '#cfeaff' },
  seam: { y: 0.7, burst: '#3a3a40' },
}

/** Chop pines, fish the ice holes, mine coal: whichever spot is nearest. */
function gather(sim: Sim, dt: number) {
  const p = sim.player
  let node: TreeSim | null = null
  let type: 'tree' | 'hole' | 'seam' = 'tree'
  let best = TREES.chopRange
  const consider = (list: TreeSim[], t: 'tree' | 'hole' | 'seam') => {
    for (const n of list) {
      if (n.wood <= 0) continue
      const d = dist(p.pos, n.pos)
      if (d < best) {
        best = d
        node = n
        type = t
      }
    }
  }
  consider(sim.trees, 'tree')
  if (sim.zones.fishery) consider(sim.holes, 'hole')
  if (sim.zones.mine) consider(sim.seams, 'seam')
  const n = node as TreeSim | null
  if (!n || p.noGrab) {
    p.chopT = 0
    return
  }
  if (!hasRoom(sim)) return
  if (!p.moving) face(p, n.pos, dt)
  const cfg = NODES[type]
  p.chopT += dt
  if (p.chopT < playerChopTime(p.powerLvl) * cfg.workMult) return
  p.chopT = 0
  p.swing = 0.25
  n.wood--
  n.shake = 1
  p.carry.push(cfg.kind)
  if (type === 'tree') sfx.chop()
  else if (type === 'seam') sfx.thud()
  else sfx.pick()
  sfx.stack(p.carry.length)
  const fx = GATHER_FX[type]
  sim.fx.push({
    t: 'itemfly',
    kind: cfg.kind,
    from: { x: n.pos.x, y: fx.y, z: n.pos.z },
    to: { x: p.pos.x, y: 1.8 + p.carry.length * 0.24, z: p.pos.z },
  })
  sim.fx.push({ t: 'burst', x: n.pos.x, y: fx.y, z: n.pos.z, color: fx.burst, n: 7, spread: 0.7 })
  if (n.wood <= 0) n.regrowT = nodeRegrow(type, sim.rep.level)
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
  if (prey) hurtAnimal(sim, prey, dmg, false)
}

/** wolves, bears, goats and bosses: what the 🔫 Laser Blaster shoots at */
const isMonster = (a: AnimalSim) => a.kind === 'bear' || a.kind === 'goat' || isBoss(a.kind)

const BEAM_LIFE = 0.16

/** squared distance from point q to the segment a-b */
function segDist(q: V2, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const l = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l))
  return Math.hypot(q.x - ax - dx * t, q.z - az - dz * t)
}

/**
 * 🔫 Laser Blaster: every so often you fire a beam at the nearest monster in
 * range. It pierces, hitting every monster along the line out to full range.
 */
function laser(sim: Sim, dt: number) {
  const p = sim.player
  for (let i = p.beams.length - 1; i >= 0; i--) {
    p.beams[i].t -= dt
    if (p.beams[i].t <= 0) p.beams.splice(i, 1)
  }
  const lvl = p.slayLvl
  if (lvl <= 0) return
  if (p.laserT > 0) p.laserT -= dt
  if (p.laserT > 0) return
  const range = laserRange(lvl)
  let target: V2 | null = null
  let best = range
  for (const w of sim.wolves) {
    const d = dist(p.pos, w.pos)
    if (d < best) {
      best = d
      target = w.pos
    }
  }
  for (const a of sim.animals) {
    if (!isMonster(a)) continue
    const d = dist(p.pos, a.pos)
    if (d < best) {
      best = d
      target = a.pos
    }
  }
  if (!target) return
  p.laserT = laserCooldown(lvl)
  const dx = (target.x - p.pos.x) / (best || 1)
  const dz = (target.z - p.pos.z) / (best || 1)
  const ex = p.pos.x + dx * range
  const ez = p.pos.z + dz * range
  const dmg = playerDamage(p.powerLvl) * (1 + PLAYER.slayDmgPerLvl * lvl)
  let hits = 0
  for (const w of [...sim.wolves]) {
    if (segDist(w.pos, p.pos.x, p.pos.z, ex, ez) < PLAYER.laserWidth) {
      damageWolf(sim, w, dmg)
      hits++
    }
  }
  for (const a of [...sim.animals]) {
    if (!isMonster(a) || a.hp <= 0) continue
    if (segDist(a.pos, p.pos.x, p.pos.z, ex, ez) < PLAYER.laserWidth) {
      hurtAnimal(sim, a, dmg, false)
      hits++
    }
  }
  if (!p.moving) p.yaw = Math.atan2(dx, dz)
  p.beams.push({ x0: p.pos.x, z0: p.pos.z, x1: ex, z1: ez, t: BEAM_LIFE })
  sim.fx.push({
    t: 'burst',
    x: target.x,
    y: 1.0,
    z: target.z,
    color: '#ff6a5a',
    n: 6 + Math.min(hits, 6) * 2,
    spread: 0.6,
    up: 1.6,
  })
  sfx.laser()
}

function pickUpDrops(sim: Sim) {
  const p = sim.player
  if (p.noGrab || p.transferCd > 0 || !hasRoom(sim)) return
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
    } else if (id === 'fish' && p.carry.includes('fish')) {
      hint(sim, 'Smoke it first! 🔥')
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
      !p.noGrab &&
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

/**
 * The forest log pile / mine coal pile. While nothing carries from it you can
 * scoop logs or coal off it; once a belt or carrier runs it, it's a drop-off
 * instead — so stray coal always has a home and walking past never grabs any.
 */
function useDepot(sim: Sim, d: DepotSim, automated: boolean) {
  const p = sim.player
  if (p.transferCd > 0 || dist(p.pos, d.pos) >= PLAYER.depositRange) return
  if (automated) {
    if (d.count >= d.cap || !takeFromStack(p.carry, d.kind)) return
    d.count++
    p.transferCd = PLAYER.transferInterval
    sfx.unstack(p.carry.length)
    sim.fx.push({
      t: 'itemfly',
      kind: d.kind,
      from: { x: p.pos.x, y: 1.8, z: p.pos.z },
      to: { x: d.pos.x, y: 0.6, z: d.pos.z },
    })
    return
  }
  if (p.noGrab || d.count <= 0 || !hasRoom(sim)) return
  d.count--
  p.carry.push(d.kind)
  p.transferCd = PLAYER.transferInterval
  sfx.stack(p.carry.length)
  sim.fx.push({
    t: 'itemfly',
    kind: d.kind,
    from: { x: d.pos.x, y: 0.6, z: d.pos.z },
    to: { x: p.pos.x, y: 1.8, z: p.pos.z },
  })
}

/** Drop products off at an Industrial Park terminal (any kind it ships). */
function stockTerminals(sim: Sim) {
  const p = sim.player
  if (p.transferCd > 0 || p.carry.length === 0) return
  for (const id of TERMINAL_IDS) {
    const t = sim.terminals[id]
    if (!t.open || dist(p.pos, t.restock) >= PLAYER.depositRange) continue
    const kind = t.kinds.find((k) => p.carry.includes(k) && (t.stock[k] ?? 0) < t.cap)
    if (!kind) continue
    takeFromStack(p.carry, kind)
    t.stock[kind] = (t.stock[kind] ?? 0) + 1
    p.transferCd = PLAYER.transferInterval
    sfx.unstack(p.carry.length)
    sim.fx.push({
      t: 'itemfly',
      kind,
      from: { x: p.pos.x, y: 1.8, z: p.pos.z },
      to: { x: t.pos.x, y: 1.0, z: t.pos.z },
    })
    return
  }
}

/** Shovel carried coal into the furnace. */
function feedFurnace(sim: Sim) {
  const p = sim.player
  const f = sim.furnace
  if (!f.built || p.transferCd > 0 || f.fuel >= f.cap) return
  if (dist(p.pos, f.feed) >= PLAYER.depositRange) return
  if (!takeFromStack(p.carry, 'coal')) return
  f.fuel++
  p.transferCd = PLAYER.transferInterval
  sfx.unstack(p.carry.length)
  sim.fx.push({
    t: 'itemfly',
    kind: 'coal',
    from: { x: p.pos.x, y: 1.8, z: p.pos.z },
    to: { x: f.pos.x, y: 1.0, z: f.pos.z },
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
  gather(sim, dt)
  fight(sim, dt)
  laser(sim, dt)
  pickUpDrops(sim)
  depositAndTake(sim)
  useDepot(sim, sim.depot, automated(sim, 'logCarrier'))
  if (sim.zones.mine) useDepot(sim, sim.coalDepot, automated(sim, 'coalCarrier'))
  feedFurnace(sim)
  stockTerminals(sim)
  supplyCaravan(sim)
  collectMoney(sim, dt)
}
