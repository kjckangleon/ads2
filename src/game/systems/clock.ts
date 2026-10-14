// Day / night cycle. Starts once the tower stands and the settlement reaches
// level 2. Each night a wolf pack raids; each dawn pays out (or doesn't).

import type { Sim } from '../types'
import { CLOCK, REP, WOLVES, wolfCount } from '../balance'
import { damp } from '../util'
import { sfx } from '../audio'
import { spawnWolf } from './wolves'
import { addXp, banner } from './progress'
import { requestSave } from '../saveFlag'

export function startNight(sim: Sim) {
  const c = sim.clock
  const r = sim.raid
  c.night = true
  c.t = 0
  const n = wolfCount(r.count)
  r.toSpawn = n
  r.spawnT = 1.5
  r.stolen = 0
  r.theftAnnounced = false
  r.warned = true
  banner(sim, `🌙 Night ${c.day}`, `🐺 ×${n} wolves are coming for your meat`, 'warn')
  sfx.nightfall()
}

export function endNight(sim: Sim) {
  const c = sim.clock
  const r = sim.raid
  c.night = false
  c.t = 0
  c.day++
  r.count++
  r.toSpawn = 0
  r.warned = false
  for (const w of sim.wolves) w.state = 'flee'
  if (r.stolen === 0) {
    const bonus = Math.round(WOLVES.cleanBonus * (1 + 0.5 * (r.count - 1)))
    sim.piles.find((p) => p.id === 'bountyPay')!.value += bonus
    banner(sim, '☀️ Dawn — not a scrap stolen!', `Defense bonus +$${bonus} at the tower`, 'good')
  } else {
    banner(sim, '☀️ Dawn breaks', `Wolves stole ${r.stolen} meat — upgrade the tower or hire a guard`, 'info')
  }
  addXp(sim, REP.xpNight)
  sfx.dawn()
  requestSave()
}

/** Raids only start once food runs itself — that's when the game needs a new threat. */
export function nightsReady(sim: Sim) {
  return sim.tower.built && sim.rep.level >= REP.nightsLevel && sim.workers.some((w) => w.role === 'runner')
}

export function updateClock(sim: Sim, dt: number) {
  const c = sim.clock
  if (!c.enabled && nightsReady(sim)) {
    c.enabled = true
    c.t = 0
    c.night = false
    banner(sim, '☀️ The long winter begins', 'Days bring customers — nights bring wolves', 'info')
  }

  if (c.enabled) {
    c.t += dt
    if (!c.night) {
      if (!sim.raid.warned && c.t >= CLOCK.dayLength - CLOCK.warnBefore) {
        sim.raid.warned = true
        banner(sim, '🌙 Dusk is coming…', '🐺 Wolves hunt at night', 'warn')
        sfx.howl()
      }
      if (c.t >= CLOCK.dayLength) startNight(sim)
    } else {
      const r = sim.raid
      if (r.toSpawn > 0) {
        r.spawnT -= dt
        if (r.spawnT <= 0) {
          spawnWolf(sim)
          r.toSpawn--
          r.spawnT = WOLVES.spawnStagger
        }
      }
      if (c.t >= CLOCK.nightLength) endNight(sim)
    }
  }

  const target = c.enabled && c.night ? 1 : 0
  c.dark += (target - c.dark) * damp(0.8, dt)
}
