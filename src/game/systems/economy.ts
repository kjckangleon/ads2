// Purchase pads: stand on a pad, coins drain in, thing gets built/hired.
// Upgrade pads marked `gated` stop at the settlement-level cap and show a
// lock until the settlement grows.

import type { Sim, PadSim, StationId, ProcessorId, WorkerRole, PadBeltId, MachineId } from '../types'
import {
  PAD_BY_ID,
  padCost,
  ECONOMY,
  TOWER,
  REP,
  ZONES,
  stationCapacity,
  stationPrice,
  stationServiceTime,
  procTime,
  procInCap,
  procOutCap,
  playerSpeed,
  playerCarry,
  upgradeCap,
  furnaceCap,
  furnaceBonus,
  UNLIMITED,
  BELT_RETIRES,
  MACHINE_IDS,
  MACHINE_CFG,
} from '../balance'
import { dist } from '../util'
import { sfx, haptic } from '../audio'
import { spawnAnimal } from '../state'
import { hireWorker } from './workers'
import { banner } from './progress'
import { requestSave } from '../saveFlag'
import { automated, beltReplaces, retireWorkers } from './belts'
import { moveSettlement, pendingStars } from './meta'

const CONFETTI = ['#ffd75e', '#7fdc8f', '#ff8a7a', '#8fc4ff', '#ffffff']
let payStreamT = 0

function padVisible(sim: Sim, pad: PadSim): boolean {
  const s = sim.stats
  switch (pad.id) {
    case 'meatStall':
      return !sim.stations.meat.unlocked && (s.woodServed >= 1 || s.earned >= 50)
    case 'tower':
      return sim.stations.meat.unlocked && !sim.tower.built && s.meatServed >= 1
    // helpers unlock with the station they serve, not one after another
    case 'lumberjack':
      return s.woodServed >= 4
    case 'logCarrier':
      return automated(sim, 'lumberjack')
    case 'collector':
    case 'cook':
    case 'runner':
      return sim.stations.meat.unlocked
    case 'cashier':
      return s.collected >= 300
    case 'guard':
      return sim.clock.enabled || sim.raid.count >= 1
    case 'tailor':
    case 'coatRunner':
      return sim.zones.tannery
    case 'tower_dmg':
    case 'tower_spd':
    case 'tower_rng':
    case 'p_power':
      return sim.tower.built
    case 'kitchen_up':
      return automated(sim, 'cook')
    case 'wood_up':
      return s.woodServed >= 3
    case 'meat_up':
      return sim.stations.meat.unlocked && s.meatServed >= 2
    case 'game_up':
      return sim.tower.built && s.kills >= 6
    case 'p_speed':
    case 'p_carry':
      return s.collected >= 150
    case 'w_speed':
    case 'w_carry':
      return sim.workers.length >= 3
    case 'zone_tannery':
      return !sim.zones.tannery && sim.proc.kitchen.unlocked && sim.rep.level >= REP.tanneryLevel
    case 'coat_up':
      return sim.zones.tannery && s.coatServed >= 2
    case 'tailor_up':
      return sim.zones.tannery && automated(sim, 'tailor')
    // conveyor belts: late-game automation, once the chain they replace exists
    case 'belt_wood':
      return beltsReady(sim) && automated(sim, 'lumberjack')
    case 'belt_meat':
      return beltsReady(sim) && sim.proc.kitchen.unlocked
    case 'belt_coat':
      return beltsReady(sim) && sim.zones.tannery
    case 'belt_fish':
      return beltsReady(sim) && sim.zones.fishery
    case 'belt_coal':
      return beltsReady(sim) && sim.zones.mine
    case 'belt_cash':
      return beltsReady(sim) && s.collected >= 300
    case 'zone_fishery':
      return !sim.zones.fishery && sim.zones.tannery && sim.rep.level >= REP.fisheryLevel
    case 'fisher':
    case 'smoker':
    case 'fishRunner':
    case 'smoke_up':
      return sim.zones.fishery
    case 'fish_up':
      return sim.zones.fishery && s.fishServed >= 2
    case 'zone_mine':
      return !sim.zones.mine && sim.zones.fishery && sim.rep.level >= REP.mineLevel
    case 'miner':
    case 'coalCarrier':
      return sim.zones.mine
    case 'furnace_up':
      return sim.zones.mine && s.coalBurned >= 5
    // machines: late-game, and only where their crew works
    case 'm_saw':
    case 'm_grill':
    case 'm_skinner':
      return beltsReady(sim) && sim.proc.kitchen.unlocked
    case 'm_sewer':
      return beltsReady(sim) && sim.zones.tannery
    case 'm_auger':
    case 'm_autosmoker':
      return beltsReady(sim) && sim.zones.fishery
    case 'm_drill':
      return beltsReady(sim) && sim.zones.mine
    // prestige opens once the whole map is built (the Coal Mine is the last district)
    case 'prestige':
      return sim.zones.mine
    default:
      return false
  }
}

