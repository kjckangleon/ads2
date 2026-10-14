// Instanced crowd: every survivor is drawn through a handful of shared
// InstancedMeshes (one torso batch per coat palette, one for all legs, one
// for blob shadows, one per carried item kind, one billboard batch for the
// emoji / "×N" bubbles). The draw-call count stays flat however big the rush
// gets, which is what keeps phones smooth when the queues surge.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { CUSTOMERS } from '../game/balance'
import { NEED_ICON } from '../game/icons'
import type { CustomerSim, ResKind } from '../game/types'
import { villagerTorsoGeo, CUSTOMER_PALETTES, legGeo, legMat, makeCarryItem, STACK_STEP } from './characters'
import { vertexColorMat, blobGeo, blobMat } from './rutil'

const MAX = CUSTOMERS.maxCap
const CARRY_SHOWN = 3
const SOLD: ResKind[] = ['log', 'cooked', 'coat', 'smoked']

// ---------- billboard atlas: need icons, moods, bundle counts ----------

const CELLS = ['🪵', '🍖', '🧥', '🐟', '😍', '😠', '😊', '😱', '❗', '👑', '×2', '×3', '×4', '×5']
const GRID = 4
const CELL_PX = 128
const cellOf = new Map(CELLS.map((c, i) => [c, i]))

function makeAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = GRID * CELL_PX
  const ctx = c.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  CELLS.forEach((ch, i) => {
    const x = (i % GRID) * CELL_PX + CELL_PX / 2
    const y = Math.floor(i / GRID) * CELL_PX + CELL_PX / 2
    if (ch.startsWith('×')) {
      ctx.font = 'bold 76px system-ui, sans-serif'
      ctx.lineWidth = 14
      ctx.strokeStyle = 'rgba(10,16,26,0.9)'
      ctx.strokeText(ch, x, y + 4)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(ch, x, y + 4)
    } else {
      ctx.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.fillText(ch, x, y + 6)
    }
  })
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 2
  return tex
}

/** camera-facing quads; each instance picks its atlas cell */
function makeBillboards(max: number) {
  const geo = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(1, 1)
  geo.index = quad.index
  geo.setAttribute('position', quad.getAttribute('position'))
  geo.setAttribute('uv', quad.getAttribute('uv'))
  const cell = new THREE.InstancedBufferAttribute(new Float32Array(max), 1)
  cell.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aCell', cell)
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: makeAtlas() }, grid: { value: GRID } },
    vertexShader: /* glsl */ `
      attribute float aCell;
      varying vec2 vUv;
      uniform float grid;
      void main() {
        float col = mod(aCell, grid);
        float row = floor(aCell / grid);
        vUv = vec2((col + uv.x) / grid, 1.0 - (row + 1.0 - uv.y) / grid);
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float size = length(instanceMatrix[0].xyz);
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.08) discard;
        gl_FragColor = c;
      }
    `,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, max)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return { mesh, cell }
}

function iconFor(c: CustomerSim): string | null {
  if (c.state === 'leaving') {
    if (c.moodT <= 0) return null
    return c.mood === 'tip' ? '😍' : c.mood === 'angry' ? '😠' : '😊'
  }
  if (sim.wolves.length && nearWolf(c)) return '😱'
  if (c.starveT > CUSTOMERS.angryAfter) return '😠'
  if (c.starveT > CUSTOMERS.impatientAfter) return '❗'
  // VIPs flash a crown between their need icon
  if (c.vip && Math.sin(sim.time * 4 + c.id) > 0.3) return '👑'
  return NEED_ICON[c.need]
}

function nearWolf(c: CustomerSim): boolean {
  for (const w of sim.wolves) {
    const dx = w.pos.x - c.pos.x
    const dz = w.pos.z - c.pos.z
    if (dx * dx + dz * dz < 12) return true
  }
  return false
}

function batch(geo: THREE.BufferGeometry, mat: THREE.Material, max: number, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, max)
  m.count = 0
  m.frustumCulled = false
  m.castShadow = shadow
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return m
}

/** per-survivor animation state that eases between frames */
interface Anim {
  phase: number
  leg: number
  bob: number
  roll: number
  seen: number
}

