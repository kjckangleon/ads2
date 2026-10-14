import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useUI, type Quality } from './uiStore'
import { SimDriver } from '../render/SimDriver'
import { CameraRig } from '../render/CameraRig'
import { DayNight } from '../render/DayNight'
import { Environment } from '../render/Environment'
import { ZoneView } from '../render/ZoneView'
import { TreesView } from '../render/TreesView'
import { StationsView } from '../render/StationsView'
import { DepotView } from '../render/DepotView'
import { ProcessorsView } from '../render/ProcessorsView'
import { TowerView } from '../render/TowerView'
import { CaravanView } from '../render/CaravanView'
import { PadsView } from '../render/PadsView'
import { PilesView } from '../render/PilesView'
import { DropsView } from '../render/DropsView'
import { AnimalsView } from '../render/AnimalsView'
import { CustomersView } from '../render/CustomersView'
import { WorkersView } from '../render/WorkersView'
import { PlayerView } from '../render/PlayerView'
import { ArrowsView } from '../render/ArrowsView'
import { GuidesView } from '../render/GuidesView'
import { FxView } from '../render/FxView'
import { BeltsView } from '../render/BeltsView'
import { FurnaceView } from '../render/FurnaceView'
import { NodesView } from '../render/NodesView'
import { CashBeltsView } from '../render/CashBeltsView'
import { MachinesView } from '../render/MachinesView'
import { LootView } from '../render/LootView'

// Phones have 2-3x screens; rendering at 1x there looks pixelated, so even low
// quality renders above 1x and the adaptive monitor trades it back for frame rate.
const MAX_DPR: Record<Quality, number> = { low: 1.5, medium: 2, high: 2 }
const MIN_DPR = 1

function startDpr(quality: Quality) {
  return Math.min(window.devicePixelRatio || 1, MAX_DPR[quality])
}

/** Steps the render resolution down when frames drop and back up when they recover. */
function AdaptiveResolution({ quality }: { quality: Quality }) {
  const setDpr = useThree((s) => s.setDpr)
  return (
    <PerformanceMonitor
      onDecline={() => setDpr(MIN_DPR + (startDpr(quality) - MIN_DPR) * 0.5)}
      onIncline={() => setDpr(startDpr(quality))}
      onFallback={() => {
        setDpr(MIN_DPR)
        // still struggling at 1x: drop shadows and extras rather than stutter
        if (quality !== 'low') useUI.getState().set({ quality: 'low' })
      }}
    />
  )
}

export function Game() {
  const quality = useUI((s) => s.quality)
  const shadows = quality !== 'low'
  return (
    <Canvas
      key={quality}
      shadows={shadows}
      dpr={startDpr(quality)}
      camera={{ fov: 42, near: 0.5, far: 260, position: [0, 21.5, 19.5] }}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <AdaptiveResolution quality={quality} />
      <color attach="background" args={['#cdd8e6']} />
      <fog attach="fog" args={['#cdd8e6', 60, 150]} />
      <DayNight shadows={shadows} quality={quality} />
      <SimDriver />
      <CameraRig />
      <Environment />
      <ZoneView />
      <TreesView />
      <NodesView />
      <StationsView />
      <DepotView />
      <ProcessorsView />
      <FurnaceView />
      <BeltsView />
      <CashBeltsView />
      <MachinesView />
      <LootView />
      <TowerView />
      <CaravanView />
      <PadsView />
      <PilesView />
      <DropsView />
      <AnimalsView />
      <CustomersView />
      <WorkersView />
      <PlayerView />
      <ArrowsView />
      <GuidesView />
      <FxView />
    </Canvas>
  )
}
