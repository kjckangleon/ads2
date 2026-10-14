// Locked district walls (snowdrifts + stakes) that sink away when bought, plus
// district dressing visible from outside as a tease: tannery tents and racks,
// the frozen fishing pond with its shacks, the mine's rock face and shaft.

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import type { V2, ZoneId } from '../game/types'
import { WORLD, BARRIERS } from '../game/balance'
import { damp, mulberry32 } from '../game/util'
import { mergeStatic } from './rutil'

const moundMat = new THREE.MeshStandardMaterial({
  color: '#e9eff7',
  roughness: 0.95,
})
const stakeMat = new THREE.MeshStandardMaterial({
  color: '#5e4630',
  roughness: 0.9,
})
const tentMat = new THREE.MeshStandardMaterial({
  color: '#b69a72',
  roughness: 0.95,
  flatShading: true,
})
const hideMat = new THREE.MeshStandardMaterial({
  color: '#a07850',
  roughness: 0.95,
  side: THREE.DoubleSide,
})

const B = WORLD.bounds

/** mound positions every 1.5 m along a wall, clipped to just past the world edge */
function barrierPoints(from: V2, to: V2): V2[] {
  const len = Math.hypot(to.x - from.x, to.z - from.z)
  const n = Math.max(1, Math.round(len / 1.5))
  const pts: V2[] = []
  for (let i = 0; i <= n; i++) {
    const x = from.x + ((to.x - from.x) * i) / n
    const z = from.z + ((to.z - from.z) * i) / n
    if (x < B.minX - 2 || x > B.maxX + 2 || z < B.minZ - 2 || z > B.maxZ + 2) continue
    pts.push({ x, z })
  }
  return pts
}

function Barrier({ from, to, zones, seed }: { from: V2; to: V2; zones: ZoneId[]; seed: number }) {
  const pts = useMemo(() => barrierPoints(from, to), [from, to])
  const open = () => zones.every((z) => sim.zones[z])
  const group = useRef<THREE.Group>(null)
  const mounds = useRef<THREE.InstancedMesh>(null)
  const stakes = useRef<THREE.InstancedMesh>(null)
  const sink = useRef(open() ? 1 : 0)
  const stakeCount = Math.ceil(pts.length / 2)

  useFrame((_, dt) => {
    const m = mounds.current
    const s = stakes.current
    if (m && !m.userData.done && s) {
      const rng = mulberry32(seed)
      const mat = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      pts.forEach((p, i) => {
        const sc = 0.9 + rng() * 0.5
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI)
        mat.compose(new THREE.Vector3(p.x, 0.1, p.z), q, new THREE.Vector3(sc * 1.1, sc * 0.65, sc))
        m.setMatrixAt(i, mat)
        if (i % 2 === 0) {
          q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (rng() - 0.5) * 0.3)
          mat.compose(new THREE.Vector3(p.x + 0.3, 0.7, p.z + 0.3), q, new THREE.Vector3(1, 1, 1))
          s.setMatrixAt(i / 2, mat)
        }
      })
      m.instanceMatrix.needsUpdate = true
      s.instanceMatrix.needsUpdate = true
      m.userData.done = true
    }
    const target = open() ? 1 : 0
    sink.current += (target - sink.current) * damp(1.8, dt)
    if (group.current) {
      group.current.position.y = -sink.current * 1.8
      group.current.visible = sink.current < 0.98
    }
  })

  return (
    <group ref={group}>
      <instancedMesh ref={mounds} args={[undefined, moundMat, pts.length]} castShadow>
        <sphereGeometry args={[0.85, 10, 7]} />
      </instancedMesh>
      <instancedMesh ref={stakes} args={[undefined, stakeMat, stakeCount]}>
        <cylinderGeometry args={[0.07, 0.09, 1.4, 6]} />
      </instancedMesh>
    </group>
  )
}

