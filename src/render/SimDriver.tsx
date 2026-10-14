// Runs the simulation tick once per frame, before all view components
// (negative useFrame priority). Also feeds a lightweight FPS meter.

import { useFrame } from '@react-three/fiber'
import { sim } from '../game/state'
import { tick } from '../game/update'

let frames = 0
let lastFpsAt = 0

export function SimDriver() {
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05) * sim.speed
    tick(sim, dt)

    frames++
    const now = state.clock.elapsedTime
    if (now - lastFpsAt >= 1) {
      ;(window as any).__fps = Math.round(frames / (now - lastFpsAt))
      ;(window as any).__drawCalls = state.gl.info.render.calls
      if (import.meta.env.DEV) (window as any).__scene = state.scene
      frames = 0
      lastFpsAt = now
    }
  }, -100)
  return null
}
