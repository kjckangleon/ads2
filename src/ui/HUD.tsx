import { useEffect, useRef, useState } from 'react'
import { useUI } from '../game/uiStore'
import { setMuted, isMuted } from '../game/audio'
import { fmt } from '../game/format'
import { sim } from '../game/state'
import { claimOffline } from '../game/systems/meta'

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

function Banner() {
  const id = useUI((s) => s.bannerId)
  const text = useUI((s) => s.bannerText)
  const sub = useUI((s) => s.bannerSub)
  const tone = useUI((s) => s.bannerTone)
  if (!id) return null
  return (
    <div key={id} className={`hud-banner tone-${tone}`}>
      <div className="hud-banner-text">{text}</div>
      {sub && <div className="hud-banner-sub">{sub}</div>}
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
    <div className="hud-modal-backdrop">
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
  if (!tasks.length) return null
  return (
    <div className="hud-tasks">
      {tasks.map((t) => (
        <div key={t.id} className={`hud-task${t.done ? ' done' : ''}`}>
          <div className="hud-task-row">
            <span className="hud-task-text">{t.done ? '✅ ' : ''}{t.text}</span>
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

export function HUD() {
  const objective = useUI((s) => s.objectiveText)
  const flash = useUI((s) => s.objectiveFlash)
  const level = useUI((s) => s.level)
  const xpFrac = useUI((s) => s.xpFrac)
  const dark = useUI((s) => s.dark)
  const muted = useUI((s) => s.muted)
  const set = useUI((s) => s.set)
  const debugOpen = useUI((s) => s.debugOpen)

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
        <Banner />
      </div>
      <div className="hud-right">
        <div className="hud-buttons">
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
        <Clock />
      </div>
      <div className="hud-br">
        <Furnace />
        <Tasks />
      </div>
      <Offline />
      <Moving />
    </div>
  )
}
