// Floating virtual joystick for touch devices. Appears where the thumb
// lands on the lower-left half of the screen.

import { useEffect, useRef, useState } from 'react'
import { input } from '../game/input'

const RADIUS = 56

export function Joystick() {
  const [isTouch] = useState(() => typeof window !== 'undefined' && 'ontouchstart' in window)
  const baseRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const state = useRef({ active: false, id: -1, bx: 0, by: 0 })

  useEffect(() => {
    if (!isTouch) return
    const onDown = (e: TouchEvent) => {
      if (state.current.active) return
      const t = e.changedTouches[0]
      // left 65% of screen, bottom 60% only
      if (t.clientX > window.innerWidth * 0.65 || t.clientY < window.innerHeight * 0.4) return
      state.current = { active: true, id: t.identifier, bx: t.clientX, by: t.clientY }
      const base = baseRef.current!
      base.style.display = 'block'
      base.style.left = `${t.clientX - RADIUS}px`
      base.style.top = `${t.clientY - RADIUS}px`
      const thumb = thumbRef.current!
      thumb.style.transform = 'translate(0px, 0px)'
    }
    const release = () => {
      state.current.active = false
      input.jx = 0
      input.jz = 0
      if (baseRef.current) baseRef.current.style.display = 'none'
    }
    const onMove = (e: TouchEvent) => {
      if (!state.current.active) return
      // find our touch by id; tolerate identifier drift when it's the only touch
      let t = Array.from(e.changedTouches).find((x) => x.identifier === state.current.id)
      if (!t && e.touches.length === 1) t = e.touches[0]
      if (!t) return
      let dx = t.clientX - state.current.bx
      let dy = t.clientY - state.current.by
      const len = Math.hypot(dx, dy)
      const max = RADIUS * 0.8
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      thumbRef.current!.style.transform = `translate(${dx}px, ${dy}px)`
      input.jx = dx / max
      input.jz = dy / max
    }
    const onUp = (e: TouchEvent) => {
      if (!state.current.active) return
      const ours = Array.from(e.changedTouches).some((t) => t.identifier === state.current.id)
      // release on our touch ending — or whenever no touches remain (missed
      // touchend / identifier drift must never lock the stick)
      if (ours || e.touches.length === 0) release()
    }
    window.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp, { passive: true })
    window.addEventListener('touchcancel', onUp, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onDown)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    }
  }, [isTouch])

  if (!isTouch) return null
  return (
    <div ref={baseRef} className="joystick-base" style={{ display: 'none' }}>
      <div ref={thumbRef} className="joystick-thumb" />
    </div>
  )
}