const beltsReady = (sim: Sim) => sim.rep.level >= REP.beltLevel

/** "Needs Food Runner 1/2 · Cook" for the first unmet prerequisites ('' when all are met) */
export function missingText(sim: Sim, requires: string[]): string {
  const missing: string[] = []
  for (const req of requires) {
    const [id, at] = req.split('@')
    const def = PAD_BY_ID[id]
    const need = at ? Number(at) : def.maxLevel
    const p = sim.pads.find((x) => x.id === id)!
    if (p.level >= need) continue
    missing.push(need > 1 ? `${def.label} ${p.level}/${need}` : def.label)
  }
  if (!missing.length) return ''
  return `Needs ${missing.slice(0, 2).join(' · ')}${missing.length > 2 ? ' …' : ''}`
}

const RETIRABLE = new Set<string>([
  ...Object.values(BELT_RETIRES),
  'cashier',
  ...MACHINE_IDS.map((id) => MACHINE_CFG[id].retires),
])

const BELT_PADS: Record<string, PadBeltId> = {
  belt_wood: 'wood',
  belt_meat: 'meat',
  belt_coat: 'coat',
  belt_fish: 'fish',
  belt_coal: 'coal',
}

/**
 * Hire pads that aren't available yet still show, greyed out, with what they
 * need — so players can see who they'll be able to hire next.
 */
function padPreview(sim: Sim, pad: PadSim): string | null {
  switch (pad.id) {
    case 'lumberjack':
      return `Sell ${4 - sim.stats.woodServed} more wood`
    case 'logCarrier':
      return 'Hire a Lumberjack'
    case 'collector':
    case 'cook':
    case 'runner':
      return 'Build the Meat Stall'
    case 'cashier':
      return `Collect $${300 - sim.stats.collected} more`
    case 'belt_cash':
      return sim.stats.collected >= 300 ? `Needs ⭐ Level ${REP.beltLevel}` : null
    case 'tower':
      return sim.stations.meat.unlocked && !sim.tower.built ? 'Sell your first meat' : null
    case 'guard':
      return automated(sim, 'runner') ? 'Comes with the first night' : null
    // tease the belts as soon as the chain exists, so players know they're coming
    case 'belt_wood':
      return automated(sim, 'lumberjack') ? `Needs ⭐ Level ${REP.beltLevel}` : null
    case 'belt_meat':
      return sim.proc.kitchen.unlocked ? `Needs ⭐ Level ${REP.beltLevel}` : null
    case 'belt_coat':
      return sim.zones.tannery ? `Needs ⭐ Level ${REP.beltLevel}` : null
    default:
      return null
  }
}

function upgradeStation(sim: Sim, id: StationId) {
  const st = sim.stations[id]
  st.level++
  st.capacity = stationCapacity(id, st.level)
  st.price = stationPrice(id, st.level)
  st.serviceTime = stationServiceTime(id, st.level)
  sim.fx.push({ t: 'burst', x: st.pos.x, y: 1.2, z: st.pos.z, color: '#b0e0ff', n: 14, spread: 1.2 })
  sim.fx.push({ t: 'shake', power: 0.25 })
  if (st.capacity === UNLIMITED) banner(sim, '♾️ Unlimited storage!', 'This stall is maxed: drop off as much as you carry', 'good')
  sfx.build()
}

function upgradeProc(sim: Sim, id: ProcessorId) {
  const pr = sim.proc[id]
  pr.level++
  pr.time = procTime(id, pr.level)
  pr.inCap = procInCap(id, pr.level)
  pr.outCap = procOutCap(id, pr.level)
  sim.fx.push({ t: 'burst', x: pr.pos.x, y: 1.2, z: pr.pos.z, color: '#ffc890', n: 14, spread: 1.2 })
  if (pr.inCap === UNLIMITED) banner(sim, '♾️ Unlimited storage!', `The ${pr.id} is maxed: it takes everything you bring`, 'good')
  sfx.build()
}

