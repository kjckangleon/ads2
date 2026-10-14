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
- Lights: + 1 furnace light (also always mounted, intensity 0 while cold).
- Instanced: background forest (~150 trees × 5 parts), rocks, particles (360),
  barrier mounds, belt items, cash bundles.
- **Instanced crowd (up to 96 customers):** one torso batch per coat palette
  (7), one batch for all legs, one for blob shadows, one per carried item kind,
  and one billboard batch (emoji atlas) for every need / mood / ×N bubble —
  about 15 draw calls no matter how many survivors are on screen.
- **Static batching:** belts, cash belts, stalls, workshops, machine bodies,
  district dressing, trampled paths and mountains are baked into one mesh per
  material at build time (`mergeStatic` in `render/rutil.ts`).
- Pooled: 34 workers, 16 deer, 6 rabbits, 8 goats, 4 bears, 10 wolves, 40
  meat + 40 hide drops, 32 floating texts, 70 cash flights, 56 item flights,
  20 arrows.
- Instanced per kind: carry stacks (player + workers), stall / table inventory
  grids, cash-bundle piles.
- Measured late game with every district, belt and machine (desktop Chrome,
  camera over the camp): 45 customers 335 draw calls before the crowd
  instancing → 80 customers 177 draw calls after; scene objects 1031 → 652.
  Simulation 0.03 ms per tick with 70 customers, 31 workers, 28 animals.
- Adaptive: render resolution steps down when frames drop; if it still can't
  keep up at 1×, quality falls back to Low (no shadows).

## Headroom for the art pass

Target initial download on mobile: **≤ 8 MB**, which leaves ~7.5 MB for GLB
models (Meshopt) and KTX2 textures. Suggested split:

- Characters + animals (one rig + animation set each): ≤ 2 MB
- Buildings / props (atlased): ≤ 2.5 MB
- Terrain + snow PBR (1K, KTX2): ≤ 1.5 MB
- Audio (Opus): ≤ 1.5 MB
