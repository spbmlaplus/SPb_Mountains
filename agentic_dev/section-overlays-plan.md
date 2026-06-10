# Per-section overlay stacks driven by `Описание лонгрида - порядок слоев.csv`

> **STATUS 2026-06-09 — styles re-ported + categorized support added.** The 13 sets and toggle UI from this plan shipped earlier. On 2026-06-09 every overlay *style* in `section-overlays.json` was re-ported from the QML `<renderer-v2>` block (the original port had read the wrong `<elevation>` block → wrong colors). Canonical QMLs now live in-repo at `src/assets/styles/sections/*.qml`. Categorized renderers (`resettlement_after_stage` on `type`; `landscape_12`/`landscape_7` on `Ландшафт`) now use a new `fill_categories` block → MapLibre `match`. QGIS hatch (dense3/diagonal_x/cross/PointPatternFill) is approximated as solid per-category fills. `slope` is the only remaining placeholder (no QML on disk). See `src/assets/sections/README.md` and memory `qml-port-renderer-v2-not-elevation`.

## Context

Yes — adding layers on top of base layers is exactly what `MainMap.tsx` already does. Today, each scrolled-into-view section reads `fileList` from the Google Sheet, calls `ensureLayerOnMap` for each file, and toggles MapLibre visibility via `setLayerVisibility` (MainMap.tsx:500-508, 654-667). Section overlays are added AFTER `addBaseComposition` on `map.on('load')`, so they naturally stack above the base. There is no per-section base swap or per-layer toggle UI today.

The design team's spec in `drive/Описание лонгрида - порядок слоев.csv` defines **13 `id_map` sets** (numeric 1–13) that pair a base composition (`id_layer_base` column, 1 or 3) with an ordered list of overlay layers. Each layer in a set carries an `id_layer_click` number:

- `id_layer_click = 1` → **mandatory**: always rendered, no toggle UI.
- `id_layer_click ≥ 2` → **optional**: default ON; user can toggle off via UI; state is per-section.

The 13 sets are referenced from `drive/Описание лонгрида - лонгрид.csv` via its `id _map` column, which carries the numeric set id on rows that change the active map. Sections of the longread (chapters 1 "Как устроен амфитеатр" + 2 "Горы Петербурга") refer to these sets to decide what to draw at each scroll step.

This plan ports those 13 sets into a runtime manifest, wires them into the existing scroll-driven layer machinery, and adds a minimal toggle UI for the optional layers — landing as a single user-visible change that turns the design CSV into the actual on-screen behavior.

## What the CSV says (the 13 sets, audited)

Bottom→top order within each set is the CSV's `id_layer_click` ascending. Mandatory = `id_layer_click=1`.

| id_map | base | mandatory layer(s) | optional layers (default ON) | chapter context (from лонгрид.csv) |
|---|---|---|---|---|
| 1  | 1 *or* 3 | `mountains` | — | both chapters: intro/recap shots |
| 2  | 1 | `mask_stage` | `stage` | ch. 1 — «Сцена» |
| 3  | 1 | `mask_parter` | `parter` | ch. 1 — «Партер» |
| 4  | 1 | `mask_belletazh` | `belletazh` | ch. 1 — «Бельэтаж» |
| 5  | 1 | `mask_balcon` | `balcon` | ch. 1 — «Балкон» |
| 6  | 1 | `amphitheater` | `mask_amphitheater`, `vomitoria` | ch. 1 — «Вомитории» |
| 7  | 1 | `mask_amphitheater` | `sector` | ch. 1 — «Сектора» |
| 8  | 3 | `resettlement` | `resettlement_after_stage`, `stage_isolated_urban_areas`, `stage_barier`, `stage` | ch. 1 — «Внутренняя граница» |
| 9  | 3 | `historical_resettlement` | `stage`, `slope`, `search_bound_one_step`, `search_bound`, `amphitheater_bound` | ch. 1 — «Внешняя граница» |
| 10 | 3 | `landscape_450` | — | ch. 2 — «450 млн лет назад» |
| 11 | 3 | `landscape_450` | `landscape_2,5` | ch. 2 — «2,5 млн лет назад» |
| 12 | 3 | `landscape_450` | `landscape_2,5`, `landscape_12` | ch. 2 — «12 тыс. лет назад» |
| 13 | 3 | `landscape_450` | `landscape_2,5`, `landscape_12`, `landscape_7` | ch. 2 — «7 тыс. лет назад» |

