// Procedural stylized characters & animals — chunky silhouettes tuned for the
// elevated camera. All variants share one vertex-colored material so the whole
// crowd costs very few unique materials.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ResKind } from '../game/types'
import { colorGeo, vertexColorMat, makeBlobShadow } from './rutil'

export interface CharPalette {
  coat: string
  hat: string
  scarf: string
  skin: string
}

export const CUSTOMER_PALETTES: CharPalette[] = [
  { coat: '#7f5a3c', hat: '#5a4028', scarf: '#c0563f', skin: '#e8b98f' },
  { coat: '#5c7a99', hat: '#3e5570', scarf: '#d8a03f', skin: '#d9a072' },
  { coat: '#8a6d9e', hat: '#5e4a70', scarf: '#7fbf8f', skin: '#e8b98f' },
  { coat: '#6e8f5a', hat: '#4a6540', scarf: '#c0563f', skin: '#c98d5f' },
  { coat: '#a86868', hat: '#7a4848', scarf: '#e0d8c0', skin: '#e8b98f' },
  { coat: '#4f7f7a', hat: '#365a56', scarf: '#d8a03f', skin: '#d9a072' },
  // VIP: gold coat, crimson hat
  { coat: '#dcae2e', hat: '#9a2a2a', scarf: '#f7ecc4', skin: '#e8b98f' },
]

export const PLAYER_PALETTE: CharPalette = {
  coat: '#3e6fd1',
  hat: '#26437e',
  scarf: '#e8c04a',
  skin: '#e8b98f',
}

export const WORKER_PALETTES: Record<string, CharPalette> = {
  collector: { coat: '#c98f3f', hat: '#8f6428', scarf: '#7a4a2f', skin: '#d9a072' },
  cook: { coat: '#e8e4dc', hat: '#f5f2ea', scarf: '#c0563f', skin: '#e8b98f' },
  runner: { coat: '#4fa06a', hat: '#33734a', scarf: '#e0d8c0', skin: '#c98d5f' },
  cashier: { coat: '#d1b23f', hat: '#947c22', scarf: '#3e5570', skin: '#e8b98f' },
  lumberjack: { coat: '#a04a3f', hat: '#6e2f28', scarf: '#e0d8c0', skin: '#d9a072' },
  logCarrier: { coat: '#c07a35', hat: '#7a4a22', scarf: '#4fa06a', skin: '#e8b98f' },
  archer: { coat: '#57683f', hat: '#3d4a2c', scarf: '#c0563f', skin: '#e8b98f' },
  guard: { coat: '#56607a', hat: '#363c4d', scarf: '#c0563f', skin: '#d9a072' },
  tailor: { coat: '#8a5a9e', hat: '#5e3a70', scarf: '#e8c04a', skin: '#e8b98f' },
  coatRunner: { coat: '#3e7fb0', hat: '#2a5a80', scarf: '#f0e6d0', skin: '#c98d5f' },
  fisher: { coat: '#2f7f8f', hat: '#e8c04a', scarf: '#1f4f5a', skin: '#e8b98f' },
  smoker: { coat: '#6a5a4a', hat: '#3a2f26', scarf: '#ff9a3a', skin: '#d9a072' },
  fishRunner: { coat: '#4fa0b8', hat: '#2f6f80', scarf: '#f0e6d0', skin: '#c98d5f' },
  miner: { coat: '#4a4a52', hat: '#e8c04a', scarf: '#c0563f', skin: '#d9a072' },
  coalCarrier: { coat: '#5e5446', hat: '#2e2a26', scarf: '#e8c04a', skin: '#e8b98f' },
  trader: { coat: '#7a3f6e', hat: '#4a2a44', scarf: '#e8c04a', skin: '#d9a072' },
}

const torsoGeoCache = new Map<string, THREE.BufferGeometry>()

