import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WORLD } from '../game/balance'
import { mulberry32, randRange } from '../game/util'
import { useUI } from '../game/uiStore'
import { sim } from '../game/state'

// ---------- snow ground ----------

function makeSnowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#edf1f7'
  ctx.fillRect(0, 0, 512, 512)
  const rng = mulberry32(99)
  for (let i = 0; i < 900; i++) {
    const x = rng() * 512
    const y = rng() * 512
    const r = 4 + rng() * 22
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tint = rng() > 0.5 ? '199,209,226' : '224,232,242'
    g.addColorStop(0, `rgba(${tint},${0.12 + rng() * 0.12})`)
    g.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // sparkles
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 350; i++) {
    ctx.fillRect(rng() * 512, rng() * 512, 1.4, 1.4)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(9, 9)
  tex.anisotropy = 4
  return tex
}

function Ground() {
  const tex = useMemo(makeSnowTexture, [])
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[170, 170]} />
      <meshStandardMaterial map={tex} color="#f0f4fa" roughness={0.96} metalness={0} />
    </mesh>
  )
}

// ---------- trampled snow paths ----------

const pathMat = new THREE.MeshBasicMaterial({
  color: '#ccd7e5',
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
})

function Paths() {
  const patches: { x: number; z: number; sx: number; sz: number; rot?: number }[] = [
    { x: 0, z: 18, sx: 2.6, sz: 13 }, // entry road
    // queues and workshops follow wherever you've placed them (the layout editor)
    { x: sim.stations.wood.pos.x, z: sim.stations.wood.pos.z + 10.5, sx: 1.6, sz: 10.5 }, // wood queue
    { x: sim.stations.meat.pos.x, z: sim.stations.meat.pos.z + 10.5, sx: 1.6, sz: 10.5 }, // meat queue
    { x: WORLD.campfire.x, z: WORLD.campfire.z, sx: 4, sz: 3.4 },
    { x: sim.proc.kitchen.pos.x, z: sim.proc.kitchen.pos.z + 1, sx: 3.4, sz: 2.6 },
    { x: WORLD.towerSpot.x, z: WORLD.towerSpot.z, sx: 3, sz: 2.6 },
    { x: WORLD.meadow.x, z: WORLD.meadow.z, sx: 8.4, sz: 7.4 },
    { x: WORLD.treeArea.x, z: WORLD.treeArea.z, sx: 6.4, sz: 6.4 },
    { x: -30, z: WORLD.caravanSpot.z + 0.8, sx: 17, sz: 2.2 }, // caravan road
    { x: sim.proc.tailor.pos.x, z: sim.proc.tailor.pos.z + 1, sx: 3.4, sz: 2.6 },
    { x: sim.stations.coat.pos.x, z: sim.stations.coat.pos.z + 9.5, sx: 1.6, sz: 9.6 }, // coat queue
    { x: sim.stations.fish.pos.x, z: sim.stations.fish.pos.z + 6, sx: 1.6, sz: 6.2 }, // fish queue
    { x: sim.proc.smokehouse.pos.x, z: sim.proc.smokehouse.pos.z + 1, sx: 3.4, sz: 2.6 },
    { x: sim.furnace.pos.x, z: sim.furnace.pos.z + 1, sx: 3.2, sz: 3 },
    { x: WORLD.coalDepot.x, z: WORLD.coalDepot.z, sx: 2.6, sz: 2.2 },
  ]
  // one merged mesh for every trampled patch (a draw call each adds up on phones)
  const geo = useMemo(() => {
    const parts = patches.map((p, i) => {
      const g = new THREE.CircleGeometry(1, 24)
      g.scale(p.sx, p.sz, 1)
      g.rotateX(-Math.PI / 2)
      g.translate(p.x, 0.012 + i * 0.0004, p.z)
      return g
    })
    return mergeGeometries(parts)!
  }, [])
  return <mesh geometry={geo} material={pathMat} renderOrder={1} />
}

// ---------- instanced pine forest ----------

interface TreeXform {
  x: number
  z: number
  s: number
  rot: number
}

