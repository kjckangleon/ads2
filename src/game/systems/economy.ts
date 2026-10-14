// Purchase pads: stand on a pad, coins drain in, thing gets built/hired.
// Upgrade pads marked `gated` stop at the settlement-level cap and show a
// lock until the settlement grows.

import type { Sim, PadSim, StationId, ProcessorId, WorkerRole } from '../types'
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
} from '../balance'
import { dist } from '../util'
import { sfx, haptic } from '../audio'
import { spawnAnimal } from '../state'
import { hireWorker } from './workers'
import { banner } from './progress'
import { requestSave } from '../saveFlag'

const hasWorker = (sim: Sim, role: WorkerRole) => sim.workers.some((w) => w.role === role)

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
      return hasWorker(sim, 'lumberjack')
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
      return hasWorker(sim, 'cook')
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
      return sim.zones.tannery && hasWorker(sim, 'tailor')
    default:
      return false
  }
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
    case 'tower':
      return sim.stations.meat.unlocked && !sim.tower.built ? 'Sell your first meat' : null
    case 'guard':
      return hasWorker(sim, 'runner') ? 'Comes with the first night' : null
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
  sfx.build()
}

function upgradeProc(sim: Sim, id: ProcessorId) {
  const pr = sim.proc[id]
  pr.level++
  pr.time = procTime(id, pr.level)
  pr.inCap = procInCap(id, pr.level)
  pr.outCap = procOutCap(id, pr.level)
  sim.fx.push({ t: 'burst', x: pr.pos.x, y: 1.2, z: pr.pos.z, color: '#ffc890', n: 14, spread: 1.2 })
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
    pad.done = pad.level >= def.maxLevel
    const ready = !pad.done && padVisible(sim, pad)
    pad.lockText = ready || pad.done ? '' : (padPreview(sim, pad) ?? '')
    pad.visible = ready || pad.lockText !== ''
    if (!pad.visible) {
      pad.locked = false
      continue
    }
    const cap = def.gated ? Math.min(def.maxLevel, upgradeCap(sim.rep.level)) : def.maxLevel
    pad.locked = pad.lockText !== '' || pad.level >= cap
    pad.needLevel = pad.locked && !pad.lockText ? pad.level + 1 - REP.upgradeCapBase : 0
    pad.pulse += dt

    const onPad = dist(p.pos, pad.pos) < pad.radius
    if (!onPad) continue
    if (pad.locked) {
      if (p.hintCd <= 0) {
        p.hintCd = 2.5
        const why = pad.lockText || `Needs ⭐ Level ${pad.needLevel}`
        sim.fx.push({ t: 'text', x: pad.pos.x, y: 2.4, z: pad.pos.z, str: `🔒 ${why}`, color: '#9fc4ff', size: 0.9 })
        sfx.lock()
      }
      continue
    }

    if (sim.money > 0 && pad.paid < pad.cost) {
      const rate = Math.max(pad.cost / ECONOMY.padDrainSeconds, 25)
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
      pad.level++
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