export function villagerTorsoGeo(p: CharPalette): THREE.BufferGeometry {
  const key = p.coat + p.hat + p.scarf + p.skin
  let geo = torsoGeoCache.get(key)
  if (geo) return geo

  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.CapsuleGeometry(0.33, 0.42, 4, 12)
  body.translate(0, 0.72, 0)
  parts.push(colorGeo(body, p.coat))
  for (const side of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.1, 0.36, 3, 8)
    arm.translate(side * 0.4, 0.72, 0)
    parts.push(colorGeo(arm, p.coat))
  }
  const head = new THREE.SphereGeometry(0.235, 14, 11)
  head.translate(0, 1.28, 0)
  parts.push(colorGeo(head, p.skin))
  const hat = new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
  hat.translate(0, 1.33, 0)
  parts.push(colorGeo(hat, p.hat))
  const bobble = new THREE.SphereGeometry(0.07, 8, 6)
  bobble.translate(0, 1.58, 0)
  parts.push(colorGeo(bobble, '#f0ede4'))
  const scarf = new THREE.TorusGeometry(0.24, 0.08, 8, 14)
  scarf.rotateX(Math.PI / 2)
  scarf.translate(0, 1.06, 0)
  parts.push(colorGeo(scarf, p.scarf))
  // nose (readable facing direction)
  const nose = new THREE.ConeGeometry(0.05, 0.12, 6)
  nose.rotateX(Math.PI / 2)
  nose.translate(0, 1.26, 0.24)
  parts.push(colorGeo(nose, '#e09b6f'))

  geo = mergeGeometries(parts)!
  torsoGeoCache.set(key, geo)
  return geo
}

export const legGeo = new THREE.BoxGeometry(0.15, 0.32, 0.18)
legGeo.translate(0, -0.16, 0)
export const legMat = new THREE.MeshStandardMaterial({ color: '#2e3542', roughness: 0.9 })

// ---------- resource visuals (carried, flying, stocked) ----------

const logGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.66, 8)
logGeo.rotateZ(Math.PI / 2)
const logMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 })

const rawGeo = new THREE.SphereGeometry(0.22, 10, 8)
rawGeo.scale(1.3, 0.75, 1)
export const rawMeatMat = new THREE.MeshStandardMaterial({ color: '#e05548', roughness: 0.7 })
export const cookedMeatMat = new THREE.MeshStandardMaterial({ color: '#8a5426', roughness: 0.75 })

let hideGeoCache: THREE.BufferGeometry | null = null
/** flat stretched pelt */
export function hideGeo(): THREE.BufferGeometry {
  if (hideGeoCache) return hideGeoCache
  const parts: THREE.BufferGeometry[] = []
  const pelt = new THREE.BoxGeometry(0.62, 0.07, 0.46)
  parts.push(colorGeo(pelt, '#98714c'))
  const patch = new THREE.BoxGeometry(0.38, 0.07, 0.26)
  patch.translate(0, 0.012, 0)
  parts.push(colorGeo(patch, '#c09668'))
  for (const [x, z] of [
    [-0.33, -0.2],
    [0.33, -0.2],
    [-0.33, 0.2],
    [0.33, 0.2],
  ]) {
    const flap = new THREE.BoxGeometry(0.14, 0.06, 0.1)
    flap.translate(x, 0, z)
    parts.push(colorGeo(flap, '#83603f'))
  }
  hideGeoCache = mergeGeometries(parts)!
  return hideGeoCache
}

let coatGeoCache: THREE.BufferGeometry | null = null
/** neatly folded red coat with a white fur collar */
export function coatGeo(): THREE.BufferGeometry {
  if (coatGeoCache) return coatGeoCache
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.BoxGeometry(0.5, 0.14, 0.38)
  parts.push(colorGeo(body, '#b8433a'))
  const collar = new THREE.BoxGeometry(0.54, 0.08, 0.11)
  collar.translate(0, 0.07, -0.15)
  parts.push(colorGeo(collar, '#efe6d6'))
  for (const z of [0.0, 0.11]) {
    const button = new THREE.BoxGeometry(0.05, 0.03, 0.05)
    button.translate(0, 0.075, z)
    parts.push(colorGeo(button, '#e8c04a'))
  }
  coatGeoCache = mergeGeometries(parts)!
  return coatGeoCache
}

