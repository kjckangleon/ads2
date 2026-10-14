import type { ResKind, StationId, WorkerRole } from './types'

export const RES_ICON: Record<ResKind, string> = {
  log: '🪵',
  raw: '🥩',
  cooked: '🍗',
  hide: '🐾',
  coat: '🧥',
  fish: '🐟',
  smoked: '🍣',
  coal: '🪨',
  furniture: '🪑',
  steel: '🔩',
  jacket: '🧥',
  canned: '🥫',
}

export const RES_NAME: Record<ResKind, string> = {
  log: 'logs',
  raw: 'raw meat',
  cooked: 'food',
  hide: 'hides',
  coat: 'coats',
  fish: 'fish',
  smoked: 'smoked fish',
  coal: 'coal',
  furniture: 'furniture',
  steel: 'steel',
  jacket: 'designer jackets',
  canned: 'canned fish',
}

export const NEED_ICON: Record<StationId, string> = {
  wood: '🪵',
  meat: '🍖',
  coat: '🧥',
  fish: '🐟',
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
  fisher: '🎣',
  smoker: '🔥',
  fishRunner: '🐟',
  miner: '⛏️',
  coalCarrier: '🪨',
}
