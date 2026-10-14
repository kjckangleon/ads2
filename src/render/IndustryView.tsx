// The Industrial Park south of the camp: asphalt roads, concrete lots, the
// sea and the runway are always there (a tease behind the wall); factories,
// the Truck Depot, the Port and the Airport spring up as each stage opens.
// Every building is baked into a few meshes; only stock piles and labels move.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '../game/state'
import type { FactoryId, ResKind, TerminalId, V2 } from '../game/types'
import { PARK, FACTORY_IDS, TERMINAL_IDS, TERMINAL_CFG, capText } from '../game/balance'
import { RES_ICON } from '../game/icons'
import { TextLabel, colorGeo, vertexColorMat, mergeStatic } from './rutil'
import { ItemGrid, gridLayout } from './ItemGrid'
import { PopIn } from './anim'
import { furnitureGeo, steelGeo, jacketGeo, cannedGeo } from './characters'

const asphaltMat = new THREE.MeshStandardMaterial({ color: '#41474f', roughness: 0.95 })
const concreteMat = new THREE.MeshStandardMaterial({ color: '#b3bac3', roughness: 0.95 })
const lineMat = new THREE.MeshBasicMaterial({ color: '#f2d24b' })
const whiteMat = new THREE.MeshBasicMaterial({ color: '#eef2f6' })
const seaMat = new THREE.MeshStandardMaterial({ color: '#2f5f80', roughness: 0.35, metalness: 0.15 })
const iceMat = new THREE.MeshStandardMaterial({ color: '#e4eef7', roughness: 0.9 })
const lightMat = new THREE.MeshBasicMaterial({ color: '#ffd77a' })

/** a flat rectangle on the ground (y slightly above the snow) */
function flat(x0: number, z0: number, x1: number, z1: number, y = 0.02): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0))
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
  return g
}

function disc(x: number, z: number, r: number, y = 0.021): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, 28)
  g.rotateX(-Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** roads, lots, the sea, the runway: one mesh per material */
function buildGround(): THREE.Group {
  const root = new THREE.Group()
  const asphalt: THREE.BufferGeometry[] = []
  const concrete: THREE.BufferGeometry[] = []
  const lines: THREE.BufferGeometry[] = []
  const white: THREE.BufferGeometry[] = []
  const lz = PARK.truckLaneZ
  const oz = PARK.truckOutZ
  // truck road (two lanes) with a turnaround, dashed centre line
  asphalt.push(flat(-120, lz - 1.6, PARK.truckTurnX, oz + 1.6))
  asphalt.push(disc(PARK.truckTurnX, (lz + oz) / 2, (oz - lz) / 2 + 1.6))
  for (let x = -110; x < PARK.truckTurnX - 3; x += 4)
    lines.push(flat(x, (lz + oz) / 2 - 0.08, x + 2, (lz + oz) / 2 + 0.08, 0.03))
  // the avenue from the gate to the airport, and a plaza around the vault
  asphalt.push(flat(-1.2, 34.6, 3.2, 55))
  for (let z = 36; z < 54; z += 3) white.push(flat(0.92, z, 1.08, z + 1.5, 0.03))
  concrete.push(flat(PARK.vault.x - 2.6, PARK.vault.z - 2.4, PARK.vault.x + 2.6, PARK.vault.z + 2.4, 0.025))
  // factory lots
  for (const id of FACTORY_IDS) {
    const p = PARK.factories[id]
    concrete.push(flat(p.x - 3.6, p.z - 3.6, p.x + 3.6, p.z + 3.6))
  }
  // terminal lots: depot yard, airport apron, the port's quay
  concrete.push(flat(-33, 43.5, -22.5, 49))
  concrete.push(flat(-6.5, 55, 9, 64))
  concrete.push(flat(12.5, 60.4, 46, PARK.seaZ))
  // runway with edge lights' strip, centre dashes and threshold bars
  const rz = PARK.runwayZ
  asphalt.push(flat(-160, rz - 2.4, 12, rz + 2.4))
  for (let x = -150; x < 8; x += 6) white.push(flat(x, rz - 0.1, x + 3, rz + 0.1, 0.03))
  for (let i = 0; i < 6; i++) white.push(flat(4 + 0, rz - 2 + i * 0.75, 8, rz - 1.7 + i * 0.75, 0.03))
  // taxiway from the apron to the runway
  asphalt.push(flat(-1.5, 63.5, 3.5, rz - 2.3))
  root.add(new THREE.Mesh(mergeGeometries(asphalt)!, asphaltMat))
  root.add(new THREE.Mesh(mergeGeometries(concrete)!, concreteMat))
  root.add(new THREE.Mesh(mergeGeometries(lines)!, lineMat))
  root.add(new THREE.Mesh(mergeGeometries(white)!, whiteMat))
  for (const m of root.children as THREE.Mesh[]) {
    m.receiveShadow = true
    m.renderOrder = 1
  }

  // the sea, with a few ice floes
  const sea = new THREE.Mesh(flat(-400, PARK.seaZ, 400, 320, 0.015), seaMat)
  sea.receiveShadow = true
  root.add(sea)
  const floes: THREE.BufferGeometry[] = []
  const spots = [
    [-40, 82, 3],
    [-12, 96, 4.5],
    [44, 88, 3.5],
    [70, 104, 5],
    [-70, 110, 6],
    [8, 118, 4],
  ]
  for (const [x, z, r] of spots) {
    const g = new THREE.CylinderGeometry(r, r * 1.1, 0.25, 7)
    g.translate(x, 0.05, z)
    floes.push(g)
  }
  root.add(new THREE.Mesh(mergeGeometries(floes)!, iceMat))

  // runway edge lights
  const lights: THREE.BufferGeometry[] = []
  for (let x = -150; x <= 12; x += 5) {
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.18, 0.12, 0.18)
      g.translate(x, 0.06, rz + s * 2.5)
      lights.push(g)
    }
  }
  root.add(new THREE.Mesh(mergeGeometries(lights)!, lightMat))
  return root
}

