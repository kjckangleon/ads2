// Online saves: a save name + password stores the game so another device can load it.
// Shared by the Vercel function (api/save.js, Upstash Redis) and the Vite dev server
// (an in-memory store). Files starting with "_" in /api are not deployed as routes.
//
// Passwords are never stored: each save keeps a random salt and a scrypt hash.

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'

const NAME_RE = /^[a-z0-9_-]{3,20}$/
const MAX_SAVE = 400_000
/** requests per IP per minute */
const RATE = 30
/** wrong passwords per save name before it's locked for a while */
const MAX_FAILS = 8
const FAIL_WINDOW = 15 * 60

function hash(password, salt) {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key))))
}

async function verify(rec, password) {
  const want = Buffer.from(rec.hash, 'hex')
  const got = await hash(password, Buffer.from(rec.salt, 'hex'))
  return want.length === got.length && timingSafeEqual(want, got)
}

const fail = (status, error) => ({ status, json: { error } })

/**
 * @param {any} body  { action: 'save' | 'load', name, password, data? }
 * @param {string} ip
 * @param {{ get(k: string): Promise<string | null>, set(k: string, v: string): Promise<void>, incr(k: string, ttl: number): Promise<number> }} store
 */
export async function handleCloud(body, ip, store) {
  if (!body || typeof body !== 'object') return fail(400, 'Bad request')
  const action = body.action
  if (action !== 'save' && action !== 'load') return fail(400, 'Bad request')
  const name = typeof body.name === 'string' ? body.name.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!NAME_RE.test(name)) return fail(400, 'Save name: 3-20 letters, numbers, - or _')
  if (password.length < 4 || password.length > 64) return fail(400, 'Password: 4-64 characters')

  if ((await store.incr(`fl:rl:${ip}`, 60)) > RATE) return fail(429, 'Too many tries, wait a minute')
  const failKey = `fl:fail:${name}`
  const fails = Number((await store.get(failKey)) ?? 0)
  if (fails >= MAX_FAILS) return fail(429, 'Too many wrong passwords, try again in 15 minutes')

  const key = `fl:save:${name}`
  const raw = await store.get(key)
  const rec = raw ? JSON.parse(raw) : null

  if (action === 'load') {
    if (!rec) return fail(404, 'No online save with that name')
    if (!(await verify(rec, password))) {
      await store.incr(failKey, FAIL_WINDOW)
      return fail(401, 'Wrong password')
    }
    return { status: 200, json: { data: rec.data, savedAt: rec.savedAt } }
  }

  // save
  const data = body.data
  if (typeof data !== 'string' || data.length > MAX_SAVE) return fail(400, 'Save is missing or too big')
  try {
    const parsed = JSON.parse(data)
    if (!parsed || typeof parsed.v !== 'number') throw new Error('not a save')
  } catch {
    return fail(400, 'That is not a FROSTLINE save')
  }
  let salt, digest
  if (rec) {
    if (!(await verify(rec, password))) {
      await store.incr(failKey, FAIL_WINDOW)
      return fail(401, 'That name is taken (or the password is wrong)')
    }
    salt = rec.salt
    digest = rec.hash
  } else {
    const s = randomBytes(16)
    salt = s.toString('hex')
    digest = (await hash(password, s)).toString('hex')
  }
  const savedAt = Date.now()
  await store.set(key, JSON.stringify({ salt, hash: digest, data, savedAt }))
  return { status: 200, json: { ok: true, created: !rec, savedAt } }
}

/** Upstash Redis over its REST API (what Vercel's Redis/KV integration provides), or null if not set up */
export function upstashStore(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const call = async (path, body) => {
    const res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`redis ${res.status}`)
    return res.json()
  }
  return {
    async get(k) {
      return (await call('', ['GET', k])).result ?? null
    },
    async set(k, v) {
      await call('', ['SET', k, v])
    },
    async incr(k, ttl) {
      const n = Number((await call('', ['INCR', k])).result)
      // the window starts with the first hit
      if (n === 1) await call('', ['EXPIRE', k, String(ttl)])
      return n
    },
  }
}

/** in-memory store for the dev server */
export function memoryStore() {
  const m = new Map()
  const live = (k) => {
    const e = m.get(k)
    if (e && e.exp && e.exp < Date.now()) m.delete(k)
    return m.get(k)
  }
  return {
    async get(k) {
      return live(k)?.v ?? null
    },
    async set(k, v) {
      m.set(k, { v, exp: 0 })
    },
    async incr(k, ttl) {
      const e = live(k)
      const n = Number(e?.v ?? 0) + 1
      m.set(k, { v: String(n), exp: e?.exp || Date.now() + ttl * 1000 })
      return n
    },
  }
}