let fishGeoCache: THREE.BufferGeometry | null = null
let smokedGeoCache: THREE.BufferGeometry | null = null
/** chunky fish: body, tail fin, eye — silver raw, golden-brown smoked */
function makeFishGeo(body: string, belly: string, fin: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const b = new THREE.SphereGeometry(0.16, 10, 8)
  b.scale(2.1, 0.72, 0.8)
  parts.push(colorGeo(b, body))
  const bl = new THREE.SphereGeometry(0.12, 8, 6)
  bl.scale(2.0, 0.45, 0.7)
  bl.translate(0, -0.04, 0)
  parts.push(colorGeo(bl, belly))
  const tail = new THREE.ConeGeometry(0.12, 0.18, 4)
  tail.rotateZ(Math.PI / 2)
  tail.scale(1, 1, 0.35)
  tail.translate(-0.4, 0, 0)
  parts.push(colorGeo(tail, fin))
  const eye = new THREE.SphereGeometry(0.03, 6, 5)
  eye.translate(0.25, 0.03, 0.1)
  parts.push(colorGeo(eye, '#1e2228'))
  return mergeGeometries(parts)!
}
export function fishGeo(): THREE.BufferGeometry {
  return (fishGeoCache ??= makeFishGeo('#8fb0c8', '#e4eef6', '#5f84a0'))
}
export function smokedFishGeo(): THREE.BufferGeometry {
  return (smokedGeoCache ??= makeFishGeo('#b8763a', '#e0b070', '#7a4a22'))
}

const coalGeo = new THREE.IcosahedronGeometry(0.17, 0)
coalGeo.scale(1.2, 0.85, 1)
export const coalMat = new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.55, metalness: 0.25, flatShading: true })

export function makeCarryItem(kind: ResKind): THREE.Mesh {
  switch (kind) {
    case 'log':
      return new THREE.Mesh(logGeo, logMat)
    case 'raw':
      return new THREE.Mesh(rawGeo, rawMeatMat)
    case 'cooked':
      return new THREE.Mesh(rawGeo, cookedMeatMat)
    case 'hide':
      return new THREE.Mesh(hideGeo(), vertexColorMat)
    case 'coat':
      return new THREE.Mesh(coatGeo(), vertexColorMat)
    case 'fish':
      return new THREE.Mesh(fishGeo(), vertexColorMat)
    case 'smoked':
      return new THREE.Mesh(smokedFishGeo(), vertexColorMat)
    case 'coal':
      return new THREE.Mesh(coalGeo, coalMat)
  }
}

export const KIND_ORDER: ResKind[] = ['log', 'raw', 'cooked', 'hide', 'coat', 'fish', 'smoked', 'coal']
export const STACK_STEP: Record<ResKind, number> = {
  log: 0.24,
  raw: 0.22,
  cooked: 0.22,
  hide: 0.11,
  coat: 0.16,
  fish: 0.2,
  smoked: 0.2,
  coal: 0.26,
}

export function kindIndex(k: ResKind) {
  return KIND_ORDER.indexOf(k)
}

// ---------- villager rig ----------

export interface CharacterRig {
  group: THREE.Group
  torso: THREE.Mesh
  legL: THREE.Mesh
  legR: THREE.Mesh
  icon: THREE.Sprite
  carryMeshes: THREE.Mesh[][] // [kindIndex][slot]
}

export function makeCharacterRig(palette: CharPalette, carrySlots = 6): CharacterRig {
  const group = new THREE.Group()
  const torso = new THREE.Mesh(villagerTorsoGeo(palette), vertexColorMat)
  torso.castShadow = true
  group.add(torso)

  const legL = new THREE.Mesh(legGeo, legMat)
  legL.position.set(-0.13, 0.34, 0)
  const legR = new THREE.Mesh(legGeo, legMat)
  legR.position.set(0.13, 0.34, 0)
  group.add(legL, legR)

  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false }))
  icon.position.y = 2.15
  icon.scale.set(0.8, 0.8, 1)
  icon.visible = false
  group.add(icon)

  group.add(makeBlobShadow(1))

  // pre-created carry meshes per kind (visibility toggled per frame)
  const carryMeshes: THREE.Mesh[][] = KIND_ORDER.map(() => [])
  for (let k = 0; k < KIND_ORDER.length; k++) {
    const kind = KIND_ORDER[k]
    for (let i = 0; i < carrySlots; i++) {
      const m = makeCarryItem(kind)
      m.visible = false
      m.position.set(0, 1.72 + i * STACK_STEP[kind], 0.05)
      m.rotation.y = kind === 'log' ? (i % 2) * 0.5 - 0.25 : (i % 3) * 0.12
      group.add(m)
      carryMeshes[k].push(m)
    }
  }

  return { group, torso, legL, legR, icon, carryMeshes }
}