function makeForestTransforms(density: number): TreeXform[] {
  const rng = mulberry32(4242)
  const out: TreeXform[] = []
  const n = Math.floor(150 * density)
  for (let i = 0; i < n; i++) {
    const ang = rng() * Math.PI * 2
    const rad = randRange(rng, 39, 66)
    const x = Math.cos(ang) * rad
    const z = Math.sin(ang) * rad
    if (Math.abs(x) < 7 && z > 18) continue // keep the entry road open
    if (inPark(x, z)) continue
    if (x < -28 && Math.abs(z - WORLD.caravanSpot.z) < 4.5) continue // caravan road
    out.push({ x, z, s: randRange(rng, 0.8, 1.5), rot: rng() * Math.PI * 2 })
  }
  // inner decorative clusters (outside gameplay zones)
  // (the fishery, mine and fish stall took over the old north / west clusters)
  const clusters = [{ cx: -28, cz: 28, r: 5, n: 6 }]
  for (const cl of clusters) {
    for (let i = 0; i < Math.floor(cl.n * density); i++) {
      out.push({
        x: cl.cx + randRange(rng, -cl.r, cl.r),
        z: cl.cz + randRange(rng, -cl.r, cl.r),
        s: randRange(rng, 0.7, 1.3),
        rot: rng() * Math.PI * 2,
      })
    }
  }
  return out
}

// tree part geometries shared with TreesView via exports
export const pineParts = {
  trunk: new THREE.CylinderGeometry(0.13, 0.2, 1.1, 7),
  cone1: new THREE.ConeGeometry(1.15, 1.6, 8),
  cone2: new THREE.ConeGeometry(0.88, 1.35, 8),
  cone3: new THREE.ConeGeometry(0.6, 1.15, 8),
  snow: new THREE.ConeGeometry(0.42, 0.6, 8),
}
export const pineOffsets = {
  trunk: 0.55,
  cone1: 1.55,
  cone2: 2.45,
  cone3: 3.25,
  snow: 3.7,
}
export const pineMats = {
  trunk: new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.95 }),
  foliage: new THREE.MeshStandardMaterial({ color: '#33604a', roughness: 0.9 }),
  foliageDark: new THREE.MeshStandardMaterial({ color: '#2b5340', roughness: 0.9 }),
  snow: new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.85 }),
}

function Forest({ density }: { density: number }) {
  const transforms = useMemo(() => makeForestTransforms(density), [density])
  const refs = {
    trunk: useRef<THREE.InstancedMesh>(null),
    cone1: useRef<THREE.InstancedMesh>(null),
    cone2: useRef<THREE.InstancedMesh>(null),
    cone3: useRef<THREE.InstancedMesh>(null),
    snow: useRef<THREE.InstancedMesh>(null),
  }
  useMemo(() => null, [])
  useFrame(() => {
    // set matrices once
    const anyRef = refs.trunk.current
    if (!anyRef || anyRef.userData.done) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
      const im = refs[key].current
      if (!im) return
      transforms.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot)
        m.compose(new THREE.Vector3(t.x, pineOffsets[key] * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s))
        im.setMatrixAt(i, m)
      })
      im.instanceMatrix.needsUpdate = true
    }
    anyRef.userData.done = true
  })
  const n = transforms.length
  return (
    <group>
      <instancedMesh ref={refs.trunk} args={[pineParts.trunk, pineMats.trunk, n]} />
      <instancedMesh ref={refs.cone1} args={[pineParts.cone1, pineMats.foliageDark, n]} castShadow />
      <instancedMesh ref={refs.cone2} args={[pineParts.cone2, pineMats.foliage, n]} />
      <instancedMesh ref={refs.cone3} args={[pineParts.cone3, pineMats.foliage, n]} />
      <instancedMesh ref={refs.snow} args={[pineParts.snow, pineMats.snow, n]} />
    </group>
  )
}

// ---------- rocks ----------

/** the Industrial Park, its truck road, runway and the sea stay clear of trees and rocks */
function inPark(x: number, z: number) {
  if (z > 33 && Math.abs(x) < 50) return true
  if (z > 46 && z < 58 && x < 0) return true // truck road
  return z > 60 // runway + sea
}

