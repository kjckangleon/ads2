// Consumes the sim's fx event queue each frame and drives pooled visuals:
// floating text, particle bursts, coin flights, item flights.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { TextLabel } from './rutil'
import { makeCarryItem, KIND_ORDER, kindIndex } from './characters'
import { billGeo, billMat } from './PilesView'

const TEXT_POOL = 32
const TEXT_WIDTH = 384
const PARTICLE_POOL = 360
const COIN_POOL = 70
const ITEM_POOL = 56
const ITEM_FLIGHT = 0.26

interface FloatText {
  label: TextLabel
  life: number
  max: number
  size: number
}

interface Particle {
  alive: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  max: number
  color: THREE.Color
}

interface CoinFly {
  active: boolean
  pos: THREE.Vector3
  from: THREE.Vector3
  to: THREE.Vector3
  /** false = home in on the player */
  fixedTarget: boolean
  t: number
}

interface ItemFly {
  active: boolean
  kindIdx: number
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
}

export function FxView() {
  const pools = useMemo(() => {
    const root = new THREE.Group()

    const texts: FloatText[] = []
    for (let i = 0; i < TEXT_POOL; i++) {
      const label = new TextLabel(1, TEXT_WIDTH)
      label.sprite.visible = false
      label.sprite.renderOrder = 10
      root.add(label.sprite)
      texts.push({ label, life: 0, max: 1.1, size: 1 })
    }

    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    const pMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 })
    const pMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL)
    pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    pMesh.frustumCulled = false
    const white = new THREE.Color('#ffffff')
    for (let i = 0; i < PARTICLE_POOL; i++) pMesh.setColorAt(i, white)
    root.add(pMesh)
    const particles: Particle[] = []
    for (let i = 0; i < PARTICLE_POOL; i++) {
      particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        max: 0.7,
        color: new THREE.Color(),
      })
    }

    const coins: CoinFly[] = []
    const coinMeshes: THREE.Mesh[] = []
    for (let i = 0; i < COIN_POOL; i++) {
      const m = new THREE.Mesh(billGeo(), billMat)
      m.scale.setScalar(0.8)
      m.visible = false
      root.add(m)
      coinMeshes.push(m)
      coins.push({
        active: false,
        pos: new THREE.Vector3(),
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        fixedTarget: false,
        t: 0,
      })
    }

    const items: ItemFly[] = []
    const itemMeshes: THREE.Mesh[][] = []
    for (let i = 0; i < ITEM_POOL; i++) {
      const kinds = KIND_ORDER.map((k) => makeCarryItem(k))
      for (const m of kinds) {
        m.visible = false
        root.add(m)
      }
      itemMeshes.push(kinds)
      items.push({ active: false, kindIdx: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0 })
    }

    return { root, texts, particles, pMesh, coins, coinMeshes, items, itemMeshes }
  }, [])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), e: new THREE.Euler() }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05) * sim.speed
    const { texts, particles, pMesh, coins, coinMeshes, items, itemMeshes } = pools

    // ---- dispatch new fx events ----
    for (const fx of sim.fx) {
      switch (fx.t) {
        case 'text': {
          const slot = texts.find((s) => s.life <= 0) ?? texts[0]
          slot.label.set(fx.str, fx.color ?? '#ffffff')
          slot.size = fx.size ?? 1
          slot.label.setScale(slot.size * 1.6)
          slot.label.sprite.position.set(fx.x, fx.y, fx.z)
          slot.life = slot.max
          slot.label.sprite.visible = true
          break
        }
        case 'burst': {
          let spawned = 0
          for (const p of particles) {
            if (spawned >= fx.n) break
            if (p.alive) continue
            p.alive = true
            p.pos.set(fx.x, fx.y, fx.z)
            const spread = fx.spread ?? 0.6
            p.vel.set(
              (Math.random() - 0.5) * spread * 6,
              (fx.up ?? 2.4) + Math.random() * 1.6,
              (Math.random() - 0.5) * spread * 6,
            )
            p.life = p.max = 0.5 + Math.random() * 0.35
            p.color.set(fx.color)
            spawned++
          }
          break
        }
        case 'coin': {
          const slot = coins.find((c) => !c.active)
          if (slot) {
            slot.active = true
            slot.from.set(fx.x, fx.y, fx.z)
            slot.pos.copy(slot.from)
            slot.fixedTarget = !!fx.to
            if (fx.to) slot.to.set(fx.to.x, fx.to.y, fx.to.z)
            slot.t = 0
          }
          break
        }
        case 'itemfly': {
          const slot = items.find((s) => !s.active)
          if (slot) {
            slot.active = true
            slot.kindIdx = kindIndex(fx.kind)
            slot.from.set(fx.from.x, fx.from.y, fx.from.z)
            slot.to.set(fx.to.x, fx.to.y, fx.to.z)
            slot.t = 0
          }
          break
        }
        case 'shake': {
          sim.shake = Math.max(sim.shake, fx.power)
          break
        }
      }
    }
    sim.fx.length = 0

    // ---- floating text ----
    for (const s of texts) {
      if (s.life <= 0) continue
      s.life -= dt
      s.label.sprite.position.y += dt * 1.4
      // pop big, settle quickly, then fade
      const age = s.max - s.life
      s.label.setScale(s.size * (age < 0.14 ? 1.6 - (age / 0.14) * 0.6 : 1))
      s.label.setOpacity(Math.min(1, (s.life / s.max) * 2.5))
      if (s.life <= 0) s.label.sprite.visible = false
    }

    // ---- particles ----
    let needsColor = false
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const p = particles[i]
      if (p.alive) {
        p.life -= dt
        if (p.life <= 0) p.alive = false
      }
      if (!p.alive) {
        tmp.m.compose(p.pos, tmp.q.identity(), tmp.s.setScalar(0.0001))
        pMesh.setMatrixAt(i, tmp.m)
        continue
      }
      p.vel.y -= 7 * dt
      p.pos.addScaledVector(p.vel, dt)
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05
        p.vel.y *= -0.3
      }
      const s = 0.6 + (p.life / p.max) * 0.7
      tmp.q.setFromEuler(tmp.e.set(p.life * 5, p.life * 7, 0))
      tmp.m.compose(p.pos, tmp.q, tmp.s.setScalar(s))
      pMesh.setMatrixAt(i, tmp.m)
      pMesh.setColorAt(i, p.color)
      needsColor = true
    }
    pMesh.instanceMatrix.needsUpdate = true
    if (needsColor && pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true

    // ---- coin flights ----
    const player = sim.player
    for (let i = 0; i < COIN_POOL; i++) {
      const c = coins[i]
      const m = coinMeshes[i]
      if (!c.active) {
        m.visible = false
        continue
      }
      c.t += dt / (c.fixedTarget ? 0.42 : 0.38)
      if (c.t >= 1) {
        c.active = false
        m.visible = false
        continue
      }
      const k = c.t
      const ease = k * k * (3 - 2 * k)
      const tx = c.fixedTarget ? c.to.x : player.pos.x
      const ty = c.fixedTarget ? c.to.y : 1.2
      const tz = c.fixedTarget ? c.to.z : player.pos.z
      c.pos.set(
        c.from.x + (tx - c.from.x) * ease,
        c.from.y + (ty - c.from.y) * ease + Math.sin(k * Math.PI) * (c.fixedTarget ? 1.6 : 1.2),
        c.from.z + (tz - c.from.z) * ease,
      )
      m.visible = true
      m.position.copy(c.pos)
      m.rotation.y += dt * 12
      m.rotation.x += dt * 8
    }

    // ---- item flights ----
    for (let i = 0; i < ITEM_POOL; i++) {
      const it = items[i]
      const meshes = itemMeshes[i]
      if (!it.active) {
        for (const m of meshes) m.visible = false
        continue
      }
      it.t += dt / ITEM_FLIGHT
      if (it.t >= 1) {
        it.active = false
        for (const m of meshes) m.visible = false
        continue
      }
      const k = it.t
      for (let j = 0; j < meshes.length; j++) meshes[j].visible = j === it.kindIdx
      const mesh = meshes[it.kindIdx]
      mesh.position.set(
        it.from.x + (it.to.x - it.from.x) * k,
        it.from.y + (it.to.y - it.from.y) * k + Math.sin(k * Math.PI) * 1.4,
        it.from.z + (it.to.z - it.from.z) * k,
      )
      mesh.rotation.y += dt * 6
    }
  })

  return <primitive object={pools.root} />
}