export function animateRig(rig: CharacterRig, phase: number, moving: boolean) {
  if (moving) {
    const s = Math.sin(phase * 2.2)
    rig.legL.rotation.x = s * 0.75
    rig.legR.rotation.x = -s * 0.75
    rig.torso.position.y = Math.abs(Math.sin(phase * 2.2)) * 0.06
    rig.torso.rotation.z = Math.sin(phase * 1.1) * 0.03
  } else {
    rig.legL.rotation.x *= 0.8
    rig.legR.rotation.x *= 0.8
    rig.torso.position.y *= 0.8
    rig.torso.rotation.z *= 0.8
  }
}

export function syncCarry(rig: CharacterRig, carry: ResKind[]) {
  for (let k = 0; k < rig.carryMeshes.length; k++) {
    const meshes = rig.carryMeshes[k]
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].visible = i < carry.length && kindIndex(carry[i]) === k
    }
  }
}

// ---------- animals ----------

let deerGeo: THREE.BufferGeometry | null = null
let rabbitGeo: THREE.BufferGeometry | null = null
let wolfGeo: THREE.BufferGeometry | null = null

export function deerBodyGeo(): THREE.BufferGeometry {
  if (deerGeo) return deerGeo
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.BoxGeometry(0.5, 0.55, 1.05)
  body.translate(0, 0.72, 0)
  parts.push(colorGeo(body, '#8a6a4a'))
  const chest = new THREE.BoxGeometry(0.52, 0.45, 0.4)
  chest.translate(0, 0.68, 0.42)
  parts.push(colorGeo(chest, '#967552'))
  const neck = new THREE.BoxGeometry(0.22, 0.5, 0.22)
  neck.rotateX(-0.4)
  neck.translate(0, 1.1, 0.52)
  parts.push(colorGeo(neck, '#8a6a4a'))
  const head = new THREE.BoxGeometry(0.26, 0.26, 0.42)
  head.translate(0, 1.38, 0.68)
  parts.push(colorGeo(head, '#96755f'))
  const snout = new THREE.BoxGeometry(0.16, 0.16, 0.18)
  snout.translate(0, 1.33, 0.94)
  parts.push(colorGeo(snout, '#6e523a'))
  for (const s of [-1, 1]) {
    const ear = new THREE.BoxGeometry(0.06, 0.16, 0.1)
    ear.translate(s * 0.16, 1.54, 0.62)
    parts.push(colorGeo(ear, '#8a6a4a'))
  }
  for (const s of [-1, 1]) {
    const a1 = new THREE.CylinderGeometry(0.025, 0.035, 0.4, 5)
    a1.rotateZ(s * 0.5)
    a1.translate(s * 0.14, 1.72, 0.6)
    parts.push(colorGeo(a1, '#d8cbb0'))
    const a2 = new THREE.CylinderGeometry(0.02, 0.03, 0.24, 5)
    a2.rotateZ(s * 1.2)
    a2.translate(s * 0.24, 1.78, 0.6)
    parts.push(colorGeo(a2, '#d8cbb0'))
  }
  const tail = new THREE.SphereGeometry(0.09, 6, 5)
  tail.translate(0, 0.82, -0.55)
  parts.push(colorGeo(tail, '#e8ddc8'))
  deerGeo = mergeGeometries(parts)!
  return deerGeo
}

export function rabbitBodyGeo(): THREE.BufferGeometry {
  if (rabbitGeo) return rabbitGeo
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.SphereGeometry(0.22, 10, 8)
  body.scale(1, 0.9, 1.3)
  body.translate(0, 0.22, 0)
  parts.push(colorGeo(body, '#cfc4b4'))
  const head = new THREE.SphereGeometry(0.14, 8, 7)
  head.translate(0, 0.4, 0.22)
  parts.push(colorGeo(head, '#d8cec0'))
  for (const s of [-1, 1]) {
    const ear = new THREE.CapsuleGeometry(0.035, 0.18, 2, 6)
    ear.rotateX(-0.25)
    ear.translate(s * 0.06, 0.62, 0.16)
    parts.push(colorGeo(ear, '#cfc4b4'))
  }
  const tail = new THREE.SphereGeometry(0.07, 6, 5)
  tail.translate(0, 0.24, -0.3)
  parts.push(colorGeo(tail, '#f2ede4'))
  rabbitGeo = mergeGeometries(parts)!
  return rabbitGeo
}

