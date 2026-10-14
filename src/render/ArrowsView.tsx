// Pooled arrow projectiles, oriented along their flight path.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import { colorGeo, vertexColorMat } from './rutil'

const POOL = 20

let arrowGeoCache: THREE.BufferGeometry | null = null
function arrowGeo(): THREE.BufferGeometry {
  if (arrowGeoCache) return arrowGeoCache
  const parts: THREE.BufferGeometry[] = []
  const shaft = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6)
  shaft.rotateX(Math.PI / 2)
  parts.push(colorGeo(shaft, '#c9b896'))
  const tip = new THREE.ConeGeometry(0.05, 0.16, 6)
  tip.rotateX(Math.PI / 2)
  tip.translate(0, 0, 0.44)
  parts.push(colorGeo(tip, '#7d8894'))
  const fletch = new THREE.BoxGeometry(0.02, 0.12, 0.16)
  fletch.translate(0, 0, -0.34)
  parts.push(colorGeo(fletch, '#e8e4dc'))
  const fletch2 = new THREE.BoxGeometry(0.12, 0.02, 0.16)
  fletch2.translate(0, 0, -0.34)
  parts.push(colorGeo(fletch2, '#e8e4dc'))
  arrowGeoCache = mergeGeometries(parts)!
  return arrowGeoCache
}

export function ArrowsView() {
  const pool = useMemo(() => {
    const g = new THREE.Group()
    const meshes: THREE.Mesh[] = []
    const geo = arrowGeo()
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, vertexColorMat)
      m.visible = false
      g.add(m)
      meshes.push(m)
    }
    return { g, meshes }
  }, [])
  const prev = useRef<Map<number, THREE.Vector3>>(new Map())
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const active = sim.arrows.filter((a) => a.active)
    for (let i = 0; i < POOL; i++) {
      const m = pool.meshes[i]
      if (i >= active.length) {
        m.visible = false
        continue
      }
      const a = active[i]
      m.visible = true
      const last = prev.current.get(a.id)
      tmp.set(a.pos.x, a.pos.y, a.pos.z)
      if (last && last.distanceToSquared(tmp) > 1e-6) {
        m.position.copy(last)
        m.lookAt(tmp)
      }
      m.position.set(a.pos.x, a.pos.y, a.pos.z)
      prev.current.set(a.id, tmp.clone())
    }
    // GC old entries occasionally
    if (prev.current.size > 64) prev.current.clear()
  })

  return <primitive object={pool.g} />
}
