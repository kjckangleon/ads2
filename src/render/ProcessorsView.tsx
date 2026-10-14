// Workshops: input pile on the left table, output pile on the right, a work
// spot in front. The kitchen is an open cook fire; the tailor is a bench with
// a tanning frame. A bar above shows the current item's progress.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { WorkshopId as ProcessorId } from '../game/types'
import { TextLabel, makeEmojiSprite, vertexColorMat, mergeStatic } from './rutil'
import { FireEffect } from './Environment'
import { hideGeo, coatGeo, fishGeo, smokedFishGeo, rawMeatMat, cookedMeatMat, makeBar, setBar } from './characters'
import { ItemGrid, gridLayout } from './ItemGrid'
import { PopIn } from './anim'
import { capText } from '../game/balance'
import { machineStaffs } from '../game/systems/belts'

const STYLE: Record<
  ProcessorId,
  { sign: string; inIcon: string; outIcon: string; workIcon: string; ring: string; bar: string }
> = {
  kitchen: { sign: '🍳', inIcon: '🥩', outIcon: '🍗', workIcon: '👨‍🍳', ring: '#ffb060', bar: '#ffab4a' },
  tailor: { sign: '🧵', inIcon: '🐾', outIcon: '🧥', workIcon: '🧵', ring: '#c9a0ff', bar: '#c9a0ff' },
  smokehouse: { sign: '🔥', inIcon: '🐟', outIcon: '🍣', workIcon: '🔥', ring: '#ffb060', bar: '#e0a860' },
}

const STAFF_ROLE: Record<ProcessorId, string> = { kitchen: 'cook', tailor: 'tailor', smokehouse: 'smoker' }

const tableMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.9 })
const postMat = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.9 })
const ironMat = new THREE.MeshStandardMaterial({ color: '#3a4150', roughness: 0.6, metalness: 0.5 })
const stoneMat = new THREE.MeshStandardMaterial({ color: '#8b95a3', roughness: 1, flatShading: true })
const peltMat = new THREE.MeshStandardMaterial({ color: '#a07850', roughness: 0.95, side: THREE.DoubleSide })
const needleMat = new THREE.MeshStandardMaterial({ color: '#d8dde5', metalness: 0.8, roughness: 0.25 })
const meatGeo = new THREE.SphereGeometry(0.2, 10, 8)
meatGeo.scale(1.3, 0.72, 1)

/** exact table piles: meat in 3×3 layers, hides / coats in 2×2 layers */
function tableGrid(id: ProcessorId, output: boolean): ItemGrid {
  if (id === 'kitchen')
    return new ItemGrid(meatGeo, output ? cookedMeatMat : rawMeatMat, 45, gridLayout(3, 3, 0.36, 0.34, 0.17))
  if (id === 'smokehouse') {
    return new ItemGrid(output ? smokedFishGeo() : fishGeo(), vertexColorMat, 45, gridLayout(1, 3, 0.5, 0.34, 0.15))
  }
  return output
    ? new ItemGrid(coatGeo(), vertexColorMat, 40, gridLayout(2, 2, 0.56, 0.42, 0.15))
    : new ItemGrid(hideGeo(), vertexColorMat, 48, gridLayout(2, 2, 0.6, 0.46, 0.08))
}

function buildKitchenCenter(root: THREE.Group) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), stoneMat)
    stone.position.set(Math.cos(a) * 0.85, 0.14, Math.sin(a) * 0.85)
    root.add(stone)
  }
  const grate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), ironMat)
  grate.position.y = 0.75
  root.add(grate)
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 6), ironMat)
    leg.position.set(s * 0.5, 0.38, 0)
    root.add(leg)
  }
  const item = new THREE.Mesh(meatGeo, rawMeatMat)
  item.position.set(0, 0.86, 0)
  root.add(item)
  return { item, needle: null as THREE.Mesh | null }
}

