// Elevated follow camera (~54° down). Smoothly tracks the player, pans to
// focus points on big unlocks, punches on impactful events, and pulls back a
// little as the settlement grows so the bigger machine stays in view.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { damp } from '../game/util'

const OFFSET = new THREE.Vector3(0, 20, 14.5)
const MAX_ZOOM_OUT = 0.22

export function CameraRig() {
  const target = useRef(new THREE.Vector3(sim.player.pos.x, 0, sim.player.pos.z))
  const look = useRef(new THREE.Vector3())
  const zoom = useRef(1)

  useFrame(({ camera }, dt) => {
    const focus = sim.focus
    const tx = focus ? focus.x : sim.player.pos.x
    const tz = focus ? focus.z : sim.player.pos.z
    const speed = focus ? 3.6 : 7.5
    target.current.x += (tx - target.current.x) * damp(speed, dt)
    target.current.z += (tz - target.current.z) * damp(speed, dt)

    const wantZoom = 1 + Math.min(MAX_ZOOM_OUT, (sim.rep.level - 1) * 0.03)
    zoom.current += (wantZoom - zoom.current) * damp(1.5, dt)
    const z = zoom.current

    camera.position.set(target.current.x + OFFSET.x * z, OFFSET.y * z, target.current.z + OFFSET.z * z)
    if (sim.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * sim.shake * 0.5
      camera.position.y += (Math.random() - 0.5) * sim.shake * 0.4
      camera.position.z += (Math.random() - 0.5) * sim.shake * 0.5
    }
    look.current.set(target.current.x, 0.8, target.current.z + 0.8)
    camera.lookAt(look.current)
  })

  return null
}
