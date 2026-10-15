// POST /api/save — online save / load by save name + password (see _cloud.js).
// Needs a Redis store: add Upstash Redis to the Vercel project (Storage tab),
// which sets KV_REST_API_URL and KV_REST_API_TOKEN.

import { handleCloud, upstashStore } from './_cloud.js'

export async function POST(request) {
  const store = upstashStore()
  if (!store) return Response.json({ error: 'Online saves are not set up on this server yet' }, { status: 503 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  try {
    const { status, json } = await handleCloud(body, ip, store)
    return Response.json(json, { status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Server error, try again' }, { status: 500 })
  }
}
