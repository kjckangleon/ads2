import { useEffect, useRef, useState } from 'react'
import { useUI } from '../game/uiStore'
import { setMuted, isMuted } from '../game/audio'
import { fmt } from '../game/format'

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
      </div>
      <div className="hud-center">
        <div className={`hud-objective${flash ? ' flash' : ''}`}>{objective}</div>
        <Rush />
        <Caravan />
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
      <Banner />
    </div>
  )
}
