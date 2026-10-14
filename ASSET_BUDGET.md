# FROSTLINE — Asset Budget

Measured from `npm run build` (Vite 5, production mode, debug panel excluded).

| Item | Raw | Gzipped |
|---|---|---|
| JavaScript (game + React + three.js + R3F) | 1,092 KB | 310 KB |
| CSS | 5.8 KB | 2.0 KB |
| HTML | 1.3 KB | 0.7 KB |
| 3D models | 0 | 0 |
| Textures | 0 | 0 |
| Audio | 0 | 0 |
| **Initial download** | **~1.10 MB** | **~313 KB** |

Every mesh, texture and sound is generated at runtime (see `ASSET_PLAN.md`),
so the whole game is a single ~313 KB gzipped download. That loads in about a
second on a typical 4G connection.

## Runtime budget (rough, high quality)

- Lights: 1 hemisphere + 1 directional (shadows) + 2 fire point lights + 3
  stall lanterns. The light count is constant, so nightfall never triggers a
  shader recompile. Low quality drops the lanterns and shadows.
- Instanced: background forest (~150 trees × 5 parts), rocks, particles (360),
  barrier mounds.
- Pooled: 48 customers, 20 workers, 10 deer, 6 rabbits, 10 wolves, 40 meat +
  40 hide drops, 32 floating texts, 70 cash flights, 56 item flights, 20 arrows.
- Instanced per kind: carry stacks (player + workers), stall / table inventory
  grids, cash-bundle piles.
- Measured late game (Level 8, 17 workers, 28 customers): ~470 draw calls per
  frame including the shadow pass; simulation 0.017 ms per tick.

## Headroom for the art pass

Target initial download on mobile: **≤ 8 MB**, which leaves ~7.5 MB for GLB
models (Meshopt) and KTX2 textures. Suggested split:

- Characters + animals (one rig + animation set each): ≤ 2 MB
- Buildings / props (atlased): ≤ 2.5 MB
- Terrain + snow PBR (1K, KTX2): ≤ 1.5 MB
- Audio (Opus): ≤ 1.5 MB