// ---------- buildings ----------

const FACTORY_STYLE: Record<FactoryId, { name: string; accent: string; wall: string }> = {
  furnFactory: { name: '🪑 Furniture', accent: '#c58b52', wall: '#e2d6c6' },
  cannery: { name: '🥫 Cannery', accent: '#d8463a', wall: '#dfe3e8' },
  fashion: { name: '🧥 Fashion', accent: '#2f6fd6', wall: '#e3e6ef' },
  steelMill: { name: '🔩 Steel Mill', accent: '#5b6878', wall: '#c8ced6' },
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return colorGeo(g, color)
}

/** a factory hall: sawtooth roof with snow, chimney, intake hopper north, loading door south */
function factoryGeo(id: FactoryId): THREE.BufferGeometry {
  const st = FACTORY_STYLE[id]
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(5, 3, 4, 0, 1.5, 0, st.wall))
  parts.push(box(5.04, 0.35, 4.04, 0, 0.18, 0, '#7c8592'))
  parts.push(box(5.06, 0.4, 4.06, 0, 2.4, 0, st.accent))
  // sawtooth roof: three ridges with their glass faces north and snow on top
  for (let i = 0; i < 3; i++) {
    const x = -5 / 3 + (5 / 3) * i
    const g = new THREE.CylinderGeometry(0.01, 1.05, 4, 3, 1)
    g.rotateZ(Math.PI / 2)
    g.rotateX(Math.PI / 6)
    g.scale(1, 0.75, 1)
    g.rotateY(Math.PI / 2)
    g.translate(x, 3.45, 0)
    parts.push(colorGeo(g, '#5b6878'))
    parts.push(box(1.5, 0.12, 3.9, x, 3.98, 0.15, '#f4f8fc'))
  }
  // windows strip on both long faces
  for (const z of [-2.02, 2.02]) {
    for (let i = 0; i < 4; i++) parts.push(box(0.8, 0.6, 0.04, -1.8 + i * 1.2, 1.9, z, '#7fb4d9'))
  }
  // chimney with a red band
  const ch = new THREE.CylinderGeometry(0.32, 0.38, 3.2, 10)
  ch.translate(1.6, 4.6, -1.0)
  parts.push(colorGeo(ch, '#b5543c'))
  const band = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10)
  band.translate(1.6, 5.8, -1.0)
  parts.push(colorGeo(band, '#eef2f6'))
  // intake hopper (north) and loading door (south)
  const hop = new THREE.CylinderGeometry(0.75, 0.4, 0.8, 4, 1, true)
  hop.rotateY(Math.PI / 4)
  hop.translate(0, 1.0, -2.45)
  parts.push(colorGeo(hop, '#e07a1a'))
  parts.push(box(1.8, 1.8, 0.06, 0, 0.95, 2.03, '#3a4150'))
  for (let i = 0; i < 5; i++) parts.push(box(1.8, 0.04, 0.08, 0, 0.3 + i * 0.32, 2.05, '#5c6575'))
  return mergeGeometries(parts)!
}

function depotGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(5, 2.8, 3.4, 0, 1.4, 0, '#d9dee5'))
  parts.push(box(5.1, 0.3, 3.5, 0, 2.95, 0, '#2f6fd6'))
  parts.push(box(5.0, 0.12, 3.3, 0, 3.15, 0, '#f4f8fc'))
  // three roll-up bay doors facing the truck lane (south)
  for (let i = 0; i < 3; i++) {
    parts.push(box(1.2, 1.9, 0.06, -1.6 + i * 1.6, 0.95, 1.73, '#3a4150'))
    parts.push(box(1.3, 0.12, 0.2, -1.6 + i * 1.6, 2.0, 1.78, '#f2d24b'))
  }
  // loading dock lip
  parts.push(box(5, 0.5, 0.8, 0, 0.25, 2.1, '#8b95a3'))
  return mergeGeometries(parts)!
}

function portGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  // warehouse
  parts.push(box(6.8, 3.4, 3.6, 0, 1.7, 0, '#cfd5dc'))
  parts.push(box(6.9, 0.3, 3.7, 0, 3.55, 0, '#d8463a'))
  parts.push(box(6.8, 0.12, 3.5, 0, 3.75, 0, '#f4f8fc'))
  for (let i = 0; i < 2; i++) parts.push(box(2, 2.4, 0.06, -1.6 + i * 3.2, 1.2, 1.83, '#3a4150'))
  // gantry cranes on the quay, booms over the water
  for (const cx of [-7, 8]) {
    for (const dx of [-1.1, 1.1]) parts.push(box(0.3, 5.5, 0.3, cx + dx, 2.75, 3.4, '#f2a82b'))
    parts.push(box(2.6, 0.45, 0.45, cx, 5.5, 3.4, '#f2a82b'))
    parts.push(box(0.4, 0.4, 7, cx, 5.85, 5.6, '#e0901a'))
    parts.push(box(0.9, 0.7, 0.9, cx, 5.2, 7.6, '#3a4150'))
  }
  // container stacks on the east of the quay
  const colors = ['#d8463a', '#2f6fd6', '#2e9a5a', '#f2d24b', '#8a5ad6']
  let k = 0
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      for (let h = 0; h < 2 - ((i + j) % 2); h++) {
        parts.push(box(2.6, 1.1, 1.1, 10 + i * 2.8, 0.55 + h * 1.1, -1 + j * 1.25, colors[k++ % colors.length]))
      }
    }
  }
  // bollards along the quay edge
  for (let x = -9; x <= 20; x += 4) {
    const b = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8)
    b.translate(x, 0.2, PARK.seaZ - TERMINAL_CFG.port.pos.z - 0.3)
    parts.push(colorGeo(b, '#2a2f38'))
  }
  return mergeGeometries(parts)!
}

function airportGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(6, 2.6, 3.2, 0, 1.3, 0, '#e6ebf2'))
  // glass front facing the apron (south)
  parts.push(box(5.6, 1.8, 0.06, 0, 1.4, 1.62, '#7fb4d9'))
  parts.push(box(6.2, 0.3, 3.4, 0, 2.75, 0, '#2f6fd6'))
  parts.push(box(6, 0.12, 3.2, 0, 2.95, 0, '#f4f8fc'))
  // control tower on the east side
  const shaft = new THREE.CylinderGeometry(0.45, 0.55, 6, 10)
  shaft.translate(8.2, 3, 1.2)
  parts.push(colorGeo(shaft, '#dfe3e8'))
  const cab = new THREE.CylinderGeometry(1.1, 0.9, 1.0, 8)
  cab.translate(8.2, 6.4, 1.2)
  parts.push(colorGeo(cab, '#7fb4d9'))
  const roof = new THREE.CylinderGeometry(1.2, 1.2, 0.18, 8)
  roof.translate(8.2, 7.0, 1.2)
  parts.push(colorGeo(roof, '#f4f8fc'))
  parts.push(box(0.06, 1.2, 0.06, 8.2, 7.6, 1.2, '#8a96a5'))
  return mergeGeometries(parts)!
}

function vaultGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(2.6, 2.0, 2.2, 0, 1.0, 0, '#e8e0cc'))
  for (const x of [-0.9, -0.3, 0.3, 0.9]) {
    const c = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8)
    c.translate(x, 0.95, 1.15)
    parts.push(colorGeo(c, '#f4efe2'))
  }
  const roof = new THREE.CylinderGeometry(0.01, 1.7, 0.8, 4, 1)
  roof.rotateY(Math.PI / 4)
  roof.scale(1.1, 1, 0.95)
  roof.translate(0, 2.4, 0)
  parts.push(colorGeo(roof, '#c9a64a'))
  parts.push(box(0.9, 1.3, 0.05, 0, 0.65, 1.12, '#5a4a2a'))
  return mergeGeometries(parts)!
}

// ---------- stock piles ----------

const PRODUCT_GEO: Partial<Record<ResKind, () => THREE.BufferGeometry>> = {
  furniture: furnitureGeo,
  steel: steelGeo,
  jacket: jacketGeo,
  canned: cannedGeo,
}

interface Pile {
  kind: ResKind
  grid: ItemGrid
  label: TextLabel
}

function makePile(kind: ResKind, at: V2, root: THREE.Group, cols = 3): Pile {
  const grid = new ItemGrid(PRODUCT_GEO[kind]!(), vertexColorMat, 36, gridLayout(cols, 3, 0.58, 0.42, 0.3))
  grid.mesh.position.set(at.x, 0.12, at.z)
  grid.mesh.castShadow = true
  root.add(grid.mesh)
  const label = new TextLabel(0.7)
  label.sprite.position.set(at.x, 2.2, at.z)
  root.add(label.sprite)
  return { kind, grid, label }
}

function signLabel(text: string, at: V2, y: number, root: THREE.Group, scale = 0.95) {
  const l = new TextLabel(scale, 384)
  l.set(text, '#ffffff')
  l.sprite.position.set(at.x, y, at.z)
  root.add(l.sprite)
  return l
}

interface FactoryVis {
  id: FactoryId
  root: THREE.Group
  inLabel: TextLabel
  out: Pile
}

function buildFactory(id: FactoryId): FactoryVis {
  const pr = sim.proc[id]
  const root = new THREE.Group()
  const body = new THREE.Mesh(factoryGeo(id), vertexColorMat)
  body.position.set(pr.pos.x, 0, pr.pos.z)
  body.castShadow = true
  body.receiveShadow = true
  root.add(body)
  signLabel(FACTORY_STYLE[id].name, pr.pos, 5.1, root)
  const inLabel = new TextLabel(0.7)
  inLabel.sprite.position.set(pr.inZone.x - 1.6, 2.4, pr.inZone.z)
  root.add(inLabel.sprite)
  const out = makePile(pr.outKind, { x: pr.outZone.x + 1.9, z: pr.outZone.z + 0.4 }, root, 2)
  return { id, root, inLabel, out }
}

interface TerminalVis {
  id: TerminalId
  root: THREE.Group
  piles: Pile[]
}