function buildTailorCenter(root: THREE.Group) {
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.85), tableMat)
  bench.position.y = 0.72
  bench.castShadow = true
  root.add(bench)
  for (const [x, z] of [
    [-0.7, -0.33],
    [0.7, -0.33],
    [-0.7, 0.33],
    [0.7, 0.33],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.7, 0.09), postMat)
    leg.position.set(x, 0.35, z)
    root.add(leg)
  }
  // tanning frame with a stretched pelt behind the bench
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 6), postMat)
    post.position.set(s * 0.7, 1.0, -0.75)
    root.add(post)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), postMat)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, 1.85, -0.75)
  root.add(bar)
  const pelt = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.05), peltMat)
  pelt.position.set(0, 1.25, -0.75)
  root.add(pelt)
  const spool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: '#c0563f' }),
  )
  spool.position.set(0.55, 0.85, 0.15)
  root.add(spool)
  const item = new THREE.Mesh(hideGeo(), vertexColorMat)
  item.position.set(-0.1, 0.82, 0.05)
  root.add(item)
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), needleMat)
  needle.position.set(-0.1, 1.05, 0.05)
  root.add(needle)
  return { item, needle }
}

const plankMat = new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 0.95 })
const roofMat = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 })
const snowMat = new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.85 })
const emberMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a' })

/** little plank smoke hut with a chimney, racks of hanging fish and a glowing ember pit */
function buildSmokehouseCenter(root: THREE.Group) {
  const hut = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.2), plankMat)
  hut.position.set(0, 0.75, -0.5)
  hut.castShadow = true
  root.add(hut)
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.45), roofMat)
    roof.position.set(s * 0.42, 1.7, -0.5)
    roof.rotation.z = -s * 0.55
    root.add(roof)
    const snow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.45), snowMat)
    snow.position.set(s * 0.43, 1.76, -0.5)
    snow.rotation.z = -s * 0.55
    root.add(snow)
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), stoneMat)
  chimney.position.set(0.5, 2.0, -0.7)
  root.add(chimney)
  // open front rack with fish hanging over the ember pit
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), postMat)
    post.position.set(s * 0.7, 0.65, 0.35)
    root.add(post)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), postMat)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, 1.25, 0.35)
  root.add(bar)
  for (const x of [-0.45, 0, 0.45]) {
    const f = new THREE.Mesh(smokedFishGeo(), vertexColorMat)
    f.rotation.z = Math.PI / 2
    f.position.set(x, 0.95, 0.35)
    root.add(f)
  }
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 10), stoneMat)
  pit.position.set(0, 0.06, 0.35)
  root.add(pit)
  const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 10), emberMat)
  embers.position.set(0, 0.14, 0.35)
  root.add(embers)
  const item = new THREE.Mesh(fishGeo(), vertexColorMat)
  item.rotation.z = Math.PI / 2
  item.position.set(0, 0.62, 0.35)
  root.add(item)
  return { item, needle: null as THREE.Mesh | null }
}

