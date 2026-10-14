// Overhead cash belts: bundles of bills climb a lift tower off each pay pile,
// ride a chevron belt above the camp on posts, and drop down a second tower
// into the chest (or the park's vault). Posts skip anything on the ground.
//
// Every running cash belt is baked into one set of meshes (one shared belt
// surface, one batch of rails, one instanced mesh for all the bills), rebuilt
// only when a belt starts running — a handful of draw calls for all of them.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { CashBeltId } from '../game/types'
import { BELT, CASH_BELT, CASH_BELT_IDS, beltSpeed } from '../game/balance'
import { cashPoint, cashBeltOn } from '../game/systems/belts'
import { billGeo, billMat } from './PilesView'
import { railMats } from './BeltsView'
import { buildOverhead, beltSurface, groundObstacles, STRIPE } from './overhead'
import { mergeStatic } from './rutil'
import { beltPerkMult } from '../game/perks'

const W = 0.62
const glassMat = new THREE.MeshStandardMaterial({
  color: '#9fe0a0',
  transparent: true,
  opacity: 0.18,
  roughness: 0.2,
  depthWrite: false,
})
const capMat = new THREE.MeshStandardMaterial({ color: '#47a85a', roughness: 0.5, metalness: 0.3 })

interface Baked {
  root: THREE.Group
  rails: THREE.Mesh[]
  items: THREE.InstancedMesh
  ids: CashBeltId[]
}

function bake(ids: CashBeltId[], top: { mat: THREE.Material; tex: THREE.Texture }): Baked {
  const root = new THREE.Group()
  const obs = groundObstacles()
  const rails: THREE.Mesh[] = []
  let max = 0
  for (const id of ids) {
    const b = sim.cash.belts[id]
    const part = buildOverhead(b.path, b.dists, b.h, obs, { width: W, glass: glassMat, cap: capMat, top })
    root.add(part.root)
    rails.push(...part.rails)
    max += Math.ceil(b.length / BELT.spacing) + 2
  }
  const items = new THREE.InstancedMesh(billGeo(), billMat, Math.max(1, max))
  items.count = 0
  items.frustumCulled = false
  items.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  root.add(items)
  const keep = new Set<THREE.Object3D>([items, ...rails])
  mergeStatic(root, (o) => !keep.has(o))
  // second pass: only the rails (and the segment groups holding them)
  const railSet = new Set<THREE.Object3D>([...rails, ...rails.map((r) => r.parent!)])
  return { root, rails: mergeStatic(root, (o) => railSet.has(o)), items, ids }
}

function dispose(b: Baked) {
  b.root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m !== b.items) m.geometry.dispose()
  })
  b.items.dispose()
}

export function CashBeltsView() {
  const st = useMemo(
    () => ({
      group: new THREE.Group(),
      top: beltSurface(),
      baked: null as Baked | null,
      key: '',
      lvl: -1,
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(1, 1, 1),
      up: new THREE.Vector3(0, 1, 0),
      at: { x: 0, y: 0, z: 0, yaw: 0 },
    }),
    [],
  )

  useFrame((_, dt) => {
    const cash = sim.cash
    const ids = CASH_BELT_IDS.filter((id) => cashBeltOn(sim, id))
    const key = ids.join(',')
    if (key !== st.key) {
      st.key = key
      if (st.baked) {
        st.group.remove(st.baked.root)
        dispose(st.baked)
        st.baked = null
      }
      if (ids.length) {
        st.baked = bake(ids, st.top)
        st.group.add(st.baked.root)
        st.lvl = -1
      }
    }
    const v = st.baked
    if (!v) return
    st.top.tex.offset.y -=
      (beltSpeed(cash.level) * CASH_BELT.speedMult * beltPerkMult(sim) * Math.min(dt, 0.05)) / STRIPE
    if (st.lvl !== cash.level) {
      st.lvl = cash.level
      for (const r of v.rails) r.material = railMats[Math.min(railMats.length - 1, cash.level - 1)]
    }
    let n = 0
    const cap = v.items.instanceMatrix.count
    for (const id of v.ids) {
      const b = cash.belts[id]
      for (let i = 0; i < b.items.length && n < cap; i++) {
        cashPoint(b, b.items[i], st.at)
        st.q.setFromAxisAngle(st.up, st.at.yaw + Math.PI / 2)
        st.p.set(st.at.x, st.at.y + 0.08, st.at.z)
        st.m.compose(st.p, st.q, st.s)
        v.items.setMatrixAt(n++, st.m)
      }
    }
    v.items.count = n
    v.items.instanceMatrix.needsUpdate = true
  })

  return <primitive object={st.group} />
}
