import { create } from 'zustand'

export type Quality = 'low' | 'medium' | 'high'

function autoQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high'
  const touch = 'ontouchstart' in window
  const cores = navigator.hardwareConcurrency ?? 4
  if (touch && cores <= 4) return 'low'
  if (touch) return 'medium'
  return 'high'
}

export interface UIState {
  money: number
  objectiveText: string
  objectiveFlash: boolean
  level: number
  xpFrac: number
  rushN: number
  rushMult: number
  rushFrac: number
  clockOn: boolean
  night: boolean
  day: number
  clockFrac: number
  wolves: number
  dark: number
  caravanState: string
  caravanText: string
  caravanTime: number
  caravanFrac: number
  bannerId: number
  bannerText: string
  bannerSub: string
  bannerTone: string
  muted: boolean
  quality: Quality
  debugOpen: boolean
  set: (p: Partial<UIState>) => void
}

export const useUI = create<UIState>((set) => ({
  money: 0,
  objectiveText: '',
  objectiveFlash: false,
  level: 1,
  xpFrac: 0,
  rushN: 0,
  rushMult: 1,
  rushFrac: 0,
  clockOn: false,
  night: false,
  day: 1,
  clockFrac: 0,
  wolves: 0,
  dark: 0,
  caravanState: 'away',
  caravanText: '',
  caravanTime: 0,
  caravanFrac: 0,
  bannerId: 0,
  bannerText: '',
  bannerSub: '',
  bannerTone: 'info',
  muted: false,
  quality: autoQuality(),
  debugOpen: false,
  set: (p) => set(p),
}))
