# `src/assets/sections/` — provenance of `section-overlays.json`

This folder is the **runtime source of truth** for the 13 per-section overlay stacks (id_map 1–13). `src/sectionOverlays.ts` imports `section-overlays.json` directly; `src/layerStyles.ts` merges its `styles` block into `VECTOR_STYLES`. Edit the JSON when stack composition or paint values change; the TypeScript modules rebuild themselves at next reload.

## Per-field provenance

For each value in `section-overlays.json`, here's where it came from:

| JSON path | Provenance | Source |
|---|---|---|
| `sets[K].layers[].name` | ✅ Quoted | `drive/Описание лонгрида - порядок слоев.csv`, `name_layer` column, for rows where `id _map = K`. Order matches the CSV's `id_layer_click` ascending. |
| `sets[K].layers[].style` | ✅ Quoted | Same row's `name_vector_style` column. |
| `sets[K].layers[].mandatory` | Derived | True when `id_layer_click = 1` per the CSV row. All others (`id_layer_click ≥ 2`) are optional and default-ON in the UI. |
| `sets[K].layers[].label` | **Authored** | Russian-language UI label for the toggle panel. Derived from `лонгрид.csv` subtitles + Russian convention; tune freely. Falls back to `name` when missing. |
| `sets[K].default_base` | ✅ Quoted | `id_layer_base` column from the CSV. For id_map 1 (which appears in both chapters with two different bases), `default_base = 1` is the chapter-1 value; the chapter-2 occurrence overrides via the Sheet row's `base_id` column. See "Disambiguating id_map = 1" below. |
| `styles.<name>.fill.color` etc. | ✅ Quoted (when QML exists) | `drive/Стили/<name>.qml`'s `<Option name="color">` of the first `SimpleFill` symbol; same convention as base composition #1's README. RGB extracted from the leading `R,G,B,255,...` triple. |
| `styles.<name>.line.width_px`, `outline.width_px` | Converted | QML widths are in mm; 72 dpi → 2.83 px/mm. QML's 0.6 mm becomes ~1.7 px (line) and 0.2 mm → 1.0 px (outline, bumped from sub-pixel for legibility). |
| `styles.<name>.fill.opacity` | **My calibration** | QML's color alpha is 255 (fully opaque). Overlay tints are dialed to 0.3–0.4 so the relief base reads through; placeholders use 0.35–0.4. Tune per style — this is the primary visual-calibration knob. |
| `styles.<name>.placeholder = true` | Marker | No QML existed for the style in `drive/Стили/`. Placeholder colors chosen to be visually distinct from each other and from base composition layers. **Replace when design ships the canonical QML.** |
| `px_per_mm_assumption` | Reference constant | 72 dpi → 25.4 mm/in → 2.83 px/mm. Same conversion as base composition #1. |

## Disambiguating id_map = 1

The CSV has two rows for id_map = 1 with the same overlay stack (`mountains`, mandatory) but different `id_layer_base` (1 in chapter 1's intro; 3 in chapter 2's intro). The manifest stores `default_base: 1` for id_map = 1; the chapter-2 occurrence overrides this via the Sheet row's `base_id = 3` column. In the runtime resolver (`MainMap.tsx:syncLayers`), the per-row `base_id` takes precedence over `SECTION_OVERLAYS[1].default_base`.

If the Sheet column is empty for that row, the chapter-2 intro will render with base #1 (the default) — visually still acceptable since the overlay is just the mountains layer.

## Placeholder styles

As of 2026-05-16, design shipped canonical QMLs for five of the six original placeholders (via `drive/Стили 2/`, since promoted into `drive/Стили/`):

