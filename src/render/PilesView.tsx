// Physical money: green cash bundles stacking into a tower at each pay spot
// (one bundle per ECONOMY.billValue), shrinking as it's collected.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import { ECONOMY } from '../game/balance'
import { fmt } from '../game/format'
import { TextLabel, colorGeo, vertexColorMat } from './rutil'
import { ItemGrid, gridLayout } from './ItemGrid'

const MAX_BUNDLES = 117
const LAYER_H = 0.13

let billGeoCache: THREE.BufferGeometry | null = null
/** banded bundle of bills */
export function billGeo(): THREE.BufferGeometry {
  if (billGeoCache) return billGeoCache
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.BoxGeometry(0.5, 0.12, 0.26)
  parts.push(colorGeo(body, '#47a85a'))
  const top = new THREE.BoxGeometry(0.44, 0.01, 0.2)
  top.translate(0, 0.062, 0)
  parts.push(colorGeo(top, '#6cc77a'))
  const band = new THREE.BoxGeometry(0.11, 0.128, 0.268)
  parts.push(colorGeo(band, '#f1f8e8'))
  billGeoCache = mergeGeometries(parts)!
  return billGeoCache
}
export const billMat = vertexColorMat

export function PilesView() {
  const visuals = useMemo(
    () =>
      sim.piles.map((p) => {
        const root = new THREE.Group()
        root.position.set(p.pos.x, 0.07, p.pos.z)
        const grid = new ItemGrid(billGeo(), billMat, MAX_BUNDLES, gridLayout(3, 3, 0.54, 0.3, LAYER_H))
        grid.mesh.castShadow = true
        root.add(grid.mesh)
        const label = new TextLabel(0.72)
        root.add(label.sprite)
        return { root, grid, label }
      }),
    [],
  )
  const group = useMemo(() => {
    const g = new THREE.Group()
    for (const v of visuals) g.add(v.root)
    return g
  }, [visuals])

  useFrame(() => {
    sim.piles.forEach((p, i) => {
      const v = visuals[i]
      const bundles = p.value > 0 ? Math.ceil(p.value / ECONOMY.billValue) : 0
      v.grid.update(bundles, sim.time)
      v.label.sprite.visible = p.value > 0
      if (p.value > 0) {
        v.label.set(`$${fmt(p.value)}`, '#b8ff9a')
        v.label.sprite.position.y = v.grid.topY(bundles) + 0.85
      }
    })
  })

  return <primitive object={group} />
}
