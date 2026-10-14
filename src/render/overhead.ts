// Shared builder for overhead conveyors (cash belts and the Industrial Park
// export lines): a chevron belt on posts at height `h`, a glass lift tower at
// each end, and posts that skip anything standing on the ground below.

import * as THREE from 'three'
import type { V2 } from '../game/types'
import { sim } from '../game/state'
import { STATION_IDS, PARK, TERMINAL_IDS } from '../game/balance'
import { frameMat, railMats, legMat, stripeCanvas } from './BeltsView'

export const STRIPE = 0.5

export interface Obstacle {
  x: number
  z: number
  r: number
}

/** circles on the ground a support post must not land in */
export function groundObstacles(): Obstacle[] {
  const out: Obstacle[] = []
  for (const p of sim.pads) out.push({ x: p.pos.x, z: p.pos.z, r: 1.65 })
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    for (const dx of [-1.2, 0, 1.2]) out.push({ x: st.pos.x + dx, z: st.pos.z, r: 1.0 })
    out.push({ x: st.restock.x, z: st.restock.z, r: 1.0 })
    for (let i = 0; i < st.queueSize; i++) {
      out.push({
        x: st.queueBase.x + st.queueDir.x * st.queueSpacing * i,
        z: st.queueBase.z + st.queueDir.z * st.queueSpacing * i,
        r: 0.7,
      })
    }
  }
  for (const pr of Object.values(sim.proc)) {
    const big = pr.pos.z > 34
    out.push(
      { x: pr.pos.x, z: pr.pos.z, r: big ? 3.4 : 1.4 },
      { x: pr.inZone.x, z: pr.inZone.z, r: 1.0 },
      { x: pr.outZone.x, z: pr.outZone.z, r: 1.0 },
    )
  }
  for (const id of TERMINAL_IDS) out.push({ x: sim.terminals[id].pos.x, z: sim.terminals[id].pos.z, r: 4 })
  for (const b of Object.values(sim.belts)) for (const p of b.path) out.push({ x: p.x, z: p.z, r: 0.8 })
  for (const p of sim.piles) out.push({ x: p.pos.x, z: p.pos.z, r: 0.9 })
  for (const t of sim.trees) out.push({ x: t.pos.x, z: t.pos.z, r: 0.8 })
  out.push(
    { x: 0, z: -2, r: 1.3 },
    { x: sim.chest.pos.x, z: sim.chest.pos.z, r: 0.9 },
    { x: 0, z: 18, r: 2.8 },
    { x: PARK.vault.x, z: PARK.vault.z, r: 1.6 },
  )
  // the caravan's road and the truck lanes
  for (let x = -34; x <= -12; x += 1.5) out.push({ x, z: 17.6, r: 1.6 })
  for (let x = -40; x <= -16; x += 1.5) out.push({ x, z: (PARK.truckLaneZ + PARK.truckOutZ) / 2, r: 2.6 })
  return out
}

function blocked(obs: Obstacle[], x: number, z: number) {
  return obs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)
}

/** a chevron belt surface: its texture scrolls to show the belt moving */
export function beltSurface(): { mat: THREE.MeshStandardMaterial; tex: THREE.CanvasTexture } {
  const tex = new THREE.CanvasTexture(stripeCanvas())
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return { mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), tex }
}

export interface OverheadOpts {
  width: number
  glass: THREE.Material
  cap: THREE.Material
  rail?: THREE.Material
  /** share one scrolling belt surface between several belts (one draw call when merged) */
  top?: { mat: THREE.Material; tex: THREE.Texture }
}

function liftTower(at: V2, root: THREE.Group, topY: number, o: OverheadOpts) {
  const g = new THREE.Group()
  g.position.set(at.x, 0, at.z)
  for (const [dx, dz] of [
    [-0.28, -0.28],
    [0.28, -0.28],
    [-0.28, 0.28],
    [0.28, 0.28],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, topY + 0.15, 0.07), legMat)
    post.position.set(dx, (topY + 0.15) / 2, dz)
    g.add(post)
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.5, topY - 0.4, 0.5), o.glass)
  glass.position.y = 0.4 + (topY - 0.4) / 2
  g.add(glass)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), o.cap)
  cap.position.y = topY + 0.2
  g.add(cap)
  root.add(g)
}

/**
 * The belt's static structure (and its rails, whose material shows the level).
 * `dists` are the cumulative ground distances along `path`.
 */
export function buildOverhead(path: V2[], dists: number[], H: number, obs: Obstacle[], o: OverheadOpts) {
  const W = o.width
  const root = new THREE.Group()
  const { mat: topMat, tex } = o.top ?? beltSurface()
  const rails: THREE.Mesh[] = []

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const c = path[i]
    const len = Math.hypot(c.x - a.x, c.z - a.z)
    const seg = new THREE.Group()
    seg.position.set((a.x + c.x) / 2, 0, (a.z + c.z) / 2)
    seg.rotation.y = Math.atan2(c.x - a.x, c.z - a.z)
    root.add(seg)
    const full = len + W
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, full), frameMat)
    frame.position.y = H - 0.1
    frame.castShadow = true
    seg.add(frame)
    const topGeo = new THREE.PlaneGeometry(W * 0.84, full)
    topGeo.rotateX(-Math.PI / 2)
    topGeo.rotateY(Math.PI)
    const uv = topGeo.attributes.uv as THREE.BufferAttribute
    const offset = (dists[i - 1] - W / 2) / STRIPE
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (full / STRIPE) + offset)
    const top = new THREE.Mesh(topGeo, topMat)
    top.position.y = H - 0.035
    seg.add(top)
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, full), o.rail ?? railMats[0])
      rail.position.set(s * (W / 2 - 0.02), H + 0.02, 0)
      seg.add(rail)
      rails.push(rail)
    }
    // support posts every ~4 m, nudged or skipped where something stands below
    const n = Math.max(1, Math.round(len / 4))
    for (let k = 1; k < n; k++) {
      for (const shift of [0, 0.8, -0.8, 1.6, -1.6]) {
        const t = Math.min(1, Math.max(0, k / n + shift / len))
        const x = a.x + (c.x - a.x) * t
        const z = a.z + (c.z - a.z) * t
        if (blocked(obs, x, z)) continue
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.15, 0.12), legMat)
        post.position.set(x, (H - 0.15) / 2, z)
        root.add(post)
        break
      }
    }
  }
  // corner posts carry the bends
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i]
    if (blocked(obs, p.x, p.z)) continue
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.15, 0.12), legMat)
    post.position.set(p.x, (H - 0.15) / 2, p.z)
    root.add(post)
  }
  liftTower(path[0], root, H, o)
  liftTower(path[path.length - 1], root, H, o)
  return { root, tex, rails }
}
