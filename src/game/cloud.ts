// Online saves: upload this device's game under a save name + password, and
// load it on any other device (see api/save.js). Only the name is remembered here.

import { sim } from './state'
import { readRawSave, installSave } from './save'

const NAME_KEY = 'frostline-cloud-name'

export function lastCloudName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function remember(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim().toLowerCase())
  } catch {
    // private mode: fine, just not remembered
  }
}

async function call(body: object): Promise<any> {
  let res: Response
  try {
    res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No connection, try again')
  }
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // not JSON (e.g. no server route)
  }
  if (!res.ok || !json) throw new Error(json?.error ?? 'Online saves are not available right now')
  return json
}

/** upload the current game; resolves to a message to show */
export async function cloudSave(name: string, password: string): Promise<string> {
  const data = readRawSave(sim)
  if (!data) throw new Error("Couldn't read this game's save")
  const r = await call({ action: 'save', name, password, data })
  remember(name)
  return r.created ? `☁️ Saved online as "${name.trim().toLowerCase()}"` : '☁️ Online save updated'
}

/** download a save and restart on it (the page reloads) */
export async function cloudLoad(name: string, password: string): Promise<void> {
  const r = await call({ action: 'load', name, password })
  remember(name)
  if (typeof r.data !== 'string' || !installSave(r.data)) throw new Error('That save could not be loaded')
}
