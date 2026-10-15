// The player character: blue coat, axe that swings when chopping/hunting,
// and a tall swaying carry stack with a MAX tag when full. With the Jetpack
// they hover on two flickering flames, their shadow left on the snow below.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { PLAYER, flyMult } from '../game/balance'
import { makeCharacterRig, animateRig, PLAYER_PALETTE } from './characters'
import { CarryStack } from './CarryStack'
import { TextLabel, blobGeo, BLOB_Y } from './rutil'
import { damp } from '../game/util'

const MAX_SLOTS = PLAYER.baseCarry + PLAYER.carryPerLvl * 6 + 2
/** how far forward the body leans at full flying speed (radians), and the height it pivots around */
const FLY_LEAN = 1.15
const PIVOT = 0.9

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

    // 🚀 jetpack on the back: twin tanks, nozzles, flames
    const jet = new THREE.Group()
    const tankMat = new THREE.MeshStandardMaterial({ color: '#c9d2dc', metalness: 0.7, roughness: 0.3 })
    const trimMat = new THREE.MeshStandardMaterial({ color: '#e07a1a', roughness: 0.5 })
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#ffb347',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const flames: THREE.Mesh[] = []
    for (const x of [-0.14, 0.14]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), tankMat)
      tank.position.set(x, 1.05, -0.3)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), trimMat)
      cap.position.set(x, 1.3, -0.3)
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.12, 8), trimMat)
      nozzle.position.set(x, 0.74, -0.3)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8).rotateX(Math.PI), flameMat)
      flame.position.set(x, 0.43, -0.3)
      flames.push(flame)
      jet.add(tank, cap, nozzle, flame)
    }
    jet.visible = false
    rig.group.add(jet)
    // the shadow stays on the snow while the body leans and lifts
    const root = new THREE.Group()
    const shadow = rig.group.children.find((o) => (o as THREE.Mesh).geometry === blobGeo) ?? null
    if (shadow) root.add(shadow)
    root.add(rig.group)
    // yaw first, then lean forward around the body's own side axis
    rig.group.rotation.order = 'YXZ'
    return { root, rig, axe, stack, max, jet, flames, shadow }
  }, [])
  const pose = useRef({ hover: 0, pitch: 0 })
  const prev = useRef({ x: sim.player.pos.x, z: sim.player.pos.z })

  useFrame((_, rawDt) => {
    const p = sim.player
    const { rig, axe, stack, max, jet, flames, shadow } = built
    const dt = Math.max(1e-4, Math.min(rawDt, 0.05))

    const vx = (p.pos.x - prev.current.x) / dt
    const vz = (p.pos.z - prev.current.z) / dt
    prev.current.x = p.pos.x
    prev.current.z = p.pos.z

    // 🚀 flying: lift off, then lean into the direction of travel like a superhero
    const flying = p.flyLvl > 0 && p.flying
    const top = p.speed * flyMult(p.flyLvl)
    const frac = flying ? Math.min(1, Math.hypot(vx, vz) / Math.max(1, top)) : 0
    const ps = pose.current
    ps.hover += ((flying ? 1 : 0) - ps.hover) * damp(2.5, dt)
    ps.pitch += (FLY_LEAN * frac - ps.pitch) * damp(6, dt)
    const bob = Math.sin(sim.time * 3) * 0.12 * (1 - frac * 0.6)
    const lift = ps.hover * (PLAYER.flyHover + bob + frac * 0.4)
    // pivot the lean around the chest, not the feet
    const fx = Math.sin(p.yaw)
    const fz = Math.cos(p.yaw)
    const off = PIVOT * Math.sin(ps.pitch)
    rig.group.position.set(p.pos.x - fx * off, lift + PIVOT * (1 - Math.cos(ps.pitch)), p.pos.z - fz * off)
    rig.group.rotation.y = p.yaw
    rig.group.rotation.x = ps.pitch
    jet.visible = ps.hover > 0.05
    if (jet.visible) {
      for (const f of flames) f.scale.set(1, 0.7 + Math.random() * 0.5 + frac * 1.4, 1)
    }
    if (shadow) {
      shadow.position.set(p.pos.x, BLOB_Y, p.pos.z)
      shadow.scale.setScalar(1 - Math.min(0.45, lift * 0.25))
    }

    if (flying) {
      // legs together, trailing behind; no walking while airborne
      rig.legL.rotation.x += (0.18 - rig.legL.rotation.x) * damp(8, dt)
      rig.legR.rotation.x += (0.18 - rig.legR.rotation.x) * damp(8, dt)
      rig.torso.position.y *= 0.8
    } else {
      animateRig(rig, p.walkPhase, p.moving)
    }

    // the carry stack stays upright while the body leans
    stack.group.rotation.x = -ps.pitch
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

  return <primitive object={built.root} />
}