export function wolfBodyGeo(): THREE.BufferGeometry {
  if (wolfGeo) return wolfGeo
  const fur = '#6f7682'
  const dark = '#555b66'
  const light = '#b3b8c2'
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.BoxGeometry(0.42, 0.42, 0.98)
  body.translate(0, 0.62, -0.05)
  parts.push(colorGeo(body, fur))
  const belly = new THREE.BoxGeometry(0.34, 0.14, 0.78)
  belly.translate(0, 0.42, -0.05)
  parts.push(colorGeo(belly, light))
  const mane = new THREE.BoxGeometry(0.52, 0.52, 0.36)
  mane.translate(0, 0.7, 0.36)
  parts.push(colorGeo(mane, dark))
  const head = new THREE.BoxGeometry(0.32, 0.3, 0.34)
  head.translate(0, 0.9, 0.66)
  parts.push(colorGeo(head, fur))
  const snout = new THREE.BoxGeometry(0.17, 0.15, 0.26)
  snout.translate(0, 0.83, 0.92)
  parts.push(colorGeo(snout, light))
  const nose = new THREE.BoxGeometry(0.08, 0.07, 0.05)
  nose.translate(0, 0.88, 1.06)
  parts.push(colorGeo(nose, '#1e2228'))
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.07, 0.2, 4)
    ear.translate(s * 0.1, 1.13, 0.6)
    parts.push(colorGeo(ear, dark))
  }
  const tail = new THREE.CylinderGeometry(0.035, 0.08, 0.55, 6)
  tail.rotateX(-1.0)
  tail.translate(0, 0.72, -0.72)
  parts.push(colorGeo(tail, dark))
  wolfGeo = mergeGeometries(parts)!
  return wolfGeo
}

let goatGeo: THREE.BufferGeometry | null = null
let bearGeo: THREE.BufferGeometry | null = null

/** shaggy white mountain goat with curled dark horns and a beard */
export function goatBodyGeo(): THREE.BufferGeometry {
  if (goatGeo) return goatGeo
  const fur = '#eeeae0'
  const shade = '#d6d0c2'
  const horn = '#3a3530'
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.BoxGeometry(0.55, 0.55, 0.95)
  body.translate(0, 0.72, 0)
  parts.push(colorGeo(body, fur))
  const hump = new THREE.BoxGeometry(0.6, 0.35, 0.45)
  hump.translate(0, 0.98, 0.25)
  parts.push(colorGeo(hump, shade))
  const neck = new THREE.BoxGeometry(0.26, 0.36, 0.26)
  neck.rotateX(-0.35)
  neck.translate(0, 1.05, 0.5)
  parts.push(colorGeo(neck, fur))
  const head = new THREE.BoxGeometry(0.26, 0.3, 0.38)
  head.translate(0, 1.22, 0.7)
  parts.push(colorGeo(head, fur))
  const beard = new THREE.BoxGeometry(0.12, 0.2, 0.1)
  beard.translate(0, 0.98, 0.84)
  parts.push(colorGeo(beard, shade))
  for (const s of [-1, 1]) {
    const h = new THREE.TorusGeometry(0.12, 0.035, 5, 8, Math.PI * 1.2)
    h.rotateY(Math.PI / 2)
    h.translate(s * 0.1, 1.42, 0.6)
    parts.push(colorGeo(h, horn))
  }
  const tail = new THREE.BoxGeometry(0.1, 0.12, 0.08)
  tail.translate(0, 0.9, -0.5)
  parts.push(colorGeo(tail, shade))
  goatGeo = mergeGeometries(parts)!
  return goatGeo
}

