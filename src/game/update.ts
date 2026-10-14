import type { Sim, BossKind } from './types'
import { ECONOMY, CLOCK, RUSH, EVENT_INFO, BOSS, xpForLevel, furnaceBonus } from './balance'
import { updateClock } from './systems/clock'
import { updateCustomers } from './systems/customers'
import { updatePlayer } from './systems/player'
import { updateAnimals } from './systems/animals'
import { updateWolves } from './systems/wolves'
import { updateTower } from './systems/tower'
import { updateWorkers } from './systems/workers'
import { updateProcessors } from './systems/processors'
import { updateBelts } from './systems/belts'
import { updateFreight, bigOrderView } from './systems/freight'
import { updateMeta, pendingStars, canDoubleOffline, finishSettlementMove } from './systems/meta'
import { starSalesMult } from './balance'
import { updateTasks, taskProgress, taskText } from './systems/tasks'
import { updateEvents } from './systems/events'
import { fmt } from './format'
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

function ago(sec: number) {
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}

/** running event + boss bar for the HUD */
function eventView(sim: Sim) {
  const ev = sim.event
  const boss = ev?.id === 'boss' ? sim.animals.find((a) => a.id === ev.bossId) : undefined
  const info = ev ? EVENT_INFO[ev.id] : null
  return {
    eventIcon: info && ev ? (boss ? BOSS[boss.kind as BossKind].icon : info.icon) : '',
    eventName: info && ev ? (boss ? BOSS[boss.kind as BossKind].label : info.name.replace('!', '')) : '',
    eventFrac: ev ? q(ev.t / ev.dur, 50) : 0,
    eventLeft: ev ? Math.ceil(ev.t) : 0,
    bossName: boss ? BOSS[boss.kind as BossKind].label : '',
    bossFrac: boss ? q(boss.hp / boss.maxHp, 100) : 0,
    bossHp: boss ? `${fmt(Math.max(0, boss.hp))} / ${fmt(boss.maxHp)}` : '',
  }
}

function syncUI(sim: Sim) {
  const cv = sim.caravan
  const c = sim.clock
  const ship = bigOrderView(sim, 'ship')
  const plane = bigOrderView(sim, 'plane')
  const next: Partial<UIState> = {
    settlementRun: sim.meta.runs,
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
    inPark: sim.zones.industry && sim.player.pos.z > 34.5,
    noGrab: sim.player.noGrab,
    hasJet: sim.player.flyLvl > 0,
    flying: sim.player.flying,
    shipText: ship.text,
    shipTime: ship.time,
    planeText: plane.text,
    planeTime: plane.time,
    bannerId: sim.banner.id,
    bannerText: sim.banner.text,
    bannerSub: sim.banner.sub,
    bannerTone: sim.banner.tone,
    stars: sim.meta.stars,
    freeStars: sim.meta.stars - sim.meta.spent,
    latestNotice: sim.notices.length ? sim.notices[sim.notices.length - 1].id : 0,
    ...eventView(sim),
    starBonus: Math.round((starSalesMult(sim.meta.stars) - 1) * 100),
    pendingStars: sim.zones.mine ? pendingStars(sim) : 0,
    offlineAmount: sim.offline?.amount ?? 0,
    offlineSeconds: sim.offline?.seconds ?? 0,
    offlineDouble: canDoubleOffline(sim),
    moving: sim.moving > 0,
    movingStars: sim.movingStars,
    furnace: !sim.furnace.built ? '' : sim.furnace.burning ? 'lit' : 'cold',
    furnaceBonus: Math.round(furnaceBonus(sim.furnace.level) * 100),
    furnaceFrac: sim.furnace.built ? q(sim.furnace.fuel / sim.furnace.cap, 20) : 0,
  }
  // tasks are an array: only push them when something visible changed
  const tasks = sim.tasks.map((t) => {
    const p = taskProgress(sim, t)
    return {
      id: t.id,
      text: taskText(t),
      frac: q(p / t.need, 40),
      progress: t.kind === 'earn' ? `$${fmt(p)}/$${fmt(t.need)}` : `${Math.floor(p)}/${t.need}`,
      reward: `$${fmt(t.reward)}`,
      done: t.doneT >= 0,
    }
  })
  // alert history: re-send when a new one arrives or every ~10 s so "2m ago" stays fresh
  const noticesKey = `${sim.notices.length ? sim.notices[sim.notices.length - 1].id : 0}:${Math.floor(sim.time / 10)}`
  if (noticesKey !== useUI.getState().noticesKey) {
    next.noticesKey = noticesKey
    next.notices = sim.notices
      .slice()
      .reverse()
      .map((n) => ({ id: n.id, text: n.text, sub: n.sub, tone: n.tone, ago: ago(sim.time - n.at) }))
  }
  const tasksKey = tasks.map((t) => `${t.id}:${t.progress}:${t.done}`).join('|')
  if (tasksKey !== useUI.getState().tasksKey) {
    next.tasks = tasks
    next.tasksKey = tasksKey
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
  // packing up for a new settlement: freeze the old camp (and never save it again)
  if (sim.moving > 0) {
    sim.moving -= dt / Math.max(1, sim.speed)
    if (sim.moving <= 0) {
      const next = finishSettlementMove(sim)
      useUI.setState({ panel: '', seenNotice: 0, noticesKey: '', tasksKey: '' })
      uiSyncT = 0
      syncUI(next)
      return
    }
    syncUI(sim)
    return
  }
  sim.time += dt
  updateMeta(sim, dt)

  updateClock(sim, dt)
  updatePlayer(sim, dt)
  updateCustomers(sim, dt)
  updateAnimals(sim, dt)
  updateWolves(sim, dt)
  updateTower(sim, dt)
  updateWorkers(sim, dt)
  updateProcessors(sim, dt)
  updateBelts(sim, dt)
  updateFreight(sim, dt)
  updateCaravan(sim, dt)
  updateEconomy(sim, dt)
  updateRush(sim, dt)
  updateObjectives(sim, dt)
  updateTasks(sim, dt)
  updateEvents(sim, dt)
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