function unlockTannery(sim: Sim) {
  sim.zones.tannery = true
  sim.proc.tailor.unlocked = true
  sim.stations.coat.unlocked = true
  const f = ZONES.tannery.focus
  sim.focus = { x: f.x, z: f.z, t: 2.6 }
  for (const p of [sim.proc.tailor.pos, sim.stations.coat.pos]) {
    sim.fx.push({ t: 'burst', x: p.x, y: 1, z: p.z, color: '#ffe9b0', n: 24, spread: 1.8 })
  }
  sim.fx.push({ t: 'shake', power: 0.5 })
  banner(sim, '🧥 The Tannery is open!', 'Deer now drop hides — sew them into coats', 'good')
  sfx.build()
}

function unlockFishery(sim: Sim) {
  sim.zones.fishery = true
  sim.proc.smokehouse.unlocked = true
  sim.stations.fish.unlocked = true
  const f = ZONES.fishery.focus
  sim.focus = { x: f.x, z: f.z, t: 2.6 }
  for (const p of [sim.proc.smokehouse.pos, sim.stations.fish.pos]) {
    sim.fx.push({ t: 'burst', x: p.x, y: 1, z: p.z, color: '#cfeaff', n: 24, spread: 1.8 })
  }
  sim.fx.push({ t: 'shake', power: 0.5 })
  banner(sim, '🎣 The Ice Fishery is open!', 'Fish the holes, smoke the catch, sell it west', 'good')
  sfx.build()
}

function unlockMine(sim: Sim) {
  sim.zones.mine = true
  sim.furnace.built = true
  const f = ZONES.mine.focus
  sim.focus = { x: f.x, z: f.z, t: 2.6 }
  const fp = sim.furnace.pos
  sim.fx.push({ t: 'burst', x: fp.x, y: 1.4, z: fp.z, color: '#ffb35a', n: 30, spread: 2 })
  sim.fx.push({ t: 'shake', power: 0.6 })
  banner(sim, '⛏️ The Coal Mine is open!', `Burn coal in the furnace: it sells heat and every sale +${Math.round(furnaceBonus(0) * 100)}%`, 'good')
  sfx.build()
}

function buildMachine(sim: Sim, id: MachineId, level: number) {
  const m = sim.machines[id]
  const cfg = MACHINE_CFG[id]
  const first = m.level === 0
  m.level = level
  for (const b of cfg.belts ?? []) sim.belts[b].level = level
  const at = cfg.proc ? sim.proc[cfg.proc].workSpot : m.pos
  sim.fx.push({ t: 'burst', x: at.x, y: 1.2, z: at.z, color: '#cfd8e6', n: 22, spread: 1.6 })
  if (first) {
    retireWorkers(sim, cfg.retires)
    sim.focus = { x: at.x, z: at.z, t: 1.8 }
    sim.fx.push({ t: 'shake', power: 0.35 })
    banner(sim, `${cfg.icon} ${cfg.label} running!`, 'No crew needed — upgrade it to work faster', 'good')
  }
  sfx.build()
}

function buildBelt(sim: Sim, id: PadBeltId, level: number) {
  const b = sim.belts[id]
  const first = b.level === 0
  b.level = level
  if (first) retireWorkers(sim, BELT_RETIRES[id])
  const mid = b.path[Math.floor(b.path.length / 2)]
  sim.fx.push({ t: 'burst', x: mid.x, y: 0.6, z: mid.z, color: '#cfd8e6', n: 20, spread: 2 })
  if (first) {
    sim.focus = { x: mid.x, z: mid.z, t: 1.8 }
    sim.fx.push({ t: 'shake', power: 0.3 })
    banner(sim, '⚙️ Conveyor belt running!', 'It hauls on its own — upgrade it to go faster', 'good')
  }
  sfx.build()
}

