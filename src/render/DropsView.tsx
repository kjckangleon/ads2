// Raw meat and hides lying on the ground after a kill — pooled meshes, gently
// bobbing. Hides blink shortly before they spoil.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import { ANIMALS } from '../game/balance'
import { colorGeo, vertexColorMat, makeBlobShadow } from './rutil'
import { hideGeo } from './characters'

const POOL = 40

let dropGeo: THREE.BufferGeometry | null = null
function meatDropGeo(): THREE.BufferGeometry {
  if (dropGeo) return dropGeo
  const parts: THREE.BufferGeometry[] = []
  const meat = new THREE.SphereGeometry(0.26, 10, 8)
  meat.scale(1.25, 0.8, 1)
  meat.translate(0, 0.22, 0)
  parts.push(colorGeo(meat, '#e05548'))
  const bone = new THREE.CylinderGeometry(0.045, 0.045, 0.5, 6)
  bone.rotateZ(Math.PI / 2)
  bone.translate(0.28, 0.2, 0)
  parts.push(colorGeo(bone, '#f2ede0'))
  const knob = new THREE.SphereGeometry(0.07, 6, 5)
  knob.translate(0.53, 0.2, 0)
  parts.push(colorGeo(knob, '#f2ede0'))
  dropGeo = mergeGeometries(parts)!
  return dropGeo
}

function makeItem(geo: THREE.BufferGeometry, scale: number, shadow: number): THREE.Group {
  const item = new THREE.Group()
  const mesh = new THREE.Mesh(geo, vertexColorMat)
  mesh.castShadow = true
  mesh.scale.setScalar(scale)
  item.add(mesh)
  item.add(makeBlobShadow(shadow))
  item.visible = false
  return item
}

export function DropsView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const meat: THREE.Group[] = []
    const hides: THREE.Group[] = []
    for (let i = 0; i < POOL; i++) {
      const m = makeItem(meatDropGeo(), 1, 0.7)
      g.add(m)
      meat.push(m)
      const h = makeItem(hideGeo(), 1.25, 0.8)
      g.add(h)
      hides.push(h)
    }
    return { g, meat, hides }
  }, [])

  useFrame(() => {
    let mi = 0
    let hi = 0
    for (const d of sim.drops) {
      const item = d.kind === 'raw' ? pool.meat[mi++] : pool.hides[hi++]
      if (!item) continue
      const bob = Math.sin(d.age * 3 + d.id) * 0.045 + 0.045
      item.position.set(d.pos.x, (d.kind === 'raw' ? 0.06 : 0.1) + bob, d.pos.z)
      item.rotation.y = d.age * 0.9 + d.id
      item.visible = d.kind === 'raw' || ANIMALS.hideLifetime - d.age > 8 || Math.sin(d.age * 14) > -0.2
    }
    for (let i = mi; i < POOL; i++) pool.meat[i].visible = false
    for (let i = hi; i < POOL; i++) pool.hides[i].visible = false
  })

  return <primitive object={pool.g} />
}
