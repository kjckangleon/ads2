// Industrial Park customers on screen: pooled trucks on the depot lane, the
// cargo ship at the berth (containers pile up on deck as it loads) and the
// cargo plane on the runway. Each shows its order over it while loading.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import type { VehicleSim } from '../game/types'
import { orderLine } from '../game/systems/freight'
import { TextLabel, colorGeo, vertexColorMat, makeBlobShadow } from './rutil'

const TRUCKS = 8
const SHIPS = 8
const PLANES = 8
const TRAILER_COLORS = ['#d8463a', '#2f6fd6', '#2e9a5a', '#f2a82b']

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return colorGeo(g, color)
}

function wheel(x: number, z: number) {
  const g = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10)
  g.rotateZ(Math.PI / 2)
  g.translate(x, 0.42, z)
  return colorGeo(g, '#1d2128')
}

/** a box truck facing +z: cab in front, trailer behind (trailer colour per variant) */
function truckGeo(trailer: string): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = []
  p.push(box(2.2, 1.6, 1.8, 0, 1.3, 2.1, '#eef2f6'))
  p.push(box(2.1, 0.7, 0.06, 0, 1.6, 3.02, '#7fb4d9'))
  p.push(box(2.24, 0.25, 1.84, 0, 0.55, 2.1, '#3a4150'))
  p.push(box(2.3, 2.3, 4.2, 0, 1.75, -0.9, trailer))
  p.push(box(2.32, 0.18, 4.22, 0, 2.95, -0.9, '#f4f8fc'))
  p.push(box(2.0, 0.3, 4.6, 0, 0.55, -0.6, '#2a2f38'))
  for (const z of [2.3, -1.8, -2.6]) for (const x of [-1.05, 1.05]) p.push(wheel(x, z))
  return mergeGeometries(p)!
}

/** a cargo ship facing +z: hull, deck, bridge at the stern */
function shipGeo(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = []
  p.push(box(4.6, 1.6, 15, 0, 0.3, 0, '#c0392b'))
  p.push(box(4.62, 0.3, 15.02, 0, 1.0, 0, '#f4f8fc'))
  const bow = new THREE.CylinderGeometry(0.01, 2.3, 3, 3, 1)
  bow.rotateX(Math.PI / 2)
  bow.rotateY(Math.PI)
  bow.scale(1, 0.55, 1)
  bow.translate(0, 0.3, 9)
  p.push(colorGeo(bow, '#c0392b'))
  p.push(box(4.2, 0.12, 14.6, 0, 1.15, 0, '#8b95a3'))
  p.push(box(3.6, 3, 2.4, 0, 2.6, -6, '#eef2f6'))
  p.push(box(3.7, 0.5, 0.06, 0, 3.4, -4.78, '#7fb4d9'))
  const funnel = new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10)
  funnel.translate(0, 4.6, -6.6)
  p.push(colorGeo(funnel, '#d8463a'))
  return mergeGeometries(p)!
}

/** a cargo plane facing +z */
function planeGeo(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = []
  const body = new THREE.CylinderGeometry(0.85, 0.85, 9, 12)
  body.rotateX(Math.PI / 2)
  body.translate(0, 1.6, 0)
  p.push(colorGeo(body, '#eef2f6'))
  const nose = new THREE.SphereGeometry(0.85, 12, 8)
  nose.scale(1, 1, 1.6)
  nose.translate(0, 1.6, 4.5)
  p.push(colorGeo(nose, '#eef2f6'))
  const tail = new THREE.CylinderGeometry(0.85, 0.25, 2.4, 12)
  tail.rotateX(-Math.PI / 2)
  tail.translate(0, 1.85, -5.6)
  p.push(colorGeo(tail, '#eef2f6'))
  p.push(box(0.12, 2.2, 1.6, 0, 3.0, -6.0, '#2f6fd6'))
  p.push(box(4.4, 0.1, 1.0, 0, 2.0, -6.2, '#eef2f6'))
  p.push(box(12, 0.16, 2.0, 0, 1.4, 0.4, '#dfe3e8'))
  p.push(box(1.74, 0.3, 9, 0, 1.25, 0, '#2f6fd6'))
  for (const x of [-3, 3]) {
    const eng = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 10)
    eng.rotateX(Math.PI / 2)
    eng.translate(x, 0.95, 0.9)
    p.push(colorGeo(eng, '#8a96a5'))
  }
  p.push(box(1.4, 0.5, 0.4, 0, 0.35, 3.0, '#1d2128'))
  p.push(box(3.0, 0.5, 0.4, 0, 0.35, -0.6, '#1d2128'))
  p.push(box(2.0, 0.5, 0.06, 0, 2.05, 4.9, '#2b3a50'))
  return mergeGeometries(p)!
}