export function applyPad(sim: Sim, pad: PadSim) {
  switch (pad.id) {
    case 'meatStall': {
      sim.stations.meat.unlocked = true
      sim.proc.kitchen.unlocked = true
      sim.focus = { x: sim.stations.meat.pos.x + 3, z: sim.stations.meat.pos.z - 4, t: 2.2 }
      sim.fx.push({ t: 'burst', x: 9, y: 1, z: 2, color: '#ffe9b0', n: 20, spread: 1.6 })
      const k = sim.proc.kitchen.pos
      sim.fx.push({ t: 'burst', x: k.x, y: 1, z: k.z, color: '#ffe9b0', n: 20, spread: 1.6 })
      sim.fx.push({ t: 'shake', power: 0.35 })
      sfx.build()
      break
    }
    case 'tower': {
      sim.tower.built = true
      sim.tower.buildT = TOWER.buildTime
      sim.focus = { x: sim.tower.pos.x, z: sim.tower.pos.z, t: 2.4 }
      sim.fx.push({ t: 'burst', x: sim.tower.pos.x, y: 1.5, z: sim.tower.pos.z, color: '#ffe9b0', n: 26, spread: 1.8 })
      sim.fx.push({ t: 'shake', power: 0.5 })
      sfx.build()
      break
    }
    case 'collector':
    case 'cook':
    case 'runner':
    case 'cashier':
    case 'lumberjack':
    case 'logCarrier':
    case 'guard':
    case 'tailor':
    case 'coatRunner':
    case 'fisher':
    case 'smoker':
    case 'fishRunner':
    case 'miner':
    case 'coalCarrier':
      hireWorker(sim, pad.id, pad.pos)
      sfx.buy()
      break
    case 'wood_up':
      upgradeStation(sim, 'wood')
      break
    case 'meat_up':
      upgradeStation(sim, 'meat')
      break
    case 'coat_up':
      upgradeStation(sim, 'coat')
      break
    case 'fish_up':
      upgradeStation(sim, 'fish')
      break
    case 'smoke_up':
      upgradeProc(sim, 'smokehouse')
      break
    case 'furnace_up': {
      const f = sim.furnace
      f.level++
      f.cap = furnaceCap(f.level)
      sim.fx.push({ t: 'burst', x: f.pos.x, y: 1.6, z: f.pos.z, color: '#ffb35a', n: 16, spread: 1.2 })
      sfx.build()
      break
    }
    case 'zone_fishery':
      unlockFishery(sim)
      break
    case 'zone_mine':
      unlockMine(sim)
      break
    case 'belt_wood':
    case 'belt_meat':
    case 'belt_coat':
    case 'belt_fish':
    case 'belt_coal':
      buildBelt(sim, BELT_PADS[pad.id], pad.level)
      break
    case 'm_saw':
    case 'm_skinner':
    case 'm_auger':
    case 'm_drill':
    case 'm_grill':
    case 'm_sewer':
    case 'm_autosmoker':
      buildMachine(sim, pad.id.slice(2) as MachineId, pad.level)
      break
    case 'belt_cash': {
      const first = sim.cash.level === 0
      sim.cash.level = pad.level
      const c = sim.chest.pos
      sim.fx.push({ t: 'burst', x: c.x, y: 2, z: c.z, color: '#7fdc8f', n: 24, spread: 2 })
      if (first) {
        retireWorkers(sim, 'cashier')
        sim.focus = { x: c.x, z: c.z + 2, t: 1.8 }
        sim.fx.push({ t: 'shake', power: 0.3 })
        banner(sim, '💸 Cash belts running!', 'Every stall\'s cash rides straight into the chest', 'good')
      }
      sfx.build()
      break
    }
    case 'kitchen_up':
      upgradeProc(sim, 'kitchen')
      break
    case 'tailor_up':
      upgradeProc(sim, 'tailor')
      break
    case 'tower_dmg':
      sim.tower.dmgLvl++
      sfx.buy()
      break
    case 'tower_spd':
      sim.tower.spdLvl++
      sfx.buy()
      break
    case 'tower_rng':
      sim.tower.rngLvl++
      sfx.buy()
      break
    case 'game_up':
      sim.game.lvl++
      spawnAnimal(sim, 'deer')
      sfx.buy()
      break
    case 'p_speed':
      sim.player.spdLvl++
      sim.player.speed = playerSpeed(sim.player.spdLvl)
      sfx.buy()
      break
    case 'p_carry':
      sim.player.carryLvl++
      sim.player.carryCap = playerCarry(sim.player.carryLvl)
      sfx.buy()
      break
    case 'p_power':
      sim.player.powerLvl++
      sfx.buy()
      break
    case 'w_speed':
      sim.lodge.spdLvl++
      sfx.buy()
      break
    case 'w_carry':
      sim.lodge.capLvl++
      sfx.buy()
      break
    case 'zone_tannery':
      unlockTannery(sim)
      break
  }
}

