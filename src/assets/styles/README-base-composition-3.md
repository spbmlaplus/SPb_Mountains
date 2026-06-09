# Base composition #3 — provenance

Companion to `README-base-composition-1.md`. Read that first for the shared workflow + per-field provenance of the vector styles; this doc only covers what's different in `base-composition-3.json`.

## What composition #3 is for

Chapter 2 *«Горы Петербурга»* (sections 10–13) — the part of the longread that pans the camera out across the wider St. Petersburg agglomeration after the close-up tour of the amphitheater. The CSV gives composition #3 a stripped-down stack: no hillshade, no `amphitheater_bound`, and the relief raster dialed back to 40% so foreground vectors read against terrain rather than the terrain dominating.

## Stack (bottom → top)

| # | name           | type    | source                                       | notes                                                            |
|---|----------------|---------|----------------------------------------------|------------------------------------------------------------------|
| 1 | `relief`       | raster  | `tiles/relief/{z}/{x}/{y}.png`               | Plain relief pyramid, no hillshade fuse. Paint block: `raster-opacity 0.35 + raster-saturation -0.85 + raster-brightness-max 1.1` (see "Paint block" below). |
| 2 | `sectors_level`| GeoJSON | `sectors_level.geojson`                      | Same style as base #1.                                          |
| 3 | `isoline_5m`   | GeoJSON | `isoline_5m.geojson` (25 m-tolerance bundle) | Same style as base #1.                                          |
| 4 | `stage`        | GeoJSON | `stage.geojson`                              | Same style as base #1.                                          |
| 5 | `water`        | GeoJSON | `water.geojson`                              | Same style as base #1.                                          |

Source: `drive/Описание лонгрида - порядок базовых слоев.csv`, rows where `id_layer_base = 3`. Order matches the CSV's `layer_render_order` column.

## Why the relief is the plain pyramid, not `relief_hillshade`

Base #1 fuses relief + hillshade because the CSV has both raster rows. Base #3 has only the relief row (rows for `hillshade` are absent — composition #3 deliberately skips it). The plain `relief` pyramid was already deployed in Phase 2 and never retired, so this is a zero-tile-deploy change.

## The `multiply, opacity 40%` interpretation

CSV value: `"multiply, opacity 40%"`. MapLibre raster layers have no multiply blend mode. Two parts of that value:

- **`opacity 40%`** → emitted as `raster-opacity: 0.35` (close to 0.4; tuned slightly down to compensate for the brightness lift below).
- **`multiply`** → not honored directly. The visual target — Frames 46–49 show a near-grayscale, low-contrast relief — is reached instead via `raster-saturation: -0.85` (strip nearly all chroma) + `raster-brightness-max: 1.1` (slight lift so the desaturated relief doesn't read as muddy).

The pre-bake approach used for base #1 (multiply at the tile level) was not applied here because there's no companion raster to multiply against — relief on its own can't "multiply with itself" in a meaningful way. Path B in plan 08 (bake a grayscale relief pyramid via gdal2tiles) is the fallback if paint-property tuning doesn't get close enough.

## Paint block

`baseCompositions.ts` and `addBaseComposition` in `MainMap.tsx` support a `paint?: Record<string, unknown>` field on raster manifest entries; when present, it is passed verbatim as the MapLibre layer's `paint` block. The legacy `opacity?: number` shorthand still works (it becomes `{ "raster-opacity": opacity }`), so base #1 entries continue to behave as before.

Current base-#3 values (`raster-opacity: 0.35`, `raster-saturation: -0.85`, `raster-brightness-max: 1.1`) are starting values, not measured ones — tune by eye against Frame 46 once the dev build is up and update the manifest in place. No code change is needed when adjusting the numbers; the manifest is the source of truth.

## What's shared with base #1 (do not edit in isolation)

The vector style blocks for `sectors_level`, `isoline_5m`, `stage`, and `water` are byte-identical to base #1. They MUST stay that way — `layerStyles.ts` merges both manifests into a single `VECTOR_STYLES` map keyed by name, so a drift would silently make the active base's values win. If you tune one, tune the other in the same commit.

## What's not in base #3

- `amphitheater_bound` — design choice in the source CSV. The chapter-2 view doesn't draw the amphitheater outline.
- `hillshade` — see above. No fused pyramid needed.

## Wiring status (2026-05-15)

- `BASE_COMPOSITIONS[3]` is populated and importable from `src/baseCompositions.ts`.
- `VECTOR_STYLES` covers all five entries.
- `MainMap.tsx` still always renders `BASE_COMPOSITIONS[DEFAULT_BASE_ID]` (= #1). **Base #3 is not yet selected per section** — that's a follow-up: build the `SECTION_TO_BASE_ID` map from `drive/Описание лонгрида - порядок слоев.csv` (column `id_layer_base`), gate it through a `useBaseComposition(activeItemId)` hook, and extend `addBaseComposition` to tear down the previous composition before adding the new one. See `migration-implementation-plan.md` § Phase 5 PR B.

## Files added

- `base-composition-3.json` — the manifest itself.
- `README-base-composition-3.md` — this doc.

No new `.qml` or tile assets — everything base #3 references is already on disk or already deployed.
