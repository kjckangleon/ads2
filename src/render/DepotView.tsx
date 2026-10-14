// Forest log pile: where lumberjacks stack logs once a Log Carrier is hired.
// Shows every log, a count label and a signpost; appears with the first
// lumberjack so the hand-off point is visible before it's used.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { TextLabel, makeEmojiSprite } from './rutil'
import { ItemGrid, gridLayout } from './ItemGrid'
import { PopIn, Squash } from './anim'

const logGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.85, 8)
logGeo.rotateZ(Math.PI / 2)
const logMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 })
const postMat = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.9 })
const ringMat = new THREE.MeshBasicMaterial({ color: '#c9a86a', transparent: true, opacity: 0.4, depthWrite: false })

export function DepotView() {
  const built = useMemo(() => {
    const d = sim.depot
    const root = new THREE.Group()
    root.position.set(d.pos.x, 0, d.pos.z)
    const grid = new ItemGrid(logGeo, logMat, d.cap, gridLayout(1, 6, 0.85, 0.23, 0.21, true))
    grid.mesh.position.y = 0.12
    grid.mesh.castShadow = true
    root.add(grid.mesh)
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 28), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    ring.renderOrder = 2
    root.add(ring)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.8, 7), postMat)
    post.position.set(-1.1, 0.9, -0.6)
    root.add(post)
    const sign = makeEmojiSprite('🪵', 0.8)
    sign.position.set(-1.1, 2.1, -0.6)
    root.add(sign)
    const label = new TextLabel(0.6)
    root.add(label.sprite)
    return { root, grid, label }
  }, [])
  const pop = useMemo(() => new PopIn(0.6), [])
  const squash = useMemo(() => new Squash(), [])
  const prev = useMemo(() => ({ n: -1 }), [])

  useFrame(() => {
    const d = sim.depot
    const on = sim.workers.some((w) => w.role === 'lumberjack') || d.count > 0
    const s = pop.update(on, sim.time)
    built.root.visible = s > 0.01
    if (!on) return
    if (prev.n >= 0 && d.count > prev.n) squash.kick(sim.time)
    prev.n = d.count
    const [sxz, sy] = squash.value(sim.time)
    built.root.scale.set(s * sxz, s * sy, s * sxz)
    built.grid.update(d.count, sim.time)
    built.label.set(`${d.count}/${d.cap}`, d.count >= d.cap ? '#ff9a8a' : '#ffffff')
    built.label.sprite.position.y = built.grid.topY(d.count) + 1.0
  })

  return <primitive object={built.root} />
}