export function CustomersView() {
  const crowd = useMemo(() => {
    const group = new THREE.Group()
    const torsos = CUSTOMER_PALETTES.map((p) => batch(villagerTorsoGeo(p), vertexColorMat, MAX, true))
    const legs = batch(legGeo, legMat, MAX * 2)
    const shadows = batch(blobGeo, blobMat, MAX)
    shadows.renderOrder = 1
    const carry = Object.fromEntries(
      SOLD.map((k) => {
        const proto = makeCarryItem(k)
        return [k, batch(proto.geometry, proto.material as THREE.Material, MAX * CARRY_SHOWN)]
      }),
    ) as Record<string, THREE.InstancedMesh>
    const bubbles = makeBillboards(MAX * 2)
    group.add(...torsos, legs, shadows, ...Object.values(carry), bubbles.mesh)
    return { group, torsos, legs, shadows, carry, bubbles, anims: new Map<number, Anim>(), frame: 0 }
  }, [])

  const tmp = useMemo(
    () => ({
      root: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
      torsoN: new Array(CUSTOMER_PALETTES.length).fill(0),
      carryN: {} as Record<string, number>,
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const { torsos, legs, shadows, carry, bubbles, anims } = crowd
    const frame = ++crowd.frame
    tmp.torsoN.fill(0)
    for (const k of SOLD) tmp.carryN[k] = 0
    let legN = 0
    let bubbleN = 0
    const ease = Math.pow(0.8, dt * 60)

    const list = sim.customers
    const n = Math.min(list.length, MAX)
    for (let i = 0; i < n; i++) {
      const c = list[i]
      let a = anims.get(c.id)
      if (!a) {
        a = { phase: c.walkPhase, leg: 0, bob: 0, roll: 0, seen: frame }
        anims.set(c.id, a)
      }
      a.seen = frame
      // legs swing only while the walk phase is actually advancing
      const moving = c.walkPhase !== a.phase
      a.phase = c.walkPhase
      if (moving) {
        const sw = Math.sin(c.walkPhase * 2.2)
        a.leg = sw * 0.75
        a.bob = Math.abs(sw) * 0.06
        a.roll = Math.sin(c.walkPhase * 1.1) * 0.03
      } else {
        a.leg *= ease
        a.roll *= ease
        a.bob = Math.abs(Math.sin(sim.time * 1.8 + c.id)) * 0.03
      }
      // happy hop as they leave with a tip
      if (c.state === 'leaving' && c.mood === 'tip' && c.moodT > 0.8) a.bob += Math.abs(Math.sin(sim.time * 14)) * 0.18

      // root: position, facing, VIP size, and a shiver when kept waiting at an empty stall
      let x = c.pos.x
      if (c.state === 'queue' && c.starveT > CUSTOMERS.impatientAfter) x += Math.sin(sim.time * 32 + c.id) * 0.02
      const scale = c.vip ? 1.12 : 1
      tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.yaw)
      tmp.root.compose(tmp.p.set(x, 0, c.pos.z), tmp.q, tmp.s.setScalar(scale))

      // torso (batched by coat palette)
      tmp.e.set(0, 0, a.roll)
      tmp.local.compose(tmp.p.set(0, a.bob, 0), tmp.q.setFromEuler(tmp.e), tmp.one)
      tmp.out.multiplyMatrices(tmp.root, tmp.local)
      const v = Math.min(c.variant, torsos.length - 1)
      torsos[v].setMatrixAt(tmp.torsoN[v]++, tmp.out)

      // legs
      for (const side of [-1, 1]) {
        tmp.e.set(side * a.leg, 0, 0)
        tmp.local.compose(tmp.p.set(side * 0.13, 0.34, 0), tmp.q.setFromEuler(tmp.e), tmp.one)
        tmp.out.multiplyMatrices(tmp.root, tmp.local)
        legs.setMatrixAt(legN++, tmp.out)
      }

      // ground shadow
      tmp.local.makeTranslation(0, 0.02, 0)
      tmp.out.multiplyMatrices(tmp.root, tmp.local)
      shadows.setMatrixAt(i, tmp.out)

      // what they bought, stacked in their arms
      if (c.carrying && carry[c.carrying]) {
        const shown = Math.min(Math.max(c.got, 1), CARRY_SHOWN)
        const step = STACK_STEP[c.carrying]
        for (let k = 0; k < shown; k++) {
          tmp.e.set(0, c.carrying === 'log' ? (k % 2) * 0.5 - 0.25 : (k % 3) * 0.12, 0)
          tmp.local.compose(tmp.p.set(0, 1.72 + k * step, 0.05), tmp.q.setFromEuler(tmp.e), tmp.one)
          tmp.out.multiplyMatrices(tmp.root, tmp.local)
          carry[c.carrying].setMatrixAt(tmp.carryN[c.carrying]++, tmp.out)
        }
      }

      // bubbles: need / mood icon, and how many more items they want
      const bob = Math.sin(sim.time * 2.2 + c.id * 1.7) * 0.06
      const icon = iconFor(c)
      if (icon !== null) {
        tmp.out.compose(tmp.p.set(x, 2.15 * scale + bob, c.pos.z), tmp.q.identity(), tmp.s.setScalar(0.8))
        bubbles.mesh.setMatrixAt(bubbleN, tmp.out)
        bubbles.cell.setX(bubbleN++, cellOf.get(icon) ?? 0)
      }
      const left = c.want - c.got
      if (c.state !== 'leaving' && c.want > 1 && left > 1) {
        tmp.out.compose(tmp.p.set(x, 2.62 * scale + bob, c.pos.z), tmp.q.identity(), tmp.s.setScalar(0.55))
        bubbles.mesh.setMatrixAt(bubbleN, tmp.out)
        bubbles.cell.setX(bubbleN++, cellOf.get(`×${Math.min(left, 5)}`) ?? 0)
      }
    }

    torsos.forEach((m, k) => {
      m.count = tmp.torsoN[k]
      m.instanceMatrix.needsUpdate = true
    })
    legs.count = legN
    legs.instanceMatrix.needsUpdate = true
    shadows.count = n
    shadows.instanceMatrix.needsUpdate = true
    for (const k of SOLD) {
      carry[k].count = tmp.carryN[k]
      carry[k].instanceMatrix.needsUpdate = true
    }
    bubbles.mesh.count = bubbleN
    bubbles.mesh.instanceMatrix.needsUpdate = true
    bubbles.cell.needsUpdate = true

    // forget survivors who have left
    if (frame % 60 === 0) for (const [id, st] of anims) if (st.seen !== frame) anims.delete(id)
  })

  return <primitive object={crowd.group} />
}
