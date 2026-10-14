// Easing + small animation state helpers for the "juice" layer.

export function elasticOut(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

export function backOut(t: number) {
  if (t >= 1) return 1
  const c1 = 2.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/**
 * Springy appear animation for things that get unlocked. Already-on at mount
 * means "loaded from a save": show at full size without animating.
 */
export class PopIn {
  private onAt = -1
  private was: boolean | null = null

  constructor(private duration = 0.7) {}

  update(on: boolean, time: number): number {
    if (this.was === null) {
      this.was = on
      if (on) this.onAt = -1e9
    }
    if (!on) {
      this.was = false
      return 0
    }
    if (!this.was) this.onAt = time
    this.was = true
    return elasticOut(Math.min(1, (time - this.onAt) / this.duration))
  }
}

/** Squash-and-stretch kick, e.g. a stall receiving stock. */
export class Squash {
  private at = -1e9
  kick(time: number) {
    this.at = time
  }
  /** [xz scale, y scale] */
  value(time: number): [number, number] {
    const t = (time - this.at) / 0.22
    if (t >= 1 || t < 0) return [1, 1]
    const s = Math.sin(t * Math.PI) * (1 - t)
    return [1 + 0.07 * s, 1 - 0.1 * s]
  }
}