function Tent({ x, z, r = 0 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      <mesh position-y={1.0} castShadow material={tentMat}>
        <coneGeometry args={[1.4, 2.0, 5]} />
      </mesh>
      <mesh position={[0, 0.5, 1.12]} material={stakeMat}>
        <boxGeometry args={[0.5, 1.0, 0.05]} />
      </mesh>
    </group>
  )
}

function DryingRack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} position={[dx, 0.8, 0]} material={stakeMat}>
          <cylinderGeometry args={[0.05, 0.06, 1.6, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} rotation-z={Math.PI / 2} material={stakeMat}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
      </mesh>
      {[-0.45, 0.45].map((dx) => (
        <mesh key={dx} position={[dx, 1.15, 0]} material={hideMat}>
          <planeGeometry args={[0.7, 0.75]} />
        </mesh>
      ))}
    </group>
  )
}

const iceMat = new THREE.MeshStandardMaterial({
  color: '#a9cade',
  roughness: 0.18,
  metalness: 0.15,
})
const iceRimMat = new THREE.MeshBasicMaterial({ color: '#dde8f2' })
const shackMat = new THREE.MeshStandardMaterial({
  color: '#8a5a3c',
  roughness: 0.9,
})
const shackRoofMat = new THREE.MeshStandardMaterial({
  color: '#3e5a6a',
  roughness: 0.85,
})
const snowMat = new THREE.MeshStandardMaterial({
  color: '#eef3f9',
  roughness: 0.85,
})
const cliffMat = new THREE.MeshStandardMaterial({
  color: '#7d8794',
  roughness: 1,
  flatShading: true,
})
const tunnelMat = new THREE.MeshBasicMaterial({ color: '#0e1014' })
const railMat = new THREE.MeshStandardMaterial({
  color: '#6a717c',
  roughness: 0.45,
  metalness: 0.7,
})
const cartMat = new THREE.MeshStandardMaterial({
  color: '#5a4636',
  roughness: 0.8,
})
const lanternMat = new THREE.MeshStandardMaterial({
  color: '#3a2a1a',
  emissive: '#ffb347',
  emissiveIntensity: 1.2,
})

function Pond() {
  const p = WORLD.pond
  return (
    <group position={[p.x, 0.015, p.z]}>
      <mesh rotation-x={-Math.PI / 2} scale={[p.rx, p.rz, 1]} material={iceMat} receiveShadow>
        <circleGeometry args={[1, 32]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} scale={[p.rx + 0.45, p.rz + 0.45, 1]} position-y={-0.004} material={iceRimMat}>
        <circleGeometry args={[1, 32]} />
      </mesh>
    </group>
  )
}

function IceShack({ x, z, r = 0 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      <mesh position-y={0.8} material={shackMat} castShadow>
        <boxGeometry args={[1.8, 1.6, 1.5]} />
      </mesh>
      <mesh position={[0, 1.85, 0]} rotation-z={Math.PI / 4} material={shackRoofMat} castShadow>
        <boxGeometry args={[1.45, 1.45, 1.7]} />
      </mesh>
      <mesh position={[0, 2.5, 0]} material={snowMat}>
        <boxGeometry args={[0.5, 0.15, 1.75]} />
      </mesh>
      <mesh position={[0, 0.6, 0.76]} material={stakeMat}>
        <boxGeometry args={[0.5, 1.0, 0.05]} />
      </mesh>
    </group>
  )
}

