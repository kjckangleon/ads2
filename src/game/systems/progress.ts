// Long-term progression (settlement XP / levels), the rush combo, and the
// big centre-screen announcement queue.

import type { Sim, BannerTone } from '../types'
import { REP, RUSH, CARAVAN, WORLD, ANIMALS, TASKS, CLASSIC_MAX, xpForLevel, upgradeCap, levelGift, maxDemand } from '../balance'
import { fmt } from '../format'
import { automated } from './belts'
import { sfx } from '../audio'
import { requestSave } from '../saveFlag'

const BANNER_TIME = 2.2
let bannerSeq = 0

let noticeSeq = 0
const MAX_NOTICES = 30

export function banner(sim: Sim, text: string, sub = '', tone: BannerTone = 'info') {
  // every alert lands in the 🔔 history (no pop-ups over the play area)
  const last = sim.notices[sim.notices.length - 1]
  if (!last || last.text !== text || sim.time - last.at > 3) {
    sim.notices.push({ id: ++noticeSeq, text, sub, tone, at: sim.time })
    if (sim.notices.length > MAX_NOTICES) sim.notices.shift()
  }
  if (sim.banners.some((b) => b.text === text)) return
  sim.banners.push({ text, sub, tone, id: 0 })
  if (sim.banners.length > 4) sim.banners.shift()
}

export function updateBanners(sim: Sim, dt: number) {
  if (sim.bannerT > 0) {
    sim.bannerT -= dt
    return
  }
  const next = sim.banners.shift()
  if (next) {
    next.id = ++bannerSeq
    sim.banner = next
    sim.bannerT = BANNER_TIME
  }
}

function perksFor(sim: Sim, lvl: number): string {
  const out: string[] = []
  const foodAutomated = automated(sim, 'runner')
  if (lvl === CARAVAN.unlockLevel) out.push(foodAutomated ? '🛷 trade caravans' : '🛷 caravans once food runs itself')
  if (lvl === REP.tanneryLevel) out.push('🧥 Tannery for sale')
  if (lvl === REP.beltLevel) out.push('⚙️ conveyor belts · 🐐 mountain goats')
  if (lvl === REP.fisheryLevel) out.push(sim.zones.tannery ? '🎣 Ice Fishery for sale' : '🎣 Ice Fishery after the Tannery')
  if (lvl === ANIMALS.bear.level) out.push('🐻 bears roam the meadow')
  if (lvl === TASKS.level) out.push('🎯 task board')
  if (lvl === REP.mineLevel) out.push(sim.zones.fishery ? '⛏️ Coal Mine for sale' : '⛏️ Coal Mine after the Fishery')
  const cap = upgradeCap(lvl)
  out.push(cap > CLASSIC_MAX ? `⭐ star upgrades up to ${cap - CLASSIC_MAX}` : `upgrades up to Lv${cap}`)
  if (maxDemand(lvl) > maxDemand(lvl - 1)) out.push(`🛒 survivors buy up to ${maxDemand(lvl)} each`)
  out.push('more survivors')
  return out.join(' · ')
}

export function addXp(sim: Sim, n: number) {
  const r = sim.rep
  r.xp += n
  let need = xpForLevel(r.level)
  while (r.xp >= need) {
    r.xp -= need
    r.level++
    need = xpForLevel(r.level)
    // every level-up comes with a cash gift
    const gift = levelGift(r.level)
    sim.money += gift
    sim.fx.push({ t: 'text', x: sim.player.pos.x, y: 3.2, z: sim.player.pos.z, str: `🎁 +$${fmt(gift)}`, color: '#ffe680', size: 1.3 })
    banner(sim, `⭐ Settlement Level ${r.level}`, `🎁 +$${fmt(gift)} · ${perksFor(sim, r.level)}`, 'good')
    sfx.levelUp()
    sim.fx.push({ t: 'burst', x: WORLD.campfire.x, y: 1.5, z: WORLD.campfire.z, color: '#ffe680', n: 30, spread: 2.2, up: 4 })
    sim.fx.push({ t: 'shake', power: 0.2 })
    requestSave()
  }
}

/** Reconstruct a level from lifetime XP (old saves had no XP field). */
export function levelFromTotalXp(total: number) {
  let level = 1
  let xp = total
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level)
    level++
  }
  return { level, xp }
}

export function rushMult(n: number) {
  return 1 + RUSH.perStack * Math.min(n, RUSH.maxStack)
}

export function updateRush(sim: Sim, dt: number) {
  const r = sim.rush
  if (r.n <= 0) return
  r.t -= dt
  if (r.t <= 0) {
    r.n = 0
    r.t = 0
  }
}
