# FROSTLINE — Asset Plan

Target style: **60% stylized** (characters, animals, buildings, resources, stations)
/ **40% realistic** (terrain materials, snow, rock, lighting, fog). Everything is
read from an elevated ~54° camera, so silhouettes and color-coding matter more
than surface detail.

## Current status (v0.1 vertical slice)

Per the "asset hunting must not block gameplay" rule, the entire vertical slice
currently ships with **procedural, code-built stylized assets** (see
`src/render/characters.ts`, `Environment.tsx`, station/tower/kitchen views).
They are deliberately designed as *good* placeholders: merged vertex-colored
low-poly meshes with chunky readable silhouettes, one shared material for the
whole crowd, emoji-derived canvas sprites for icons. Zero download weight,
zero license risk, runs on phones.

Every item below lists the planned free-asset replacement source for the next
art pass. **License must be verified and recorded in `ASSET_LICENSES.md`
before any external file enters the repo.** Prefer CC0.

## Characters

| Asset | Now | Planned source | Notes |
|---|---|---|---|
| Player | procedural villager (blue coat, beanie, axe) | Quaternius Ultimate Modular Characters (CC0) or KayKit Adventurers (verify license) | needs idle/walk/carry/chop |
| Survivor/customer ×6 variants | procedural villager, 6 coat palettes | Quaternius characters + material recolors | cold/idle/walk/happy |
| Workers (collector, cook, runner, cashier, lumberjack) | same rig, role-colored coats + role icon | same base + hats/tools | visual role identity via color |
| Archer | procedural villager on tower + torus bow | Quaternius / KayKit archer | draw/fire anim currently procedural |

## Animals

| Asset | Now | Planned source |
|---|---|---|
| Deer | procedural box-built deer w/ antlers, trot anim | Quaternius Animated Animals (CC0) |
| Rabbit | procedural hopper | Quaternius Animated Animals |
| Boar / elk / wolf (later) | — | Quaternius Animated Animals |

## Resources (readability-critical)

| Asset | Now | Planned source |
|---|---|---|
| Log | cylinder, bark color, carried in stacks | Kenney Survival Kit (CC0) |
| Raw meat | exaggerated red chunk + white bone | Kenney Food Kit (CC0) or keep procedural |
| Cooked meat | same silhouette, grilled brown | recolor of the above |
| Coin / money pile | staged gold cylinder piles (4 sizes) | Kenney (CC0) |

## Buildings & stations

| Asset | Now | Planned source |
|---|---|---|
| Wood stall | procedural counter + posts + snowy roof + staged log piles | Kenney Fantasy Town Kit modules (CC0) |
| Meat counter | same construction, red roof, staged cooked display | Kenney Fantasy Town Kit |
| Kitchen | stone fire ring + grate + canopy + staged raw/cooked piles + steam | Kenney Survival Kit modules |
| Archer tower | modular: legs, braces, platform, ladder, railing; roof at lvl 2+, banner at lvl 6+ | Kenney Tower Defense / Castle Kit modules |
| Money chest | procedural chest | Kenney (CC0) |

## Environment

| Asset | Now | Planned source |
|---|---|---|
| Snow ground | procedural canvas-noise snow texture | **Poly Haven** `snow_02` / `snow_field` PBR (CC0), 1K for mobile |
| Pines | 5-part instanced low-poly pine w/ snow caps | Poly Haven pine models or Quaternius Nature (CC0) |
| Rocks | instanced flat-shaded icosahedra | Poly Haven rock scans decimated (CC0) |
| Mountains | fog-faded low-poly cones | keep procedural (background) |
| Frozen pond | flat reflective disc | Poly Haven ice material |
| HDRI/lighting | hemisphere + warm directional | Poly Haven winter HDRI (CC0), pre-filtered |

## Audio

All SFX are currently **synthesized in-code via WebAudio** (`src/game/audio.ts`):
coins, chops, bow thwip, hits, kill, pickup/deposit ticks, buy/build chords,
milestone jingle, looping filtered-noise wind. Replacement candidates: Kenney
Audio packs (CC0), freesound.org CC0 selections.

## Optimization pipeline (for the art pass)

1. Download source asset, record license in `ASSET_LICENSES.md`.
2. Decimate to budget (< 3k tris for props, < 8k for hero buildings).
3. Merge materials; bake to 1 atlas where possible.
4. Resize textures: 1K standard, 2K only for the terrain.
5. Export GLB with Meshopt compression; KTX2/Basis for textures.
6. Instantiate repeated meshes via `InstancedMesh`.

Budgets tracked in `ASSET_BUDGET.md`.
