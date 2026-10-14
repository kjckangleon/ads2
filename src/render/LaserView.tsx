// 🔫 Laser Blaster beams: a red glow with a white-hot core from the player's
// chest out to the beam's full range, fading out in a blink.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { PLAYER } from '../game/balance'

const POOL = 6
const LIFE = 0.16

const glowMat = new THREE.MeshBasicMaterial({
  color: '#ff3b3b',
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const coreMat = new THREE.MeshBasicMaterial({
  color: '#fff1e6',
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

export function LaserView() {
  const built = useMemo(() => {
    const root = new THREE.Group()
    // unit-length beams along +z, centred, scaled to each shot
    const glowGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8, 1, true).rotateX(Math.PI / 2)
    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true).rotateX(Math.PI / 2)
    const beams = Array.from({ length: POOL }, () => {
      const g = new THREE.Group()
      const glow = new THREE.Mesh(glowGeo, glowMat.clone())
      const core = new THREE.Mesh(coreGeo, coreMat.clone())
      glow.renderOrder = core.renderOrder = 7
      g.add(glow, core)
      g.visible = false
      root.add(g)
      return { g, glow, core }
    })
    return { root, beams, from: new THREE.Vector3(), to: new THREE.Vector3() }
  }, [])

  useFrame(() => {
    const p = sim.player
    const y0 = (p.flyLvl > 0 && p.flying ? PLAYER.flyHover : 0) + 1.25
    for (let i = 0; i < POOL; i++) {
      const v = built.beams[i]
      const b = p.beams[i]
      v.g.visible = !!b
      if (!b) continue
      const k = Math.max(0, b.t / LIFE)
      built.from.set(b.x0, y0, b.z0)
      built.to.set(b.x1, 0.9, b.z1)
      const len = built.from.distanceTo(built.to)
      v.g.position.copy(built.from).lerp(built.to, 0.5)
      v.g.lookAt(built.to)
      v.g.scale.set(0.6 + k * 0.6, 0.6 + k * 0.6, len)
      ;(v.glow.material as THREE.MeshBasicMaterial).opacity = 0.6 * k
      ;(v.core.material as THREE.MeshBasicMaterial).opacity = 0.95 * k
    }
  })

  return <primitive object={built.root} />
}
