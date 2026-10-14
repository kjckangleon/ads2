// Pooled deer, rabbits, goats, bears and raiding wolves (big game and wolves
// get health bars) — trot/hop animation and hit flash.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { makeAnimalRig, makeWolfRig, makeBar, setBar, type AnimalRig, type Bar } from './characters'
import type { AnimalKind } from '../game/types'

const POOL: Record<AnimalKind, number> = { deer: 16, rabbit: 6, goat: 8, bear: 4, mammoth: 1, yeti: 1 }
const KINDS: AnimalKind[] = ['deer', 'rabbit', 'goat', 'bear', 'mammoth', 'yeti']
const WOLF_POOL = 10
/** big game gets a health bar so the long fight reads */
const BAR_KINDS = new Set<AnimalKind>(['goat', 'bear', 'mammoth', 'yeti'])
const BAR_POOL = POOL.goat + POOL.bear + POOL.mammoth + POOL.yeti

export function AnimalsView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const rigs = {} as Record<AnimalKind, AnimalRig[]>
    for (const kind of KINDS) {
      rigs[kind] = []
      for (let i = 0; i < POOL[kind]; i++) {
        const r = makeAnimalRig(kind)
        r.group.visible = false
        g.add(r.group)
        rigs[kind].push(r)
      }
    }
    const wolves: AnimalRig[] = []
    const bars: Bar[] = []
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
    const gameBars: Bar[] = []
    for (let i = 0; i < BAR_POOL; i++) {
      const bar = makeBar(1.1, '#ffb347')
      bar.group.visible = false
      g.add(bar.group)
      gameBars.push(bar)
    }
    return { g, rigs, wolves, bars, gameBars }
  }, [])

  useFrame(() => {
    const used: Record<AnimalKind, number> = { deer: 0, rabbit: 0, goat: 0, bear: 0, mammoth: 0, yeti: 0 }
    let bi = 0
    for (const a of sim.animals) {
      const rig = pool.rigs[a.kind][used[a.kind]++]
      if (!rig) continue
      rig.group.visible = true
      rig.group.position.set(a.pos.x, 0, a.pos.z)
      rig.group.rotation.y = a.yaw

      const moving = a.state !== 'idle'
      if (a.kind === 'rabbit') {
        rig.body.position.y = moving ? Math.abs(Math.sin(a.walkPhase * 3)) * 0.22 : 0
      } else {
        const heavy = a.kind === 'bear' || a.kind === 'mammoth' || a.kind === 'yeti'
        const gait = heavy ? 1.6 : a.kind === 'goat' ? 2.8 : 2.4
        const swing = heavy ? 0.4 : 0.55
        rig.legs.forEach((leg, k) => {
          leg.rotation.x = moving ? Math.sin(a.walkPhase * gait + (k % 2) * Math.PI) * swing : 0
        })
        rig.body.position.y = moving ? Math.abs(Math.sin(a.walkPhase * gait)) * (heavy ? 0.09 : 0.04) : 0
        // graze when idle; a charging bear drops its head
        rig.body.rotation.x =
          a.state === 'charge' ? 0.12 : a.state === 'idle' ? Math.sin(sim.time * 0.8 + a.id) * 0.06 + 0.06 : 0
      }
      // bosses get hit constantly: a softer flash keeps their fur colour readable
      const f = Math.max(0, a.hitFlash) * (a.kind === 'mammoth' || a.kind === 'yeti' ? 0.3 : 1)
      rig.mat.emissive.setRGB(f * 0.9, f * 0.3, f * 0.25)

      if (BAR_KINDS.has(a.kind) && a.hp < a.maxHp && bi < BAR_POOL) {
        const bar = pool.gameBars[bi++]
        bar.group.visible = true
        const barY = a.kind === 'mammoth' ? 4.6 : a.kind === 'yeti' ? 4.8 : a.kind === 'bear' ? 2.2 : 1.8
        bar.group.position.set(a.pos.x, barY, a.pos.z)
        bar.group.scale.setScalar(a.kind === 'mammoth' || a.kind === 'yeti' ? 2.2 : 1)
        setBar(bar, a.hp / a.maxHp)
      }
    }
    for (const kind of KINDS) for (let i = used[kind]; i < POOL[kind]; i++) pool.rigs[kind][i].group.visible = false
    for (let i = bi; i < BAR_POOL; i++) pool.gameBars[i].group.visible = false

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
      // the siege alpha is a giant
      rig.group.scale.setScalar(w.alpha ? 1.7 : 1)
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
      bar.group.position.set(w.pos.x, w.alpha ? 2.6 : 1.6, w.pos.z)
      bar.group.scale.setScalar(w.alpha ? 1.8 : 1)
      setBar(bar, w.hp / w.maxHp)
    }
  })

  return <primitive object={pool.g} />
}
