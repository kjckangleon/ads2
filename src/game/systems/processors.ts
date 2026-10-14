// Workshops (kitchen: raw -> cooked, tailor: hide -> coat, smokehouse: fish -> smoked). Work only runs
// while someone stands at the work spot: the hired staff or the player. Industrial Park factories
// run on their own.

import type { Sim } from '../types'
import { PROC_IDS, PLAYER, FACTORY_IDS, MACHINE_IDS, MACHINE_CFG, machineSpeedMult } from '../balance'
import { dist } from '../util'
import { sfx } from '../audio'
import { machineStaffs } from './belts'

export function updateProcessors(sim: Sim, dt: number) {
  for (const id of PROC_IDS) {
    const pr = sim.proc[id]
    if (!pr.unlocked) {
      pr.active = false
      continue
    }
    const playerHere = dist(sim.player.pos, pr.workSpot) < PLAYER.workRange
    const factory = (FACTORY_IDS as string[]).includes(id)
    const staffed = factory || pr.staffed || playerHere || machineStaffs(sim, id)

    if (staffed && pr.inCount > 0 && pr.outCount < pr.outCap) {
      pr.active = true
      const machine = MACHINE_IDS.find((mid) => MACHINE_CFG[mid].proc === id && sim.machines[mid].level > 0)
      const workTime = Math.max(0.04, pr.time / (machine ? machineSpeedMult(sim.machines[machine].level) : 1))
      pr.t += dt
      if (id === 'tailor') sfx.stitch()
      else if (!factory) sfx.sizzle()
      while (pr.t >= workTime && pr.inCount > 0 && pr.outCount < pr.outCap) {
        pr.t -= workTime
        pr.inCount--
        pr.outCount++
        sim.fx.push({
          t: 'itemfly',
          kind: pr.outKind,
          from: { x: pr.pos.x, y: 1.0, z: pr.pos.z },
          to: { x: pr.outZone.x, y: 0.7, z: pr.outZone.z },
        })
        if (id === 'tailor') {
          sim.fx.push({ t: 'burst', x: pr.pos.x, y: 1.1, z: pr.pos.z, color: '#d9b8ff', n: 6, spread: 0.5 })
        } else if (factory && Math.random() < 0.35) {
          // steam puffs off the factory roof
          sim.fx.push({
            t: 'burst',
            x: pr.pos.x + 1.4,
            y: 4.4,
            z: pr.pos.z - 0.6,
            color: '#e6ebf2',
            n: 3,
            spread: 0.3,
            up: 2.4,
          })
        } else if (id === 'smokehouse') {
          sim.fx.push({
            t: 'burst',
            x: pr.pos.x,
            y: 2.6,
            z: pr.pos.z - 0.3,
            color: '#c9cfd8',
            n: 4,
            spread: 0.4,
            up: 2,
          })
        }
      }
    } else {
      pr.active = false
      if (pr.inCount === 0) pr.t = 0
    }
  }
}