function ProcessorView({ id }: { id: ProcessorId }) {
  const activeRef = useRef(false)
  const built = useMemo(() => {
    const pr = sim.proc[id]
    const style = STYLE[id]
    const root = new THREE.Group()
    root.position.set(pr.pos.x, 0, pr.pos.z)
    const center =
      id === 'kitchen'
        ? buildKitchenCenter(root)
        : id === 'tailor'
          ? buildTailorCenter(root)
          : buildSmokehouseCenter(root)

    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.4, 7), postMat)
    signPost.position.set(id === 'tailor' ? 1.15 : id === 'smokehouse' ? -1.15 : 0, 1.2, -1.4)
    root.add(signPost)
    const sign = makeEmojiSprite(style.sign, 1.0)
    sign.position.set(signPost.position.x, 2.75, -1.4)
    root.add(sign)

    const local = (v: { x: number; z: number }) => ({ x: v.x - pr.pos.x, z: v.z - pr.pos.z })
    const inL = local(pr.inZone)
    const outL = local(pr.outZone)
    for (const at of [inL, outL]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.3), tableMat)
      t.position.set(at.x, 0.28, at.z)
      root.add(t)
    }

    const inGrid = tableGrid(id, false)
    inGrid.mesh.position.set(inL.x, 0.62, inL.z)
    root.add(inGrid.mesh)
    const outGrid = tableGrid(id, true)
    outGrid.mesh.position.set(outL.x, 0.62, outL.z)
    root.add(outGrid.mesh)

    const inIcon = makeEmojiSprite(style.inIcon, 0.55)
    inIcon.position.set(inL.x, 1.35, inL.z)
    root.add(inIcon)
    const outIcon = makeEmojiSprite(style.outIcon, 0.55)
    outIcon.position.set(outL.x, 1.35, outL.z)
    root.add(outIcon)
    const inLabel = new TextLabel(0.62)
    inLabel.sprite.position.set(inL.x, 1.85, inL.z)
    root.add(inLabel.sprite)
    const outLabel = new TextLabel(0.62)
    outLabel.sprite.position.set(outL.x, 1.85, outL.z)
    root.add(outLabel.sprite)

    const ws = local(pr.workSpot)
    const workRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 22),
      new THREE.MeshBasicMaterial({ color: style.ring, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    workRing.rotation.x = -Math.PI / 2
    workRing.position.set(ws.x, 0.02, ws.z)
    workRing.renderOrder = 2
    root.add(workRing)
    const workIcon = makeEmojiSprite(style.workIcon, 0.5)
    workIcon.position.set(ws.x, 0.6, ws.z)
    root.add(workIcon)

    const progress = makeBar(1.1, style.bar)
    progress.group.position.y = 2.25
    root.add(progress.group)

    // bake tables, posts, stones and benches; keep what animates or toggles
    const keep = new Set<THREE.Object3D>([workRing, progress.group])
    if (center.item) keep.add(center.item)
    if (center.needle) keep.add(center.needle)
    mergeStatic(root, (o) => !keep.has(o))
    return { root, center, inGrid, outGrid, inLabel, outLabel, workRing, workIcon, progress }
  }, [id])

  const pop = useMemo(() => new PopIn(0.75), [])

  useFrame((_, dt) => {
    const pr = sim.proc[id]
    const s = pop.update(pr.unlocked, sim.time)
    built.root.visible = s > 0.01
    built.root.scale.setScalar(Math.max(s, 0.001))
    if (!pr.unlocked) return

    activeRef.current = pr.active
    const p = pr.time > 0 ? pr.t / pr.time : 0
    const { item, needle } = built.center
    if (id === 'kitchen') {
      item.visible = pr.active
      item.material = p > 0.6 ? cookedMeatMat : rawMeatMat
      if (pr.active) {
        item.rotation.y += dt * 2.5
        item.position.y = 0.86 + Math.sin(sim.time * 14) * 0.02
      }
    } else if (id === 'smokehouse') {
      item.visible = pr.active
      item.geometry = p > 0.5 ? smokedFishGeo() : fishGeo()
      if (pr.active) item.position.y = 0.62 + Math.sin(sim.time * 3) * 0.03
    } else {
      item.visible = pr.active || pr.inCount > 0
      item.geometry = p > 0.55 ? coatGeo() : hideGeo()
      if (needle) {
        needle.visible = pr.active
        needle.position.y = 1.0 + Math.abs(Math.sin(sim.time * 12)) * 0.12
      }
    }
    built.progress.group.visible = pr.active
    setBar(built.progress, p)

    built.inGrid.update(pr.inCount, sim.time)
    built.outGrid.update(pr.outCount, sim.time)
    built.inLabel.set(capText(pr.inCount, pr.inCap), pr.inCount >= pr.inCap ? '#ff9a8a' : '#ffd9d0')
    built.outLabel.set(capText(pr.outCount, pr.outCap), pr.outCount >= pr.outCap ? '#ff9a8a' : '#ffe2b8')
    // hide the "stand here" marker once the workshop is staffed
    const staffHired = sim.workers.some((w) => w.role === STAFF_ROLE[id]) || machineStaffs(sim, id)
    built.workRing.visible = !staffHired
    built.workIcon.visible = !staffHired
  })

  return (
    <group>
      <primitive object={built.root} />
      {id === 'kitchen' && (
        <group position={[sim.proc.kitchen.pos.x, 0.15, sim.proc.kitchen.pos.z]}>
          <KitchenFire activeRef={activeRef} />
        </group>
      )}
    </group>
  )
}

function KitchenFire({ activeRef }: { activeRef: { current: boolean } }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.visible = sim.proc.kitchen.unlocked
  })
  return (
    <group ref={group}>
      <FireEffect scale={0.8} activeRef={activeRef} />
    </group>
  )
}

export function ProcessorsView() {
  return (
    <group>
      <ProcessorView id="kitchen" />
      <ProcessorView id="tailor" />
      <ProcessorView id="smokehouse" />
    </group>
  )
}
