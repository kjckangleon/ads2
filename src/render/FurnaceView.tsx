// The Great Furnace on the north side of camp: a stone kiln whose mouth glows,
// flames and smokes while it has coal. Coal waiting to burn sits on the tray
// in front; the label shows fuel and the sales bonus it's paying.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { furnaceBonus, furnacePay } from '../game/balance'
import { fmt } from '../game/format'
import { useUI } from '../game/uiStore'
import { TextLabel, makeEmojiSprite } from './rutil'
import { coalMat } from './characters'
import { ItemGrid, gridLayout } from './ItemGrid'
import { PopIn, Squash } from './anim'

const stoneMat = new THREE.MeshStandardMaterial({ color: '#7d8590', roughness: 0.95, flatShading: true })
const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#5a616c', roughness: 0.95, flatShading: true })
const ironMat = new THREE.MeshStandardMaterial({ color: '#33383f', roughness: 0.5, metalness: 0.6 })
const snowMat = new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.85 })
const mouthMat = new THREE.MeshStandardMaterial({ color: '#1a1410', emissive: '#ff6a1a', emissiveIntensity: 0 })
const flameMat = new THREE.MeshBasicMaterial({
  color: '#ff9a3a',
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const smokeMat = new THREE.MeshBasicMaterial({ color: '#9aa2ad', transparent: true, opacity: 0.35, depthWrite: false })
const ringMat = new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.45, depthWrite: false })

const lumpGeo = new THREE.IcosahedronGeometry(0.15, 0)
lumpGeo.scale(1.2, 0.85, 1)

function build(withLight: boolean) {
  const f = sim.furnace
  const root = new THREE.Group()
  root.position.set(f.pos.x, 0, f.pos.z)

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 1.5, 8), stoneMat)
  base.position.y = 0.75
  base.castShadow = true
  root.add(base)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.33, 1.33, 0.14, 8), ironMat)
  band.position.y = 1.2
  root.add(band)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), darkStoneMat)
  dome.position.y = 1.5
  dome.castShadow = true
  root.add(dome)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowMat)
  cap.scale.y = 0.45
  cap.position.y = 2.32
  root.add(cap)
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.9, 8), stoneMat)
  chimney.position.set(-0.35, 2.8, -0.4)
  root.add(chimney)
  const chimneyTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 8), ironMat)
  chimneyTop.position.set(-0.35, 3.78, -0.4)
  root.add(chimneyTop)

  // glowing mouth facing camp (the feed side)
  const toFeed = Math.atan2(f.feed.x - f.pos.x, f.feed.z - f.pos.z)
  const front = new THREE.Group()
  front.rotation.y = toFeed
  root.add(front)
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.2), mouthMat)
  mouth.position.set(0, 0.62, 1.32)
  front.add(mouth)
  const arch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.26), ironMat)
  arch.position.set(0, 1.05, 1.34)
  front.add(arch)
  const flames: THREE.Mesh[] = []
  for (const x of [-0.25, 0.05, 0.3]) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), flameMat)
    fl.position.set(x, 0.55, 1.36)
    front.add(fl)
    flames.push(fl)
  }
  // coal tray in front of the mouth shows the fuel waiting to burn
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 0.7), ironMat)
  tray.position.set(0, 0.06, 1.85)
  front.add(tray)
  const fuel = new ItemGrid(lumpGeo, coalMat, 40, gridLayout(4, 2, 0.28, 0.28, 0.17))
  fuel.mesh.position.set(0, 0.16, 1.85)
  front.add(fuel.mesh)

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.95, 24), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.set(f.feed.x - f.pos.x, 0.02, f.feed.z - f.pos.z)
  ring.renderOrder = 2
  root.add(ring)
  const feedIcon = makeEmojiSprite('🪨', 0.55)
  feedIcon.position.set(f.feed.x - f.pos.x, 0.55, f.feed.z - f.pos.z)
  root.add(feedIcon)

  const sign = makeEmojiSprite('🔥', 1.1)
  sign.position.set(0.5, 4.3, 0)
  root.add(sign)
  const label = new TextLabel(0.8)
  label.sprite.position.set(0, 3.3, 0.6)
  root.add(label.sprite)
  const bonus = new TextLabel(0.7, 384)
  bonus.sprite.position.set(0, 2.75, 0.9)
  root.add(bonus.sprite)

  const smoke: THREE.Mesh[] = []
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), smokeMat.clone())
    puff.position.set(-0.35, 4, -0.4)
    root.add(puff)
    smoke.push(puff)
  }

  let light: THREE.PointLight | null = null
  if (withLight) {
    // always mounted (intensity 0 while cold) so the light count never changes
    light = new THREE.PointLight('#ff8a3a', 0, 12, 1.8)
    light.position.set(0, 0.9, 2.2)
    front.add(light)
  }
  return { root, flames, fuel, label, bonus, smoke, light }
}

export function FurnaceView() {
  const quality = useUI((s) => s.quality)
  const v = useMemo(() => build(quality !== 'low'), [quality])
  const pop = useMemo(() => new PopIn(0.9), [])
  const squash = useMemo(() => new Squash(), [])
  const prevFuel = useRef(-1)
  const heat = useRef(0)

  useFrame((_, dt) => {
    const f = sim.furnace
    const s = pop.update(f.built, sim.time)
    v.root.visible = s > 0.01
    if (v.light) v.light.intensity = 0
    if (!f.built) return
    if (prevFuel.current >= 0 && f.fuel > prevFuel.current) squash.kick(sim.time)
    prevFuel.current = f.fuel
    const [sxz, sy] = squash.value(sim.time)
    v.root.scale.set(s * sxz, s * sy, s * sxz)

    heat.current += ((f.burning ? 1 : 0) - heat.current) * Math.min(1, dt * 3)
    const h = heat.current
    const t = sim.time
    mouthMat.emissiveIntensity = h * (1.6 + Math.sin(t * 9) * 0.25)
    v.flames.forEach((fl, i) => {
      fl.visible = h > 0.05
      const k = h * (0.8 + Math.sin(t * (11 + i * 3) + i) * 0.25)
      fl.scale.set(k, k * (1 + Math.sin(t * 17 + i) * 0.2), k)
    })
    v.smoke.forEach((p, i) => {
      const cycle = (((t * 0.4 + i / v.smoke.length) % 1) + 1) % 1
      p.visible = h > 0.05
      p.position.y = 3.9 + cycle * 3.2
      p.position.x = -0.35 + Math.sin(t * 0.7 + i * 2) * 0.35 * cycle
      p.scale.setScalar((0.2 + cycle * 0.6) * h)
      ;(p.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - cycle)
    })
    if (v.light) v.light.intensity = h * (9 + Math.sin(t * 13) * 2)

    v.fuel.update(f.fuel, sim.time)
    v.label.set(`${f.fuel}/${f.cap}`, f.fuel === 0 ? '#ff9a8a' : '#ffffff')
    v.bonus.set(
      f.burning ? `💵 $${fmt(furnacePay(f.level))}/🪨 · sales +${Math.round(furnaceBonus(f.level) * 100)}%` : 'feed me 🪨 coal',
      f.burning ? '#ffd29a' : '#9fc4ff',
    )
  })

  return <primitive object={v.root} />
}
