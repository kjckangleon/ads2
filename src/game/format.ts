/** Compact money: 950, 1.2K, 34K, 1.5M. */
export function fmt(n: number): string {
  const v = Math.floor(n)
  if (v < 1000) return String(v)
  if (v < 1e6) return trim(v / 1e3, v < 1e4) + 'K'
  if (v < 1e9) return trim(v / 1e6, v < 1e7) + 'M'
  // endless upgrades and prestige push past billions
  const units = ['B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']
  let u = 0
  let x = v / 1e9
  while (x >= 1000 && u < units.length - 1) {
    x /= 1000
    u++
  }
  return trim(x, x < 10) + units[u]
}

function trim(x: number, oneDecimal: boolean) {
  return oneDecimal ? (Math.floor(x * 10) / 10).toString() : Math.floor(x).toString()
}
