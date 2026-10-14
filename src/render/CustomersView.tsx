// Pooled customer rendering: a fixed pool of character rigs is mapped onto
// the live customer list each frame. No React state, no per-frame allocation.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { CUSTOMERS } from '../game/balance'
import { NEED_ICON } from '../game/icons'
import type { CustomerSim } from '../game/types'
import {
  makeCharacterRig,
  animateRig,
  syncCarry,
  villagerTorsoGeo,
  CUSTOMER_PALETTES,
  type CharacterRig,
} from './characters'
import { emojiTexture } from './rutil'

type Rig = CharacterRig & { variant: number; prevPhase: number }

function setIcon(rig: CharacterRig, char: string | null) {
  if (!char) {
    rig.icon.visible = false
    return
  }
  const mat = rig.icon.material as THREE.SpriteMaterial
  const tex = emojiTexture(char)
  if (mat.map !== tex) {
    mat.map = tex
    mat.needsUpdate = true
  }
  rig.icon.visible = true
}

function nearWolf(c: CustomerSim): boolean {
  for (const w of sim.wolves) {
    const dx = w.pos.x - c.pos.x
    const dz = w.pos.z - c.pos.z
    if (dx * dx + dz * dz < 12) return true
  }
  return false
}

function iconFor(c: CustomerSim): string | null {
  if (c.state === 'leaving') {
    if (c.moodT <= 0) return null
    return c.mood === 'tip' ? '😍' : c.mood === 'angry' ? '😠' : '😊'
  }
  if (sim.wolves.length && nearWolf(c)) return '😱'
  if (c.starveT > CUSTOMERS.angryAfter) return '😠'
  if (c.starveT > CUSTOMERS.impatientAfter) return '❗'
  // VIPs flash a crown between their need icon
  if (c.vip && Math.sin(sim.time * 4 + c.id) > 0.3) return '👑'
  return NEED_ICON[c.need]
}

export function CustomersView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const rigs: Rig[] = []
    for (let i = 0; i < CUSTOMERS.maxCap; i++) {
      const variant = i % 6
      const rig = makeCharacterRig(CUSTOMER_PALETTES[variant], 1)
      rig.group.visible = false
      g.add(rig.group)
      rigs.push(Object.assign(rig, { variant, prevPhase: 0 }))
    }
    return { g, rigs }
  }, [])

  useFrame(() => {
    const list = sim.customers
    for (let i = 0; i < pool.rigs.length; i++) {
      const rig = pool.rigs[i]
      if (i >= list.length) {
        rig.group.visible = false
        continue
      }
      const c = list[i]
      rig.group.visible = true
      if (rig.variant !== c.variant) {
        rig.variant = c.variant
        rig.torso.geometry = villagerTorsoGeo(CUSTOMER_PALETTES[c.variant])
      }
      rig.group.position.set(c.pos.x, 0, c.pos.z)
      rig.group.rotation.y = c.yaw
      const s = c.vip ? 1.12 : 1
      rig.group.scale.set(s, s, s)

      // shiver when left waiting at an empty stall
      if (c.state === 'queue' && c.starveT > CUSTOMERS.impatientAfter) {
        rig.group.position.x += Math.sin(sim.time * 32 + c.id) * 0.02
      }

      // legs swing only while the walk phase is actually advancing
      const moving = c.walkPhase !== rig.prevPhase
      rig.prevPhase = c.walkPhase
      animateRig(rig, c.walkPhase, moving)
      if (!moving) rig.torso.position.y = Math.abs(Math.sin(sim.time * 1.8 + c.id)) * 0.03
      // happy hop as they leave with a tip
      if (c.state === 'leaving' && c.mood === 'tip' && c.moodT > 0.8) {
        rig.torso.position.y += Math.abs(Math.sin(sim.time * 14)) * 0.18
      }

      setIcon(rig, iconFor(c))
      rig.icon.position.y = 2.15 + Math.sin(sim.time * 2.2 + c.id * 1.7) * 0.06
      syncCarry(rig, c.carrying ? [c.carrying] : [])
    }
  })

  return <primitive object={pool.g} />
}
