// Exact, physical inventory: one instance per stocked item (up to `max`),
// placed by a layout function. New items pop in with a springy bounce.

import * as THREE from 'three'
import { elasticOut } from './anim'

const POP_TIME = 0.3

export interface Slot {
  x: number
  y: number
  z: number
  ry: number
}

export type Layout = (i: number, out: Slot) => void

/** cols × rows per layer, stacked upward; optional alternating 90° turn per layer. */
export function gridLayout(cols: number, rows: number, dx: number, dz: number, dy: number, crisscross = false): Layout {
  const perLayer = cols * rows
  return (i, out) => {
    const layer = Math.floor(i / perLayer)
    const k = i % perLayer
    let cx = (k % cols) - (cols - 1) / 2
    let cz = Math.floor(k / cols) - (rows - 1) / 2
    let ry = ((i * 7919) % 13) * 0.012 - 0.07
    if (crisscross && layer % 2 === 1) {
      ;[cx, cz] = [cz * (dz / dx), cx * (dx / dz)]
      ry += Math.PI / 2
    }
    out.x = cx * dx
    out.z = cz * dz
    out.y = layer * dy
    out.ry = ry
  }
}

export class ItemGrid {
  readonly mesh: THREE.InstancedMesh
  private born: number[]
  private prev = -1
  private animUntil = 0
  private slot: Slot = { x: 0, y: 0, z: 0, ry: 0 }
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3()
  private p = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    private max: number,
    private layout: Layout,
    private scale = 1,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.born = new Array(max).fill(-1e9)
  }

  /** y of the top layer for `count` items (labels sit above it) */
  topY(count: number) {
    if (count <= 0) return 0
    this.layout(Math.min(count, this.max) - 1, this.slot)
    return this.slot.y
  }

  update(count: number, time: number) {
    const n = Math.max(0, Math.min(Math.floor(count), this.max))
    if (this.prev < 0) this.prev = n
    if (n > this.prev) {
      for (let i = this.prev; i < n; i++) this.born[i] = time
      this.animUntil = time + POP_TIME
    }
    const changed = n !== this.prev
    this.prev = n
    if (!changed && time > this.animUntil) return

    for (let i = 0; i < n; i++) {
      this.layout(i, this.slot)
      const age = time - this.born[i]
      const pop = age < POP_TIME ? Math.max(0.01, elasticOut(age / POP_TIME)) : 1
      this.q.setFromAxisAngle(this.up, this.slot.ry)
      this.p.set(this.slot.x, this.slot.y, this.slot.z)
      this.m.compose(this.p, this.q, this.s.setScalar(this.scale * pop))
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
