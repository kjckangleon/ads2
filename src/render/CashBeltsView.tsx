// Overhead cash belts: bundles of bills climb a lift tower off each stall's
// pay pile, ride a chevron belt above the camp on posts, and drop down a
// second tower into the chest. Posts skip anything on the ground below.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { StationId, V2 } from '../game/types'
import { BELT, CASH_BELT, STATION_IDS, beltSpeed } from '../game/balance'
import { cashPoint } from '../game/systems/belts'
import { billGeo, billMat } from './PilesView'
import { frameMat, railMats, legMat, stripeCanvas } from './BeltsView'
import { PopIn } from './anim'

const H = CASH_BELT.height
const W = 0.62
const STRIPE = 0.5
const glassMat = new THREE.MeshStandardMaterial({
  color: '#9fe0a0',
  transparent: true,
  opacity: 0.18,
  roughness: 0.2,
  depthWrite: false,
})
const capMat = new THREE.MeshStandardMaterial({ color: '#47a85a', roughness: 0.5, metalness: 0.3 })

/** circles on the ground a support post must not land in */
function groundObstacles(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = []
  for (const p of sim.pads) out.push({ x: p.pos.x, z: p.pos.z, r: 1.65 })
  for (const id of STATION_IDS) {
    const st = sim.stations[id]
    for (const dx of [-1.2, 0, 1.2]) out.push({ x: st.pos.x + dx, z: st.pos.z, r: 1.0 })
    out.push({ x: st.restock.x, z: st.restock.z, r: 1.0 })
    for (let i = 0; i < st.queueSize; i++) {
      out.push({ x: st.queueBase.x + st.queueDir.x * st.queueSpacing * i, z: st.queueBase.z + st.queueDir.z * st.queueSpacing * i, r: 0.7 })
    }
  }
  for (const pr of Object.values(sim.proc)) {
    out.push({ x: pr.pos.x, z: pr.pos.z, r: 1.4 }, { x: pr.inZone.x, z: pr.inZone.z, r: 1.0 }, { x: pr.outZone.x, z: pr.outZone.z, r: 1.0 })
  }
  for (const b of Object.values(sim.belts)) for (const p of b.path) out.push({ x: p.x, z: p.z, r: 0.8 })
  for (const p of sim.piles) out.push({ x: p.pos.x, z: p.pos.z, r: 0.9 })
  for (const t of sim.trees) out.push({ x: t.pos.x, z: t.pos.z, r: 0.8 })
  out.push({ x: 0, z: -2, r: 1.3 }, { x: sim.chest.pos.x, z: sim.chest.pos.z, r: 0.9 }, { x: 0, z: 18, r: 2.8 })
  return out
}

function blocked(obs: { x: number; z: number; r: number }[], x: number, z: number) {
  return obs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)
}

function liftTower(at: V2, root: THREE.Group, topY: number) {
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
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.5, topY - 0.4, 0.5), glassMat)
  glass.position.y = 0.4 + (topY - 0.4) / 2
  g.add(glass)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), capMat)
  cap.position.y = topY + 0.2
  g.add(cap)
  root.add(g)
}

function buildCashBelt(id: StationId, obs: { x: number; z: number; r: number }[]) {
  const b = sim.cash.belts[id]
  const root = new THREE.Group()
  const tex = new THREE.CanvasTexture(stripeCanvas())
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
  const rails: THREE.Mesh[] = []

  for (let i = 1; i < b.path.length; i++) {
    const a = b.path[i - 1]
    const c = b.path[i]
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
    const offset = (b.dists[i - 1] - W / 2) / STRIPE
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (full / STRIPE) + offset)
    const top = new THREE.Mesh(topGeo, topMat)
    top.position.y = H - 0.035
    seg.add(top)
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, full), railMats[0])
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
  for (let i = 1; i < b.path.length - 1; i++) {
    const p = b.path[i]
    if (blocked(obs, p.x, p.z)) continue
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.15, 0.12), legMat)
    post.position.set(p.x, (H - 0.15) / 2, p.z)
    root.add(post)
  }
  liftTower(b.path[0], root, H)
  liftTower(b.path[b.path.length - 1], root, H)

  const max = Math.ceil(b.length / BELT.spacing) + 2
  const items = new THREE.InstancedMesh(billGeo(), billMat, max)
  items.count = 0
  items.frustumCulled = false
  items.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  root.add(items)
  return { root, tex, rails, items }
}

function CashBeltView({ id }: { id: StationId }) {
  const v = useMemo(() => buildCashBelt(id, groundObstacles()), [id])
  const pop = useMemo(() => new PopIn(0.8), [])
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(1, 1, 1),
      up: new THREE.Vector3(0, 1, 0),
      at: { x: 0, y: 0, z: 0, yaw: 0 },
      lvl: -1,
    }),
    [],
  )

  useFrame((_, dt) => {
    const cash = sim.cash
    const on = cash.level > 0 && sim.stations[id].unlocked
    const s = pop.update(on, sim.time)
    v.root.visible = s > 0.01
    if (!on) return
    v.root.scale.set(1, Math.max(s, 0.001), 1)
    v.tex.offset.y -= (beltSpeed(cash.level) * 1.2 * Math.min(dt, 0.05)) / STRIPE
    if (tmp.lvl !== cash.level) {
      tmp.lvl = cash.level
      for (const r of v.rails) r.material = railMats[Math.min(railMats.length - 1, cash.level - 1)]
    }
    const b = cash.belts[id]
    const n = Math.min(b.items.length, v.items.instanceMatrix.count)
    for (let i = 0; i < n; i++) {
      cashPoint(b, b.items[i], tmp.at)
      tmp.q.setFromAxisAngle(tmp.up, tmp.at.yaw + Math.PI / 2)
      tmp.p.set(tmp.at.x, tmp.at.y + 0.08, tmp.at.z)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      v.items.setMatrixAt(i, tmp.m)
    }
    v.items.count = n
    v.items.instanceMatrix.needsUpdate = true
  })

  return <primitive object={v.root} />
}

export function CashBeltsView() {
  return (
    <group>
      {STATION_IDS.map((id) => (
        <CashBeltView key={id} id={id} />
      ))}
    </group>
  )
}
