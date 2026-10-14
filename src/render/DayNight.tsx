// Sun/moon lighting, sky and fog colour driven by sim.clock.dark. Light
// count stays constant so nothing recompiles when night falls.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../game/state'
import { lerp } from '../game/util'
import type { Quality } from '../game/uiStore'

export function DayNight({ shadows, quality }: { shadows: boolean; quality: Quality }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  const c = useMemo(
    () => ({
      dayBg: new THREE.Color('#cdd8e6'),
      nightBg: new THREE.Color('#22304f'),
      daySky: new THREE.Color('#e8f0fa'),
      nightSky: new THREE.Color('#8298c8'),
      dayGround: new THREE.Color('#8b95a5'),
      nightGround: new THREE.Color('#3a4766'),
      sun: new THREE.Color('#fff2dd'),
      moon: new THREE.Color('#b4c8ff'),
    }),
    [],
  )

  useFrame(() => {
    const d = sim.clock.dark
    if (hemi.current) {
      hemi.current.intensity = lerp(0.95, 0.66, d)
      hemi.current.color.lerpColors(c.daySky, c.nightSky, d)
      hemi.current.groundColor.lerpColors(c.dayGround, c.nightGround, d)
    }
    if (sun.current) {
      sun.current.intensity = lerp(1.35, 0.62, d)
      sun.current.color.lerpColors(c.sun, c.moon, d)
    }
    if (scene.background instanceof THREE.Color) scene.background.lerpColors(c.dayBg, c.nightBg, d)
    if (scene.fog) (scene.fog as THREE.Fog).color.lerpColors(c.dayBg, c.nightBg, d)
  })

  const map = quality === 'high' ? 2048 : 1024
  return (
    <>
      <hemisphereLight ref={hemi} args={['#e8f0fa', '#8b95a5', 0.95]} />
      <directionalLight
        ref={sun}
        position={[24, 32, 10]}
        intensity={1.35}
        color="#fff2dd"
        castShadow={shadows}
        shadow-mapSize={[map, map]}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0006}
      />
    </>
  )
}
