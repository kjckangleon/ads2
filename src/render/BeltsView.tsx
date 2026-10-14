// Conveyor belts: a chevron-striped rubber belt scrolling at the real belt
// speed, steel rails and legs, a hopper at the loading end, and every item
// riding it as one instance. Belts spring up when bought.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { BeltId } from '../game/types'
import { BELT, ALL_BELT_IDS, beltSpeed } from '../game/balance'
import { beltPoint } from '../game/systems/belts'
import { makeCarryItem } from './characters'
import { PopIn, Squash } from './anim'
import { mergeStatic } from './rutil'

const W = BELT.width
const TOP = 0.22
/** world length of one chevron on the belt */
const STRIPE = 0.5

export const frameMat = new THREE.MeshStandardMaterial({ color: '#4a525e', roughness: 0.6, metalness: 0.4 })
export const railMats = [
  new THREE.MeshStandardMaterial({ color: '#9aa4b2', roughness: 0.4, metalness: 0.6 }),
  new THREE.MeshStandardMaterial({ color: '#7fc4e8', roughness: 0.4, metalness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: '#e8bb4a', roughness: 0.35, metalness: 0.6 }),
]
export const legMat = new THREE.MeshStandardMaterial({ color: '#363c46', roughness: 0.7, metalness: 0.3 })
const hopperMat = new THREE.MeshStandardMaterial({ color: '#c0563f', roughness: 0.6, metalness: 0.2 })

let stripeImage: HTMLCanvasElement | null = null
export function stripeCanvas(): HTMLCanvasElement {
  if (stripeImage) return stripeImage
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2b3038'
  ctx.fillRect(0, 0, 64, 64)
  // chevron pointing to the top of the canvas = +v = direction of travel
  ctx.strokeStyle = '#5d6672'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(10, 46)
  ctx.lineTo(32, 22)
  ctx.lineTo(54, 46)
  ctx.stroke()
  stripeImage = c
  return c
}

interface BeltVisual {
  root: THREE.Group
  tex: THREE.CanvasTexture
  rails: THREE.Mesh[]
  items: THREE.InstancedMesh
  endCap: THREE.Group
}

function buildBelt(id: BeltId): BeltVisual {
  const b = sim.belts[id]
  const root = new THREE.Group()
  const tex = new THREE.CanvasTexture(stripeCanvas())
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
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

    // overlap half a width at each end so corners join cleanly
    const full = len + W
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, full), frameMat)
    frame.position.y = TOP - 0.09
    frame.castShadow = true
    frame.receiveShadow = true
    seg.add(frame)

    const topGeo = new THREE.PlaneGeometry(W * 0.84, full)
    topGeo.rotateX(-Math.PI / 2)
    topGeo.rotateY(Math.PI) // +v now runs along +z, the direction of travel
    const uv = topGeo.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (full / STRIPE))
    // keep chevrons continuous from one segment to the next
    const offset = (b.dists[i - 1] - W / 2) / STRIPE
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) + offset)
    const top = new THREE.Mesh(topGeo, topMat)
    top.position.y = TOP + 0.002
    top.receiveShadow = true
    seg.add(top)

    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, full), railMats[0])
      rail.position.set(s * (W / 2 - 0.02), TOP + 0.05, 0)
      seg.add(rail)
      rails.push(rail)
    }
    const legs = Math.max(1, Math.round(len / 1.6))
    for (let k = 0; k <= legs; k++) {
      const z = -len / 2 + (len * k) / legs
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, TOP - 0.1, 0.08), legMat)
        leg.position.set(s * (W / 2 - 0.08), (TOP - 0.1) / 2, z)
        seg.add(leg)
      }
    }
  }

  // loading hopper at the source end
  const start = b.path[0]
  const second = b.path[1]
  const hopper = new THREE.Group()
  hopper.position.set(start.x, 0, start.z)
  hopper.rotation.y = Math.atan2(second.x - start.x, second.z - start.z)
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.45, 4, 1, true), hopperMat)
  funnel.rotation.y = Math.PI / 4
  funnel.position.y = TOP + 0.45
  hopper.add(funnel)
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, TOP + 0.5, 0.07), legMat)
    post.position.set(s * 0.42, (TOP + 0.5) / 2, 0)
    hopper.add(post)
  }
  root.add(hopper)

  // squashy drop lip at the delivery end
  const end = b.path[b.path.length - 1]
  const prev = b.path[b.path.length - 2]
  const endCap = new THREE.Group()
  endCap.position.set(end.x, 0, end.z)
  endCap.rotation.y = Math.atan2(end.x - prev.x, end.z - prev.z)
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.2, 0.14), railMats[0])
  lip.position.set(0, TOP + 0.08, W / 2 + 0.05)
  endCap.add(lip)
  root.add(endCap)

  const proto = makeCarryItem(b.kind)
  const max = Math.ceil(b.length / BELT.spacing) + 2
  const items = new THREE.InstancedMesh(proto.geometry, proto.material, max)
  items.count = 0
  items.castShadow = true
  items.frustumCulled = false
  items.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  root.add(items)

  // bake the static frame / legs / hopper, then the rails (their material shows the level)
  const keep = new Set<THREE.Object3D>([items, endCap, ...rails])
  mergeStatic(root, (o) => !keep.has(o))
  // second pass: only the rails (and the segment groups holding them)
  const railSet = new Set<THREE.Object3D>([...rails, ...rails.map((r) => r.parent!)])
  const bakedRails = mergeStatic(root, (o) => railSet.has(o))
  return { root, tex, rails: bakedRails, items, endCap }
}

