# FROSTLINE — Asset Licenses

Rule: no external asset enters the repo without an entry here, verified
license, and a preference for CC0.

## Currently used external assets

**None.** As of v0.1 every mesh, texture, icon and sound in the build is
generated procedurally in code:

- Meshes: three.js primitive geometry, vertex-colored and merged at runtime
  (`src/render/characters.ts`, `src/render/*View.tsx`).
- Snow ground texture: generated on a `<canvas>` at startup
  (`src/render/Environment.tsx`).
- Icons/labels: system emoji + text rendered to canvas textures at runtime
  (`src/render/rutil.ts`). Emoji glyphs are supplied by the user's OS and are
  not distributed with the game.
- Audio: synthesized with the WebAudio API at runtime (`src/game/audio.ts`).
  No audio files are distributed.

## Template for future entries

```text
Asset:
Creator:
Source:
URL:
License:
Commercial use allowed:
Modification allowed:
Attribution required:
Downloaded date:
Modified:
```

## Pre-cleared sources for the art pass

| Source | License | Notes |
|---|---|---|
| Poly Haven (polyhaven.com) | CC0 | textures, HDRIs, models — verify per-asset page anyway |
| Kenney (kenney.nl) | CC0 | full packs |
| Quaternius (quaternius.com) | CC0 | full packs |
| itch.io packs (e.g. KayKit) | varies! | **must check each asset page** before use |
| OpenGameArt | varies! | **must check each asset page** before use |