const TERMINAL_GEO: Record<TerminalId, () => THREE.BufferGeometry> = { dock: depotGeo, port: portGeo, air: airportGeo }
const TERMINAL_SIGN: Record<TerminalId, string> = { dock: '🚚 Truck Depot', port: '🚢 Port', air: '✈️ Airport' }

function buildTerminal(id: TerminalId): TerminalVis {
  const t = sim.terminals[id]
  const root = new THREE.Group()
  const body = new THREE.Mesh(TERMINAL_GEO[id](), vertexColorMat)
  body.position.set(t.pos.x, 0, t.pos.z)
  body.castShadow = true
  body.receiveShadow = true
  root.add(body)
  signLabel(TERMINAL_SIGN[id], t.pos, id === 'port' ? 4.9 : 4.2, root)
  // stock waits by the drop-off: one pile per product, side by side
  const piles = t.kinds.map((k, i) => {
    const off = (i - (t.kinds.length - 1) / 2) * 2.4
    const at =
      id === 'dock'
        ? { x: t.restock.x + 0.4, z: t.restock.z - 2.4 }
        : { x: t.restock.x + off + 2.6, z: t.restock.z - 0.4 }
    return makePile(k, at, root)
  })
  return { id, root, piles }
}

function updatePile(p: Pile, count: number, cap: number, time: number) {
  p.grid.update(count, time)
  p.label.set(`${RES_ICON[p.kind]} ${capText(count, cap)}`, '#ffffff')
  p.label.sprite.position.y = 1.0 + p.grid.topY(Math.min(count, 36)) + 0.5
}

export function IndustryView() {
  const built = useMemo(() => {
    const ground = buildGround()
    const factories = FACTORY_IDS.map(buildFactory)
    const terminals = TERMINAL_IDS.map(buildTerminal)
    const vaultRoot = new THREE.Group()
    const vault = new THREE.Mesh(vaultGeo(), vertexColorMat)
    vault.position.set(PARK.vault.x, 0, PARK.vault.z)
    vault.castShadow = true
    vaultRoot.add(vault)
    signLabel('🏦 Vault', PARK.vault, 3.6, vaultRoot, 0.8)
    // bake each building's static parts (labels and piles stay live)
    for (const r of [...factories.map((f) => f.root), ...terminals.map((t) => t.root), vaultRoot]) {
      mergeStatic(r, (o) => (o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh)
    }
    return {
      ground,
      factories: factories.map((f) => ({ ...f, pop: new PopIn(0.9) })),
      terminals: terminals.map((t) => ({ ...t, pop: new PopIn(0.9) })),
      vaultRoot,
      vaultPop: new PopIn(0.9),
    }
  }, [])

  useFrame(() => {
    const time = sim.time
    for (const f of built.factories) {
      const pr = sim.proc[f.id]
      const s = f.pop.update(pr.unlocked, time)
      f.root.visible = s > 0.01
      if (!f.root.visible) continue
      f.root.scale.set(1, Math.max(0.001, s), 1)
      f.inLabel.set(`${RES_ICON[pr.inKind]} ${capText(pr.inCount, pr.inCap)}`, '#ffd6a0')
      updatePile(f.out, pr.outCount, pr.outCap, time)
    }
    for (const t of built.terminals) {
      const term = sim.terminals[t.id]
      const s = t.pop.update(term.open, time)
      t.root.visible = s > 0.01
      if (!t.root.visible) continue
      t.root.scale.set(1, Math.max(0.001, s), 1)
      for (const p of t.piles) updatePile(p, term.stock[p.kind] ?? 0, term.cap, time)
    }
    const vs = built.vaultPop.update(sim.zones.industry, time)
    built.vaultRoot.visible = vs > 0.01
    built.vaultRoot.scale.set(1, Math.max(0.001, vs), 1)
  })

  return (
    <group>
      <primitive object={built.ground} />
      {built.factories.map((f) => (
        <primitive key={f.id} object={f.root} />
      ))}
      {built.terminals.map((t) => (
        <primitive key={t.id} object={t.root} />
      ))}
      <primitive object={built.vaultRoot} />
    </group>
  )
}