**Ambiguity note for id_map = 1**: the CSV has two rows (lines 2 & 16) with the same overlay stack (`mountains`/mandatory) but different `id_layer_base` (1 vs 3). It is used as the recap/intro shot in both chapters. The plan resolves base per occurrence (chapter 1 row → base 1; chapter 2 row → base 3) rather than per id_map, by storing base alongside id_map on the Sheet row (see "Sheet schema delta" below).

## Asset coverage

- **GeoJSON files**: all 25 unique `name_layer` values resolve to files in `Map-View-Client/src/assets/layers/` (including the comma-bearing `landscape_2,5.geojson`). No new bundling work needed.
- **QML / styles**: 14 of the 19 unique `name_vector_style` values have QML originals in `drive/Стили/`. Five are missing: `elements`, `sector_1`, `historical_resettlement`, `amphitheater_bound_1`, `landscape_450`, `landscape_2,5`. They will ship as placeholders (analogue of the `amphitheater_bound` placeholder that landed with base #1), tagged `placeholder: true` in the manifest so they're easy to swap when design ships canonical QMLs.
- **`VECTOR_STYLES` runtime register** (`src/layerStyles.ts`) currently holds 5 entries (the four shared between base #1 and #3 + `amphitheater_bound`). All 19 overlay styles need to land in the new manifest and be merged in.

## Approach

Three product decisions, confirmed:

- **Data source**: Sheet gains two new columns (`id_map`, `base_id`). The Sheet stays editable; the CSV stays as spec. No runtime ingestion of longread.csv.
- **Toggle UI**: a floating, absolutely-positioned card in the map's top-right corner, visible by default whenever the active section has optional layers.
- **Missing styles**: ship 5 placeholders tagged `placeholder: true` in the manifest, mirroring how the `amphitheater_bound` placeholder was handled in base composition #1. Follow-up to swap canonical QMLs when design ships them.

A single PR that lands:

### 1. Data manifest: `Map-View-Client/src/assets/sections/section-overlays.json` (new)

Self-contained machine-readable port of the 13 id_map sets, mirroring the shape of `src/assets/styles/base-composition-{1,3}.json`. Single file (the dataset is small):

```json
{
  "_comment": "Per-id_map overlay stacks, ported 2026-05-15 from `drive/Описание лонгрида - порядок слоев.csv`. Mandatory layers (id_layer_click=1) render unconditionally; optional layers (id_layer_click>=2) default ON and can be toggled off via UI.",
  "sets": {
    "1":  { "default_base": 1, "layers": [ { "name": "mountains", "style": "mountains", "mandatory": true } ] },
    "2":  { "default_base": 1, "layers": [ { "name": "mask_stage",  "style": "mask",     "mandatory": true },
                                            { "name": "stage",       "style": "elements", "mandatory": false } ] },
    "...": "...",
    "13": { "default_base": 3, "layers": [ { "name": "landscape_450",  "style": "landscape_450",  "mandatory": true },
                                            { "name": "landscape_2,5", "style": "landscape_2,5", "mandatory": false },
                                            { "name": "landscape_12",  "style": "landscape_12",  "mandatory": false },
                                            { "name": "landscape_7",   "style": "landscape_7",   "mandatory": false } ] }
  },
  "styles": {
    "mountains":                { "fill": { "color": "...", "opacity": 0.3 } },
    "mask":                     { "fill": { "color": "rgb(9,19,26)",  "opacity": 0.12 }, "outline": { "color": "rgb(32,55,69)", "width_px": 1.0 } },
    "elements":                 { "fill": { "color": "rgb(242,165,65)", "opacity": 0.28 }, "outline": { "color": "rgb(247,197,107)", "width_px": 1.0 } },
    "...": "..."
  }
}
```

The `styles` block holds the 19 overlay paint definitions, pre-merged with `VECTOR_STYLES`. Authored from `drive/Стили/<name>.qml` for the 14 styles that exist, plus visually-reasonable placeholders for the 5 missing ones (tagged with `"placeholder": true`). The `mask` and `elements` styles are seeded from the existing two-palette logic in `ensureLayerOnMap` (MainMap.tsx:448–494) so behavior doesn't regress on day one.

### 2. Runtime module: `Map-View-Client/src/sectionOverlays.ts` (new)

```ts
import manifest from './assets/sections/section-overlays.json'

export type OverlayLayer = { name: string; style: string; mandatory: boolean }
export type SectionOverlay = { default_base: 1 | 3; layers: OverlayLayer[] }
export const SECTION_OVERLAYS: Record<number, SectionOverlay> =
  Object.fromEntries(Object.entries(manifest.sets).map(([k, v]) => [Number(k), v as SectionOverlay]))
```

Plus extend `src/layerStyles.ts` to merge the manifest's `styles` block into `VECTOR_STYLES` so the rendering path can look up paint by style name.

### 3. Sheet schema delta (one-time editorial step, not code)

Add **two new columns** to the public Sheet referenced from `MainMap.tsx:11–14`:

- `id_map` — numeric 1..13 (or blank for continuation rows that keep the previous row's map).
- `base_id` — numeric 1 or 3, **only set on rows where `id_map` is set** and overrides the manifest's `default_base`. This is what disambiguates id_map=1's chapter-1 vs chapter-2 appearance: row 2 of the Sheet has `id_map=1`, `base_id=1`; the chapter-2 recap row has `id_map=1`, `base_id=3`.

Fallback rule: if the Sheet is unreachable or columns are missing, the existing `fallbackContentItems` block (MainMap.tsx:52–134) gains hand-coded `id_map` + `base_id` fields per item, so the build still ships a working longread. No-op for rows without `id_map`.

`MainMap.tsx`'s `parseSheetRows` (around line 80–134) extends to read the two new columns; `ContentItem` type (line 39–44) gains `id_map?: number` and `base_id?: 1|3`.

### 4. Per-section base swap

Refactor `addBaseComposition` (MainMap.tsx:340–422):

- Track the currently-active composition id in a module-level ref or `useRef` in the parent.
- When a new id is requested: `removeLayer` + `removeSource` for every entry in the previous composition, then run the existing add path for the new one.
- Add a sentinel transparent layer (`__overlay_anchor__`) at the top of every base composition so section overlays can pass `beforeId: '__overlay_anchor__'` to `addLayer`, keeping overlay-on-base ordering invariant even after a swap.

Wire it from `syncLayers` (MainMap.tsx:654–667): when the new `activeItem` has an `id_map`, compute `baseId = activeItem.base_id ?? SECTION_OVERLAYS[activeItem.id_map].default_base`, and call `addBaseComposition(map, BASE_COMPOSITIONS[baseId])` BEFORE the overlay diff. If `baseId` is unchanged from the previous active section, the function early-returns (already-present sources are not re-added — current behavior).

### 5. Section overlay rendering (replaces today's `fileList` → `ensureLayerOnMap`)

In `syncLayers`:

- If the active section has an `id_map`, the visible-layer set becomes:
  `mandatoryLayers ∪ (optionalLayers \ userDisabledOptional[id_map])`
- Each layer's paint comes from `VECTOR_STYLES[layer.style]`. The hard-coded `mask_*` two-palette block in `ensureLayerOnMap` (MainMap.tsx:448–494) is replaced by `VECTOR_STYLES` lookup; the two old palettes are preserved as the `mask` and `elements` style entries in the manifest, so visual parity is preserved.
- If the active section has no `id_map` (e.g., a Sheet row that never got the column populated), fall back to today's behavior: use `fileList` with the two-palette logic.

### 6. Toggle UI: per-section optional-layer panel

Add a new component `Map-View-Client/src/OverlayTogglePanel.tsx`. Props: `{ idMap: number; disabled: Set<string>; onToggle: (name: string) => void }`. Renders only when `SECTION_OVERLAYS[idMap].layers.some(l => !l.mandatory)` is true; otherwise renders nothing.

- **Placement**: floating, absolutely-positioned card in the map's top-right corner. Compact (checkbox + Russian-label list), collapsible to a single chevron when minimized. Visible by default — critical for discoverability since the drawer is hidden by default and these toggles are the only user-controlled interaction in the longread.
- **State**: lifted into `MainMap.tsx` as `const [userDisabled, setUserDisabled] = useState<Record<number, Set<string>>>({})`. Session-scoped (no `localStorage` for now — the longread is a single-sitting experience).
- **Labels**: derive from a `label` field on each layer entry in the manifest (Russian-language copy), falling back to `name`. For mandatory layers, no row is rendered.

### 7. Style authoring

Add 19 entries to the manifest's `styles` block:

- **14 from existing QMLs in `drive/Стили/`** — port colors + line widths verbatim, same provenance approach as base composition #1's README documents.
- **5 placeholders** with `"placeholder": true` and a `TODO(design)` source comment: `elements`, `sector_1`, `historical_resettlement`, `amphitheater_bound_1`, `landscape_450`, `landscape_2,5`. (Six names — one is `landscape_450` which appears mandatorily in id_maps 10–13 and lacks a QML; ship a sane brown/khaki fill placeholder so the geological-era panels read distinctly from chapter 1.) Replace with canonical QMLs in a follow-up when design ships them.

### 8. Documentation

- New `Map-View-Client/src/assets/sections/README.md` — provenance per-field for `section-overlays.json`, modeled on `README-base-composition-1.md`. Calls out which styles are placeholders and the rule for resolving id_map=1's base via the Sheet's `base_id` column.
- Update `HANDOFF.md` "What's next" section to mark this as the landing PR for Phase 5 PR-B (per-section selector + remaining styles). Update `migration-implementation-plan.md` Phase 5 PR-B bullet correspondingly.

## Critical files & functions

- `Map-View-Client/src/MainMap.tsx` — primary edit surface:
  - `ContentItem` type at L39–44 (extend with `id_map?`, `base_id?`)
  - `parseSheetRows` (L80–134) — read the two new Sheet columns
  - `fallbackContentItems` (L52–134) — populate `id_map` + `base_id` per item
  - `ensureLayerOnMap` (L424–498) — consult `VECTOR_STYLES` first; two-palette only as fallback
  - `setLayerVisibility` (L500–508) — unchanged
  - `addBaseComposition` (L340–422) — gain teardown path + sentinel anchor layer
  - `syncLayers` effect (L654–667) — call `addBaseComposition` per active id_map, AND user-disabled set into the visibility diff
  - `map.on('load', …)` (L562–570) — keep the initial base #1 mount for fast first-paint
- `Map-View-Client/src/sectionOverlays.ts` — new, exports `SECTION_OVERLAYS`
- `Map-View-Client/src/layerStyles.ts` — merge overlay styles from the new manifest into `VECTOR_STYLES`
- `Map-View-Client/src/OverlayTogglePanel.tsx` — new floating UI
- `Map-View-Client/src/assets/sections/section-overlays.json` — new manifest (the 13 sets + 19 styles)
- `Map-View-Client/src/assets/sections/README.md` — new provenance doc
- `HANDOFF.md`, `migration-implementation-plan.md` — status updates

## Reuse (do not reinvent)

- The scroll-driven `activeItemId` → `setLayerVisibility` plumbing is already correct (MainMap.tsx:580–667). Only the data source changes (`SECTION_OVERLAYS[id_map]` instead of `activeItem.fileList`) and the AND-with-user-disabled set is new.
- `loadGeoJson` + `fileCache` (MainMap.tsx:208–287) handles fetch + EPSG:3857 → WGS84 reprojection — overlays reuse it unchanged.
- `addBaseComposition`'s manifest-driven body works for #1 and #3 already; only the teardown + anchor are new.
- The Google Sheet pipeline stays — no migration to "longread.csv at runtime." The CSVs remain spec; the manifest is their build-time port.

## Verification

1. **Type-check & lint**: `npm run build` (= `tsc -b && vite build`) and `npm run lint` in `Map-View-Client/` both green.
2. **Dev server scroll-through**: `npm run dev` → open `http://localhost:5173/Map-View-Client/`. For each of the 13 sections (drive the longread via Sheet rows that carry id_map 1..13), verify:
   - The right base composition is on screen (relief×hillshade vs relief at 0.4 opacity).
   - Mandatory layers are visible; no toggle for them in the floating panel.
   - Optional layers are visible by default; clicking each checkbox toggles them off/on without flicker.
3. **Base swap**: scroll across the chapter 1 → chapter 2 boundary (sections 9 → 10 in the longread). Confirm the base composition swap is clean (no orphan layers, no flicker beyond a single re-render).
4. **id_map=1 disambiguation**: scroll to the first chapter 1 row carrying id_map=1 (intro) and confirm base #1 is active; scroll to the chapter 2 intro row carrying id_map=1 + base_id=3 and confirm base #3 is active. Same `mountains` overlay either way.
5. **Style placeholders read distinctly**: open each chapter 2 section (10–13) and confirm the landscape layers stack visibly differently — placeholders use distinct hues so a missing QML import isn't silent.
6. **Drawer compatibility**: open the existing MenuDrawer; confirm the floating toggle panel does not overlap or break stacking with the drawer when open on mobile widths.
7. **No-id_map fallback**: temporarily remove the `id_map` column from a Sheet row; confirm the section falls back to the original `fileList` + two-palette path with no console errors.

## Out of scope (explicit)

- Composition #2 (Positron under/over). Not used by any id_map in the CSV; skipped per the migration plan.
- Runtime ingestion of the longread copy CSV. The Sheet remains the editable surface; the CSV stays as spec.
- Persisting user toggle state across reloads (`localStorage`). Reconsider if user testing shows people want it.
- Mobile-first redesign of the toggle panel. Ship desktop-first; the existing MenuDrawer hamburger covers the discoverability fallback on narrow viewports.
- Replacing the 5 placeholder QMLs. Track as a follow-up ticket tied to design hand-off.
