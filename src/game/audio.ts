// Lightweight synthesized SFX — no audio files needed, works offline,
// tiny footprint. Every call is throttled so bursts of events don't clip.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
const lastPlayed: Record<string, number> = {}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  return ctx
}

/** Must be called from a user gesture once (pointer/key handler). */
export function unlockAudio() {
  const c = ac()
  if (c && c.state === 'suspended') c.resume()
  startWind()
}

let coinFlip = false
const lastBuzz: Record<string, number> = {}

/** Short vibration on phones (Android Chrome). Throttled per key. */
export function haptic(ms: number, key = 'default', minGap = 0.08) {
  if (muted || typeof navigator === 'undefined' || !navigator.vibrate) return
  const now = performance.now()
  if (lastBuzz[key] && now - lastBuzz[key] < minGap * 1000) return
  lastBuzz[key] = now
  try {
    navigator.vibrate(ms)
  } catch {
    // not allowed before a user gesture — ignore
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (master) master.gain.value = m ? 0 : 0.5
}
export function isMuted() {
  return muted
}

function throttled(key: string, minGap: number): boolean {
  const now = performance.now()
  if (lastPlayed[key] && now - lastPlayed[key] < minGap * 1000) return true
  lastPlayed[key] = now
  return false
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {},
) {
  const c = ac()
  if (!c || !master || muted) return
  const t0 = c.currentTime + (opts.delay ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + opts.slide), t0 + dur)
  g.gain.setValueAtTime(opts.vol ?? 0.15, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function noise(dur: number, opts: { vol?: number; freq?: number; q?: number; delay?: number } = {}) {
  const c = ac()
  if (!c || !master || muted) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + (opts.delay ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const filt = c.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = opts.freq ?? 800
  filt.Q.value = opts.q ?? 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(opts.vol ?? 0.2, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(filt).connect(g).connect(master)
  src.start(t0, Math.random() * 0.5, dur + 0.05)
}

let windStarted = false
function startWind() {
  const c = ac()
  if (!c || !master || windStarted) return
  windStarted = true
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 320
  const g = c.createGain()
  g.gain.value = 0.035
  // slow gusts
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.13
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.02
  lfo.connect(lfoGain).connect(g.gain)
  src.connect(filt).connect(g).connect(master)
  src.start()
  lfo.start()
}

/** Pitch glide through [time, freq] points — used for the wolf howl. */
function sweep(points: [number, number][], dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number } = {}) {
  const c = ac()
  if (!c || !master || muted) return
  const t0 = c.currentTime + (opts.delay ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(points[0][1], t0)
  for (const [t, f] of points.slice(1)) osc.frequency.linearRampToValueAtTime(f, t0 + t)
  const vol = opts.vol ?? 0.1
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.15)
  g.gain.setValueAtTime(vol, t0 + dur * 0.7)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function chord(freqs: number[], step: number, dur: number, type: OscillatorType, vol: number) {
  freqs.forEach((f, i) => tone(f, dur, { type, vol, delay: i * step }))
}

export const sfx = {
  coin() {
    if (throttled('coin', 0.05)) return
    coinFlip = !coinFlip
    const f = coinFlip ? 1320 : 1568
    tone(f, 0.06, { type: 'square', vol: 0.045 })
    tone(f * 1.5, 0.08, { type: 'square', vol: 0.03, delay: 0.04 })
  },
  /** item lands on a stack — pitch climbs with stack height */
  stack(n: number) {
    if (throttled('stack', 0.035)) return
    tone(480 + Math.min(n, 30) * 26, 0.05, { type: 'triangle', vol: 0.09, slide: 120 })
  },
  /** item leaves a stack — pitch falls as it empties */
  unstack(n: number) {
    if (throttled('unstack', 0.035)) return
    tone(380 + Math.min(n, 30) * 22, 0.045, { type: 'triangle', vol: 0.08, slide: -60 })
  },
  whoosh() {
    if (throttled('whoosh', 0.25)) return
    noise(0.18, { vol: 0.12, freq: 1600, q: 0.7 })
  },
  pop() {
    if (throttled('pop', 0.05)) return
    tone(520, 0.09, { type: 'triangle', vol: 0.14, slide: 300 })
  },
  chop() {
    if (throttled('chop', 0.08)) return
    noise(0.09, { vol: 0.28, freq: 320, q: 1.2 })
    tone(140, 0.08, { type: 'triangle', vol: 0.16, slide: -60 })
  },
  thud() {
    if (throttled('thud', 0.08)) return
    noise(0.08, { vol: 0.24, freq: 200, q: 1 })
    tone(90, 0.1, { type: 'sine', vol: 0.2, slide: -40 })
  },
  thwip() {
    if (throttled('thwip', 0.05)) return
    noise(0.06, { vol: 0.16, freq: 2400, q: 2 })
    tone(700, 0.05, { type: 'sawtooth', vol: 0.03, slide: -400 })
  },
  hit() {
    if (throttled('hit', 0.05)) return
    noise(0.06, { vol: 0.2, freq: 900, q: 1.4 })
  },
  kill() {
    if (throttled('kill', 0.1)) return
    tone(300, 0.14, { type: 'triangle', vol: 0.14, slide: -160 })
    noise(0.12, { vol: 0.14, freq: 500 })
  },
  pick() {
    if (throttled('pick', 0.06)) return
    tone(660, 0.06, { type: 'triangle', vol: 0.1, slide: 200 })
  },
  deposit() {
    if (throttled('deposit', 0.06)) return
    tone(420, 0.06, { type: 'triangle', vol: 0.1, slide: 140 })
  },
  sizzle() {
    if (throttled('sizzle', 0.4)) return
    noise(0.3, { vol: 0.05, freq: 4000, q: 0.6 })
  },
  buy() {
    if (throttled('buy', 0.2)) return
    tone(523, 0.12, { type: 'triangle', vol: 0.14 })
    tone(659, 0.12, { type: 'triangle', vol: 0.14, delay: 0.08 })
    tone(784, 0.2, { type: 'triangle', vol: 0.14, delay: 0.16 })
  },
  build() {
    if (throttled('build', 0.2)) return
    noise(0.25, { vol: 0.25, freq: 250, q: 0.8 })
    tone(120, 0.25, { type: 'sine', vol: 0.2, slide: -40 })
  },
  milestone() {
    if (throttled('milestone', 0.5)) return
    tone(523, 0.15, { type: 'sine', vol: 0.16 })
    tone(659, 0.15, { type: 'sine', vol: 0.16, delay: 0.1 })
    tone(784, 0.15, { type: 'sine', vol: 0.16, delay: 0.2 })
    tone(1046, 0.3, { type: 'sine', vol: 0.16, delay: 0.3 })
  },
  tick() {
    if (throttled('tick', 0.09)) return
    tone(980, 0.04, { type: 'square', vol: 0.03 })
  },
  tip() {
    if (throttled('tip', 0.08)) return
    tone(1320, 0.06, { type: 'square', vol: 0.035 })
    tone(1760, 0.09, { type: 'square', vol: 0.035, delay: 0.05 })
  },
  combo() {
    if (throttled('combo', 0.3)) return
    chord([660, 880, 1100, 1320], 0.06, 0.14, 'triangle', 0.12)
  },
  angry() {
    if (throttled('angry', 0.25)) return
    tone(190, 0.22, { type: 'sawtooth', vol: 0.05, slide: -70 })
  },
  stitch() {
    if (throttled('stitch', 0.35)) return
    tone(1900, 0.03, { type: 'square', vol: 0.018 })
    tone(1600, 0.03, { type: 'square', vol: 0.018, delay: 0.09 })
  },
  howl() {
    if (throttled('howl', 2)) return
    sweep([[0, 330], [0.45, 560], [1.1, 520], [1.6, 300]], 1.7, { vol: 0.07 })
    sweep([[0, 336], [0.5, 572], [1.1, 512], [1.6, 310]], 1.7, { vol: 0.035, delay: 0.06 })
  },
  growl() {
    if (throttled('growl', 0.2)) return
    noise(0.28, { vol: 0.2, freq: 170, q: 2.2 })
    tone(85, 0.28, { type: 'sawtooth', vol: 0.05 })
  },
  wolfKill() {
    if (throttled('wolfKill', 0.12)) return
    tone(560, 0.16, { type: 'triangle', vol: 0.13, slide: -340 })
    noise(0.12, { vol: 0.14, freq: 600 })
  },
  nightfall() {
    if (throttled('nightfall', 1)) return
    chord([196, 233, 147], 0.18, 0.9, 'sine', 0.11)
  },
  dawn() {
    if (throttled('dawn', 1)) return
    chord([392, 494, 587, 784], 0.1, 0.5, 'sine', 0.12)
  },
  bell() {
    if (throttled('bell', 1)) return
    tone(880, 0.7, { type: 'sine', vol: 0.1 })
    tone(1318, 0.5, { type: 'sine', vol: 0.04, delay: 0.02 })
    tone(880, 0.7, { type: 'sine', vol: 0.1, delay: 0.38 })
  },
  fanfare() {
    if (throttled('fanfare', 1)) return
    chord([523, 659, 784, 1046, 1318], 0.09, 0.3, 'triangle', 0.13)
  },
  levelUp() {
    if (throttled('levelUp', 0.6)) return
    chord([659, 784, 988, 1318], 0.08, 0.35, 'triangle', 0.14)
    chord([330, 392, 494, 659], 0.08, 0.35, 'sine', 0.08)
  },
  lock() {
    if (throttled('lock', 0.4)) return
    tone(240, 0.08, { type: 'square', vol: 0.04 })
    tone(200, 0.1, { type: 'square', vol: 0.04, delay: 0.08 })
  },
}
