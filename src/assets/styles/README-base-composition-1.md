# `src/assets/styles/` — provenance of `base-composition-1.json`

This folder is the **runtime source of truth** for base composition #1's styling. `src/layerStyles.ts` and `src/baseCompositions.ts` both `import` `base-composition-1.json` from here. Edit the JSON when style values change; the TypeScript modules rebuild themselves at next reload.

The five `.qml` files are QGIS originals, kept alongside the JSON so any future "did the design team mean this color?" question can be answered without leaving this folder. **The QMLs are not loaded at runtime** — they are reference documents for hand-porting and for diffing against a future canonical version.

## ⚠️ 2026-06-09 re-port correction (read this)

The original port pulled colors from "the first `SimpleFill` symbol" in each QML. That was a **bug**: a QGIS `.qml` opens with an `<elevation>` block whose `profileFillSymbol` / `profileLineSymbol` colors are for 3D elevation profiles, not the map. `sectors_level`, `stage`, and `water` all picked up those profile colors (orange, magenta/pink, red) instead of the real map renderer — which is why the design team said the map looked nothing like QGIS.

Fixed 2026-06-09 by re-porting from the **`<renderer-v2>`** block only:

| Layer | Real `<renderer-v2>` | Was rendering (wrong) |
|---|---|---|
| `sectors_level` | transparent fill + **black dashed** 0.1 mm outline → no fill, black dashed line | orange fill + orange-brown solid outline + orange line |
| `stage` | **teal 45° LinePatternFill** rgb(50,126,105) over white wash, symbol α 0.579, outline #232323 → white wash + teal hatch + dark outline | magenta solid fill + white hatch + pink outline/line |
| `water` | light-blue solid fill rgb(194,210,242), invisible outline → blue fill only | red fill + red outline + red line |

`isoline_5m` and `amphitheater_bound` were already correct (color right, width calibrated) and are unchanged. The per-field table below predates this fix — trust the per-entry `note` fields in `base-composition-1.json` for the current provenance.

## Per-field provenance

For each value in `base-composition-1.json`, here's where it came from:

| JSON path | Provenance | Source |
|---|---|---|
| `render_order[].kind`, `name`, `geojson` | ✅ Quoted | `drive/Описание лонгрида - порядок базовых слоев.csv`, rows where `id_layer_base = 1`. Order matches the CSV's `layer_render_order` column. |
| `render_order[].source` (raster) | Derived | The CSV's two raster rows (`relief` + `hillshade`, both `multiply`) are collapsed into the single pre-baked `tiles/relief_hillshade/{z}/{x}/{y}.png` pyramid because MapLibre has no `mix-blend-mode: multiply` for raster layers. See `base-layer-1-prep/scripts/multiply_tiles.py` for the pixel-wise fuser. |
| `style.fill.color` | ✅ Quoted, exact | QML `<Option name="color">` value from the first `SimpleFill` symbol in `<file>.qml`. RGB extracted from the leading `R,G,B,255,...` triple. |
| `style.outline.color` | ✅ Quoted, exact | QML `<Option name="outline_color">` from `SimpleFill`. |
| `style.line.color` | ✅ Quoted, exact | QML `<Option name="line_color">` from `SimpleLine`. |
| `style.line.width_px` | Converted | QML widths are in mm. Conversion uses 72 dpi (2.83 px/mm), so the QML's typical 0.6 mm becomes 1.7 px. The `isoline_5m` value of 1.0 px is a downward eyeball calibration — at z=10 the full 1.7 px reads as a heavy contour line. |
| `style.outline.width_px` | **My calibration** | QML's 0.2 mm = ~0.57 px, which renders sub-pixel (invisible at most zooms). Bumped to 1.0 px for legibility — flagged in `calibration_note`. |
| `style.fill.opacity` | **My judgment, then user-tuned** | QML's color alpha is `255` (fully opaque) — QML expected to draw on a blank canvas; we draw on top of relief. I picked 0.45 / 0.5 / 0.55 initially; the values you see now were further dialed down by the project owner (e.g. sectors_level → 0.01, stage → 0.05, water → 0.05) so the relief shading reads through. Adjust to taste — this is the main visual-calibration knob. |
| `style.line.opacity`, `style.outline.opacity` | Implicit 1.0 | QML alpha was 255. Not stored in JSON; defaulted in `layerStyles.ts`. |
| `amphitheater_bound` (entire entry) | ✅ Quoted, exact | Canonical QML received 2026-05-16 via `drive/Стили 2/amphitheater_bound.qml` (now promoted into `drive/Стили/` and `src/assets/styles/`). SimpleLine, `line_color = rgb(67,69,69)`, `line_width = 0.5 mm` (~1.4 px), solid (not dashed). The earlier hand-authored dashed-gray placeholder has been removed. |
| `px_per_mm_assumption: 2.83` | Reference constant | 72 dpi → 25.4 mm/in → 2.83 px/mm. Documented so the conversion is reproducible. |
| `calibration_note` | Documentation | Free-text explanation of the width-bumping decision and the visual-calibration loop. |

## Files

| File | Origin | Notes |
|---|---|---|
| `base-composition-1.json` | Authored 2026-05-15 from CSV + QML | **Source of truth at runtime.** |
| `sectors_level.qml` | `drive/Стили/sectors_level.qml` | Verbatim copy. |
| `isoline_5m.qml` | `drive/Стили/isoline_5m_1.qml` (note `_1` suffix in source) | Renamed to drop the `_1` because the CSV calls the style `isoline_5m`. Verbatim otherwise. |
| `stage.qml` | `drive/Стили/stage.qml` | Verbatim copy. |
| `water.qml` | `drive/Стили/water.qml` | Verbatim copy. |
| `amphitheater_bound.qml` | `drive/Стили/amphitheater_bound.qml` (received 2026-05-16) | Canonical. Verbatim copy. |

## Workflow when style values change

1. Edit `base-composition-1.json` directly (or, if a new QML lands, swap the `.qml` file and re-port the colors into the JSON).
2. Save. Vite HMR picks up the JSON import and re-evaluates `layerStyles.ts` / `baseCompositions.ts` automatically — no restart needed.
3. Refresh the browser tab to see the new paint applied.
4. When values look right, build (`npm run build`) and ship per `HANDOFF.md` § "Re-deploy" sections.

For a wholesale CSV/QML re-export from the design team's Google Drive, copy fresh `.qml` files into this folder, then update `base-composition-1.json` field-by-field using the provenance table above. Run `npm run dev` while editing to live-preview.
