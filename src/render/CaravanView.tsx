// Trade caravan: a reindeer-drawn sled that slides in from the west, parks
// by the gate with a floating order board, and leaves when done.

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { WORLD } from '../game/balance'
import { caravanX, orderText } from '../game/systems/caravan'
import { TextLabel } from './rutil'
import { makeAnimalRig, makeCharacterRig, WORKER_PALETTES, makeBar, setBar } from './characters'
import { lanternMat } from './StationsView'

const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.9 })
const runnerMat = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 0.8 })
const canvasMat = new THREE.MeshStandardMaterial({ color: '#d9cdb2', roughness: 0.95, side: THREE.DoubleSide })
const crateMats = ['#9a7448', '#7f5f3a', '#a8844f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
const ringMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.6, depthWrite: false })

function buildSled() {
  // built facing local +z (the direction of travel)
  const sled = new THREE.Group()
  for (const s of [-1, 1]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.3), runnerMat)
    runner.position.set(s * 0.62, 0.06, 0)
    sled.add(runner)
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), runnerMat)
    tip.position.set(s * 0.62, 0.2, 1.75)
    tip.rotation.x = -0.6
    sled.add(tip)
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 2.9), woodMat)
  deck.position.y = 0.32
  deck.castShadow = true
  sled.add(deck)
  for (let i = 0; i < 4; i++) {
    const s = 0.5 + (i % 2) * 0.12
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMats[i % crateMats.length])
    c.position.set((i % 2) * 0.55 - 0.28, 0.41 + s / 2 + (i > 1 ? 0.5 : 0), -0.8 + (i % 2) * 0.3)
    c.rotation.y = i * 0.4
    sled.add(c)
  }
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.3, 12, 1, true, 0, Math.PI), canvasMat)
  cover.rotation.z = Math.PI / 2
  cover.rotation.y = Math.PI / 2
  cover.position.set(0, 0.42, 0.55)
  sled.add(cover)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), runnerMat)
  pole.position.set(0.6, 1.2, 1.25)
  sled.add(pole)
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lanternMat)
  lantern.position.set(0.6, 1.95, 1.25)
  sled.add(lantern)

  const deer = [makeAnimalRig('deer'), makeAnimalRig('deer')]
  deer.forEach((d, i) => {
    d.group.position.set(i === 0 ? -0.45 : 0.45, 0, 2.7)
    d.group.scale.setScalar(0.85)
    sled.add(d.group)
  })
  for (const s of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.1), runnerMat)
    line.position.set(s * 0.45, 0.65, 2.0)
    sled.add(line)
  }
  return { sled, deer }
}

export function CaravanView() {
  const built = useMemo(() => {
    const root = new THREE.Group()
    const { sled, deer } = buildSled()
    root.add(sled)

    const board = new TextLabel(0.9, 640)
    board.sprite.position.y = 4.6
    root.add(board.sprite)
    const timer = new TextLabel(0.7)
    timer.sprite.position.y = 3.85
    root.add(timer.sprite)
    const timeBar = makeBar(2.2, '#7fe0ff')
    timeBar.group.position.y = 3.4
    root.add(timeBar.group)

    // trader stands by the delivery ring while parked
    const trader = makeCharacterRig(WORKER_PALETTES.trader, 0)
    trader.group.position.set(WORLD.caravanDeliver.x - 1.9, 0, WORLD.caravanDeliver.z + 0.9)
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 36), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(WORLD.caravanDeliver.x, 0.03, WORLD.caravanDeliver.z)
    ring.renderOrder = 2
    return { root, sled, deer, board, timer, timeBar, trader, ring }
  }, [])

  useFrame(() => {
    const cv = sim.caravan
    const out = cv.state === 'away'
    built.root.visible = !out
    const parked = cv.state === 'waiting'
    built.trader.group.visible = parked
    built.ring.visible = parked
    if (out) return

    built.root.position.set(caravanX(sim), 0, WORLD.caravanSpot.z)
    built.sled.rotation.y = cv.state === 'leaving' ? -Math.PI / 2 : Math.PI / 2
    const moving = cv.state === 'arriving' || cv.state === 'leaving'
    for (const d of built.deer) {
      d.legs.forEach((leg, k) => {
        leg.rotation.x = moving ? Math.sin(sim.time * 9 + (k % 2) * Math.PI) * 0.55 : 0
      })
      d.body.rotation.x = moving ? 0 : Math.sin(sim.time * 0.8) * 0.05 + 0.05
    }

    built.board.sprite.visible = parked || cv.state === 'arriving'
    built.board.set(orderText(cv.order), '#ffffff')
    built.timer.sprite.visible = parked
    built.timeBar.group.visible = parked
    if (parked) {
      const secs = Math.ceil(cv.timer)
      built.timer.set(`⏱ ${secs}s`, secs <= 15 ? '#ff9a8a' : '#bfefff')
      setBar(built.timeBar, cv.maxTimer > 0 ? cv.timer / cv.maxTimer : 0)
      ringMat.opacity = 0.45 + Math.sin(sim.time * 4) * 0.2
      built.trader.torso.rotation.z = Math.sin(sim.time * 2.5) * 0.06
    }
  })

  return (
    <group>
      <primitive object={built.root} />
      <primitive object={built.trader.group} />
      <primitive object={built.ring} />
    </group>
  )
}