| Style name | Used by | Canonical QML | Notes on the port |
|---|---|---|---|
| `elements` | stage, parter, belletazh, balcon, amphitheater overlays (id_maps 2–6) | `drive/Стили/elements.qml` | Outline-only polygon style. Pale teal `rgb(185,219,210)` stroke at ~1.3 px; no fill (`SimpleFill` `style: no`, alpha 0). Visually distinct from the prior orange placeholder — sections 2–6 will render as teal-outlined "highlighted feature" shapes, not orange fills. |
| `historical_resettlement` | id_map 9 mandatory | `drive/Стили/historical_resettlement.qml` | Vivid orange `rgb(218,89,12)`. QML uses a `dense3` hatch pattern + no outline; approximated as solid fill at opacity 0.4 (MapLibre has no hatch). |
| `amphitheater_bound_1` | id_map 9 optional | `drive/Стили/amphitheater_bound_1.qml` | Solid dark-charcoal `rgb(67,69,69)` line at ~2.5 px (QML `line_width = 0.9 mm`). Not dashed — the earlier placeholder's `[3,2]` dasharray has been removed. |
| `landscape_450` | id_maps 10–13 mandatory | `drive/Стили/landscape_450.qml` | Peach `rgb(244,154,90)` at opacity 0.4. QML is a 2-category renderer (Ижорское плато / Путиловское плато) with stacked solid + hatched fills, both sharing the same base color; simplified to a single solid fill. |
| `landscape_2,5` | id_maps 11–13 optional | `drive/Стили/landscape_2,5.qml` | Olive-yellow `rgb(202,207,90)` at opacity 0.4. Same simplification — QML is a 2-category renderer (Дудергофские высоты / Моренный пояс) with two stacked layers per category. |

One placeholder remains:

| Style name | Used by | Placeholder hue | Why |
|---|---|---|---|
| `slope` | id_map 9 optional | muted olive | Still no QML on disk; flag to design. Distinct from `search_bound` (red) and `resettlement` (yellow). |

To replace the remaining `slope` placeholder when design ships the canonical QML:

1. Drop the new `.qml` into `drive/Стили/` (and optionally copy into `Map-View-Client/src/assets/styles/<name>.qml` for co-location with the JSON).
2. Open `section-overlays.json`, find the `slope` entry, replace `fill.color` / `outline.color` / `line.width_px` per the QML's `SimpleFill`/`SimpleLine` options.
3. Delete the `placeholder: true` flag, update the `note` field, add a `qml` pointer.
4. Vite HMR picks up the change; refresh the browser to see new paint.

## Sheet schema

The Google Sheet at `MainMap.tsx:14` (sheet name `Лист1`, range `A:J`) follows `drive/Описание лонгрида - лонгрид.csv` directly:

| Column | Header (in Sheet) | Used by code |
|---|---|---|
| A | `Chapter` | Inferred chapter → derives `base_id = 3` for chapter 2 («Горы Петербурга — геологическая летопись»). |
| B | `Subtitle` | Becomes `ContentItem.title`. |
| C | `Media Link` | Unused by this map; the longread renders its own images. |
| D | `Line` | Unused. |
| E | `Description` | Becomes `ContentItem.description`. |
| F | `Link` | Unused. |
| G | `Coordinates_zoom` | Reserved for future camera positioning per section. |
| H | `Zoom` | Same. |
| **I** | **`id _map`** (note space in source CSV; case- and whitespace-tolerant in code) | The numeric set id (1..13). Blank rows inherit the most-recent value via `fillForwardIdMap()`. |
| J | `Описание что на картах` | Reserved for editorial notes. |

**`base_id` is not a separate Sheet column.** It is inferred from the `Chapter` column via `isChapter2()` (`MainMap.tsx`) — chapter 2 forces `base_id = 3`. For all other chapters the runtime uses `SECTION_OVERLAYS[id_map].default_base`. This handles the id_map = 1 ambiguity without requiring an extra column: the chapter-2 recap row carrying id_map = 1 will resolve to base 3 because its `Chapter` cell starts with "Горы Петербурга".

If an editor later wants to force a per-row override (e.g. a chapter-1 section that should render against base 3 for some experimental reason), `parseSheetRows` also accepts a `base_id` column anywhere in the schema — case-insensitive, ignored when blank.

When `id_map` is missing on a row, the runtime falls back to today's behavior: the legacy `fileList` column (no longer in the Sheet but still in `fallbackContentItems`) + the two-palette `mask_*` logic in `ensureLayerOnMap`. Zero regression.

## Workflow when stack/style values change

1. Edit `section-overlays.json` directly.
2. Save. Vite HMR picks up the import and re-evaluates `sectionOverlays.ts` / `layerStyles.ts` automatically — no restart needed.
3. Refresh the browser tab to see the new overlay rendering.
4. When values look right, build (`npm run build`) and ship per `HANDOFF.md` § "Re-deploy" sections.
