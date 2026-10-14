// Frost Star perk levels, readable from any system without import cycles.

import type { Sim, PerkId } from './types'

export function perk(sim: Sim, id: PerkId): number {
  return sim.meta.perks[id] ?? 0
}

/** Greased Gears: belts and machines run faster */
export function beltPerkMult(sim: Sim) {
  // endless levels, but never more than 2.5× (the belt level cap already limits speed)
  return Math.min(2.5, 1 + 0.15 * perk(sim, 'belts'))
}
