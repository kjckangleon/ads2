// Chevrons on the ground around the player pointing at what matters right
// now: gold = current objective, red = raiding wolf, teal = waiting caravan,
// blue = where the stack you're carrying belongs.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { Guide } from '../game/types'

const POOL = 4
const RADIUS = 1.9

const MATS: Record<Guide['color'], THREE.MeshBasicMaterial> = {
  gold: new THREE.MeshBasicMaterial({ color: '#ffd75e', transparent: true, opacity: 0.9, depthWrite: false }),
  red: new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.9, depthWrite: false }),
  teal: new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.9, depthWrite: false }),
  blue: new THREE.MeshBasicMaterial({ color: '#6f9bff', transparent: true, opacity: 0.95, depthWrite: false }),
}

export function GuidesView() {
  const pool = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.28, 0.62, 3)
    geo.rotateX(Math.PI / 2)
    geo.scale(1, 0.3, 1)
    const g = new THREE.Group()
    const meshes: THREE.Mesh[] = []
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, MATS.gold)
      m.visible = false
      m.renderOrder = 6
      g.add(m)
      meshes.push(m)
    }
    return { g, meshes }
  }, [])

  useFrame(() => {
    const p = sim.player.pos
    for (let i = 0; i < POOL; i++) {
      const m = pool.meshes[i]
      const guide = sim.guides[i]
      if (!guide) {
        m.visible = false
        continue
      }
      const a = Math.atan2(guide.x - p.x, guide.z - p.z)
      const r = RADIUS + Math.sin(sim.time * 6 + i) * 0.14
      m.visible = true
      m.material = MATS[guide.color]
      m.position.set(p.x + Math.sin(a) * r, 0.12, p.z + Math.cos(a) * r)
      m.rotation.y = a
    }
  })

  return <primitive object={pool.g} />
}
