// Frost Star perk levels, readable from any system without import cycles.

import type { Sim, PerkId } from './types'

export function perk(sim: Sim, id: PerkId): number {
  return sim.meta.perks[id] ?? 0
}

/** Greased Gears: belts and machines run faster */
export function beltPerkMult(sim: Sim) {
  return 1 + 0.15 * perk(sim, 'belts')
}
