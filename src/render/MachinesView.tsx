// Machines that replaced the crews: the Auto-Saw in the forest, the Ice Auger
// on the pond, the Coal Drill in the mine, the Skinning Machine by the meadow,
// and little automatons standing at the kitchen / tailor / smokehouse. They
// pop in when bought, spin while working, and the trim colour shows the level.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { MachineId } from '../game/types'
import { MACHINE_IDS, MACHINE_CFG, MACHINE } from '../game/balance'
import { RES_ICON } from '../game/icons'
import { TextLabel, makeEmojiSprite, makeBlobShadow, mergeStatic } from './rutil'
import { PopIn } from './anim'
import { railMats } from './BeltsView'

const steel = new THREE.MeshStandardMaterial({ color: '#5a6472', roughness: 0.45, metalness: 0.6 })
const dark = new THREE.MeshStandardMaterial({ color: '#2f343c', roughness: 0.6, metalness: 0.4 })
const paint = new THREE.MeshStandardMaterial({ color: '#e0a23a', roughness: 0.5, metalness: 0.2 })
const red = new THREE.MeshStandardMaterial({ color: '#c0563f', roughness: 0.5, metalness: 0.2 })
const blade = new THREE.MeshStandardMaterial({ color: '#d8dde5', roughness: 0.25, metalness: 0.9 })
const glow = new THREE.MeshStandardMaterial({ color: '#203040', emissive: '#7fe0ff', emissiveIntensity: 1.4 })

interface Built {
  root: THREE.Group
  /** rotates to face the work */
  turret: THREE.Group
  /** spins while working */
  spinner: THREE.Object3D
  /** bobs while working */
  bob: THREE.Object3D | null
  trims: THREE.Mesh[]
  label: TextLabel | null
}

function trim(geo: THREE.BufferGeometry, parent: THREE.Object3D, trims: THREE.Mesh[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, railMats[0])
  m.position.set(x, y, z)
  parent.add(m)
  trims.push(m)
  return m
}

function buildSaw(root: THREE.Group, trims: THREE.Mesh[]): Omit<Built, 'root' | 'trims' | 'label'> {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.6, 10), dark)
  base.position.y = 0.3
  base.castShadow = true
  root.add(base)
  trim(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 10), root, trims, 0, 0.62, 0)
  const turret = new THREE.Group()
  turret.position.y = 0.65
  root.add(turret)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.0), paint)
  cab.position.y = 0.45
  cab.castShadow = true
  turret.add(cab)
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.05), glow)
  win.position.set(0, 0.6, 0.51)
  turret.add(win)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.1), steel)
  arm.position.set(0, 0.55, 1.4)
  turret.add(arm)
  const spinner = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), blade)
  spinner.rotation.z = Math.PI / 2
  spinner.position.set(0.16, 0.55, 2.45)
  turret.add(spinner)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8), red)
  hub.rotation.z = Math.PI / 2
  hub.position.set(0.2, 0.55, 2.45)
  turret.add(hub)
  return { turret, spinner, bob: null }
}

function buildAuger(root: THREE.Group, trims: THREE.Mesh[]): Omit<Built, 'root' | 'trims' | 'label'> {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), steel)
    leg.position.set(Math.cos(a) * 0.75, 1.5, Math.sin(a) * 0.75)
    leg.lookAt(0, 3.2, 0)
    leg.rotateX(Math.PI / 2)
    root.add(leg)
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), paint)
  head.position.y = 3.0
  root.add(head)
  trim(new THREE.BoxGeometry(0.66, 0.08, 0.66), root, trims, 0, 2.75, 0)
  const bob = new THREE.Group()
  root.add(bob)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), blade)
  shaft.position.y = 1.7
  bob.add(shaft)
  const spinner = new THREE.Group()
  spinner.position.y = 0.55
  bob.add(spinner)
  for (let i = 0; i < 4; i++) {
    const flight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), steel)
    flight.position.y = i * 0.18
    flight.rotation.y = i * 0.8
    spinner.add(flight)
  }
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), dark)
  hole.rotation.x = -Math.PI / 2
  hole.position.y = 0.04
  root.add(hole)
  return { turret: new THREE.Group(), spinner, bob }
}

function buildDrill(root: THREE.Group, trims: THREE.Mesh[]): Omit<Built, 'root' | 'trims' | 'label'> {
  const turret = new THREE.Group()
  root.add(turret)
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 1.9), dark)
    track.position.set(s * 0.65, 0.2, 0)
    track.castShadow = true
    turret.add(track)
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.5), paint)
  body.position.y = 0.75
  body.castShadow = true
  turret.add(body)
  trim(new THREE.BoxGeometry(1.15, 0.1, 1.55), turret, trims, 0, 1.2, 0)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.1), glow)
  lamp.position.set(0, 1.0, 0.78)
  turret.add(lamp)
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8), blade)
  spinner.rotation.x = Math.PI / 2
  spinner.position.set(0, 0.7, 1.35)
  turret.add(spinner)
  return { turret, spinner, bob: null }
}

function buildSkinner(root: THREE.Group, trims: THREE.Mesh[]): Omit<Built, 'root' | 'trims' | 'label'> {
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.5), steel)
  body.position.y = 0.65
  body.castShadow = true
  root.add(body)
  trim(new THREE.BoxGeometry(1.86, 0.1, 1.56), root, trims, 0, 1.32, 0)
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.35, 0.8, 4, 1, true), red)
  hopper.rotation.y = Math.PI / 4
  hopper.position.y = 1.75
  root.add(hopper)
  const spinner = new THREE.Group()
  spinner.position.set(0.95, 0.75, 0)
  root.add(spinner)
  const gear = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 10), paint)
  gear.rotation.y = Math.PI / 2
  spinner.add(gear)
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.06), paint)
    spoke.rotation.x = (i * Math.PI) / 4
    spinner.add(spoke)
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glow)
  lamp.position.set(-0.6, 1.45, 0.6)
  root.add(lamp)
  return { turret: new THREE.Group(), spinner, bob: null }
}

