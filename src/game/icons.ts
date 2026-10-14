import type { ResKind, StationId, WorkerRole } from './types'

export const RES_ICON: Record<ResKind, string> = {
  log: '🪵',
  raw: '🥩',
  cooked: '🍗',
  hide: '🐾',
  coat: '🧥',
}

export const RES_NAME: Record<ResKind, string> = {
  log: 'logs',
  raw: 'raw meat',
  cooked: 'food',
  hide: 'hides',
  coat: 'coats',
}

export const NEED_ICON: Record<StationId, string> = {
  wood: '🪵',
  meat: '🍖',
  coat: '🧥',
}

export const ROLE_ICON: Record<WorkerRole, string> = {
  collector: '🧺',
  cook: '🍳',
  runner: '🏃',
  cashier: '💰',
  lumberjack: '🪓',
  logCarrier: '🪵',
  guard: '🛡️',
  tailor: '🧵',
  coatRunner: '🧥',
}
