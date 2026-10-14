// Dev-only balancing panel: cheats, game speed, live system readouts.
// Not rendered in production builds (guarded by import.meta.env.DEV in App).

import { useEffect, useState } from 'react'
import { sim, spawnAnimal } from '../game/state'
import { useUI, type Quality } from '../game/uiStore'
import { clearSave } from '../game/save'
import { STATION_IDS, PROC_IDS, ZONE_IDS, BELT_IDS, MACHINE_IDS, xpForLevel, capText } from '../game/balance'
import { queueLength } from '../game/systems/customers'
import { addXp } from '../game/systems/progress'
import { startNight, endNight } from '../game/systems/clock'
import { spawnWolf } from '../game/systems/wolves'
import { summonCaravan } from '../game/systems/caravan'
import { applyPad } from '../game/systems/economy'
import { moveSettlement } from '../game/systems/meta'
import { startEvent } from '../game/systems/events'
import type { EventId } from '../game/types'

export function DebugPanel() {
  const open = useUI((s) => s.debugOpen)
  const quality = useUI((s) => s.quality)
  const set = useUI((s) => s.set)
  const [, force] = useState(0)

  useEffect(() => {
    if (!open) return
    const t = setInterval(() => force((n) => n + 1), 300)
    return () => clearInterval(t)
  }, [open])

  if (!open) return null

  const s = sim
  const fps = (window as any).__fps ?? '–'

  return (
    <div className="debug-panel">
      <div className="debug-title">
        FROSTLINE debug — fps {fps} · draws {(window as any).__drawCalls ?? '–'}
      </div>
      <div className="debug-row">
        <button onClick={() => (s.money += 500)}>+500💰</button>
        <button onClick={() => (s.money += 5000)}>+5000💰</button>
        <button onClick={() => addXp(s, xpForLevel(s.rep.level) - s.rep.xp)}>+1 ⭐</button>
        <button onClick={() => (s.spawnT = 0.01)}>+customer</button>
        <button onClick={() => spawnAnimal(s, 'deer')}>+deer</button>
      </div>
      <div className="debug-row">
        <button onClick={() => (s.lastWall -= 2 * 3600 * 1000)}>away 2h</button>
        <button onClick={() => (s.stats.earned += 1e6)}>+1M earned</button>
        <button onClick={() => moveSettlement(s)}>move now</button>
        <button onClick={() => (s.meta.stars += 5)}>+5 ❄️</button>
      </div>
      <div className="debug-row">
        {(['blizzard', 'festival', 'goldRush', 'siege', 'boss'] as EventId[]).map((id) => (
          <button key={id} onClick={() => startEvent(s, id)}>
            {id}
          </button>
        ))}
      </div>
      <div className="debug-row">
        <button
          onClick={() => {
            s.clock.enabled = true
            if (s.clock.night) endNight(s)
            else startNight(s)
          }}
        >
          {s.clock.night ? 'dawn now' : 'night now'}
        </button>
        <button onClick={() => spawnWolf(s)}>+wolf</button>
        <button onClick={() => summonCaravan(s)}>caravan</button>
      </div>
      <div className="debug-row">
        {ZONE_IDS.map((z) => (
          <button
            key={z}
            className={s.zones[z] ? 'active' : ''}
            onClick={() => {
              const pad = s.pads.find((p) => p.id === `zone_${z}`)!
              if (!s.zones[z]) {
                pad.level = 1
                pad.done = true
                applyPad(s, pad)
              }
            }}
          >
            open {z}
          </button>
        ))}
        <button
          onClick={() => {
            // the whole Industrial Park: every stage, export line and product belt
            for (const id of [
              'zone_industry',
              'zone_port',
              'zone_airport',
              'ex_log',
              'ex_coal',
              'ex_coat',
              'ex_fish',
              'pb_furn',
              'pb_steel',
              'pb_jacket',
              'pb_canned',
            ]) {
              const pad = s.pads.find((p) => p.id === id)!
              if (pad.done) continue
              pad.level++
              pad.done = pad.level >= pad.maxLevel
              applyPad(s, pad)
            }
          }}
        >
          +park
        </button>
        <button
          onClick={() => {
            for (const id of [...BELT_IDS, 'cash', ...MACHINE_IDS.map((m) => `m:${m}`)]) {
              const pad = s.pads.find((p) => p.id === (id.startsWith('m:') ? `m_${id.slice(2)}` : `belt_${id}`))!
              if (pad.visible && !pad.locked && !pad.done) {
                pad.level++
                pad.done = pad.level >= pad.maxLevel
                applyPad(s, pad)
              }
            }
          }}
        >
          +belts & machines
        </button>
      </div>
      <div className="debug-row">
        {[1, 2, 4].map((x) => (
          <button key={x} className={s.speed === x ? 'active' : ''} onClick={() => (s.speed = x)}>
            {x}x
          </button>
        ))}
        <button
          onClick={() => {
            s.customers.length = 0
            for (const id of STATION_IDS) s.stations[id].slots.fill(null)
          }}
        >
          clear queues
        </button>
        <button
          onClick={() => {
            clearSave()
            location.reload()
          }}
        >
          reset save
        </button>
      </div>
      <div className="debug-row">
        {(['low', 'medium', 'high'] as Quality[]).map((q) => (
          <button key={q} className={quality === q ? 'active' : ''} onClick={() => set({ quality: q })}>
            {q}
          </button>
        ))}
      </div>
      <pre className="debug-info">
        {[
          `❄️ ${s.meta.stars} stars (${s.meta.stars - s.meta.spent} free)  runs ${s.meta.runs}  income ${Math.round(s.incomeRate)}/s`,
          `event ${s.event ? `${s.event.id} ${s.event.t.toFixed(0)}s` : `next in ${s.eventNext.toFixed(0)}s`}  loot ${s.loot.length}  perks ${JSON.stringify(s.meta.perks)}`,
          `money ${Math.floor(s.money)}  obj ${s.objective}  ⭐${s.rep.level} (${s.rep.xp}/${xpForLevel(s.rep.level)})`,
          `rush ${s.rush.n} (best ${s.rush.best})  tips ${s.stats.tips}  angry ${s.stats.angry}  vips ${s.stats.vips}`,
          `clock ${s.clock.enabled ? `${s.clock.night ? 'night' : 'day'} ${s.clock.day} t${s.clock.t.toFixed(0)}` : 'off'}  raids ${s.raid.count} stolen ${s.raid.stolen}`,
          ...STATION_IDS.map((id) => {
            const st = s.stations[id]
            return `${id.padEnd(5)} ${st.unlocked ? '' : '(locked) '}stock ${capText(st.stock, st.capacity)} q${queueLength(st)} lv${st.level} $${st.price}`
          }),
          ...PROC_IDS.map((id) => {
            const pr = s.proc[id]
            return `${id.padEnd(7)} ${pr.unlocked ? '' : '(locked) '}in ${capText(pr.inCount, pr.inCap)} out ${capText(pr.outCount, pr.outCap)} lv${pr.level} ${pr.active ? 'WORKING' : 'idle'}`
          }),
          `log pile ${s.depot.count}/${s.depot.cap}  coal pile ${s.coalDepot.count}/${s.coalDepot.cap}`,
          `furnace ${s.furnace.built ? `fuel ${s.furnace.fuel}/${s.furnace.cap} lv${s.furnace.level} ${s.furnace.burning ? 'LIT' : 'cold'}` : 'not built'}`,
          `cash belts L${s.cash.level}  ${Object.values(s.cash.belts)
            .map((b) => `${b.id}:${b.items.length}`)
            .join(' ')}`,
          `machines ${MACHINE_IDS.map((id) => `${id}:${s.machines[id].level ? `L${s.machines[id].level}${s.machines[id].active ? '*' : ''}` : '-'}`).join(' ')}`,
          `belts ${BELT_IDS.map((id) => `${id}:${s.belts[id].level ? `L${s.belts[id].level}·${s.belts[id].items.length}` : '-'}`).join(' ')}`,
          `tasks ${s.tasks.map((t) => `${t.kind}${t.station ? `/${t.station}` : ''} ${t.need}`).join(' | ')}`,
          `tower ${s.tower.built ? `dmg${s.tower.dmgLvl} spd${s.tower.spdLvl} rng${s.tower.rngLvl}` : 'not built'}`,
          `animals ${s.animals.length}  wolves ${s.wolves.length}  drops ${s.drops.length}`,
          `caravan ${s.caravan.state} ${s.caravan.state === 'away' ? `in ${s.caravan.nextIn.toFixed(0)}s` : `${s.caravan.timer.toFixed(0)}s`}  done ${s.stats.caravansDone}`,
          `customers ${s.customers.length}  piles ${s.piles.map((p) => Math.floor(p.value)).join('/')}`,
          ...s.workers.map((w) => `  ${w.role}: ${w.activity} carry:${w.carry.length} coins:${w.coins}`),
        ].join('\n')}
      </pre>
    </div>
  )
}