/** little automaton that stands at a workshop's work spot */
function buildBot(root: THREE.Group, trims: THREE.Mesh[]): Omit<Built, 'root' | 'trims' | 'label'> {
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.45), paint)
  body.position.y = 0.75
  body.castShadow = true
  root.add(body)
  trim(new THREE.BoxGeometry(0.66, 0.08, 0.49), root, trims, 0, 1.12, 0)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.38), steel)
  head.position.y = 1.32
  root.add(head)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), glow)
    eye.position.set(s * 0.1, 1.35, 0.2)
    root.add(eye)
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), dark)
  legL.position.set(-0.15, 0.21, 0)
  const legR = legL.clone()
  legR.position.x = 0.15
  root.add(legL, legR)
  const bob = new THREE.Group()
  bob.position.y = 0.9
  root.add(bob)
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), steel)
    arm.position.set(s * 0.38, 0, 0.2)
    bob.add(arm)
  }
  const spinner = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 5, 8), red)
  spinner.rotation.x = Math.PI / 2
  spinner.position.y = 1.58
  root.add(spinner)
  return { turret: new THREE.Group(), spinner, bob }
}

function build(id: MachineId): Built {
  const cfg = MACHINE_CFG[id]
  const root = new THREE.Group()
  const trims: THREE.Mesh[] = []
  // automatons stand at their workshop's work spot, facing the bench
  if (cfg.proc) {
    const pr = sim.proc[cfg.proc]
    root.position.set(pr.workSpot.x, 0, pr.workSpot.z)
    root.rotation.y = Math.PI
  } else {
    root.position.set(cfg.pos.x, 0, cfg.pos.z)
  }
  const parts =
    id === 'saw'
      ? buildSaw(root, trims)
      : id === 'auger'
        ? buildAuger(root, trims)
        : id === 'drill'
          ? buildDrill(root, trims)
          : id === 'skinner'
            ? buildSkinner(root, trims)
            : buildBot(root, trims)
  root.add(makeBlobShadow(cfg.proc ? 0.9 : 2.2))
  const sign = makeEmojiSprite(cfg.icon, cfg.proc ? 0.5 : 0.9)
  sign.position.y = cfg.proc ? 2.05 : id === 'auger' ? 3.9 : 2.7
  root.add(sign)
  // gatherers / skinner show what's waiting for their belt
  const label = cfg.proc ? null : new TextLabel(0.55)
  if (label) {
    label.sprite.position.y = sign.position.y - 0.62
    root.add(label.sprite)
  }
  // bake what doesn't move: the base, the turret body, the bobbing rig (each on its own)
  const moving = new Set<THREE.Object3D>([parts.turret, parts.spinner, ...trims])
  if (parts.bob) moving.add(parts.bob)
  mergeStatic(root, (o) => !moving.has(o))
  mergeStatic(parts.turret, (o) => o !== parts.spinner && !trims.includes(o as THREE.Mesh))
  if (parts.bob) mergeStatic(parts.bob, (o) => o !== parts.spinner)
  return { root, trims, label, ...parts }
}

function MachineView({ id }: { id: MachineId }) {
  const v = useMemo(() => build(id), [id])
  const pop = useMemo(() => new PopIn(0.8), [])
  const state = useMemo(() => ({ lvl: -1, labelT: 0 }), [])

  useFrame((_, dt) => {
    const m = sim.machines[id]
    const s = pop.update(m.level > 0, sim.time)
    v.root.visible = s > 0.01
    if (m.level <= 0) return
    v.root.scale.setScalar(Math.max(s, 0.001))
    if (state.lvl !== m.level) {
      state.lvl = m.level
      for (const t of v.trims) t.material = railMats[Math.min(railMats.length - 1, m.level - 1)]
    }
    v.turret.rotation.y = m.yaw
    const speed = m.active ? 14 + m.level * 4 : 0
    if (id === 'saw') v.spinner.rotation.x += speed * dt
    else if (id === 'drill') v.spinner.rotation.z += speed * dt
    else v.spinner.rotation.y += speed * dt * 0.6
    if (v.bob) {
      if (id === 'auger') v.bob.position.y = m.active ? -0.25 + Math.sin(sim.time * 5) * 0.2 : 0
      else v.bob.position.z = m.active ? Math.sin(sim.time * 10) * 0.08 : 0
    }
    if (v.label) {
      state.labelT -= dt
      if (state.labelT <= 0) {
        state.labelT = 0.25
        const cfg = MACHINE_CFG[id]
        const kinds = id === 'skinner' ? (['raw', 'hide'] as const) : ([cfg.out!] as const)
        const text = kinds.map((k) => `${RES_ICON[k]}${Math.floor(m.buf[k] ?? 0)}`).join(' ')
        const full = kinds.some((k) => (m.buf[k] ?? 0) >= MACHINE.bufCap * (id === 'skinner' ? 2 : 1))
        v.label.set(text, full ? '#ff9a8a' : '#ffffff')
      }
    }
  })

  return <primitive object={v.root} />
}

export function MachinesView() {
  return (
    <group>
      {MACHINE_IDS.map((id) => (
        <MachineView key={id} id={id} />
      ))}
    </group>
  )
}