/** big brown bear: heavy shoulders, round ears, pale muzzle */
export function bearBodyGeo(): THREE.BufferGeometry {
  if (bearGeo) return bearGeo
  const fur = '#5a3f2a'
  const dark = '#3f2b1c'
  const muzzle = '#b08a64'
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.SphereGeometry(0.62, 12, 9)
  body.scale(0.95, 0.85, 1.35)
  body.translate(0, 0.98, -0.1)
  parts.push(colorGeo(body, fur))
  const hump = new THREE.SphereGeometry(0.5, 10, 8)
  hump.scale(1, 0.8, 0.9)
  hump.translate(0, 1.32, 0.35)
  parts.push(colorGeo(hump, dark))
  const head = new THREE.SphereGeometry(0.36, 10, 8)
  head.translate(0, 1.22, 0.95)
  parts.push(colorGeo(head, fur))
  const snout = new THREE.BoxGeometry(0.26, 0.2, 0.3)
  snout.translate(0, 1.12, 1.28)
  parts.push(colorGeo(snout, muzzle))
  const nose = new THREE.BoxGeometry(0.12, 0.08, 0.06)
  nose.translate(0, 1.2, 1.44)
  parts.push(colorGeo(nose, '#1e1a16'))
  for (const s of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.1, 7, 6)
    ear.translate(s * 0.24, 1.52, 0.9)
    parts.push(colorGeo(ear, dark))
    const eye = new THREE.SphereGeometry(0.04, 6, 5)
    eye.translate(s * 0.13, 1.3, 1.24)
    parts.push(colorGeo(eye, '#1e1a16'))
  }
  bearGeo = mergeGeometries(parts)!
  return bearGeo
}

let mammothGeo: THREE.BufferGeometry | null = null
let yetiGeo: THREE.BufferGeometry | null = null

/** woolly mammoth: huge shaggy body, domed head, curled tusks, trunk */
export function mammothBodyGeo(): THREE.BufferGeometry {
  if (mammothGeo) return mammothGeo
  const fur = '#6a4a32'
  const dark = '#4e3424'
  const ivory = '#efe6d2'
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.SphereGeometry(1.25, 14, 10)
  body.scale(1.0, 0.95, 1.4)
  body.translate(0, 2.0, -0.2)
  parts.push(colorGeo(body, fur))
  const hump = new THREE.SphereGeometry(0.95, 12, 8)
  hump.translate(0, 2.75, 0.45)
  parts.push(colorGeo(hump, dark))
  const skirt = new THREE.CylinderGeometry(1.15, 1.35, 0.6, 12, 1, true)
  skirt.scale(1, 1, 1.35)
  skirt.translate(0, 1.25, -0.2)
  parts.push(colorGeo(skirt, dark))
  const head = new THREE.SphereGeometry(0.75, 12, 9)
  head.translate(0, 2.45, 1.55)
  parts.push(colorGeo(head, fur))
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.CylinderGeometry(0.22 - i * 0.03, 0.25 - i * 0.03, 0.55, 8)
    seg.rotateX(0.35 + i * 0.25)
    seg.translate(0, 2.0 - i * 0.45, 2.05 + i * 0.12)
    parts.push(colorGeo(seg, dark))
  }
  for (const s of [-1, 1]) {
    const tusk = new THREE.TorusGeometry(0.7, 0.09, 6, 12, Math.PI * 0.85)
    tusk.rotateY(Math.PI / 2)
    tusk.rotateX(Math.PI)
    tusk.translate(s * 0.42, 2.1, 2.15)
    parts.push(colorGeo(tusk, ivory))
    const ear = new THREE.SphereGeometry(0.3, 8, 6)
    ear.scale(0.4, 1, 1)
    ear.translate(s * 0.72, 2.6, 1.3)
    parts.push(colorGeo(ear, dark))
    const eye = new THREE.SphereGeometry(0.07, 6, 5)
    eye.translate(s * 0.42, 2.65, 2.15)
    parts.push(colorGeo(eye, '#1e1a16'))
  }
  mammothGeo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!
  return mammothGeo
}

