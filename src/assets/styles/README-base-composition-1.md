# Base composition #1 — provenance

**Updated 2026-06-18** from `new_legend/Базовые_слои.csv`.

## Stack (bottom → top)

| Order | Layer | Source |
|---|---|---|
| 1 | Positron without labels | CartoDB `light_nolabels` @ `opacity: 0.4` |
| 2 | `relief_water1` | `TILE_BASE_URL/relief_water1/{z}/{x}/{y}.png` |
| 3 | `isoline_5m` | `src/assets/layers/isoline_5m.geojson` |
| 4 | `amphitheater_bound` | `src/assets/layers/amphitheater_bound.geojson` |
| 5 | `sectors_level` | `src/assets/layers/sectors_level.geojson` |

Tile example: `https://spbmlaplus.github.io/spb_mountains_tiles/relief_water1/12/2393/2904.png`

## Removed (legacy)

- `relief_hillshade` pre-baked multiply
- `stage`, `water` base vectors
- `positron_labels` overlay
- Base composition #3 (chapter-2 relief @ 40%) — no longer used; single base for all chapters

## Editing

Change `src/assets/styles/base-composition-1.json`; `baseCompositions.ts` and `layerStyles.ts` import it at build time.