export function updateEconomy(sim: Sim, dt: number) {
  const p = sim.player
  for (const pad of sim.pads) {
    const def = PAD_BY_ID[pad.id]
    // a belt replaced this hire: the pad is gone for good
    if (RETIRABLE.has(pad.id) && beltReplaces(sim, pad.id as WorkerRole)) {
      pad.visible = false
      pad.locked = false
      pad.hold = 0
      continue
    }
    pad.done = pad.level >= def.maxLevel
    const ready = !pad.done && padVisible(sim, pad)
    pad.lockText = ready || pad.done ? '' : (padPreview(sim, pad) ?? '')
    pad.visible = ready || pad.lockText !== ''
    if (!pad.visible) {
      pad.locked = false
      pad.hold = 0
      continue
    }
    // prerequisites: everything a pad builds on must be fully bought first
    if (!pad.lockText && def.requires) pad.lockText = missingText(sim, def.requires)
    if (pad.id === 'prestige' && pendingStars(sim) < 1) pad.lockText = 'Sell more to earn ❄️'
    const cap = def.gated ? Math.min(def.maxLevel, upgradeCap(sim.rep.level)) : def.maxLevel
    pad.locked = pad.lockText !== '' || pad.level >= cap
    pad.needLevel = pad.locked && !pad.lockText ? pad.level + 1 - REP.upgradeCapBase : 0
    pad.pulse += dt

    const onPad = dist(p.pos, pad.pos) < pad.radius
    if (!onPad) {
      pad.hold = 0
      pad.streak = 0
      continue
    }
    if (pad.locked) {
      pad.hold = 0
      if (p.hintCd <= 0) {
        p.hintCd = 2.5
        const why = pad.lockText || `Needs ⭐ Level ${pad.needLevel}`
        sim.fx.push({ t: 'text', x: pad.pos.x, y: 2.4, z: pad.pos.z, str: `🔒 ${why}`, color: '#9fc4ff', size: 0.9 })
        sfx.lock()
      }
      continue
    }

    // moving the settlement costs nothing: a long hold is the confirmation
    if (pad.id === 'prestige') {
      if (pad.hold === 0) {
        sim.fx.push({ t: 'text', x: pad.pos.x, y: 3, z: pad.pos.z, str: 'Stay to move: keep ❄️, start fresh', color: '#bfe6ff', size: 0.85 })
      }
      pad.hold = Math.min(pad.hold + dt, pad.holdNeed)
      if (pad.hold >= pad.holdNeed) moveSettlement(sim)
      continue
    }

    if (pad.hold < pad.holdNeed) {
      // only count down while there's money to spend, so the ring means "about to pay"
      if (sim.money > 0) pad.hold = Math.min(pad.hold + dt, pad.holdNeed)
      continue
    }

    if (sim.money > 0 && pad.paid < pad.cost) {
      // back-to-back levels pay faster, so a big upgrade run doesn't drag
      const secs = Math.max(ECONOMY.padDrainMin, ECONOMY.padDrainSeconds * Math.pow(ECONOMY.padStreakMult, pad.streak))
      const rate = Math.max(pad.cost / secs, 25)
      const drain = Math.min(sim.money, pad.cost - pad.paid, rate * dt)
      sim.money -= drain
      pad.paid += drain
      sfx.tick()
      // bills stream from the player into the pad while paying
      payStreamT -= dt
      if (payStreamT <= 0) {
        payStreamT = 0.045
        sim.fx.push({ t: 'coin', x: p.pos.x, y: 1.6, z: p.pos.z, to: { x: pad.pos.x, y: 0.15, z: pad.pos.z } })
      }
    }
    if (pad.cost - pad.paid < 0.001) {
      pad.paid = 0
      // keep standing to keep upgrading: the hold isn't needed again until you step off
      pad.streak++
      pad.level++
      sim.stats.bought++
      pad.done = pad.level >= def.maxLevel
      if (!pad.done) pad.cost = padCost(def, pad.level)
      applyPad(sim, pad)
      for (const color of CONFETTI) {
        sim.fx.push({ t: 'burst', x: pad.pos.x, y: 0.6, z: pad.pos.z, color, n: 7, spread: 1.4, up: 5 })
      }
      sim.fx.push({ t: 'shake', power: 0.18 })
      sfx.whoosh()
      haptic(28, 'buy', 0.2)
      sim.fx.push({
        t: 'text',
        x: pad.pos.x,
        y: 2,
        z: pad.pos.z,
        str: def.maxLevel > 1 ? `${pad.label} Lv${pad.level}` : `${pad.label}!`,
        color: '#a0ffb0',
        size: 1,
      })
      requestSave()
    }
  }
}
