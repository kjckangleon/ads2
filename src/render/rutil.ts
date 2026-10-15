import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ---------- emoji sprite textures (crisp icons with zero asset downloads) ----------

const emojiCache = new Map<string, THREE.Texture>()

export function emojiTexture(char: string): THREE.Texture {
  let tex = emojiCache.get(char)
  if (tex) return tex
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.font = '100px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, 64, 70)
  tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 2
  emojiCache.set(char, tex)
  return tex
}

export function makeEmojiSprite(char: string, scale = 0.9): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ map: emojiTexture(char), depthWrite: false })
  const s = new THREE.Sprite(mat)
  s.scale.set(scale, scale, 1)
  return s
}

// ---------- dynamic text labels ----------

export class TextLabel {
  sprite: THREE.Sprite
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tex: THREE.CanvasTexture
  private last = ''
  private lastColor = ''
  readonly aspect: number

  constructor(scale = 1, width = 256) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = 96
    this.aspect = width / 256
    this.ctx = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.anisotropy = 2
    const mat = new THREE.SpriteMaterial({ map: this.tex, depthWrite: false })
    this.sprite = new THREE.Sprite(mat)
    this.setScale(scale)
  }

  setScale(scale: number) {
    this.sprite.scale.set(2.3 * scale * this.aspect, 0.86 * scale, 1)
  }

  set(text: string, color = '#ffffff') {
    if (text === this.last && color === this.lastColor) return
    this.last = text
    this.lastColor = color
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let size = 46
    ctx.font = `bold ${size}px system-ui, sans-serif`
    const maxW = canvas.width - 18
    const w = ctx.measureText(text).width
    if (w > maxW) {
      size = Math.max(18, Math.floor((size * maxW) / w))
      ctx.font = `bold ${size}px system-ui, sans-serif`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(5, size * 0.2)
    ctx.strokeStyle = 'rgba(10,16,26,0.85)'
    ctx.strokeText(text, canvas.width / 2, 50)
    ctx.fillStyle = color
    ctx.fillText(text, canvas.width / 2, 50)
    this.tex.needsUpdate = true
  }

  setOpacity(o: number) {
    ;(this.sprite.material as THREE.SpriteMaterial).opacity = o
  }
}

// ---------- shared geometry/material helpers ----------

export function colorGeo(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex)
  const n = geo.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

export const vertexColorMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.02,
})

/** simple ground blob shadow, lifted over every ground layer (park roads and markings) so it never flickers */
export const BLOB_Y = 0.07
export const blobGeo = new THREE.CircleGeometry(0.5, 20)
blobGeo.rotateX(-Math.PI / 2)
export const blobMat = new THREE.MeshBasicMaterial({
  color: '#1c2636',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
})
export function makeBlobShadow(scale = 1): THREE.Mesh {
  const m = new THREE.Mesh(blobGeo, blobMat)
  m.scale.setScalar(scale)
  m.position.y = BLOB_Y
  m.renderOrder = 1
  return m
}

/** Show pile stage groups based on a 0..1 fraction. */
export function stagedVisibility(groups: THREE.Object3D[], frac: number) {
  const n = groups.length
  for (let i = 0; i < n; i++) {
    groups[i].visible = frac > (i + 0.01) / n || (i === 0 && frac > 0.001)
  }
}

// ---------- static batching ----------

/**
 * Bake the static meshes under `root` into one mesh per material (draw calls
 * and scene-graph size drop a lot on phones). `pick` chooses which meshes may
 * be baked — leave out anything animated, re-materialed or toggled. Instanced
 * meshes and sprites are never touched. Returns the merged meshes.
 */
export function mergeStatic(root: THREE.Object3D, pick: (o: THREE.Object3D) => boolean): THREE.Mesh[] {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const rel = new THREE.Matrix4()
  const buckets = new Map<
    string,
    { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; order: number }
  >()
  const baked: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (!pick(p)) return
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld))
    const attrs = Object.keys(g.attributes).sort().join(',')
    const key = `${m.material.uuid}|${attrs}|${m.castShadow}|${m.receiveShadow}|${m.renderOrder}`
    let b = buckets.get(key)
    if (!b) {
      b = { mat: m.material, geos: [], cast: m.castShadow, receive: m.receiveShadow, order: m.renderOrder }
      buckets.set(key, b)
    }
    b.geos.push(g)
    baked.push(m)
  })
  for (const m of baked) m.parent?.remove(m)
  const out: THREE.Mesh[] = []
  for (const b of buckets.values()) {
    const merged = new THREE.Mesh(b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos)!, b.mat)
    merged.castShadow = b.cast
    merged.receiveShadow = b.receive
    merged.renderOrder = b.order
    root.add(merged)
    out.push(merged)
  }
  return out
}
