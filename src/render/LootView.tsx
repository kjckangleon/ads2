// Loot to grab by walking over it: Gold Rush cash bundles (instanced, bobbing
// and spinning, blinking before they melt) and boss treasure chests with a
// glow ring and a value label.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { fmt } from '../game/format'
import { billGeo, billMat } from './PilesView'
import { TextLabel } from './rutil'

const MAX_CASH = 80
const MAX_CHESTS = 3

const goldMat = new THREE.MeshStandardMaterial({
  color: '#e8bb4a',
  metalness: 0.6,
  roughness: 0.35,
  emissive: '#5a3d00',
})
const woodMat = new THREE.MeshStandardMaterial({ color: '#6e4a2a', roughness: 0.85 })
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.55, depthWrite: false })
const cashRingMat = new THREE.MeshBasicMaterial({
  color: '#9fe08a',
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
})

function makeChest() {
  const g = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.75), woodMat)
  box.position.y = 0.35
  box.castShadow = true
  g.add(box)
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 1.1, 12, 1, false, 0, Math.PI), woodMat)
  lid.rotation.z = Math.PI / 2
  lid.position.y = 0.7
  g.add(lid)
  for (const x of [-0.42, 0, 0.42]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.74, 0.8), goldMat)
    band.position.set(x, 0.37, 0)
    g.add(band)
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.08), goldMat)
  lock.position.set(0, 0.55, 0.4)
  g.add(lock)
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 28), glowMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.03
  ring.renderOrder = 2
  g.add(ring)
  const label = new TextLabel(0.8)
  label.sprite.position.y = 2.0
  g.add(label.sprite)
  g.visible = false
  return { g, ring, label }
}

export function LootView() {
  const built = useMemo(() => {
    const group = new THREE.Group()
    const cash = new THREE.InstancedMesh(billGeo(), billMat, MAX_CASH)
    cash.count = 0
    cash.frustumCulled = false
    cash.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const rings = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.45, 0.6, 18).rotateX(-Math.PI / 2),
      cashRingMat,
      MAX_CASH,
    )
    rings.count = 0
    rings.frustumCulled = false
    rings.renderOrder = 2
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const chests = Array.from({ length: MAX_CHESTS }, makeChest)
    group.add(cash, rings, ...chests.map((c) => c.g))
    return { group, cash, rings, chests }
  }, [])
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useFrame(() => {
    let n = 0
    let c = 0
    for (const l of sim.loot) {
      if (l.kind === 'cash') {
        if (n >= MAX_CASH) continue
        // blink in the last two seconds before it melts
        const left = l.ttl - l.age
        const show = left > 2 || Math.sin(l.age * 20) > 0
        const pop = Math.min(1, l.age * 4)
        tmp.q.setFromAxisAngle(tmp.up, l.age * 3 + l.id)
        tmp.p.set(l.pos.x, 0.45 + Math.sin(l.age * 4 + l.id) * 0.12, l.pos.z)
        tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(show ? 1.4 * pop : 0.001))
        built.cash.setMatrixAt(n, tmp.m)
        tmp.m.makeTranslation(l.pos.x, 0.03, l.pos.z)
        built.rings.setMatrixAt(n, tmp.m)
        n++
      } else if (c < MAX_CHESTS) {
        const ch = built.chests[c++]
        ch.g.visible = true
        ch.g.position.set(l.pos.x, Math.abs(Math.sin(l.age * 3)) * 0.12, l.pos.z)
        ch.g.rotation.y = Math.sin(l.age * 1.5) * 0.3
        ch.ring.scale.setScalar(1 + Math.sin(l.age * 5) * 0.08)
        ch.label.set(`🎁 $${fmt(l.value)}`, '#ffe680')
      }
    }
    built.cash.count = n
    built.rings.count = n
    built.cash.instanceMatrix.needsUpdate = true
    built.rings.instanceMatrix.needsUpdate = true
    for (let i = c; i < MAX_CHESTS; i++) built.chests[i].g.visible = false
  })

  return <primitive object={built.group} />
}
