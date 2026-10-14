import { unlockAudio, resumeAudio } from './audio'

// Shared input vector, written by keyboard listeners and the virtual
// joystick, read once per tick by the player system. Not React state.

export const input = {
  kx: 0,
  kz: 0,
  jx: 0,
  jz: 0,
  /** combined, normalized (call poll() first) */
  x: 0,
  z: 0,
}

if (typeof window !== 'undefined' && import.meta.env.DEV) (window as any).__input = input

const held = new Set<string>()

export function resetInput() {
  held.clear()
  input.kx = input.kz = input.jx = input.jz = input.x = input.z = 0
}

function recompute() {
  let x = 0
  let z = 0
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1
  if (held.has('KeyW') || held.has('ArrowUp')) z -= 1
  if (held.has('KeyS') || held.has('ArrowDown')) z += 1
  input.kx = x
  input.kz = z
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    held.add(e.code)
    recompute()
    unlockAudio()
  })
  window.addEventListener('keyup', (e) => {
    held.delete(e.code)
    recompute()
  })
  window.addEventListener('blur', () => {
    held.clear()
    recompute()
  })
  // every gesture can (re)start audio: phones suspend it in the background or on a call.
  // Capture phase, so the joystick and buttons can't swallow the event first.
  const wake = () => unlockAudio()
  for (const ev of ['pointerdown', 'touchstart', 'touchend', 'click']) {
    window.addEventListener(ev, wake, { capture: true, passive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeAudio()
  })
  window.addEventListener('pageshow', () => resumeAudio())
}

export function pollInput() {
  let x = input.kx + input.jx
  let z = input.kz + input.jz
  const len = Math.hypot(x, z)
  if (len > 1) {
    x /= len
    z /= len
  }
  input.x = x
  input.z = z
}