/** yeti: tall white snow beast, broad shoulders, long arms, blue face */
export function yetiBodyGeo(): THREE.BufferGeometry {
  if (yetiGeo) return yetiGeo
  const fur = '#eef2f6'
  const shade = '#c9d3de'
  const face = '#6f8fb8'
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.CapsuleGeometry(0.75, 1.2, 6, 12)
  body.scale(1.15, 1, 0.9)
  body.translate(0, 2.1, 0)
  parts.push(colorGeo(body, fur))
  const chest = new THREE.SphereGeometry(0.7, 10, 8)
  chest.scale(1.1, 0.8, 0.6)
  chest.translate(0, 2.4, 0.35)
  parts.push(colorGeo(chest, shade))
  const head = new THREE.SphereGeometry(0.55, 12, 9)
  head.translate(0, 3.45, 0.15)
  parts.push(colorGeo(head, fur))
  const mask = new THREE.SphereGeometry(0.36, 10, 8)
  mask.scale(1, 0.85, 0.6)
  mask.translate(0, 3.38, 0.52)
  parts.push(colorGeo(mask, face))
  for (const s of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.26, 1.35, 4, 8)
    arm.rotateZ(s * 0.25)
    arm.translate(s * 1.05, 1.9, 0.15)
    parts.push(colorGeo(arm, fur))
    const fist = new THREE.SphereGeometry(0.32, 8, 6)
    fist.translate(s * 1.25, 1.05, 0.2)
    parts.push(colorGeo(fist, shade))
    const eye = new THREE.SphereGeometry(0.07, 6, 5)
    eye.translate(s * 0.14, 3.48, 0.78)
    parts.push(colorGeo(eye, '#ff5a3a'))
    const horn = new THREE.ConeGeometry(0.09, 0.4, 6)
    horn.rotateZ(-s * 0.5)
    horn.translate(s * 0.35, 3.95, 0.05)
    parts.push(colorGeo(horn, '#9aa4b2'))
  }
  yetiGeo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!
  return yetiGeo
}

const deerLegGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.5, 6)
deerLegGeo.translate(0, -0.25, 0)
const deerLegMat = new THREE.MeshStandardMaterial({ color: '#6e523a', roughness: 0.9 })
const wolfLegGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.42, 6)
wolfLegGeo.translate(0, -0.21, 0)
const wolfLegMat = new THREE.MeshStandardMaterial({ color: '#555b66', roughness: 0.9 })
const wolfEyeMat = new THREE.MeshBasicMaterial({ color: '#ffd24a' })
const goatLegGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.48, 6)
goatLegGeo.translate(0, -0.24, 0)
const goatLegMat = new THREE.MeshStandardMaterial({ color: '#cfc8b8', roughness: 0.9 })
const bearLegGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.62, 7)
bearLegGeo.translate(0, -0.31, 0)
const bearLegMat = new THREE.MeshStandardMaterial({ color: '#3f2b1c', roughness: 0.95 })
const mammothLegGeo = new THREE.CylinderGeometry(0.42, 0.38, 1.3, 8)
mammothLegGeo.translate(0, -0.65, 0)
const mammothLegMat = new THREE.MeshStandardMaterial({ color: '#4e3424', roughness: 0.95 })
const yetiLegGeo = new THREE.CapsuleGeometry(0.3, 0.7, 4, 8)
yetiLegGeo.translate(0, -0.6, 0)
const yetiLegMat = new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.9 })

/** body geometry, leg mesh + spots, leg hip height, shadow size per animal */
const RIG: Record<
  'deer' | 'rabbit' | 'goat' | 'bear' | 'mammoth' | 'yeti',
  { body: () => THREE.BufferGeometry; leg?: [THREE.BufferGeometry, THREE.Material]; legs: number[][]; hip: number; shadow: number }
