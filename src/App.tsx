import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Game } from './game/Game'
import { HUD } from './ui/HUD'
import { Joystick } from './ui/Joystick'
import { DebugPanel } from './ui/DebugPanel'

export function App() {
  useEffect(() => {
    const splash = document.getElementById('splash')
    if (splash) {
      const t = setTimeout(() => {
        splash.style.opacity = '0'
        setTimeout(() => splash.remove(), 550)
      }, 400)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div className="app">
      <Game />
      <HUD />
      <Joystick />
      {import.meta.env.DEV && <DebugPanel />}
      <Analytics />
    </div>
  )
}
