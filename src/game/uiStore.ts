import { create } from 'zustand'

export type Quality = 'low' | 'medium' | 'high'

function autoQuality(): Quality {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'high'
  const touch = 'ontouchstart' in window
  // WebKit (every iOS browser, Edge and Chrome included) under-reports
  // hardwareConcurrency, so the core count says nothing about an iPhone's GPU.
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) return 'medium'
  const cores = navigator.hardwareConcurrency ?? 4
  if (touch && cores <= 4) return 'low'
  if (touch) return 'medium'
  return 'high'
}

export interface TaskView {
  id: number
  text: string
  frac: number
  progress: string
  reward: string
  done: boolean
}

export interface NoticeView {
  id: number
  text: string
  sub: string
  tone: string
  ago: string
}

/** which HUD dropdown / panel is open ('' = none) */
export type Panel = '' | 'alerts' | 'tasks' | 'shop'

export interface UIState {
  settlementRun: number
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
  /** Industrial Park: the docked ship / parked plane order (shown while you're in the park) */
  inPark: boolean
  shipText: string
  shipTime: number
  planeText: string
  planeTime: number
  bannerId: number
  bannerText: string
  bannerSub: string
  bannerTone: string
  stars: number
  freeStars: number
  starBonus: number
  notices: NoticeView[]
  noticesKey: string
  latestNotice: number
  seenNotice: number
  panel: Panel
  /** the running event (empty when none) */
  eventIcon: string
  eventName: string
  eventFrac: number
  eventLeft: number
  /** boss health bar (empty when no boss) */
  bossName: string
  bossFrac: number
  bossHp: string
  /** Frost Stars a move would earn right now (0 before the mine) */
  pendingStars: number
  offlineAmount: number
  offlineSeconds: number
  offlineDouble: boolean
  moving: boolean
  movingStars: number
  /** '' = no furnace yet */
  furnace: '' | 'cold' | 'lit'
  furnaceBonus: number
  furnaceFrac: number
  tasks: TaskView[]
  tasksKey: string
  muted: boolean
  quality: Quality
  debugOpen: boolean
  set: (p: Partial<UIState>) => void
}

export const useUI = create<UIState>((set) => ({
  settlementRun: 0,
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
  inPark: false,
  shipText: '',
  shipTime: 0,
  planeText: '',
  planeTime: 0,
  bannerId: 0,
  bannerText: '',
  bannerSub: '',
  bannerTone: 'info',
  stars: 0,
  freeStars: 0,
  starBonus: 0,
  notices: [],
  noticesKey: '',
  latestNotice: 0,
  seenNotice: 0,
  panel: '',
  eventIcon: '',
  eventName: '',
  eventFrac: 0,
  eventLeft: 0,
  bossName: '',
  bossFrac: 0,
  bossHp: '',
  pendingStars: 0,
  offlineAmount: 0,
  offlineSeconds: 0,
  offlineDouble: false,
  moving: false,
  movingStars: 0,
  furnace: '',
  furnaceBonus: 0,
  furnaceFrac: 0,
  tasks: [],
  tasksKey: '',
  muted: false,
  quality: autoQuality(),
  debugOpen: false,
  set: (p) => set(p),
}))
