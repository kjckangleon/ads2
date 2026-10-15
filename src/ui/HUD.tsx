import { useEffect, useRef, useState } from 'react'
import { useUI } from '../game/uiStore'
import { setMuted, isMuted } from '../game/audio'
import { fmt } from '../game/format'
import { sim } from '../game/state'
import { claimOffline, buyPerk, canBuyPerk, perkCost, freeStars } from '../game/systems/meta'
import { PERKS, PERK_IDS, starSalesMult, starWorkerMult } from '../game/balance'
import { perk, prodPerkMult } from '../game/perks'
import { requestSave } from '../game/saveFlag'
import { hardReset } from '../game/save'
import { cloudSave, cloudLoad, lastCloudName } from '../game/cloud'

/** Rolls toward the real balance each animation frame and bumps on gains. */
function Money() {
  const target = useUI((s) => s.money)
  const shownRef = useRef(target)
  const [shown, setShown] = useState(target)
  const [bump, setBump] = useState(0)

  useEffect(() => {
    if (target > shownRef.current + 0.5) setBump((b) => b + 1)
    let raf = 0
    const step = () => {
      const diff = target - shownRef.current
      if (Math.abs(diff) < 1) {
        shownRef.current = target
        setShown(target)
        return
      }
      shownRef.current += diff * 0.22
      setShown(Math.round(shownRef.current))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return (
    <div className="hud-money">
      <span className="hud-coin">💵</span>
      <span key={bump} className={bump ? 'amount bump' : 'amount'}>
        {shown < 1e6 ? shown.toLocaleString() : fmt(shown)}
      </span>
    </div>
  )
}

function Rush() {
  const n = useUI((s) => s.rushN)
  const mult = useUI((s) => s.rushMult)
  const frac = useUI((s) => s.rushFrac)
  if (n <= 0) return null
  return (
    <div className={`hud-rush${mult >= 1.5 ? ' hot' : ''}`}>
      <span>
        🔥 RUSH ×{mult.toFixed(2)} <small>({n})</small>
      </span>
      <div className="bar">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

function Caravan() {
  const state = useUI((s) => s.caravanState)
  const text = useUI((s) => s.caravanText)
  const time = useUI((s) => s.caravanTime)
  const frac = useUI((s) => s.caravanFrac)
  if (state !== 'waiting' && state !== 'arriving') return null
  return (
    <div className={`hud-caravan${state === 'waiting' && time <= 15 ? ' urgent' : ''}`}>
      <span>🛷 {state === 'waiting' ? `${time}s` : 'arriving…'}</span>
      <span className="order">{text}</span>
      {state === 'waiting' && (
        <div className="bar">
          <div style={{ width: `${frac * 100}%` }} />
        </div>
      )}
    </div>
  )
}

/** the docked ship / parked plane's orders in one small pill, only while you're in the Industrial Park */
function FreightOrders() {
  const inPark = useUI((s) => s.inPark)
  const shipText = useUI((s) => s.shipText)
  const shipTime = useUI((s) => s.shipTime)
  const planeText = useUI((s) => s.planeText)
  const planeTime = useUI((s) => s.planeTime)
  if (!inPark || (!shipText && !planeText)) return null
  const urgent = (shipText.includes('/') && shipTime <= 10) || (planeText.includes('/') && planeTime <= 10)
  return (
    <div className={`hud-freight${urgent ? ' urgent' : ''}`}>
      {shipText && (
        <span>
          🚢 {shipTime}s <b>{shipText}</b>
        </span>
      )}
      {planeText && (
        <span>
          ✈️ {planeTime}s <b>{planeText}</b>
        </span>
      )}
    </div>
  )
}

function Clock() {
  const on = useUI((s) => s.clockOn)
  const night = useUI((s) => s.night)
  const day = useUI((s) => s.day)
  const frac = useUI((s) => s.clockFrac)
  const wolves = useUI((s) => s.wolves)
  if (!on) return null
  return (
    <div className={`hud-clock${night ? ' night' : ''}`}>
      <span>
        {night ? '🌙 Night' : '☀️ Day'} {day}
      </span>
      {night && wolves > 0 && <span className="wolves">🐺 {wolves}</span>}
      <div className="bar">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

/** the running random event: icon, name, time left */
function EventPill() {
  const icon = useUI((s) => s.eventIcon)
  const name = useUI((s) => s.eventName)
  const frac = useUI((s) => s.eventFrac)
  const left = useUI((s) => s.eventLeft)
  const boss = useUI((s) => s.bossName)
  const bossFrac = useUI((s) => s.bossFrac)
  const bossHp = useUI((s) => s.bossHp)
  if (!icon) return null
  if (boss) {
    return (
      <div className="hud-boss">
        <span>
          {icon} {boss} <small>{left}s</small>
        </span>
        <div className="bar">
          <div style={{ width: `${bossFrac * 100}%` }} />
        </div>
        <small className="hud-boss-hp">{bossHp}</small>
      </div>
    )
  }
  return (
    <div className="hud-event">
      <span>
        {icon} {name} <small>{left}s</small>
      </span>
      <div className="bar">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

/** permanent prestige boost, shown once the first settlement has moved */
function Stars() {
  const stars = useUI((s) => s.stars)
  const bonus = useUI((s) => s.starBonus)
  const pending = useUI((s) => s.pendingStars)
  if (stars <= 0 && pending <= 0) return null
  return (
    <div className="hud-stars" title="Frost Stars: permanent bonus from moving the settlement">
      <span>❄️ {stars}</span>
      {bonus > 0 && <small>+{bonus}% sales</small>}
      {pending > 0 && <small className="pending">+{pending} on move</small>}
    </div>
  )
}

function duration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`
}

/** "While you were away" payout: collect it, or double it once a day */
function Offline() {
  const amount = useUI((s) => s.offlineAmount)
  const seconds = useUI((s) => s.offlineSeconds)
  const canDouble = useUI((s) => s.offlineDouble)
  if (amount <= 0) return null
  return (
    <div className="hud-modal-backdrop hud-interactive">
      <div className="hud-modal">
        <div className="hud-modal-title">❄️ While you were away</div>
        <div className="hud-modal-sub">Your crew kept the camp running for {duration(seconds)}</div>
        <div className="hud-modal-amount">+${fmt(amount)}</div>
        <div className="hud-modal-buttons">
          <button className="hud-modal-btn" onClick={() => claimOffline(sim, false)}>
            Collect
          </button>
          {canDouble && (
            <button className="hud-modal-btn gold" onClick={() => claimOffline(sim, true)}>
              ×2 Collect <small>(daily)</small>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** ⚙️ settings: online save / load, and the hard reset (each with a clear warning first) */
function Settings() {
  const set = useUI((s) => s.set)
  const [step, setStep] = useState<'' | 'reset' | 'load'>('')
  const [name, setName] = useState(() => lastCloudName())
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const ready = name.trim().length >= 3 && password.length >= 4 && !busy

  const run = async (job: () => Promise<string | void>) => {
    setBusy(true)
    setMsg(null)
    try {
      const text = await job()
      if (text) setMsg({ text, bad: false })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Something went wrong', bad: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hud-modal-backdrop hud-interactive" onClick={() => set({ panel: '' })}>
      <div className="hud-modal" onClick={(e) => e.stopPropagation()}>
        {step === '' && (
          <>
            <div className="hud-modal-title">⚙️ Settings</div>
            <div className="hud-cloud">
              <div className="hud-cloud-title">☁️ Online save</div>
              <div className="hud-modal-sub">
                Pick a save name and password, save here, then load it on your phone (or any device) with the same two.
              </div>
              <input
                className="hud-input"
                placeholder="Save name"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              />
              <input
                className="hud-input"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                maxLength={64}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {msg && <div className={`hud-cloud-msg${msg.bad ? ' bad' : ''}`}>{msg.text}</div>}
              <div className="hud-modal-buttons">
                <button
                  className="hud-modal-btn gold"
                  disabled={!ready}
                  onClick={() => run(() => cloudSave(name, password))}
                >
                  {busy ? '…' : '⬆️ Save online'}
                </button>
                <button className="hud-modal-btn" disabled={!ready} onClick={() => setStep('load')}>
                  ⬇️ Load save
                </button>
              </div>
            </div>
            <div className="hud-modal-sub">Start the whole game again from the very beginning.</div>
            <div className="hud-modal-buttons">
              <button className="hud-modal-btn danger" onClick={() => setStep('reset')}>
                ↺ Reset game
              </button>
              <button className="hud-modal-btn" onClick={() => set({ panel: '' })}>
                Close
              </button>
            </div>
          </>
        )}
        {step === 'load' && (
          <>
            <div className="hud-modal-title">☁️ Load &quot;{name.trim().toLowerCase()}&quot;?</div>
            <div className="hud-modal-sub">
              The game on this device is replaced by the online save. Save this one online first if you want to keep it.
            </div>
            {msg && <div className={`hud-cloud-msg${msg.bad ? ' bad' : ''}`}>{msg.text}</div>}
            <div className="hud-modal-buttons">
              <button className="hud-modal-btn" disabled={busy} onClick={() => setStep('')}>
                Back
              </button>
              <button
                className="hud-modal-btn gold"
                disabled={busy}
                onClick={() => run(() => cloudLoad(name, password))}
              >
                {busy ? 'Loading…' : 'Yes, load it'}
              </button>
            </div>
          </>
        )}
        {step === 'reset' && (
          <>
            <div className="hud-modal-title">⚠️ Do you really want to reset the game to start?</div>
            <div className="hud-modal-sub">
              Everything is wiped: money, levels, districts, the Industrial Park, Frost Stars and perks. This can&apos;t
              be undone.
            </div>
            <div className="hud-modal-buttons">
              <button className="hud-modal-btn" onClick={() => setStep('')}>
                No, keep playing
              </button>
              <button className="hud-modal-btn danger" onClick={() => hardReset()}>
                Yes, reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** full-screen fade while the camp packs up for the next settlement */
function Moving() {
  const moving = useUI((s) => s.moving)
  const stars = useUI((s) => s.movingStars)
  if (!moving) return null
  return (
    <div className="hud-moving">
      <div className="hud-moving-title">🧳 Moving to a new settlement…</div>
      <div className="hud-moving-sub">+{stars} ❄️ Frost Stars: everything earns more from now on</div>
    </div>
  )
}

function Furnace() {
  const state = useUI((s) => s.furnace)
  const bonus = useUI((s) => s.furnaceBonus)
  const frac = useUI((s) => s.furnaceFrac)
  if (!state) return null
  return (
    <div className={`hud-furnace ${state}`}>
      <span>{state === 'lit' ? `🔥 Furnace: sales +${bonus}%` : '🧊 Furnace cold: feed it coal'}</span>
      <div className="bar">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

/** The rotating task board: three goals with a reward each. */
function Tasks() {
  const tasks = useUI((s) => s.tasks)
  if (!tasks.length) return <div className="hud-panel-empty">🎯 Tasks open at Settlement Level 3</div>
  return (
    <div className="hud-tasks">
      {tasks.map((t) => (
        <div key={t.id} className={`hud-task${t.done ? ' done' : ''}`}>
          <div className="hud-task-row">
            <span className="hud-task-text">
              {t.done ? '✅ ' : ''}
              {t.text}
            </span>
            <span className="hud-task-reward">{t.reward}</span>
          </div>
          <div className="bar">
            <div style={{ width: `${t.frac * 100}%` }} />
          </div>
          <div className="hud-task-progress">{t.progress}</div>
        </div>
      ))}
    </div>
  )
}

/** 🔔 alert history: newest first, coloured by tone */
function Alerts() {
  const notices = useUI((s) => s.notices)
  if (!notices.length) return <div className="hud-panel-empty">No alerts yet</div>
  return (
    <div className="hud-alerts">
      {notices.map((n) => (
        <div key={n.id} className={`hud-alert tone-${n.tone}`}>
          <div className="hud-alert-row">
            <span className="hud-alert-text">{n.text}</span>
            <span className="hud-alert-ago">{n.ago}</span>
          </div>
          {n.sub && <div className="hud-alert-sub">{n.sub}</div>}
        </div>
      ))}
    </div>
  )
}

/** ❄️ Frost Star shop: spend stars on permanent perks */
function Shop() {
  const set = useUI((s) => s.set)
  // stars / perks change rarely: re-read the sim while the shop is open
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 400)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="hud-modal-backdrop hud-interactive" onClick={() => set({ panel: '' })}>
      <div className="hud-modal hud-shop" onClick={(e) => e.stopPropagation()}>
        <div className="hud-modal-title">❄️ Frost Star Shop</div>
        <div className="hud-modal-sub">
          {freeStars(sim)} to spend · bonuses from all {sim.meta.stars} stars stay forever
        </div>
        <div className="hud-modal-sub">
          Your bonuses: sales +{Math.round((starSalesMult(sim.meta.stars) - 1) * 100)}% · workers +
          {Math.round((starWorkerMult(sim.meta.stars) - 1) * 100)}% · production +
          {Math.round((prodPerkMult(sim) - 1) * 100)}%
        </div>
        <div className="hud-shop-list">
          {PERK_IDS.map((id) => {
            const def = PERKS[id]
            const lvl = perk(sim, id)
            const cost = perkCost(sim, id)
            const locked = def.requires && perk(sim, def.requires) === 0
            return (
              <div key={id} className="hud-perk">
                <span className="hud-perk-icon">{def.icon}</span>
                <div className="hud-perk-info">
                  <div className="hud-perk-name">
                    {def.name} <small>{def.endless ? `Lv${lvl}` : `${lvl}/${def.costs.length}`}</small>
                  </div>
                  <div className="hud-perk-desc">{locked ? `Needs ${PERKS[def.requires!].name}` : def.desc}</div>
                </div>
                <button
                  className="hud-perk-buy"
                  disabled={!canBuyPerk(sim, id)}
                  onClick={() => {
                    buyPerk(sim, id)
                    tick((n) => n + 1)
                  }}
                >
                  {cost === null ? 'MAX' : `❄️ ${cost}`}
                </button>
              </div>
            )
          })}
        </div>
        <div className="hud-modal-buttons">
          <button className="hud-modal-btn" onClick={() => set({ panel: '' })}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** a HUD toggle button with an optional badge */
function PanelButton({
  id,
  icon,
  badge,
}: {
  id: 'alerts' | 'tasks' | 'shop' | 'settings'
  icon: string
  badge?: number
}) {
  const panel = useUI((s) => s.panel)
  const set = useUI((s) => s.set)
  const latest = useUI((s) => s.latestNotice)
  return (
    <button
      className={`hud-btn${panel === id ? ' active' : ''}`}
      onClick={() =>
        set(panel === id ? { panel: '' } : { panel: id, ...(id === 'alerts' ? { seenNotice: latest } : {}) })
      }
    >
      {icon}
      {badge ? <span className="hud-badge">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  )
}

export function HUD() {
  const objective = useUI((s) => s.objectiveText)
  const flash = useUI((s) => s.objectiveFlash)
  const level = useUI((s) => s.level)
  const xpFrac = useUI((s) => s.xpFrac)
  const dark = useUI((s) => s.dark)
  const muted = useUI((s) => s.muted)
  const noGrab = useUI((s) => s.noGrab)
  const hasJet = useUI((s) => s.hasJet)
  const flying = useUI((s) => s.flying)
  const set = useUI((s) => s.set)
  const debugOpen = useUI((s) => s.debugOpen)
  const panel = useUI((s) => s.panel)
  const notices = useUI((s) => s.notices)
  const seen = useUI((s) => s.seenNotice)
  const tasks = useUI((s) => s.tasks)
  const stars = useUI((s) => s.stars)
  const free = useUI((s) => s.freeStars)
  const unread = notices.filter((n) => n.id > seen).length
  const tasksReady = tasks.filter((t) => t.done).length

  return (
    <div className="hud">
      <div className="hud-vignette" style={{ opacity: dark * 0.55 }} />
      <div className="hud-left">
        <Money />
        <div className="hud-level" title="Settlement level">
          <span>⭐ {level}</span>
          <div className="bar">
            <div style={{ width: `${xpFrac * 100}%` }} />
          </div>
        </div>
        <Stars />
      </div>
      <div className="hud-center">
        <div className={`hud-objective${flash ? ' flash' : ''}`}>{objective}</div>
        <Rush />
        <Caravan />
        <FreightOrders />
        <EventPill />
      </div>
      <div className="hud-right">
        <div className="hud-buttons hud-interactive">
          <PanelButton id="alerts" icon="🔔" badge={panel === 'alerts' ? 0 : unread} />
          <PanelButton id="tasks" icon="🎯" badge={tasksReady} />
          {stars > 0 && <PanelButton id="shop" icon="❄️" badge={free} />}
          {hasJet && (
            <button
              className={`hud-btn${flying ? ' active' : ''}`}
              title={flying ? 'Jetpack on: tap to walk' : 'Walking: tap to fly'}
              onClick={() => {
                const p = sim.player
                p.flying = !p.flying
                set({ flying: p.flying })
                requestSave()
              }}
            >
              {flying ? '🚀' : '🏃'}
            </button>
          )}
          <button
            className={`hud-btn${noGrab ? ' active' : ''}`}
            title={noGrab ? 'Hands off: not picking anything up' : 'Picking things up'}
            onClick={() => {
              const p = sim.player
              p.noGrab = !p.noGrab
              set({ noGrab: p.noGrab })
              sim.fx.push({
                t: 'text',
                x: p.pos.x,
                y: 2.6,
                z: p.pos.z,
                str: p.noGrab ? '🙅 Hands off: no grabbing' : '✋ Grabbing again',
                color: '#bfe6ff',
                size: 0.9,
              })
              requestSave()
            }}
          >
            {noGrab ? '🙅' : '✋'}
          </button>
          <PanelButton id="settings" icon="⚙️" />
          <button
            className="hud-btn"
            onClick={() => {
              setMuted(!isMuted())
              set({ muted: !muted })
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {import.meta.env.DEV && (
            <button className="hud-btn" onClick={() => set({ debugOpen: !debugOpen })}>
              🛠️
            </button>
          )}
        </div>
        {(panel === 'alerts' || panel === 'tasks') && (
          <div className="hud-dropdown hud-interactive">
            {panel === 'alerts' ? (
              <Alerts />
            ) : (
              <>
                <Furnace />
                <Tasks />
              </>
            )}
          </div>
        )}
        {panel !== 'alerts' && panel !== 'tasks' && <Clock />}
      </div>
      {panel === 'shop' && <Shop />}
      {panel === 'settings' && <Settings />}
      <Offline />
      <Moving />
    </div>
  )
}
