// Purchase pads: glowing floor discs. Stand on one and coins drain in;
// a gold disc fills radially outward as you pay.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { TextLabel, makeEmojiSprite, emojiTexture } from './rutil'
import { damp } from '../game/util'
import { fmt } from '../game/format'

interface PadVisual {
  root: THREE.Group
  base: THREE.Mesh
  fill: THREE.Mesh
  ring: THREE.Mesh
  icon: THREE.Sprite
  nameLabel: TextLabel
  costLabel: TextLabel
  scale: number
}

const baseMat = new THREE.MeshStandardMaterial({ color: '#33415c', roughness: 0.7 })
const fillMat = new THREE.MeshStandardMaterial({
  color: '#e8bb4a',
  roughness: 0.4,
  metalness: 0.4,
  emissive: '#7a5c14',
})
const ringMatAfford = new THREE.MeshBasicMaterial({
  color: '#7fdc8f',
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})
const ringMatPoor = new THREE.MeshBasicMaterial({
  color: '#8fa3bd',
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
})
const ringMatLocked = new THREE.MeshBasicMaterial({
  color: '#6f86b8',
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
})
const baseMatLocked = new THREE.MeshStandardMaterial({ color: '#28324a', roughness: 0.8 })

const baseGeo = new THREE.CylinderGeometry(1.35, 1.45, 0.1, 28)
const fillGeo = new THREE.CylinderGeometry(1, 1, 0.06, 24)
const ringGeo = new THREE.RingGeometry(1.36, 1.52, 32)

function makePadVisual(): PadVisual {
  const root = new THREE.Group()
  const base = new THREE.Mesh(baseGeo, baseMat)
  base.position.y = 0.05
  root.add(base)
  const fill = new THREE.Mesh(fillGeo, fillMat)
  fill.position.y = 0.11
  fill.scale.setScalar(0.001)
  root.add(fill)
  const ring = new THREE.Mesh(ringGeo, ringMatPoor)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.115
  ring.renderOrder = 2
  root.add(ring)
  const icon = makeEmojiSprite('❔', 0.95)
  icon.position.y = 2.35
  root.add(icon)
  const nameLabel = new TextLabel(0.62)
  nameLabel.sprite.position.y = 1.72
  root.add(nameLabel.sprite)
  const costLabel = new TextLabel(0.72, 384)
  costLabel.sprite.position.y = 1.15
  root.add(costLabel.sprite)
  root.visible = false
  return { root, base, fill, ring, icon, nameLabel, costLabel, scale: 0 }
}

export function PadsView() {
  const visuals = useMemo(() => sim.pads.map(() => makePadVisual()), [])
  const group = useMemo(() => {
    const g = new THREE.Group()
    for (const v of visuals) g.add(v.root)
    return g
  }, [visuals])

  useFrame((_, dt) => {
    sim.pads.forEach((pad, i) => {
      const v = visuals[i]
      const target = pad.visible ? 1 : 0
      v.scale += (target - v.scale) * damp(6, dt)
      v.root.visible = v.scale > 0.03
      if (!v.root.visible) return
      v.root.position.set(pad.pos.x, 0, pad.pos.z)
      const pulse = pad.visible ? 1 + Math.sin(pad.pulse * 2.4) * 0.03 : 1
      v.root.scale.setScalar(v.scale * pulse)

      const remaining = Math.max(0, Math.ceil(pad.cost - pad.paid))
      v.ring.material = pad.locked ? ringMatLocked : sim.money >= 1 ? ringMatAfford : ringMatPoor
      v.base.material = pad.locked ? baseMatLocked : baseMat

      const frac = pad.locked ? 0 : pad.paid / pad.cost
      v.fill.visible = frac > 0
      v.fill.scale.set(Math.max(frac * 1.3, 0.001), 1, Math.max(frac * 1.3, 0.001))

      const mat = v.icon.material as THREE.SpriteMaterial
      const wantMap = emojiTexture(pad.locked ? '🔒' : pad.icon)
      if (mat.map !== wantMap) {
        mat.map = wantMap
        mat.needsUpdate = true
      }

      const lvlSuffix = pad.maxLevel > 1 ? ` ${pad.level + 1}/${pad.maxLevel}` : ''
      v.nameLabel.set(pad.label + lvlSuffix, pad.locked ? '#9fb0c8' : '#dfe9f5')
      if (pad.locked) v.costLabel.set(pad.lockText || `⭐ Level ${pad.needLevel}`, '#9fc4ff')
      else v.costLabel.set(`💵 ${fmt(remaining)}`, sim.money >= remaining ? '#9fe08a' : '#ffb0a0')
      // affordable pads hop to pull the player over
      const canBuy = !pad.locked && sim.money >= remaining
      v.icon.position.y = 2.35 + (canBuy ? Math.abs(Math.sin(sim.time * 6 + i)) * 0.4 : Math.sin(sim.time * 2 + i) * 0.05)
      v.icon.scale.setScalar(canBuy ? 1.15 : 0.95)
    })
  })

  return <primitive object={group} />
}