function BeltView({ id }: { id: BeltId }) {
  const v = useMemo(() => buildBelt(id), [id])
  const pop = useMemo(() => new PopIn(0.8), [])
  const squash = useMemo(() => new Squash(), [])
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(1, 1, 1),
      up: new THREE.Vector3(0, 1, 0),
      at: { x: 0, z: 0, yaw: 0 },
      lastLevel: -1,
    }),
    [],
  )

  useFrame((_, dt) => {
    const b = sim.belts[id]
    const s = pop.update(b.level > 0, sim.time)
    v.root.visible = s > 0.01
    if (b.level <= 0) return
    v.root.scale.set(1, Math.max(s, 0.001), 1)

    // the surface scrolls at the real belt speed (items queue up on it when the stall is full)
    v.tex.offset.y -= (beltSpeed(b.level) * Math.min(dt, 0.05)) / STRIPE

    if (tmp.lastLevel !== b.level) {
      tmp.lastLevel = b.level
      const mat = railMats[Math.min(railMats.length - 1, b.level - 1)]
      for (const r of v.rails) r.material = mat
    }

    if (b.pulse > 0.17) squash.kick(sim.time)
    const [sxz, sy] = squash.value(sim.time)
    v.endCap.scale.set(sxz, sy, sxz)

    const n = Math.min(b.items.length, v.items.instanceMatrix.count)
    for (let i = 0; i < n; i++) {
      beltPoint(sim, id, b.items[i], tmp.at)
      tmp.q.setFromAxisAngle(tmp.up, tmp.at.yaw)
      // pop up off the hopper over the first stretch
      const rise = Math.min(1, b.items[i] / 0.35)
      tmp.p.set(tmp.at.x, TOP + 0.1 * rise + 0.06, tmp.at.z)
      tmp.s.setScalar(0.4 + 0.6 * rise)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      v.items.setMatrixAt(i, tmp.m)
    }
    v.items.count = n
    v.items.instanceMatrix.needsUpdate = true
  })

  return <primitive object={v.root} />
}

export function BeltsView() {
  return (
    <group>
      {ALL_BELT_IDS.map((id) => (
        <BeltView key={id} id={id} />
      ))}
    </group>
  )
}
