import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useUI } from './uiStore'
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

export function Game() {
  const quality = useUI((s) => s.quality)
  const shadows = quality !== 'low'
  return (
    <Canvas
      key={quality}
      shadows={shadows}
      dpr={quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : 1}
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
      <color attach="background" args={['#cdd8e6']} />
      <fog attach="fog" args={['#cdd8e6', 60, 150]} />
      <DayNight shadows={shadows} quality={quality} />
      <SimDriver />
      <CameraRig />
      <Environment />
      <ZoneView />
      <TreesView />
      <StationsView />
      <DepotView />
      <ProcessorsView />
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
