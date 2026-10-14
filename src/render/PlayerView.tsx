// The player character: blue coat, axe that swings when chopping/hunting,
// and a tall swaying carry stack with a MAX tag when full.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { PLAYER } from '../game/balance'
import { makeCharacterRig, animateRig, PLAYER_PALETTE } from './characters'
import { CarryStack } from './CarryStack'
import { TextLabel } from './rutil'

const MAX_SLOTS = PLAYER.baseCarry + PLAYER.carryPerLvl * 6 + 2

export function PlayerView() {
  const built = useMemo(() => {
    const rig = makeCharacterRig(PLAYER_PALETTE, 0)
    const axe = new THREE.Group()
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.65, 6),
      new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 0.9 }),
    )
    handle.position.y = 0.25
    axe.add(handle)
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: '#9aa4b0', metalness: 0.7, roughness: 0.35 }),
    )
    head.position.set(0.1, 0.52, 0)
    axe.add(head)
    axe.position.set(0.48, 0.62, 0.12)
    axe.rotation.z = -0.4
    rig.group.add(axe)

    const stack = new CarryStack(MAX_SLOTS, 1.72, 1.15)
    rig.group.add(stack.group)

    const max = new TextLabel(0.7)
    max.set('MAX', '#ff6a5a')
    max.sprite.visible = false
    rig.group.add(max.sprite)
    return { rig, axe, stack, max }
  }, [])

  const prev = useRef({ x: sim.player.pos.x, z: sim.player.pos.z })

  useFrame((_, rawDt) => {
    const p = sim.player
    const { rig, axe, stack, max } = built
    const dt = Math.max(1e-4, Math.min(rawDt, 0.05))
    rig.group.position.set(p.pos.x, 0, p.pos.z)
    rig.group.rotation.y = p.yaw
    animateRig(rig, p.walkPhase, p.moving)

    // velocity in the player's own frame drives the stack's lean
    const vx = (p.pos.x - prev.current.x) / dt
    const vz = (p.pos.z - prev.current.z) / dt
    prev.current.x = p.pos.x
    prev.current.z = p.pos.z
    const c = Math.cos(p.yaw)
    const s = Math.sin(p.yaw)
    stack.update(p.carry, sim.time, vx * c - vz * s, vx * s + vz * c, dt)

    const full = p.carry.length >= p.carryCap
    max.sprite.visible = full
    if (full) max.sprite.position.y = stack.top + 0.45 + Math.abs(Math.sin(sim.time * 7)) * 0.18

    if (p.swing > 0) {
      const k = p.swing / 0.25
      axe.rotation.x = -Math.sin(k * Math.PI) * 1.8
    } else {
      axe.rotation.x *= 0.7
    }
  })

  return <primitive object={built.rig.group} />
}
