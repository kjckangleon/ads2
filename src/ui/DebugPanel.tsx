// Dev-only balancing panel: cheats, game speed, live system readouts.
// Not rendered in production builds (guarded by import.meta.env.DEV in App).

import { useEffect, useState } from 'react'
import { sim, spawnAnimal } from '../game/state'
import { useUI, type Quality } from '../game/uiStore'
import { clearSave } from '../game/save'
import { STATION_IDS, PROC_IDS, xpForLevel } from '../game/balance'
import { queueLength } from '../game/systems/customers'
import { addXp } from '../game/systems/progress'
import { startNight, endNight } from '../game/systems/clock'
import { spawnWolf } from '../game/systems/wolves'
import { summonCaravan } from '../game/systems/caravan'
import { applyPad } from '../game/systems/economy'

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
      <div className="debug-title">FROSTLINE debug — fps {fps} · draws {(window as any).__drawCalls ?? '–'}</div>
      <div className="debug-row">
        <button onClick={() => (s.money += 500)}>+500💰</button>
        <button onClick={() => (s.money += 5000)}>+5000💰</button>
        <button onClick={() => addXp(s, xpForLevel(s.rep.level) - s.rep.xp)}>+1 ⭐</button>
        <button onClick={() => (s.spawnT = 0.01)}>+customer</button>
        <button onClick={() => spawnAnimal(s, 'deer')}>+deer</button>
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
        <button
          onClick={() => {
            const pad = s.pads.find((p) => p.id === 'zone_tannery')!
            if (!s.zones.tannery) {
              pad.level = 1
              pad.done = true
              applyPad(s, pad)
            }
          }}
        >
          open tannery
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
          `money ${Math.floor(s.money)}  obj ${s.objective}  ⭐${s.rep.level} (${s.rep.xp}/${xpForLevel(s.rep.level)})`,
          `rush ${s.rush.n} (best ${s.rush.best})  tips ${s.stats.tips}  angry ${s.stats.angry}  vips ${s.stats.vips}`,
          `clock ${s.clock.enabled ? `${s.clock.night ? 'night' : 'day'} ${s.clock.day} t${s.clock.t.toFixed(0)}` : 'off'}  raids ${s.raid.count} stolen ${s.raid.stolen}`,
          ...STATION_IDS.map((id) => {
            const st = s.stations[id]
            return `${id.padEnd(5)} ${st.unlocked ? '' : '(locked) '}stock ${st.stock}/${st.capacity} q${queueLength(st)} lv${st.level} $${st.price}`
          }),
          ...PROC_IDS.map((id) => {
            const pr = s.proc[id]
            return `${id.padEnd(7)} ${pr.unlocked ? '' : '(locked) '}in ${pr.inCount}/${pr.inCap} out ${pr.outCount}/${pr.outCap} lv${pr.level} ${pr.active ? 'WORKING' : 'idle'}`
          }),
          `log pile ${s.depot.count}/${s.depot.cap}`,
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
