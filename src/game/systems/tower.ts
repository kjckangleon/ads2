import type { Sim, V2 } from '../types'
import { TOWER, ANIMALS, towerDamage, towerCooldown, towerRange, towerArrows } from '../balance'
import { dist, lerpAngle, damp } from '../util'
import { sfx } from '../audio'
import { hurtAnimal, countDrops } from './animals'
import { damageWolf } from './wolves'
import { perk } from '../perks'

const FIRE_HEIGHT = 3.6

interface Target {
  id: number
  pos: V2
  /** sort key: wolves always come first */
  key: number
}

function findTargets(sim: Sim, range: number, count: number, huntGame: boolean): Target[] {
  const t = sim.tower
  const out: Target[] = []
  for (const w of sim.wolves) {
    const d = dist(w.pos, t.pos)
    if (d <= range) out.push({ id: w.id, pos: w.pos, key: d - 1000 })
  }
  if (huntGame) {
    for (const a of sim.animals) {
      const d = dist(a.pos, t.pos)
      if (d <= range) out.push({ id: a.id, pos: a.pos, key: d })
    }
  }
  out.sort((a, b) => a.key - b.key)
  return out.slice(0, count)
}

function targetPos(sim: Sim, id: number): V2 | null {
  const w = sim.wolves.find((x) => x.id === id)
  if (w) return w.pos
  const a = sim.animals.find((x) => x.id === id)
  return a ? a.pos : null
}

function fireArrow(sim: Sim, targetId: number, at: V2, damage: number) {
  const t = sim.tower
  const d = dist(t.pos, at)
  sim.arrows.push({
    id: sim.ids++,
    active: true,
    from: { x: t.pos.x, y: FIRE_HEIGHT, z: t.pos.z },
    pos: { x: t.pos.x, y: FIRE_HEIGHT, z: t.pos.z },
    t: 0,
    dur: Math.max(0.22, d / TOWER.arrowSpeed),
    targetId,
    damage,
  })
  sfx.thwip()
  t.drawT = 0.35
}

function impact(sim: Sim, targetId: number, damage: number) {
  const wolf = sim.wolves.find((w) => w.id === targetId)
  if (wolf) {
    damageWolf(sim, wolf, damage)
    return
  }
  const target = sim.animals.find((a) => a.id === targetId)
  if (target) hurtAnimal(sim, target, damage, true)
}

export function updateTower(sim: Sim, dt: number) {
  const t = sim.tower
  if (!t.built) return
  if (t.buildT > 0) {
    t.buildT -= dt
    return
  }
  if (t.drawT > 0) t.drawT -= dt

  const range = towerRange(t.rngLvl)
  const dmg = towerDamage(t.dmgLvl)
  const arrows = towerArrows(t.dmgLvl + t.spdLvl + t.rngLvl) + perk(sim, 'arrows')
  // stop hunting game while the meadow is littered with uncollected meat
  // (wolves are always fair game)
  const huntGame = countDrops(sim, 'raw') < ANIMALS.maxGroundMeat

  for (let i = t.pending.length - 1; i >= 0; i--) {
    const p = t.pending[i]
    p.delay -= dt
    if (p.delay <= 0) {
      t.pending.splice(i, 1)
      const at = targetPos(sim, p.targetId)
      if (at) fireArrow(sim, p.targetId, at, dmg)
    }
  }

  const targets = findTargets(sim, range, arrows, huntGame)
  const primary = targets[0] ?? null
  t.targetId = primary?.id ?? null

  if (primary) {
    const want = Math.atan2(primary.pos.x - t.pos.x, primary.pos.z - t.pos.z)
    t.yaw = lerpAngle(t.yaw, want, damp(8, dt))
    t.timer -= dt
    const aimed = Math.abs(((want - t.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.25
    if (t.timer <= 0 && aimed) {
      t.timer = towerCooldown(t.spdLvl)
      fireArrow(sim, primary.id, primary.pos, dmg)
      for (let i = 1; i < targets.length; i++) {
        t.pending.push({ delay: i * 0.13, targetId: targets[i].id })
      }
    }
  } else {
    t.timer = Math.min(t.timer, 0.2)
  }

  // arrows in flight: homing lerp with an arc
  for (const arrow of sim.arrows) {
    if (!arrow.active) continue
    arrow.t += dt / arrow.dur
    const at = targetPos(sim, arrow.targetId)
    const toX = at ? at.x : arrow.pos.x
    const toZ = at ? at.z : arrow.pos.z
    const k = Math.min(arrow.t, 1)
    arrow.pos.x = arrow.from.x + (toX - arrow.from.x) * k
    arrow.pos.z = arrow.from.z + (toZ - arrow.from.z) * k
    arrow.pos.y = arrow.from.y + (0.4 - arrow.from.y) * k + Math.sin(k * Math.PI) * 1.2

    if (arrow.t >= 1) {
      arrow.active = false
      if (at) impact(sim, arrow.targetId, arrow.damage)
      else sim.fx.push({ t: 'burst', x: arrow.pos.x, y: 0.15, z: arrow.pos.z, color: '#ffffff', n: 4, spread: 0.4 })
    }
  }
  if (sim.arrows.length > 40) sim.arrows = sim.arrows.filter((a) => a.active)
}