/** keep decorative rocks out of the districts and the west market */
function insidePlayArea(x: number, z: number) {
  if (inPark(x, z)) return true
  const b = WORLD.bounds
  if (x < b.minX - 1 || x > b.maxX + 1 || z < b.minZ - 1 || z > b.maxZ + 1) return false
  if (z < -13 && x < 12) return true // fishery + mine
  if (x < -23 && z > -9 && z < 16) return true // smokehouse + fish stall
  return false
}

function Rocks() {
  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(0.7, 0), [])
  const rockMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#97a1af', roughness: 0.95, flatShading: true }),
    [],
  )
  const ref = useRef<THREE.InstancedMesh>(null)
  const transforms = useMemo(() => {
    const rng = mulberry32(777)
    const out: TreeXform[] = []
    for (let i = 0; i < 24; i++) {
      const ang = rng() * Math.PI * 2
      const rad = randRange(rng, 30, 58)
      const x = Math.cos(ang) * rad
      const z = Math.sin(ang) * rad
      if (Math.abs(x) < 6 && z > 16) continue
      if (insidePlayArea(x, z)) continue
      out.push({ x, z, s: randRange(rng, 0.4, 1.6), rot: rng() * Math.PI * 2 })
    }
    // a few near the meadow for flavor
    out.push({ x: WORLD.meadow.x + 6, z: WORLD.meadow.z - 6, s: 1.2, rot: 1 })
    out.push({ x: WORLD.meadow.x - 7, z: WORLD.meadow.z + 5, s: 0.8, rot: 2 })
    return out
  }, [])
  useFrame(() => {
    const im = ref.current
    if (!im || im.userData.done) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    transforms.forEach((t, i) => {
      q.setFromEuler(new THREE.Euler(0, t.rot, 0))
      m.compose(new THREE.Vector3(t.x, t.s * 0.3, t.z), q, new THREE.Vector3(t.s, t.s * 0.7, t.s))
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.userData.done = true
  })
  return <instancedMesh ref={ref} args={[rockGeo, rockMat, transforms.length]} castShadow />
}

// ---------- mountains ----------

function Mountains() {
  const items = useMemo(() => {
    const rng = mulberry32(31)
    const out: { x: number; z: number; h: number; r: number }[] = []
    for (let i = 0; i < 11; i++) {
      const ang = (i / 11) * Math.PI * 2 + rng() * 0.4
      const rad = randRange(rng, 85, 110)
      out.push({
        x: Math.cos(ang) * rad,
        z: Math.sin(ang) * rad,
        h: randRange(rng, 26, 46),
        r: randRange(rng, 16, 30),
      })
    }
    return out
  }, [])
  // all the background peaks in two merged meshes (rock + snow caps)
  const { rock, snow } = useMemo(() => {
    const rocks: THREE.BufferGeometry[] = []
    const caps: THREE.BufferGeometry[] = []
    for (const mt of items) {
      const r = new THREE.ConeGeometry(mt.r, mt.h, 6)
      r.translate(mt.x, mt.h * 0.5, mt.z)
      rocks.push(r)
      const c = new THREE.ConeGeometry(mt.r * 0.38, mt.h * 0.36, 6)
      c.translate(mt.x, mt.h * 0.82, mt.z)
      caps.push(c)
    }
    return { rock: mergeGeometries(rocks)!, snow: mergeGeometries(caps)! }
  }, [items])
  return (
    <group>
      <mesh geometry={rock}>
        <meshStandardMaterial color="#aebccf" roughness={1} flatShading />
      </mesh>
      <mesh geometry={snow}>
        <meshStandardMaterial color="#eff4fa" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

// ---------- campfire ----------

const fireMatOuter = new THREE.MeshBasicMaterial({
  color: '#ff8a2a',
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const fireMatInner = new THREE.MeshBasicMaterial({
  color: '#ffd94a',
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const smokeMat = new THREE.MeshBasicMaterial({
  color: '#c9cfd8',
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
})

export function FireEffect({ scale = 1, activeRef }: { scale?: number; activeRef?: { current: boolean } }) {
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const on = activeRef ? activeRef.current : true
    const target = on ? 1 : 0.25
    if (outer.current) {
      outer.current.visible = true
      const s = target * (1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23.7) * 0.06)
      outer.current.scale.set(s, s * (1 + Math.sin(t * 17) * 0.15), s)
    }
    if (inner.current) {
      const s = target * (1 + Math.sin(t * 15 + 1) * 0.15)
      inner.current.scale.set(s, s, s)
    }
    if (light.current) {
      light.current.intensity = on ? 14 + Math.sin(t * 13) * 3 + Math.sin(t * 31) * 2 : 4
    }
    if (smoke.current) {
      smoke.current.children.forEach((p, i) => {
        const cycle = (((t * 0.45 + i * 0.23) % 1) + 1) % 1
        p.position.y = 0.8 + cycle * 2.6
        p.position.x = Math.sin(t * 0.8 + i * 2) * 0.2 * cycle
        const sc = (0.14 + cycle * 0.4) * (on ? 1 : 0.4)
        p.scale.setScalar(sc)
        ;(p as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.28 * (1 - cycle)
      })
    }
  })
  return (
    <group scale={scale}>
      <mesh ref={outer} position-y={0.55} material={fireMatOuter}>
        <coneGeometry args={[0.34, 1.0, 7]} />
      </mesh>
      <mesh ref={inner} position-y={0.42} material={fireMatInner}>
        <coneGeometry args={[0.2, 0.62, 6]} />
      </mesh>
      <pointLight ref={light} position-y={1.1} color="#ffab4a" distance={13} decay={1.8} />
      <group ref={smoke}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={smokeMat.clone()}>
            <sphereGeometry args={[1, 7, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Campfire() {
  return (
    <group position={[WORLD.campfire.x, 0, WORLD.campfire.z]}>
      {/* crossed logs */}
      {[0.5, 1.7, 2.9].map((r, i) => (
        <mesh key={i} position-y={0.16} rotation={[0.12, r, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.15, 7]} />
          <meshStandardMaterial color="#54402c" roughness={0.95} />
        </mesh>
      ))}
      {/* stone ring */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72]}>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#8b95a3" roughness={1} flatShading />
          </mesh>
        )
      })}
      <FireEffect />
    </group>
  )
}

// ---------- snowfall ----------

function Snowfall({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    const rng = mulberry32(5150)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = randRange(rng, -45, 45)
      pos[i * 3 + 1] = randRange(rng, 0, 20)
      pos[i * 3 + 2] = randRange(rng, -40, 45)
      speed[i] = randRange(rng, 1.1, 2.4)
    }
    return { pos, speed }
  }, [count])
  useFrame(({ clock }, dt) => {
    const pts = ref.current
    if (!pts) return
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    // a blizzard drives the snow down hard and sideways
    const storm = sim.event?.id === 'blizzard'
    const fall = storm ? 3.2 : 1
    const wind = storm ? 7 : 0
    for (let i = 0; i < count; i++) {
      let y = arr[i * 3 + 1] - data.speed[i] * d * fall
      if (y < 0) y = 19
      arr[i * 3 + 1] = y
      let x = arr[i * 3] + Math.sin(t * 0.7 + i) * 0.25 * d + wind * d
      if (x > 45) x -= 90
      arr[i * 3] = x
    }
    attr.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.13} transparent opacity={0.85} sizeAttenuation />
    </points>
  )
}

// ---------- composed ----------

export function Environment() {
  const quality = useUI((s) => s.quality)
  const density = quality === 'high' ? 1 : quality === 'medium' ? 0.65 : 0.4
  const snowCount = quality === 'high' ? 1100 : quality === 'medium' ? 600 : 280
  return (
    <group>
      <Ground />
      <Paths />
      <Forest density={density} />
      <Rocks />
      <Mountains />
      <Campfire />
      <Snowfall count={snowCount} />
    </group>
  )
}
