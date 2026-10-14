// Locked district barrier (snowdrifts + stakes) that sinks away when bought,
// plus tannery dressing (tents, drying racks) visible from outside as a tease.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { ZONES } from '../game/balance'
import { damp, mulberry32 } from '../game/util'

const moundMat = new THREE.MeshStandardMaterial({ color: '#e9eff7', roughness: 0.95 })
const stakeMat = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.9 })
const tentMat = new THREE.MeshStandardMaterial({ color: '#b69a72', roughness: 0.95, flatShading: true })
const hideMat = new THREE.MeshStandardMaterial({ color: '#a07850', roughness: 0.95, side: THREE.DoubleSide })

function barrierPoints(): { x: number; z: number }[] {
  const r = ZONES.tannery
  const pts: { x: number; z: number }[] = []
  for (let z = r.minZ; z <= 34; z += 1.5) pts.push({ x: r.minX, z })
  for (let x = r.minX + 1.5; x <= 36; x += 1.5) pts.push({ x, z: r.minZ })
  return pts
}

function Barrier() {
  const pts = useMemo(barrierPoints, [])
  const group = useRef<THREE.Group>(null)
  const mounds = useRef<THREE.InstancedMesh>(null)
  const stakes = useRef<THREE.InstancedMesh>(null)
  const sink = useRef(sim.zones.tannery ? 1 : 0)
  const stakeCount = Math.ceil(pts.length / 2)

  useFrame((_, dt) => {
    const m = mounds.current
    const s = stakes.current
    if (m && !m.userData.done && s) {
      const rng = mulberry32(77)
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
    const target = sim.zones.tannery ? 1 : 0
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

export function ZoneView() {
  return (
    <group>
      <Barrier />
      <Tent x={31.5} z={16} r={0.4} />
      <Tent x={30} z={20.5} r={-0.3} />
      <DryingRack x={31.5} z={8.6} />
      <DryingRack x={33} z={1.6} />
    </group>
  )
}
