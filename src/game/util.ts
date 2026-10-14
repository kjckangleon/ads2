import type { V2 } from './types'

export function dist(a: V2, b: V2) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

export function dist2(a: V2, b: V2) {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Exponential damping factor — framerate independent lerp coefficient. */
export function damp(rate: number, dt: number) {
  return 1 - Math.exp(-rate * dt)
}

/**
 * Move an entity with {pos, yaw} toward target at speed.
 * Returns true when within `arrive` of the target.
 */
export function seek(e: { pos: V2; yaw: number }, target: V2, speed: number, dt: number, arrive = 0.25): boolean {
  const dx = target.x - e.pos.x
  const dz = target.z - e.pos.z
  const d = Math.hypot(dx, dz)
  if (d < arrive) return true
  const step = Math.min(speed * dt, d)
  e.pos.x += (dx / d) * step
  e.pos.z += (dz / d) * step
  e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), damp(12, dt))
  return d - step < arrive
}

/** Deterministic PRNG for world scatter (trees, rocks, variants). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randRange(rng: () => number, lo: number, hi: number) {
  return lo + rng() * (hi - lo)
}
