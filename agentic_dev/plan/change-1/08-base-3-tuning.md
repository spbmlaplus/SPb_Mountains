# 08 — Tune base composition #3 to match chapter-2 frame fidelity

## Status

**Path A wired 2026-05-16.** Code + manifest landed:

- `RasterEntry.paint?: Record<string, unknown>` added (runtime + manifest types) in `Map-View-Client/src/baseCompositions.ts`; `addBaseComposition` in `Map-View-Client/src/MainMap.tsx` uses `entry.paint` when present and falls back to the legacy `{ 'raster-opacity': entry.opacity }` shorthand otherwise. Base #1's opacity-only entries continue to work unchanged.
- `Map-View-Client/src/assets/styles/base-composition-3.json` now ships the paint block: `raster-opacity 0.35` + `raster-saturation -0.85` + `raster-brightness-max 1.1`. **These are starting values; tune in place against Frames 46–49 — the manifest is the source of truth, no code change needed when adjusting.**
- `README-base-composition-3.md` documents the new `paint` field and the rationale for the three knobs.

Awaits browser sign-off (manual until plan 00's visual-test framework lands). If paint-property tuning alone doesn't close the gap, fall back to Path B (pre-baked grayscale relief pyramid via `gdal2tiles.py`).

## Context

Frames 46, 47, 48, 49 (chapter 2 geological-era sections) show a very light, near-monochrome relief background — almost grayscale, with only the era-specific landscape patches (orange/red/ochre) standing out. The current base composition #3 uses `raster-opacity: 0.4` on the colored `relief` pyramid, which results in a noticeably more saturated, greenish-brown wash than the frames suggest.

The design CSV says "multiply, opacity 40%" — multiply on a colored raster would desaturate it toward darker tones, but MapLibre lacks raster blend modes. Our current approximation (plain alpha at 0.4) leaves color saturation intact, just reduces overall presence.

## Current state

- `Map-View-Client/src/assets/styles/base-composition-3.json`:
  ```json
  {
    "kind": "raster",
    "name": "relief",
    "source": "tiles/relief/{z}/{x}/{y}.png",
    "opacity": 0.4
  }
  ```
- Visible result: warm, brownish-green base with overlays sitting on top. Recognizable but louder than the frames.

## Target state

Match the frames' near-grayscale, low-contrast relief look. Two paths:

### Path A — Adjust raster paint properties

MapLibre supports `raster-saturation` (-1 to 1) and `raster-brightness-min` / `raster-brightness-max` (0 to 1). Setting:

```json
"paint": {
  "raster-opacity": 0.35,
  "raster-saturation": -0.85,
  "raster-brightness-max": 1.1
}
```

would desaturate the colored relief toward gray and slightly brighten it. Cheap; no tile regeneration. **These numbers are starting values, not measured ones** — tune by eye against Frame 46 once the dev build is up and update the manifest before declaring 08 done.

### Path B — Pre-bake a grayscale relief pyramid

Run `gdal2tiles.py` over a grayscale-converted relief.tif. Higher fidelity (the desaturation is applied at tile time, not paint time), but adds ~234 MB of tiles and a re-deploy step.

**Recommendation**: try Path A first. Visual sign-off against the frames. If still wrong, fall back to Path B.

## Approach (Path A)

### Manifest change

```json
{
  "kind": "raster",
  "name": "relief",
  "source": "tiles/relief/{z}/{x}/{y}.png",
  "paint": {
    "raster-opacity": 0.35,
    "raster-saturation": -0.85,
    "raster-brightness-max": 1.1
  }
}
```

### Code change

`baseCompositions.ts` and `addBaseComposition` in `MainMap.tsx` currently treat `opacity` as a singleton field. Extend to accept a full `paint` block:

```ts
type RasterEntry = {
  ...
  paint?: Record<string, unknown>  // arbitrary maplibre raster paint props
}

// In addBaseComposition:
map.addLayer({
  id: entry.id,
  type: 'raster',
  source: entry.id,
  paint: entry.paint ?? (entry.opacity != null ? { 'raster-opacity': entry.opacity } : {}),
}, beforeId)
```

### Manifest schema

Update `Map-View-Client/src/assets/styles/README-base-composition-3.md` to describe the `paint` block.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/assets/styles/base-composition-3.json` | Replace `opacity: 0.4` with the `paint` block |
| `Map-View-Client/src/baseCompositions.ts` | Add `paint?: Record<string, unknown>` to `RasterEntry`, plumb through `compositionFromManifest` |
| `Map-View-Client/src/MainMap.tsx` | `addBaseComposition` uses `entry.paint` when present, falls back to old `opacity`-only behavior |
| `Map-View-Client/src/assets/styles/README-base-composition-3.md` | Document the new field |

## Verification

1. Dev server, scroll to chapter 2 sections (id_map=10–13). Compare against Frames 46–49.
2. Relief reads as near-grayscale; era-specific landscape patches (orange, ochre, red) stand out clearly.
3. Toggle between chapter 1 (colored base #1) and chapter 2 (desaturated base #3) — clear visual distinction.
4. No regression on base #1 (still uses `opacity` singleton path).

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 46 | `#id_map=10` | Near-grayscale relief; 450 млн лет landscape patch in color |
| 47 | `#id_map=11` | Same desaturated base; Silurian patches |
| 48 | `#id_map=12` | Same desaturated base; Devonian + glacier |
| 49 | `#id_map=13` | Same desaturated base; Quaternary |

Run `npm run visual:task -- 08` after implementation. Review `.claude-reports/visual/<timestamp>/task-08/index.html`.

Masks: longread copy panel (standard). Map tile area is unmasked — base saturation/brightness is the deliverable.

Human sign-off: the relief background is visibly desaturated compared to base #1, and the era-specific landscape patches (orange/red/ochre) clearly stand out. Tune the `-0.85` / `1.1` numbers in `base-composition-3.json` until the diff looks right to design.

## Open questions

- Should the same desaturation apply to the `relief_hillshade` pyramid (base #1)? **No** — base #1 uses the multiply-baked relief×hillshade which is already darker; desaturating it would lose the relief shading.

## Cross-references

- Mountain-triangle visibility in chapter 2 (id_map ≥ 10) is handled in [02-mountains-triangle-rendering.md](02-mountains-triangle-rendering.md) — `02` owns the `setLayerVisibility` gate so the rule lives next to the rest of the mountains code. `08` does not duplicate it.

## Phase

Phase 3 — schedule alongside [07-positron-labels.md](07-positron-labels.md). Both are base-map fidelity tweaks driven by frames vs current build.
