// A carried tower of resources: instanced per kind, each new item pops in,
// and the whole stack leans behind the carrier's motion on a spring so it
// wobbles back when they stop or turn.

import * as THREE from 'three'
import type { ResKind } from '../game/types'
import { KIND_ORDER, STACK_STEP, kindIndex, makeCarryItem } from './characters'
import { elasticOut } from './anim'

const POP_TIME = 0.28
const SPRING_K = 70
const SPRING_C = 8
const LEAN_PER_SPEED = 0.05
const MAX_LEAN = 0.6
/** how strongly height amplifies the lean (quadratic bend) */
const BEND = 0.08

export class CarryStack {
  readonly group = new THREE.Group()
  private meshes: THREE.InstancedMesh[]
  private counts: number[]
  private born: number[]
  private prevLen = 0
  private leanX = 0
  private leanZ = 0
  private velX = 0
  private velZ = 0
  private height = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private s = new THREE.Vector3()
  private p = new THREE.Vector3()

  constructor(
    private max: number,
    private baseY = 1.72,
    private itemScale = 1,
  ) {
    this.born = new Array(max).fill(-1e9)
    this.counts = KIND_ORDER.map(() => 0)
    this.meshes = KIND_ORDER.map((k) => {
      const proto = makeCarryItem(k)
      const im = new THREE.InstancedMesh(proto.geometry, proto.material, max)
      im.count = 0
      im.frustumCulled = false
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.group.add(im)
      return im
    })
  }

  /** world-space height of the top of the stack, relative to the carrier */
  get top() {
    return this.baseY + this.height
  }

  /**
   * localVx / localVz: carrier velocity in its own frame (x = right,
   * z = forward), used to lean the stack backwards against motion.
   */
  update(carry: ResKind[], time: number, localVx: number, localVz: number, dt: number) {
    const n = Math.min(carry.length, this.max)
    for (let i = this.prevLen; i < n; i++) this.born[i] = time
    this.prevLen = n

    const step = Math.min(dt, 0.05)
    const tx = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -localVx * LEAN_PER_SPEED))
    const tz = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -localVz * LEAN_PER_SPEED))
    this.velX += ((tx - this.leanX) * SPRING_K - this.velX * SPRING_C) * step
    this.velZ += ((tz - this.leanZ) * SPRING_K - this.velZ * SPRING_C) * step
    this.leanX += this.velX * step
    this.leanZ += this.velZ * step

    let h = 0
    for (let i = 0; i < n; i++) {
      const kind = carry[i]
      const ki = kindIndex(kind)
      const stepH = STACK_STEP[kind] * this.itemScale
      const rel = h + stepH * 0.5
      const bend = rel * rel * BEND
      const age = time - this.born[i]
      const pop = age < POP_TIME ? Math.max(0.01, elasticOut(age / POP_TIME)) : 1
      this.e.set(
        this.leanZ * rel * 0.22,
        kind === 'log' ? (i % 2) * 0.5 - 0.25 : (i % 3) * 0.12,
        -this.leanX * rel * 0.22,
      )
      this.q.setFromEuler(this.e)
      this.p.set(this.leanX * bend, this.baseY + h, this.leanZ * bend + 0.05)
      this.m.compose(this.p, this.q, this.s.setScalar(this.itemScale * pop))
      this.meshes[ki].setMatrixAt(this.counts[ki]++, this.m)
      h += stepH
    }
    this.height = h

    for (let k = 0; k < this.meshes.length; k++) {
      const im = this.meshes[k]
      im.count = this.counts[k]
      im.instanceMatrix.needsUpdate = true
      this.counts[k] = 0
    }
  }
}
