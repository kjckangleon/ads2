// Stale-build guard for phones: mobile browsers (and home-screen web apps)
// happily keep serving yesterday's page. version.json is fetched uncached; if
// it names a different build than the one running, save and reload onto it.

import { sim } from './state'
import { saveNow } from './save'

const CHECK_EVERY = 3 * 60 * 1000
const RELOAD_KEY = 'frostline-reloaded-for'

async function check() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { id } = (await res.json()) as { id?: string }
    if (!id || id === __BUILD_ID__) return
    // one reload per new build: if the page is still stale after it, don't loop
    if (sessionStorage.getItem(RELOAD_KEY) === id) return
    sessionStorage.setItem(RELOAD_KEY, id)
    if (sim.moving > 0) return
    saveNow(sim)
    const url = new URL(window.location.href)
    url.searchParams.set('v', id)
    window.location.replace(url.toString())
  } catch {
    // offline or blocked: keep playing the build we have
  }
}

export function watchForUpdates() {
  if (import.meta.env.DEV) return
  setTimeout(check, 2000)
  setInterval(check, CHECK_EVERY)
  // phones resume suspended tabs instead of reloading them
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}
