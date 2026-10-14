import type { Sim } from './types'
import { ECONOMY, CLOCK, RUSH, xpForLevel } from './balance'
import { updateClock } from './systems/clock'
import { updateCustomers } from './systems/customers'
import { updatePlayer } from './systems/player'
import { updateAnimals } from './systems/animals'
import { updateWolves } from './systems/wolves'
import { updateTower } from './systems/tower'
import { updateWorkers } from './systems/workers'
import { updateProcessors } from './systems/processors'
import { updateCaravan, orderText } from './systems/caravan'
import { updateEconomy } from './systems/economy'
import { updateObjectives, objectiveText } from './systems/objectives'
import { updateRush, updateBanners, rushMult } from './systems/progress'
import { saveNow } from './save'
import { consumeSaveRequest } from './saveFlag'
import { useUI, type UIState } from './uiStore'
import { sim } from './state'

const MAX_PENDING_FX = 300
let uiSyncT = 0

const q = (v: number, steps: number) => Math.round(v * steps) / steps

function syncUI(sim: Sim) {
  const cv = sim.caravan
  const c = sim.clock
  const next: Partial<UIState> = {
    money: Math.floor(sim.money),
    objectiveText: objectiveText(sim),
    objectiveFlash: sim.objectiveFlash > 0,
    level: sim.rep.level,
    xpFrac: q(sim.rep.xp / xpForLevel(sim.rep.level), 100),
    rushN: sim.rush.n,
    rushMult: q(rushMult(sim.rush.n), 100),
    rushFrac: q(sim.rush.t / RUSH.window, 20),
    clockOn: c.enabled,
    night: c.night,
    day: c.day,
    clockFrac: q(c.t / (c.night ? CLOCK.nightLength : CLOCK.dayLength), 100),
    wolves: sim.wolves.length + sim.raid.toSpawn,
    dark: q(c.dark, 20),
    caravanState: cv.state,
    caravanText: cv.state === 'waiting' || cv.state === 'arriving' ? orderText(cv.order) : '',
    caravanTime: Math.ceil(cv.timer),
    caravanFrac: cv.maxTimer > 0 ? q(cv.timer / cv.maxTimer, 50) : 0,
    bannerId: sim.banner.id,
    bannerText: sim.banner.text,
    bannerSub: sim.banner.sub,
    bannerTone: sim.banner.tone,
  }
  const ui = useUI.getState() as unknown as Record<string, unknown>
  for (const k in next) {
    if (ui[k] !== (next as Record<string, unknown>)[k]) {
      useUI.setState(next)
      return
    }
  }
}

/** Master simulation tick — called once per rendered frame, before views. */
export function tick(sim: Sim, dt: number) {
  sim.time += dt

  updateClock(sim, dt)
  updatePlayer(sim, dt)
  updateCustomers(sim, dt)
  updateAnimals(sim, dt)
  updateWolves(sim, dt)
  updateTower(sim, dt)
  updateWorkers(sim, dt)
  updateProcessors(sim, dt)
  updateCaravan(sim, dt)
  updateEconomy(sim, dt)
  updateRush(sim, dt)
  updateObjectives(sim, dt)
  updateBanners(sim, dt)

  if (sim.focus) {
    sim.focus.t -= dt
    if (sim.focus.t <= 0) sim.focus = null
  }
  if (sim.shake > 0) sim.shake -= dt * 2
  // fx are drained by the renderer; don't let them pile up when it isn't drawing
  if (sim.fx.length > MAX_PENDING_FX) sim.fx.splice(0, sim.fx.length - MAX_PENDING_FX)

  sim.saveT += dt
  if (sim.saveT >= ECONOMY.autosaveInterval || consumeSaveRequest()) {
    sim.saveT = 0
    saveNow(sim)
  }

  // throttled UI sync (never per-frame React state)
  uiSyncT -= dt
  if (uiSyncT <= 0) {
    uiSyncT = 0.1
    syncUI(sim)
  }
}

// Dev-only deterministic fast-forward for automated testing/balancing.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as any).__ff = (seconds: number) => {
    const step = 1 / 60
    const n = Math.round(seconds / step)
    for (let i = 0; i < n; i++) tick(sim, step)
    return `advanced ${seconds}s`
  }
}
