// Task board: once the settlement is up and running there are always three
// goals on the go ("Sell 40 smoked fish", "Hunt 2 bears", "Reach a ×1.5
// rush"...). Each pays cash + XP and is replaced by a new one scaled to the
// current level, so the late game always has a next thing to chase.

import type { Sim, TaskSim, TaskKind, StationId } from '../types'
import { TASKS, STATION_IDS, CARAVAN, ANIMALS, RUSH, xpForLevel, niceRound } from '../balance'
import { NEED_ICON } from '../icons'
import { fmt } from '../format'
import { sfx } from '../audio'
import { addXp, banner, rushMult } from './progress'
import { caravansReady } from './caravan'
import { requestSave } from '../saveFlag'

const SERVED: Record<StationId, keyof Sim['stats']> = {
  wood: 'woodServed',
  meat: 'meatServed',
  coat: 'coatServed',
  fish: 'fishServed',
}

const STALL_NAME: Record<StationId, string> = { wood: 'firewood', meat: 'meals', coat: 'coats', fish: 'smoked fish' }

/** the stat a task counts (rush is a peak, not a running total) */
function metric(sim: Sim, t: TaskSim): number {
  const s = sim.stats
  switch (t.kind) {
    case 'serve':
      return s[SERVED[t.station!]]
    case 'kills':
      return s.kills
    case 'bears':
      return s.bearKills
    case 'earn':
      return s.earned
    case 'tips':
      return s.tips
    case 'caravan':
      return s.caravansDone
    case 'coal':
      return s.coalBurned
    case 'buy':
      return s.bought
    case 'rush':
      return sim.rush.n
  }
}

export function taskProgress(sim: Sim, t: TaskSim): number {
  if (t.doneT >= 0) return t.need
  if (t.kind === 'rush') return Math.min(t.need, sim.rush.n)
  return Math.max(0, Math.min(t.need, metric(sim, t) - t.start))
}

export function taskText(t: TaskSim): string {
  switch (t.kind) {
    case 'serve':
      return `${NEED_ICON[t.station!]} Sell ${t.need} ${STALL_NAME[t.station!]}`
    case 'kills':
      return `🏹 Hunt ${t.need} animals`
    case 'bears':
      return `🐻 Bring down ${t.need} bear${t.need > 1 ? 's' : ''}`
    case 'earn':
      return `💵 Earn $${fmt(t.need)}`
    case 'tips':
      return `😍 Collect ${t.need} tips`
    case 'caravan':
      return `🛷 Fill ${t.need} caravan${t.need > 1 ? 's' : ''}`
    case 'coal':
      return `🔥 Burn ${t.need} coal`
    case 'buy':
      return `⬆️ Buy ${t.need} upgrades`
    case 'rush':
      return `🔥 Hit a RUSH of ×${rushMult(t.need).toFixed(2)}`
  }
}

interface Template {
  kind: TaskKind
  station?: StationId
  /** relative reward for the effort */
  weight: number
  need: (lvl: number) => number
}

function templates(sim: Sim): Template[] {
  const lvl = sim.rep.level
  const out: Template[] = []
  for (const id of STATION_IDS) {
    if (!sim.stations[id].unlocked) continue
    // the coat and fish stalls sell slower, so they ask for fewer
    const slow = id === 'coat' || id === 'fish'
    out.push({ kind: 'serve', station: id, weight: slow ? 1.2 : 1, need: (l) => niceRound((slow ? 4 : 6) + 1.5 * l) })
  }
  if (sim.tower.built) out.push({ kind: 'kills', weight: 0.9, need: (l) => niceRound(8 + 2 * l) })
  if (lvl >= ANIMALS.bear.level) out.push({ kind: 'bears', weight: 1.3, need: (l) => 1 + Math.floor((l - ANIMALS.bear.level) / 3) })
  out.push({ kind: 'earn', weight: 1.1, need: (l) => niceRound(2500 * Math.pow(1.5, l - TASKS.level)) })
  out.push({ kind: 'tips', weight: 0.9, need: (l) => niceRound(8 + 2 * l) })
  if (caravansReady(sim) && lvl >= CARAVAN.unlockLevel) out.push({ kind: 'caravan', weight: 1.4, need: () => 1 })
  if (sim.furnace.built) out.push({ kind: 'coal', weight: 1, need: (l) => niceRound(30 + 8 * l) })
  out.push({ kind: 'buy', weight: 0.8, need: () => 3 })
  out.push({ kind: 'rush', weight: 1.2, need: (l) => Math.min(RUSH.maxStack, 6 + l) })
  return out
}

function postTask(sim: Sim) {
  const lvl = sim.rep.level
  // never two of the same task on the board
  const taken = new Set(sim.tasks.map((t) => `${t.kind}:${t.station ?? ''}`))
  const pool = templates(sim).filter((tp) => !taken.has(`${tp.kind}:${tp.station ?? ''}`))
  if (!pool.length) return
  const tp = pool[Math.floor(Math.random() * pool.length)]
  const t: TaskSim = {
    id: sim.ids++,
    kind: tp.kind,
    station: tp.station ?? null,
    need: tp.need(lvl),
    start: 0,
    reward: niceRound(TASKS.rewardBase * Math.pow(TASKS.rewardMult, lvl - TASKS.level) * tp.weight),
    xp: Math.max(1, Math.round(xpForLevel(lvl) * TASKS.xpFrac * tp.weight)),
    doneT: -1,
  }
  t.start = t.kind === 'rush' ? 0 : metric(sim, t)
  sim.tasks.push(t)
}

function payOut(sim: Sim, t: TaskSim) {
  const p = sim.player.pos
  sim.money += t.reward
  sim.stats.tasksDone++
  addXp(sim, t.xp)
  for (let i = 0; i < 6; i++) sim.fx.push({ t: 'coin', x: p.x + (Math.random() - 0.5), y: 2.2, z: p.z + (Math.random() - 0.5) })
  sim.fx.push({ t: 'burst', x: p.x, y: 2, z: p.z, color: '#ffe680', n: 18, spread: 1.4, up: 4 })
  sim.fx.push({ t: 'text', x: p.x, y: 3, z: p.z, str: `🎯 +$${fmt(t.reward)}`, color: '#ffe680', size: 1.25 })
  banner(sim, `🎯 Task complete: +$${fmt(t.reward)}`, taskText(t), 'good')
  sfx.combo()
  requestSave()
}

export function updateTasks(sim: Sim, dt: number) {
  if (sim.rep.level < TASKS.level) return
  for (let i = sim.tasks.length - 1; i >= 0; i--) {
    const t = sim.tasks[i]
    if (t.doneT < 0) {
      if (taskProgress(sim, t) >= t.need) {
        t.doneT = 0
        sfx.milestone()
      }
      continue
    }
    t.doneT += dt
    if (t.doneT >= TASKS.claimDelay) {
      sim.tasks.splice(i, 1)
      payOut(sim, t)
    }
  }
  while (sim.tasks.length < TASKS.slots) {
    const before = sim.tasks.length
    postTask(sim)
    if (sim.tasks.length === before) break
  }
}
