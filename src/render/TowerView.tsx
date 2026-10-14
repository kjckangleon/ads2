// The hunting tower: wooden platform, animated archer, rotating aim,
// visible range ring, and physical level-up changes (roof, banner).

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { towerRange } from '../game/balance'
import { makeCharacterRig, WORKER_PALETTES } from './characters'
import { PopIn } from './anim'

const woodMat = new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 0.9 })
const woodDark = new THREE.MeshStandardMaterial({ color: '#54402c', roughness: 0.9 })
const snowMat = new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.85 })

export function TowerView() {
  const built = useMemo(() => {
    const t = sim.tower
    const root = new THREE.Group()
    root.position.set(t.pos.x, 0, t.pos.z)

    // legs
    for (const [x, z] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.1, 7), woodMat)
      leg.position.set(x, 1.55, z)
      leg.castShadow = true
      root.add(leg)
    }
    // cross braces
    for (const r of [0, Math.PI / 2]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), woodDark)
      brace.position.y = 1.4
      brace.rotation.y = r
      brace.rotation.z = 0.5
      root.add(brace)
    }
    // platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.9), woodMat)
    platform.position.y = 3.15
    platform.castShadow = true
    root.add(platform)
    // railing
    for (const [x, z, ry] of [
      [0, -0.9, 0],
      [0, 0.9, 0],
      [-0.9, 0, Math.PI / 2],
      [0.9, 0, Math.PI / 2],
    ] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.07), woodDark)
      rail.position.set(x, 3.65, z)
      rail.rotation.y = ry
      root.add(rail)
    }
    // ladder
    const ladder = new THREE.Group()
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), woodDark)
      side.position.set(s * 0.2, 1.6, 1.05)
      ladder.add(side)
    }
    for (let i = 0; i < 6; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5), woodDark)
      rung.rotation.z = Math.PI / 2
      rung.position.set(0, 0.5 + i * 0.5, 1.05)
      ladder.add(rung)
    }
    root.add(ladder)

    // level visuals: corner torches + banner + flag. No roof — it would hide
    // the archer from the elevated camera.
    const bannerMat = new THREE.MeshStandardMaterial({
      color: '#b23a2e',
      side: THREE.DoubleSide,
      roughness: 0.8,
    })
    // banner appears at >= 2 total upgrade levels
    const roofGroup = new THREE.Group()
    const banner1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), bannerMat)
    banner1.position.set(0.96, 2.55, 0)
    banner1.rotation.y = Math.PI / 2
    roofGroup.add(banner1)
    const banner1b = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), bannerMat)
    banner1b.position.set(-0.96, 2.55, 0)
    banner1b.rotation.y = Math.PI / 2
    roofGroup.add(banner1b)
    roofGroup.visible = false
    root.add(roofGroup)

    // flag pole at >= 6 total upgrade levels
    const banner = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), woodDark)
    pole.position.set(-0.8, 4.4, -0.8)
    banner.add(pole)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.42), bannerMat)
    flag.position.set(-0.42, 4.85, -0.8)
    banner.add(flag)
    const snowCap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), snowMat)
    snowCap.position.set(-0.8, 5.12, -0.8)
    banner.add(snowCap)
    banner.visible = false
    root.add(banner)

    // archer (rotates with aim)
    const aimGroup = new THREE.Group()
    aimGroup.position.y = 3.22
    const archer = makeCharacterRig(WORKER_PALETTES.archer, 0)
    archer.group.scale.setScalar(0.85)
    aimGroup.add(archer.group)
    // bow
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.03, 6, 14, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.8 }),
    )
    bow.position.set(0, 1.05, 0.42)
    bow.rotation.z = Math.PI / 2
    aimGroup.add(bow)
    const nockedArrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5),
      new THREE.MeshStandardMaterial({ color: '#d8cbb0' }),
    )
    nockedArrow.rotation.x = Math.PI / 2
    nockedArrow.position.set(0, 1.05, 0.42)
    aimGroup.add(nockedArrow)
    root.add(aimGroup)

    // range ring
    const rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.06, 56),
      new THREE.MeshBasicMaterial({
        color: '#9fd0ff',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    )
    rangeRing.rotation.x = -Math.PI / 2
    rangeRing.position.y = 0.03
    rangeRing.renderOrder = 2
    root.add(rangeRing)

    return { root, roofGroup, banner, aimGroup, nockedArrow, rangeRing, archer }
  }, [])

  const pop = useMemo(() => new PopIn(0.85), [])
  const shownSince = useRef(-1)

  useFrame(() => {
    const t = sim.tower
    const visible = t.built
    const s = pop.update(visible, sim.time)
    built.root.visible = s > 0.01
    built.root.scale.setScalar(Math.max(s, 0.001))
    if (!visible) return
    if (shownSince.current < 0) shownSince.current = sim.time

    const totalLvl = t.dmgLvl + t.spdLvl + t.rngLvl
    built.roofGroup.visible = totalLvl >= 2
    built.banner.visible = totalLvl >= 6

    built.aimGroup.rotation.y = t.yaw
    // draw animation: arrow appears then snaps forward
    built.nockedArrow.visible = t.targetId !== null
    if (t.drawT > 0) {
      built.nockedArrow.position.z = 0.42 - t.drawT * 0.3
    } else {
      built.nockedArrow.position.z = 0.42
    }

    // range ring: show for a few seconds after build / when player is close
    const range = towerRange(t.rngLvl)
    built.rangeRing.scale.setScalar(range)
    const px = sim.player.pos.x - t.pos.x
    const pz = sim.player.pos.z - t.pos.z
    const nearPlayer = px * px + pz * pz < 64
    const justBuilt = sim.time - shownSince.current < 5
    // at night the ring shows what the tower actually protects
    built.rangeRing.visible = nearPlayer || justBuilt || sim.clock.dark > 0.3
    ;(built.rangeRing.material as THREE.MeshBasicMaterial).opacity =
      0.22 + Math.sin(sim.time * 3) * 0.08
  })

  return <primitive object={built.root} />
}