> = {
  mammoth: {
    body: () => mammothBodyGeo(),
    leg: [mammothLegGeo, mammothLegMat],
    legs: [
      [-0.65, 0.95],
      [0.65, 0.95],
      [-0.65, -1.1],
      [0.65, -1.1],
    ],
    hip: 1.3,
    shadow: 4.2,
  },
  yeti: {
    body: () => yetiBodyGeo(),
    leg: [yetiLegGeo, yetiLegMat],
    legs: [
      [-0.45, 0],
      [0.45, 0],
    ],
    hip: 1.25,
    shadow: 2.8,
  },
  deer: {
    body: () => deerBodyGeo(),
    leg: [deerLegGeo, deerLegMat],
    legs: [
      [-0.16, 0.35],
      [0.16, 0.35],
      [-0.16, -0.35],
      [0.16, -0.35],
    ],
    hip: 0.5,
    shadow: 1.3,
  },
  rabbit: { body: () => rabbitBodyGeo(), legs: [], hip: 0, shadow: 0.6 },
  goat: {
    body: () => goatBodyGeo(),
    leg: [goatLegGeo, goatLegMat],
    legs: [
      [-0.17, 0.32],
      [0.17, 0.32],
      [-0.17, -0.32],
      [0.17, -0.32],
    ],
    hip: 0.48,
    shadow: 1.3,
  },
  bear: {
    body: () => bearBodyGeo(),
    leg: [bearLegGeo, bearLegMat],
    legs: [
      [-0.32, 0.55],
      [0.32, 0.55],
      [-0.32, -0.6],
      [0.32, -0.6],
    ],
    hip: 0.62,
    shadow: 2.2,
  },
}

export interface AnimalRig {
  group: THREE.Group
  body: THREE.Mesh
  legs: THREE.Mesh[]
  mat: THREE.MeshStandardMaterial
  /** wolves only: meat held in the jaws */
  mouth?: THREE.Mesh
}

export function makeAnimalRig(kind: 'deer' | 'rabbit' | 'goat' | 'bear' | 'mammoth' | 'yeti'): AnimalRig {
  const cfg = RIG[kind]
  const group = new THREE.Group()
  const mat = vertexColorMat.clone() // per-animal so hit flash can tint
  const body = new THREE.Mesh(cfg.body(), mat)
  body.castShadow = true
  group.add(body)
  const legs: THREE.Mesh[] = []
  if (cfg.leg) {
    for (const [x, z] of cfg.legs) {
      const leg = new THREE.Mesh(cfg.leg[0], cfg.leg[1])
      leg.position.set(x, cfg.hip, z)
      group.add(leg)
      legs.push(leg)
    }
  }
  group.add(makeBlobShadow(cfg.shadow))
  return { group, body, legs, mat }
}

export function makeWolfRig(): AnimalRig {
  const group = new THREE.Group()
  const mat = vertexColorMat.clone()
  const body = new THREE.Mesh(wolfBodyGeo(), mat)
  body.castShadow = true
  group.add(body)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), wolfEyeMat)
    eye.position.set(s * 0.09, 0.96, 0.83)
    body.add(eye)
  }
  const legs: THREE.Mesh[] = []
  for (const [x, z] of [
    [-0.14, 0.32],
    [0.14, 0.32],
    [-0.14, -0.4],
    [0.14, -0.4],
  ]) {
    const leg = new THREE.Mesh(wolfLegGeo, wolfLegMat)
    leg.position.set(x, 0.43, z)
    group.add(leg)
    legs.push(leg)
  }
  const mouth = new THREE.Mesh(rawGeo, rawMeatMat)
  mouth.scale.setScalar(0.85)
  mouth.position.set(0, 0.8, 1.1)
  mouth.visible = false
  body.add(mouth)
  group.add(makeBlobShadow(1.2))
  return { group, body, legs, mat, mouth }
}

// ---------- billboard progress / health bar ----------

export interface Bar {
  group: THREE.Group
  fill: THREE.Sprite
  width: number
}

/** Must not be parented to a rotating object: the fill grows along world x. */
export function makeBar(width: number, color: string): Bar {
  const group = new THREE.Group()
  const bg = new THREE.Sprite(
    new THREE.SpriteMaterial({ color: '#141924', transparent: true, opacity: 0.8, depthWrite: false }),
  )
  bg.scale.set(width + 0.08, 0.16, 1)
  bg.renderOrder = 4
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthWrite: false }))
  fill.center.set(0, 0.5)
  fill.position.x = -width / 2
  fill.scale.set(width, 0.1, 1)
  fill.renderOrder = 5
  group.add(bg, fill)
  return { group, fill, width }
}

export function setBar(bar: Bar, frac: number) {
  bar.fill.scale.x = Math.max(0.0001, bar.width * Math.min(1, Math.max(0, frac)))
}
