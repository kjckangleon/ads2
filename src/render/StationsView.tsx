// Market stalls with physical, staged inventory piles, restock-zone markers,
// queue slot dots, a live "stock / capacity" label, night lanterns and
// decorations that appear as the stall levels up.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { StationId } from '../game/types'
import { STATION_IDS } from '../game/balance'
import { useUI } from '../game/uiStore'
import { TextLabel, makeEmojiSprite, vertexColorMat } from './rutil'
import { coatGeo, cookedMeatMat } from './characters'
import { ItemGrid, gridLayout } from './ItemGrid'
import { PopIn, Squash } from './anim'

const STYLE: Record<StationId, { roof: string; sign: string; zoneIcon: string; zoneColor: string }> = {
  wood: { roof: '#4a6b52', sign: '🪵', zoneIcon: '🪵', zoneColor: '#c9a86a' },
  meat: { roof: '#8a4a3f', sign: '🍖', zoneIcon: '🍗', zoneColor: '#d98a6a' },
  coat: { roof: '#3e5a8a', sign: '🧥', zoneIcon: '🧥', zoneColor: '#8fb0e0' },
}

const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.9 })
const woodDarkMat = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.9 })
const counterTopMat = new THREE.MeshStandardMaterial({ color: '#94714a', roughness: 0.85 })
const snowTrimMat = new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.85 })
const logMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 })
const crateMat = new THREE.MeshStandardMaterial({ color: '#9a7448', roughness: 0.9 })
const goldMat = new THREE.MeshStandardMaterial({ color: '#e8bb4a', metalness: 0.6, roughness: 0.35 })
export const lanternMat = new THREE.MeshStandardMaterial({
  color: '#3a2a1a',
  emissive: '#ffb347',
  emissiveIntensity: 0.2,
})
const slotDotMat = new THREE.MeshBasicMaterial({ color: '#8fa3bd', transparent: true, opacity: 0.28, depthWrite: false })
const flagColors = ['#c0563f', '#e8c04a', '#4fa06a', '#3e6fd1']
const flagMats = flagColors.map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }))

const logGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.85, 8)
logGeo.rotateZ(Math.PI / 2)
const meatGeo = new THREE.SphereGeometry(0.19, 10, 8)
meatGeo.scale(1.3, 0.72, 1)

/** every stocked item is shown, up to these per-stall maximums */
function makeStockGrid(id: StationId): { grid: ItemGrid; y: number; z: number } {
  switch (id) {
    case 'wood':
      // crisscross log pile behind the counter, where the player drops logs
      return { grid: new ItemGrid(logGeo, logMat, 72, gridLayout(1, 6, 0.85, 0.23, 0.21, true)), y: 0.12, z: -1.6 }
    case 'meat':
      return { grid: new ItemGrid(meatGeo, cookedMeatMat, 48, gridLayout(6, 2, 0.4, 0.42, 0.18)), y: 1.05, z: 0 }
    case 'coat':
      return { grid: new ItemGrid(coatGeo(), vertexColorMat, 40, gridLayout(4, 2, 0.62, 0.42, 0.15)), y: 1.03, z: 0 }
  }
}

interface Stall {
  root: THREE.Group
  stock: ItemGrid
  label: TextLabel
  light: THREE.PointLight | null
  deco: { lvl: number; obj: THREE.Object3D }[]
}