const CONTAINER_COLORS = ['#d8463a', '#2f6fd6', '#2e9a5a', '#f2d24b', '#8a5ad6']

interface Unit {
  group: THREE.Group
  label: TextLabel
}

function unit(mesh: THREE.Mesh, labelY: number, shadow = true): Unit {
  const group = new THREE.Group()
  mesh.castShadow = true
  group.add(mesh)
  if (shadow) group.add(makeBlobShadow(2.6))
  const label = new TextLabel(0.75, 320)
  label.sprite.position.y = labelY
  group.add(label.sprite)
  group.visible = false
  return { group, label }
}

function place(u: Unit, v: VehicleSim) {
  u.group.visible = true
  u.group.position.set(v.pos.x, v.y, v.pos.z)
  u.group.rotation.y = v.yaw
  const loading = v.state === 'load' || (v.kind === 'truck' && v.slot === 0)
  u.label.sprite.visible = loading
  if (loading) u.label.set(orderLine(v.order), '#ffffff')
}

export function VehiclesView() {
  const built = useMemo(() => {
    const root = new THREE.Group()
    const truckGeos = TRAILER_COLORS.map(truckGeo)
    const trucks = Array.from({ length: TRUCKS }, (_, i) =>
      unit(new THREE.Mesh(truckGeos[i % truckGeos.length], vertexColorMat), 4),
    )
    // several berths and gates: a pool of ships and planes (incoming, docked and leaving)
    const shipGeom = shipGeo()
    const containerGeo = new THREE.BoxGeometry(1.25, 1.0, 2.2)
    const containerMat = new THREE.MeshStandardMaterial({ roughness: 0.7 })
    const ships = Array.from({ length: SHIPS }, () => {
      const u = unit(new THREE.Mesh(shipGeom, vertexColorMat), 7, false)
      // containers on deck show how full the ship is
      const containers = new THREE.InstancedMesh(containerGeo, containerMat, 18)
      containers.count = 0
      containers.castShadow = true
      for (let i = 0; i < 18; i++) {
        const row = i % 3
        const col = Math.floor(i / 3) % 3
        const layer = Math.floor(i / 9)
        containers.setMatrixAt(
          i,
          new THREE.Matrix4().makeTranslation(-1.35 + row * 1.35, 1.75 + layer * 1.0, -2.2 + col * 2.6),
        )
        containers.setColorAt(i, new THREE.Color(CONTAINER_COLORS[i % CONTAINER_COLORS.length]))
      }
      u.group.add(containers)
      return { ...u, containers }
    })
    const planeGeom = planeGeo()
    const planes = Array.from({ length: PLANES }, () => {
      const m = new THREE.Mesh(planeGeom, vertexColorMat)
      // small enough for five to park side by side at the cargo gates
      m.scale.setScalar(0.55)
      const u = unit(m, 3.4)
      // heading first, then pitch around the plane's own wings (not the world's X axis)
      u.group.rotation.order = 'YXZ'
      return u
    })
    root.add(...trucks.map((t) => t.group), ...ships.map((u) => u.group), ...planes.map((u) => u.group))
    return { root, trucks, ships, planes }
  }, [])

  useFrame(() => {
    let t = 0
    let si = 0
    let pi = 0
    for (const v of sim.freight.vehicles) {
      if (v.kind === 'truck') {
        if (t < built.trucks.length) place(built.trucks[t++], v)
      } else if (v.kind === 'ship') {
        if (si >= built.ships.length) continue
        const u = built.ships[si++]
        place(u, v)
        const need = v.order.reduce((n, l) => n + l.need, 0)
        const got = v.order.reduce((n, l) => n + l.got, 0)
        u.containers.count = need > 0 ? Math.round((got / need) * 18) : 0
      } else if (pi < built.planes.length) {
        const u = built.planes[pi++]
        place(u, v)
        // nose up while climbing, a little down on approach
        u.group.rotation.x = v.state === 'leave' && v.y > 0.1 ? -0.18 : v.y > 0.1 ? 0.06 : 0
      }
    }
    for (let i = t; i < built.trucks.length; i++) built.trucks[i].group.visible = false
    for (let i = si; i < built.ships.length; i++) built.ships[i].group.visible = false
    for (let i = pi; i < built.planes.length; i++) built.planes[i].group.visible = false
  })

  return <primitive object={built.root} />
}
