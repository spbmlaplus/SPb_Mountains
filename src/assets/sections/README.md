# `src/assets/sections/` — provenance of `section-overlays.json`

Runtime source of truth for **23** per-section overlay stacks (`id_map` 1–23), ported 2026-06-18 from `new_legend/Порядок_слоев.csv`.

## Regenerating

```bash
python scripts/gen-section-overlays.py
python scripts/gen-layer-urls.py   # after overlays/base manifest change
```

Empty sets for `id_map` 1, 21, 23 are added automatically by the generator.

Longread fallback copy:

```bash
python scripts/gen-fallback-longread.py
```

## Base composition

Single global base (`id_layer_base = 1`) from `new_legend/Базовые_слои.csv`:

1. CartoDB Positron `light_nolabels` @ 40%
2. `relief_water1` raster tiles (`TILE_BASE_URL/relief_water1/{z}/{x}/{y}.png`)
3. `isoline_5m`, `amphitheater_bound`, `sectors_level` vectors

All sections use `default_base: 1`. Chapter-based base swap (#1 ↔ #3) was removed.

## Data sources

- Layer geojson: `new_files/layers/` → `src/assets/layers/`
- QML styles: `new_files/style/` → `src/assets/styles/sections/`
- Longread text: `new_legend/Лонгрид_1.csv` → `src/fallbackLongread.ts`

## Special id_map sets

| id_map | Layers | Notes |
|---|---|---|
| 1 | (empty) | Viewpoints — global toggle in `OverlayTogglePanel` |
| 21 | (empty) | Painting section — text/media only |
| 23 | (empty) | Viewpoints + photos — global viewpoints layer |

## Mountains layer rename

`mountains.geojson` → **`mount.geojson`** (`id_map` 2). Optional `mount_polygon` for massifs.
