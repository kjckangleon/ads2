// The choppable trees in the lumber area — individual meshes so they can
// shake when chopped, disappear when depleted, and regrow.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import { colorGeo, vertexColorMat } from './rutil'
import { damp } from '../game/util'

let pineGeo: THREE.BufferGeometry | null = null
function choppablePineGeo(): THREE.BufferGeometry {
  if (pineGeo) return pineGeo
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.2, 7)
  trunk.translate(0, 0.6, 0)
  parts.push(colorGeo(trunk, '#5e4630'))
  const cone1 = new THREE.ConeGeometry(1.25, 1.7, 8)
  cone1.translate(0, 1.7, 0)
  parts.push(colorGeo(cone1, '#2b5340'))
  const cone2 = new THREE.ConeGeometry(0.95, 1.4, 8)
  cone2.translate(0, 2.65, 0)
  parts.push(colorGeo(cone2, '#33604a'))
  const cone3 = new THREE.ConeGeometry(0.62, 1.2, 8)
  cone3.translate(0, 3.5, 0)
  parts.push(colorGeo(cone3, '#3a6b52'))
  const snow = new THREE.ConeGeometry(0.45, 0.65, 8)
  snow.translate(0, 3.95, 0)
  parts.push(colorGeo(snow, '#eef3f9'))
  pineGeo = mergeGeometries(parts)!
  return pineGeo
}

const stumpGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.35, 8)
stumpGeo.translate(0, 0.17, 0)
const stumpMat = new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 0.95 })

export function TreesView() {
  const geo = useMemo(choppablePineGeo, [])
  const group = useMemo(() => {
    const g = new THREE.Group()
    for (const t of sim.trees) {
      const tree = new THREE.Mesh(geo, vertexColorMat)
      tree.castShadow = true
      tree.position.set(t.pos.x, 0, t.pos.z)
      tree.scale.setScalar(t.scale)
      const stump = new THREE.Mesh(stumpGeo, stumpMat)
      stump.position.set(t.pos.x, 0, t.pos.z)
      stump.visible = false
      g.add(tree, stump)
    }
    return g
  }, [geo])

  const scales = useRef(sim.trees.map((t) => (t.wood > 0 ? t.scale : 0)))

  useFrame((_, dt) => {
    sim.trees.forEach((t, i) => {
      const tree = group.children[i * 2] as THREE.Mesh
      const stump = group.children[i * 2 + 1] as THREE.Mesh
      if (!tree) return
      const target = t.wood > 0 ? t.scale : 0
      scales.current[i] += (target - scales.current[i]) * damp(5, dt)
      const s = scales.current[i]
      tree.visible = s > 0.03
      tree.scale.setScalar(Math.max(s, 0.001))
      stump.visible = s < t.scale * 0.9
      if (t.shake > 0) {
        tree.rotation.z = Math.sin(sim.time * 42) * 0.055 * t.shake
        tree.rotation.x = Math.cos(sim.time * 38) * 0.04 * t.shake
      } else {
        tree.rotation.z *= 0.85
        tree.rotation.x *= 0.85
      }
    })
  })

  return <primitive object={group} />
}