function FishRack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} position={[dx, 0.8, 0]} material={stakeMat}>
          <cylinderGeometry args={[0.05, 0.06, 1.6, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} rotation-z={Math.PI / 2} material={stakeMat}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
      </mesh>
      {[-0.55, -0.15, 0.25, 0.65].map((dx) => (
        <mesh key={dx} position={[dx, 1.25, 0]} rotation-z={Math.PI / 2} scale={[1, 0.35, 0.3]} material={shackRoofMat}>
          <sphereGeometry args={[0.28, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/** rock face along the north edge with a timber-framed shaft and a cart track */
function MineDressing() {
  const rocks = useMemo(() => {
    const rng = mulberry32(404)
    const out: { x: number; z: number; s: number; r: number }[] = []
    for (let x = -8; x <= 11; x += 1.6) {
      out.push({
        x: x + (rng() - 0.5) * 0.8,
        z: -26.8 + (rng() - 0.5) * 0.8,
        s: 1.6 + rng() * 1.2,
        r: rng() * 3,
      })
    }
    return out
  }, [])
  const shaft = { x: 8.6, z: -25.2 }
  const railFrom = { x: 8.6, z: -24.4 }
  const railTo = { x: WORLD.coalDepot.x + 1.4, z: WORLD.coalDepot.z - 1.2 }
  const len = Math.hypot(railTo.x - railFrom.x, railTo.z - railFrom.z)
  const yaw = Math.atan2(railTo.x - railFrom.x, railTo.z - railFrom.z)
  const ties = Math.floor(len / 0.7)
  return (
    <group>
      {rocks.map((r, i) => (
        <mesh
          key={i}
          position={[r.x, r.s * 0.45, r.z]}
          scale={[r.s, r.s * 0.95, r.s * 0.8]}
          rotation-y={r.r}
          material={cliffMat}
          castShadow
        >
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <group position={[shaft.x, 0, shaft.z]}>
        <mesh position={[0, 1.05, 0]} material={tunnelMat}>
          <boxGeometry args={[1.9, 2.1, 0.3]} />
        </mesh>
        {[-1.05, 1.05].map((dx) => (
          <mesh key={dx} position={[dx, 1.15, 0.2]} material={stakeMat} castShadow>
            <boxGeometry args={[0.24, 2.3, 0.24]} />
          </mesh>
        ))}
        <mesh position={[0, 2.35, 0.2]} material={stakeMat} castShadow>
          <boxGeometry args={[2.6, 0.26, 0.3]} />
        </mesh>
        <mesh position={[1.35, 1.9, 0.5]} material={lanternMat}>
          <boxGeometry args={[0.2, 0.28, 0.2]} />
        </mesh>
      </group>
      <group position={[(railFrom.x + railTo.x) / 2, 0, (railFrom.z + railTo.z) / 2]} rotation-y={yaw}>
        {[-0.35, 0.35].map((dx) => (
          <mesh key={dx} position={[dx, 0.06, 0]} material={railMat}>
            <boxGeometry args={[0.07, 0.07, len]} />
          </mesh>
        ))}
        {Array.from({ length: ties }, (_, i) => (
          <mesh key={i} position={[0, 0.02, -len / 2 + 0.35 + i * 0.7]} material={stakeMat}>
            <boxGeometry args={[1.0, 0.05, 0.16]} />
          </mesh>
        ))}
        {/* mine cart half-way down the track, loaded with coal */}
        <group position={[0, 0, len * 0.15]}>
          <mesh position-y={0.5} material={cartMat} castShadow>
            <boxGeometry args={[0.95, 0.55, 1.3]} />
          </mesh>
          <mesh position-y={0.82} scale={[0.8, 0.3, 1.1]}>
            <sphereGeometry args={[0.5, 8, 6]} />
            <meshStandardMaterial color="#24242a" roughness={0.6} flatShading />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function ZoneView() {
  // district dressing never moves: bake it into one mesh per material after mount
  const deco = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (deco.current && !deco.current.userData.baked) {
      deco.current.userData.baked = true
      mergeStatic(deco.current, () => true)
    }
  }, [])
  return (
    <group>
      {BARRIERS.map((b, i) => (
        <Barrier key={i} from={b.from} to={b.to} zones={b.zones} seed={77 + i * 13} />
      ))}
      <group ref={deco}>
        <Tent x={31.5} z={16} r={0.4} />
        <Tent x={30} z={20.5} r={-0.3} />
        <DryingRack x={31.5} z={8.6} />
        <DryingRack x={33} z={1.6} />
        <Pond />
        <IceShack x={-30.6} z={-21.4} r={0.5} />
        <IceShack x={-13.2} z={-23.8} r={-0.4} />
        <FishRack x={-31.2} z={-16.4} />
        <MineDressing />
      </group>
    </group>
  )
}
