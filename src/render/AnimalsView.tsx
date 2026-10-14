// Pooled deer, rabbits and raiding wolves (with health bars) — trot/hop
// animation and hit flash.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { makeAnimalRig, makeWolfRig, makeBar, setBar, type AnimalRig, type Bar } from './characters'

const DEER_POOL = 10
const RABBIT_POOL = 6
const WOLF_POOL = 10

export function AnimalsView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const deer: AnimalRig[] = []
    const rabbits: AnimalRig[] = []
    const wolves: AnimalRig[] = []
    const bars: Bar[] = []
    for (let i = 0; i < DEER_POOL; i++) {
      const r = makeAnimalRig('deer')
      r.group.visible = false
      g.add(r.group)
      deer.push(r)
    }
    for (let i = 0; i < RABBIT_POOL; i++) {
      const r = makeAnimalRig('rabbit')
      r.group.visible = false
      g.add(r.group)
      rabbits.push(r)
    }
    for (let i = 0; i < WOLF_POOL; i++) {
      const r = makeWolfRig()
      r.group.visible = false
      g.add(r.group)
      wolves.push(r)
      const bar = makeBar(0.9, '#ff5a4a')
      bar.group.visible = false
      g.add(bar.group)
      bars.push(bar)
    }
    return { g, deer, rabbits, wolves, bars }
  }, [])

  useFrame(() => {
    let di = 0
    let ri = 0
    for (const a of sim.animals) {
      const rig = a.kind === 'deer' ? pool.deer[di++] : pool.rabbits[ri++]
      if (!rig) continue
      rig.group.visible = true
      rig.group.position.set(a.pos.x, 0, a.pos.z)
      rig.group.rotation.y = a.yaw

      const moving = a.state !== 'idle'
      if (a.kind === 'deer') {
        rig.legs.forEach((leg, k) => {
          leg.rotation.x = moving ? Math.sin(a.walkPhase * 2.4 + (k % 2) * Math.PI) * 0.55 : 0
        })
        rig.body.position.y = moving ? Math.abs(Math.sin(a.walkPhase * 2.4)) * 0.04 : 0
        // graze when idle
        rig.body.rotation.x = a.state === 'idle' ? Math.sin(sim.time * 0.8 + a.id) * 0.06 + 0.06 : 0
      } else {
        rig.body.position.y = moving ? Math.abs(Math.sin(a.walkPhase * 3)) * 0.22 : 0
      }
      const f = Math.max(0, a.hitFlash)
      rig.mat.emissive.setRGB(f * 0.9, f * 0.3, f * 0.25)
    }
    for (let i = di; i < DEER_POOL; i++) pool.deer[i].group.visible = false
    for (let i = ri; i < RABBIT_POOL; i++) pool.rabbits[i].group.visible = false

    for (let i = 0; i < WOLF_POOL; i++) {
      const rig = pool.wolves[i]
      const bar = pool.bars[i]
      const w = sim.wolves[i]
      if (!w) {
        rig.group.visible = false
        bar.group.visible = false
        continue
      }
      rig.group.visible = true
      rig.group.position.set(w.pos.x, 0, w.pos.z)
      rig.group.rotation.y = w.yaw
      const running = w.state !== 'steal'
      // legs are [front-left, front-right, back-left, back-right]: trot diagonally
      rig.legs.forEach((leg, k) => {
        const phase = k === 0 || k === 3 ? 0 : Math.PI
        leg.rotation.x = running ? Math.sin(w.walkPhase * 2.6 + phase) * 0.7 : 0
      })
      rig.body.position.y = running ? Math.abs(Math.sin(w.walkPhase * 2.6)) * 0.07 : 0
      // head down while tearing at the meat
      rig.body.rotation.x = w.state === 'steal' ? 0.18 + Math.sin(sim.time * 18) * 0.05 : 0
      if (rig.mouth) rig.mouth.visible = w.carry > 0
      const f = Math.max(0, w.hitFlash)
      rig.mat.emissive.setRGB(f * 0.9, f * 0.3, f * 0.25)

      bar.group.visible = w.hp < w.maxHp
      bar.group.position.set(w.pos.x, 1.6, w.pos.z)
      setBar(bar, w.hp / w.maxHp)
    }
  })

  return <primitive object={pool.g} />
}
