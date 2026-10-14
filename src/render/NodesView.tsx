// Fishing holes on the pond ice and coal seams in the mine. Holes show open
// water with a bobbing float while they have fish and freeze over while they
// refill; seams are coal-studded boulders that shrink to rubble when spent.
// Both shake when worked, like the pines.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import type { TreeSim } from '../game/types'
import { colorGeo, vertexColorMat } from './rutil'
import { damp, mulberry32 } from '../game/util'

const waterMat = new THREE.MeshStandardMaterial({ color: '#1f4f6e', roughness: 0.1, metalness: 0.3 })
const frozenMat = new THREE.MeshStandardMaterial({ color: '#c8e2f0', roughness: 0.25, metalness: 0.1 })
const rimMat = new THREE.MeshStandardMaterial({ color: '#eef6fb', roughness: 0.6, flatShading: true })
const floatRed = new THREE.MeshStandardMaterial({ color: '#e04a3a', roughness: 0.5 })
const floatWhite = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 })
const rubbleMat = new THREE.MeshStandardMaterial({ color: '#6a707a', roughness: 1, flatShading: true })

const waterGeo = new THREE.CircleGeometry(0.5, 18)
waterGeo.rotateX(-Math.PI / 2)
const rimGeo = new THREE.TorusGeometry(0.56, 0.12, 5, 14)
rimGeo.rotateX(Math.PI / 2)
const floatGeo = new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
const floatBottomGeo = new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)

let seamGeoCache: THREE.BufferGeometry | null = null
/** grey boulder with black coal facets poking out */
function seamGeo(): THREE.BufferGeometry {
  if (seamGeoCache) return seamGeoCache
  const rng = mulberry32(99)
  const parts: THREE.BufferGeometry[] = []
  const rock = new THREE.IcosahedronGeometry(0.85, 0)
  rock.scale(1.15, 0.8, 1)
  rock.translate(0, 0.55, 0)
  parts.push(colorGeo(rock, '#8a929c'))
  const top = new THREE.IcosahedronGeometry(0.5, 0)
  top.translate(0.2, 1.05, -0.1)
  parts.push(colorGeo(top, '#9aa2ac'))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng()
    const lump = new THREE.IcosahedronGeometry(0.2 + rng() * 0.1, 0)
    lump.translate(Math.cos(a) * 0.78, 0.45 + rng() * 0.5, Math.sin(a) * 0.62)
    parts.push(colorGeo(lump, '#1e1e24'))
  }
  const snow = new THREE.SphereGeometry(0.42, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
  snow.scale(1, 0.35, 1)
  snow.translate(0.2, 1.35, -0.1)
  parts.push(colorGeo(snow.toNonIndexed(), '#eef3f9'))
  seamGeoCache = mergeGeometries(parts)!
  return seamGeoCache
}

function Holes() {
  const built = useMemo(() => {
    const g = new THREE.Group()
    const holes = sim.holes.map((h) => {
      const root = new THREE.Group()
      root.position.set(h.pos.x, 0.03, h.pos.z)
      const water = new THREE.Mesh(waterGeo, waterMat)
      water.position.y = 0.01
      root.add(water)
      const rim = new THREE.Mesh(rimGeo, rimMat)
      rim.position.y = 0.04
      rim.scale.y = 0.6
      root.add(rim)
      const bob = new THREE.Group()
      bob.add(new THREE.Mesh(floatGeo, floatRed), new THREE.Mesh(floatBottomGeo, floatWhite))
      bob.position.set(0.12, 0.06, -0.05)
      root.add(bob)
      g.add(root)
      return { root, water, bob }
    })
    return { g, holes }
  }, [])

  useFrame(() => {
    const open = sim.zones.fishery
    sim.holes.forEach((h, i) => {
      const v = built.holes[i]
      const full = open && h.wood > 0
      v.water.material = full ? waterMat : frozenMat
      v.bob.visible = full
      if (full) v.bob.position.y = 0.06 + Math.sin(sim.time * 3 + i * 1.7) * 0.025 - h.shake * 0.05
      const ripple = 1 + h.shake * 0.12 * Math.sin(sim.time * 30)
      v.root.scale.set(ripple, 1, ripple)
    })
  })

  return <primitive object={built.g} />
}

function Seams() {
  const built = useMemo(() => {
    const g = new THREE.Group()
    const geo = seamGeo()
    const seams = sim.seams.map((s, i) => {
      const rock = new THREE.Mesh(geo, vertexColorMat)
      rock.castShadow = true
      rock.position.set(s.pos.x, 0, s.pos.z)
      rock.rotation.y = i * 1.3
      const rubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), rubbleMat)
      rubble.position.set(s.pos.x, 0.12, s.pos.z)
      rubble.scale.y = 0.45
      g.add(rock, rubble)
      return { rock, rubble, scale: s.wood > 0 ? s.scale : 0.25 }
    })
    return { g, seams }
  }, [])

  useFrame((_, dt) => {
    sim.seams.forEach((s: TreeSim, i) => {
      const v = built.seams[i]
      const target = s.wood > 0 ? s.scale * (0.55 + 0.45 * (s.wood / s.maxWood)) : 0
      v.scale += (target - v.scale) * damp(5, dt)
      v.rock.visible = v.scale > 0.03
      v.rock.scale.setScalar(Math.max(v.scale, 0.001))
      v.rubble.visible = v.scale < s.scale * 0.7
      v.rock.rotation.z = s.shake > 0 ? Math.sin(sim.time * 45) * 0.05 * s.shake : 0
    })
  })

  return <primitive object={built.g} />
}

export function NodesView() {
  return (
    <group>
      <Holes />
      <Seams />
    </group>
  )
}
