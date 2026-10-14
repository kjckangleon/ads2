// Pooled worker rendering — role-colored villagers with visible carry stacks,
// a coin stack for cashiers and a spear for guards.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { ROLE_ICON } from '../game/icons'
import { makeCharacterRig, animateRig, villagerTorsoGeo, WORKER_PALETTES, type CharacterRig } from './characters'
import { billGeo, billMat } from './PilesView'
import { CarryStack } from './CarryStack'
import { emojiTexture } from './rutil'

const POOL = 26

interface WorkerVisual extends CharacterRig {
  role: string
  coinStack: THREE.Mesh[]
  prevPhase: number
  spear: THREE.Group
  stack: CarryStack
  px: number
  pz: number
  seen: boolean
}

const spearShaftMat = new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 0.9 })
const spearTipMat = new THREE.MeshStandardMaterial({ color: '#b8c0cc', metalness: 0.6, roughness: 0.35 })

function makeSpear(): THREE.Group {
  const g = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), spearShaftMat)
  shaft.rotation.x = Math.PI / 2
  g.add(shaft)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), spearTipMat)
  tip.rotation.x = Math.PI / 2
  tip.position.z = 0.9
  g.add(tip)
  g.position.set(0.42, 0.8, 0.15)
  g.visible = false
  return g
}

export function WorkersView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const rigs: WorkerVisual[] = []
    for (let i = 0; i < POOL; i++) {
      const rig = makeCharacterRig(WORKER_PALETTES.collector, 0) as WorkerVisual
      rig.role = ''
      rig.prevPhase = 0
      rig.px = 0
      rig.pz = 0
      rig.seen = false
      rig.stack = new CarryStack(16, 1.72, 1)
      rig.group.add(rig.stack.group)
      rig.coinStack = []
      for (let k = 0; k < 8; k++) {
        const coin = new THREE.Mesh(billGeo(), billMat)
        coin.position.set(0, 1.72 + k * 0.13, 0.05)
        coin.rotation.y = (k % 2) * 0.3
        coin.visible = false
        rig.group.add(coin)
        rig.coinStack.push(coin)
      }
      rig.spear = makeSpear()
      rig.group.add(rig.spear)
      rig.group.visible = false
      g.add(rig.group)
      rigs.push(rig)
    }
    return { g, rigs }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.max(1e-4, Math.min(rawDt, 0.05))
    const list = sim.workers
    for (let i = 0; i < POOL; i++) {
      const rig = pool.rigs[i]
      if (i >= list.length) {
        rig.group.visible = false
        continue
      }
      const w = list[i]
      rig.group.visible = true
      if (rig.role !== w.role) {
        rig.role = w.role
        rig.torso.geometry = villagerTorsoGeo(WORKER_PALETTES[w.role])
        const mat = rig.icon.material as THREE.SpriteMaterial
        mat.map = emojiTexture(ROLE_ICON[w.role])
        mat.needsUpdate = true
        mat.opacity = 0.85
        rig.icon.scale.set(0.55, 0.55, 1)
        rig.icon.position.y = 2.0
        rig.icon.visible = true
        rig.spear.visible = w.role === 'guard'
      }
      rig.group.position.set(w.pos.x, 0, w.pos.z)
      rig.group.rotation.y = w.yaw
      const moving = w.walkPhase !== rig.prevPhase
      rig.prevPhase = w.walkPhase
      animateRig(rig, w.walkPhase, moving)

      if ((w.role === 'cook' && sim.proc.kitchen.active) || (w.role === 'tailor' && sim.proc.tailor.active)) {
        rig.torso.rotation.z = Math.sin(sim.time * 6) * 0.08
      }
      if (w.role === 'guard') {
        rig.spear.position.z = 0.15 + (w.swing > 0 ? Math.sin((w.swing / 0.25) * Math.PI) * 0.55 : 0)
        // raise the icon on alert so raids read at a glance
        rig.icon.scale.setScalar(w.mode === 'chase' ? 0.8 : 0.55)
      }
      // lumberjack chop bob
      if (w.role === 'lumberjack' && w.swing > 0) rig.torso.rotation.x = Math.sin((w.swing / 0.25) * Math.PI) * 0.25
      else rig.torso.rotation.x *= 0.8

      if (!rig.seen) {
        rig.seen = true
        rig.px = w.pos.x
        rig.pz = w.pos.z
      }
      const vx = (w.pos.x - rig.px) / dt
      const vz = (w.pos.z - rig.pz) / dt
      rig.px = w.pos.x
      rig.pz = w.pos.z
      const c = Math.cos(w.yaw)
      const s = Math.sin(w.yaw)
      rig.stack.update(w.carry, sim.time, vx * c - vz * s, vx * s + vz * c, dt)
      const coins = Math.min(8, Math.ceil(w.coins / 100))
      rig.coinStack.forEach((c, k) => {
        c.visible = w.coins > 0 && k < coins
      })
    }
  })

  return <primitive object={pool.g} />
}
