// Workshops (kitchen: raw -> cooked, tailor: hide -> coat). Work only runs
// while someone stands at the work spot: the hired staff or the player.

import type { Sim } from '../types'
import { PROC_IDS, PLAYER } from '../balance'
import { dist } from '../util'
import { sfx } from '../audio'

export function updateProcessors(sim: Sim, dt: number) {
  for (const id of PROC_IDS) {
    const pr = sim.proc[id]
    if (!pr.unlocked) {
      pr.active = false
      continue
    }
    const playerHere = dist(sim.player.pos, pr.workSpot) < PLAYER.workRange
    const staffed = pr.staffed || playerHere

    if (staffed && pr.inCount > 0 && pr.outCount < pr.outCap) {
      pr.active = true
      pr.t += dt
      if (id === 'kitchen') sfx.sizzle()
      else sfx.stitch()
      if (pr.t >= pr.time) {
        pr.t = 0
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
        }
      }
    } else {
      pr.active = false
      if (pr.inCount === 0) pr.t = 0
    }
  }
}