function buildStall(id: StationId, withLight: boolean): Stall {
  const st = sim.stations[id]
  const style = STYLE[id]
  const root = new THREE.Group()
  root.position.set(st.pos.x, 0, st.pos.z)

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 1.05), woodMat)
  counter.position.y = 0.42
  counter.castShadow = true
  root.add(counter)
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.1, 1.3), counterTopMat)
  top.position.y = 0.9
  root.add(top)

  for (const [x, z] of [
    [-1.35, -0.5],
    [1.35, -0.5],
    [-1.35, 0.5],
    [1.35, 0.5],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 7), woodDarkMat)
    post.position.set(x, 1.2, z)
    root.add(post)
  }

  const roofMat = new THREE.MeshStandardMaterial({ color: style.roof, roughness: 0.85 })
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.09, 1.9), roofMat)
  roof.position.set(0, 2.5, 0)
  roof.rotation.x = -0.16
  roof.castShadow = true
  root.add(roof)
  const snow = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 1.9), snowTrimMat)
  snow.position.set(0, 2.58, 0)
  snow.rotation.x = -0.16
  root.add(snow)

  const sign = makeEmojiSprite(style.sign, 1.1)
  sign.position.set(0, 3.3, 0)
  root.add(sign)

  const label = new TextLabel(0.85)
  label.sprite.position.set(0, 1.7, 0.2)
  root.add(label.sprite)

  const stockGrid = makeStockGrid(id)
  stockGrid.grid.mesh.position.set(0, stockGrid.y, stockGrid.z)
  stockGrid.grid.mesh.castShadow = true
  root.add(stockGrid.grid.mesh)

  // restock zone marker
  const zoneMat = new THREE.MeshBasicMaterial({ color: style.zoneColor, transparent: true, opacity: 0.4, depthWrite: false })
  const zone = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.95, 24), zoneMat)
  zone.rotation.x = -Math.PI / 2
  zone.position.set(st.restock.x - st.pos.x, 0.02, st.restock.z - st.pos.z)
  zone.renderOrder = 2
  root.add(zone)
  const zoneIcon = makeEmojiSprite(style.zoneIcon, 0.55)
  zoneIcon.position.set(st.restock.x - st.pos.x, 0.5, st.restock.z - st.pos.z)
  ;(zoneIcon.material as THREE.SpriteMaterial).opacity = 0.8
  root.add(zoneIcon)

  const dotGeo = new THREE.CircleGeometry(0.3, 12)
  for (let i = 0; i < st.queueSize; i++) {
    const dot = new THREE.Mesh(dotGeo, slotDotMat)
    dot.rotation.x = -Math.PI / 2
    dot.position.set(
      st.queueBase.x - st.pos.x + st.queueDir.x * st.queueSpacing * i,
      0.025,
      st.queueBase.z - st.pos.z + st.queueDir.z * st.queueSpacing * i,
    )
    dot.renderOrder = 2
    root.add(dot)
  }

  // lantern on the front-left post; glows at night
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), lanternMat)
  lantern.position.set(-1.35, 2.0, 0.66)
  root.add(lantern)
  let light: THREE.PointLight | null = null
  if (withLight) {
    light = new THREE.PointLight('#ffb35a', 0, 10, 1.8)
    light.position.set(-1.1, 2.0, 1.3)
    root.add(light)
  }

  // level decorations
  const deco: Stall['deco'] = []
  const crates = new THREE.Group()
  for (const [x, y, z, s] of [
    [1.95, 0.28, -0.3, 0.56],
    [2.15, 0.22, 0.4, 0.44],
    [1.98, 0.74, -0.25, 0.38],
  ]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat)
    c.position.set(x, y, z)
    c.rotation.y = x * 0.7
    crates.add(c)
  }
  deco.push({ lvl: 2, obj: crates })

  const bunting = new THREE.Group()
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 3), flagMats[i % flagMats.length])
    f.rotation.x = Math.PI
    f.position.set(-1.5 + i * 0.5, 2.15 - Math.sin((i / 6) * Math.PI) * 0.12, 0.96)
    bunting.add(f)
  }
  deco.push({ lvl: 4, obj: bunting })

  const trim = new THREE.Group()
  const goldBar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 0.08), goldMat)
  goldBar.position.set(0, 0.96, 0.66)
  trim.add(goldBar)
  const star = makeEmojiSprite('⭐', 0.6)
  star.position.set(0.85, 3.4, 0)
  trim.add(star)
  deco.push({ lvl: 7, obj: trim })

  for (const d of deco) {
    d.obj.visible = false
    root.add(d.obj)
  }

  return { root, stock: stockGrid.grid, label, light, deco }
}

function StallView({ id, withLight }: { id: StationId; withLight: boolean }) {
  const built = useMemo(() => buildStall(id, withLight), [id, withLight])
  const pop = useMemo(() => new PopIn(0.75), [])
  const squash = useMemo(() => new Squash(), [])
  const prevStock = useRef(-1)

  useFrame(() => {
    const st = sim.stations[id]
    const s = pop.update(st.unlocked, sim.time)
    built.root.visible = s > 0.01
    if (built.light) built.light.intensity = st.unlocked ? sim.clock.dark * 7 : 0
    if (!st.unlocked) return
    // every delivered item makes the stall bounce
    if (prevStock.current >= 0 && st.stock > prevStock.current) squash.kick(sim.time)
    prevStock.current = st.stock
    const [sxz, sy] = squash.value(sim.time)
    built.root.scale.set(s * sxz, s * sy, s * sxz)
    built.stock.update(st.stock, sim.time)
    built.label.set(`${st.stock}/${st.capacity}`, st.stock === 0 ? '#ff9a8a' : '#ffffff')
    for (const d of built.deco) d.obj.visible = st.level >= d.lvl
  })

  return <primitive object={built.root} />
}

// money chest by the campfire (cash collectors deposit here)
function ChestView() {
  const group = useMemo(() => {
    const g = new THREE.Group()
    g.position.set(sim.chest.pos.x, 0, sim.chest.pos.z)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.6),
      new THREE.MeshStandardMaterial({ color: '#6e4a2a', roughness: 0.85 }),
    )
    base.position.y = 0.28
    base.castShadow = true
    g.add(base)
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#7d5631', roughness: 0.85 }),
    )
    lid.rotation.z = Math.PI / 2
    lid.position.y = 0.56
    g.add(lid)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.6, 0.12), goldMat)
    band.position.y = 0.3
    g.add(band)
    return g
  }, [])
  return <primitive object={group} />
}

export function StationsView() {
  const quality = useUI((s) => s.quality)
  const withLight = quality !== 'low'
  useFrame(() => {
    lanternMat.emissiveIntensity = 0.2 + sim.clock.dark * 2.6
  })
  return (
    <group>
      {STATION_IDS.map((id) => (
        <StallView key={id} id={id} withLight={withLight} />
      ))}
      <ChestView />
    </group>
  )
}
