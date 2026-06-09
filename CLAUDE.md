# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is a workspace, not a single project. Two unrelated trees live side by side:

- `Map-View-Client/` — the actual application (React 19 + Vite + MapLibre GL JS). Has its own `.git`, `package.json`, and GitHub Pages deploy workflow. **All app work happens inside this directory.**
- `drive/` — source geodata and styling assets from Google Drive (`Слои/` = layer source files, `Стили/` = style definitions, plus three CSV exports of the design-team spec: `Описание лонгрида - лонгрид.csv` (longread copy), `Описание лонгрида - порядок слоев.csv` (per-section layer order), `Описание лонгрида - порядок базовых слоев.csv` (base-layer compositions). The legacy `Описание лонгрида.xlsx` may still be present but the CSVs are the current source of truth). Not consumed by the build; treat as a content archive that feeds `Map-View-Client/src/assets/`.
- `migration-google-maps-to-custom-raster.md` — design note (Russian), the original *why* of the planned migration to self-hosted raster tiles.
- `migration-implementation-plan.md` — concrete phased plan for that migration. **Read this before suggesting any change to the base layer or hosting.** Phases 1–4 done; Phase 5 PR-A landed in code on 2026-05-15, PR-B pending.
- `base-layer-1-plan.md` — design + sequencing for shipping base composition #1 (the design spec's default basemap for chapter 1, covering most of the longread).
- `base-layer-1-prep/` — working folder with the prep artifacts: `scripts/multiply_tiles.py` (Pillow tile fuser), `tiles/relief_hillshade/` (the pre-baked multiply pyramid), `vectors/isoline_5m.geojson` (+ three alt tolerances), `styles/{amphitheater_bound.qml, base-composition-1.json}`, README + log. The canonical copies of the JSON manifest and QML files now live under `Map-View-Client/src/assets/styles/`; this folder is kept for regenerability.
- `HANDOFF.md` — current state of the migration work (what's on disk, what's running, what's next). **Read after this file.**
- `tile-build/` — output of migration Phase 1. Contains the standalone `relief/` and `hillshade/` XYZ tile pyramids (the latter is the input to the multiply fuser). The combined output lives at `base-layer-1-prep/tiles/relief_hillshade/`.
- A sibling workspace `/Users/dodonovpavel/gavr_mounty/gavr-tiles/` mirrors the public `github.com/Pashteto/gavr-tiles` repo — now hosts both `relief/{z}/{x}/{y}.png` and `relief_hillshade/{z}/{x}/{y}.png` pyramids over GitHub Pages.

## Common commands

All commands run from `Map-View-Client/`:

```bash
npm install
npm run dev        # vite dev server (default http://localhost:5173)
npm run build      # tsc -b && vite build → outputs to dist/
npm run lint       # eslint .
npm run preview    # serve the built dist/
```

There is no test runner configured.

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on push to `main`. `vite.config.ts` sets `base: "/Map-View-Client/"` to match the Pages path — don't change `base` without updating the deploy target.

## Architecture

Single-page React 19 app rendered from `src/main.tsx` → `AppLayout` (`src/layout.tsx`) → `MainMap` (`src/MainMap.tsx`). `MainMap.tsx` is where almost everything lives.

### Data flow for the map longread

1. **Content items** (the scroll-driven narrative sections) come from a public Google Sheet via the Sheets v4 REST API. `sheetId`, `sheetsApiKey`, and `sheetsRange` are hardcoded at the top of `MainMap.tsx`. The sheet has columns `id | title | description | fileList` (the `fileList` cell is a comma-separated list of geojson filenames). If the fetch fails or the sheet is empty, `fallbackContentItems` (hardcoded in the same file) is used.
2. **GeoJSON layers** are bundled at build time via `import.meta.glob('./assets/layers/*.geojson', { query: '?url', eager: true })`. Files referenced from the sheet must exist under `src/assets/layers/` or the layer silently fails. `fileUrlByName` indexes them by basename.
3. **Coordinate transform**: many of the geojson files are stored in **EPSG:3857 (Web Mercator)**, not WGS84. `transformCoordinates` / `mercatorToLngLat` recursively rewrite coordinates before handing them to MapLibre, which expects lng/lat. If a layer appears off the coast of Africa, this is why — check the source CRS.
4. **Base composition (always-on)**: `addBaseComposition(map, BASE_COMPOSITIONS[1])` runs on `map.on('load')`. The composition is derived from `src/assets/styles/base-composition-1.json` (the runtime source of truth, ported from `drive/Описание лонгрида - порядок базовых слоев.csv`). It renders the pre-baked `relief_hillshade` raster + 5 styled vectors (sectors_level, isoline_5m, amphitheater_bound, stage, water) as an always-visible bottom stack. Per-layer paint comes from `VECTOR_STYLES` in `src/layerStyles.ts`, also derived from the same JSON. See `src/assets/styles/README.md` for per-field provenance.
5. **Mask convention (per-section overlays)**: files whose names start with `mask_` are rendered with a darker, lower-opacity palette (see `isMaskFile` and the paint blocks in `ensureLayerOnMap`). New mask files just need the prefix. This palette is the fallback for any per-section overlay file that doesn't yet have a styled `VECTOR_STYLES` entry. Section overlays are added *after* `addBaseComposition`, so they layer on top.
6. **Scroll → active section → visible layers**: section-selection is breakpoint-aware. On desktop a scroll listener on `.longread` picks the section closest to the viewport center; **on mobile (`max-width: 768px`) the same listener is bound to the horizontal scroll-snap rail `.longread-content-items` and derives the active card from `rail.scrollLeft` + each item's `offsetLeft`**. Both branches set the same `activeItemId`. A separate effect diffs that against `allLayerFiles` and toggles MapLibre layer visibility — section-overlay layers are added once and shown/hidden, not re-created. Base composition layers are added once on mount and stay visible.

### Mobile layout (≤ 768px)

The mobile shell is **not** a vertical-scroll document — it's a 72/28 dvh flex column:

- Map fills the top 72 dvh (minus a 56 px topbar reserved via `padding-top: var(--mobile-topbar-h)`), and is always on screen.
- The longread sheet occupies the bottom 28 dvh and is a **horizontal scroll-snap carousel**. The actual rail is `.longread-content-items` with `display: flex; overflow-x: auto; scroll-snap-type: x mandatory`. Each `.longread-content-item` is a full-width card with `overflow-y: auto` for long content. `touch-action: pan-x` on the rail + `pan-y` on each card resolves the gesture conflict natively — horizontal swipes page, vertical swipes scroll the active card's text.
- `MobileLongreadControls.tsx` overlays the sheet with a chapter pill (top-left), pagination dots / `N / total` counter (top-right), and disabled-aware left/right chevrons. All wire through `useMapInteraction()` → `scrollToItemId`.
- `MobileTopBar` + `MobileMenu` are unchanged from `plan/change-2/`.

Desktop behaviour is untouched: 650 px longread overlay on the right, vertical scroll inside `.longread`.

### Map base layer

Initialized in `MainMap.tsx` with **MapLibre GL JS** (no Mapbox token). The map opens with an empty style spec; on `map.on('load')`, `addBaseComposition(map, BASE_COMPOSITIONS[DEFAULT_BASE_ID])` populates it from `src/baseCompositions.ts` (which itself reads `src/assets/styles/base-composition-1.json`).

**Initial centre is viewport-aware** (chosen at constructor time, no `flyTo` on breakpoint flips):

- Desktop (`>768px`): `[30.61, 59.94]` — agglomeration centre, biased east to compensate for the 650 px longread overlay covering the right side of the map.
- Mobile (`≤768px`): `[30.32, 59.95]` — SPB city centre, so the "SAINT PETERSBURG" label lands at the visual centre of the full-width map.

Zoom is 9 on both layouts (`minZoom: 9`, `maxZoom: 14`). The default MapLibre `AttributionControl` is **disabled** in the constructor; a custom one is added at `bottom-left` (`map.addControl(new maplibregl.AttributionControl(), 'bottom-left')`), with no `compact` flag so MapLibre auto-collapses to an `(i)` icon under 640 px and expands on wider viewports. CSS in `App.css` gives the attribution a translucent backdrop-blur for an overlay feel.

For composition #1 (the default for chapter 1 / most of the longread), the base stack is `relief_hillshade` raster + 5 styled vectors. Composition #2 (Positron + relief multiply, for select chapter-1 sections) and #3 (relief at opacity 0.4, default for chapter 2) are scaffolded but their CSV-baked entries are TBD — see `migration-implementation-plan.md` § Phase 5 PR-B.

### Raster tile pyramids — deployed

Two pyramids exist on both tile origins (z=10–14, ~15,719 PNGs each, XYZ, EPSG:3857):

- **`relief/`** — straight render of `drive/Слои/relief.tif`. ~234 MB. The original baseline.
- **`relief_hillshade/`** — pre-baked pixel multiply of `relief × hillshade luma`. ~262 MB. Required because MapLibre has no `mix-blend-mode: multiply` for raster layers. Generated by `base-layer-1-prep/scripts/multiply_tiles.py` (Pillow-based, walks the existing `tile-build/tiles/{relief,hillshade}/` pyramids and emits the combined output). The base raster used by composition #1.

Hosting:

- **GH Pages** (`github.com/Pashteto/gavr-tiles`) → `https://pashteto.github.io/gavr-tiles/{relief,relief_hillshade}/{z}/{x}/{y}.png`. ~496 MB combined; well under the 1 GB soft limit.
- **oracle-1** → `https://amphitheater.pashteto.com/tiles/{relief,relief_hillshade}/{z}/{x}/{y}.png`. Same content, served by nginx with 1y immutable cache + ACAO:*.

`VITE_TILE_BASE_URL` env var (default `https://pashteto.github.io/gavr-tiles`) picks which origin to bake into the build; oracle-1 deploys use `/tiles`.

Raw on-disk pyramids live at `tile-build/tiles/{relief,hillshade}/{z}/{x}/{y}.png` (standalone hillshade is the input to the multiply, not deployed standalone). The combined output lives at `base-layer-1-prep/tiles/relief_hillshade/`. To regenerate from source:

```bash
# Single raster (for reference; standalone relief was generated this way)
gdal2tiles.py --zoom=10-14 --xyz --processes=6 --webviewer=none \
  --resampling=bilinear drive/Слои/relief.tif tile-build/tiles/relief

# Combined relief × hillshade (the deployed base for composition #1)
./base-layer-1-prep/.venv/bin/python base-layer-1-prep/scripts/multiply_tiles.py
```

### UI

- shadcn/ui is installed (`components.json`, style `radix-nova`, aliases `@/components`, `@/lib`, etc.) but only the `Drawer` (vaul) is actually used, by `MenuDrawer.tsx`.
- Tailwind v4 via `@tailwindcss/vite`; styles in `src/index.css`, `src/App.css`, `src/layout.css`.
- The `@/` import alias points to `src/` (`vite.config.ts` and `tsconfig.app.json`).

### Things that look like they should work but don't

- `google-auth-library`, `google-spreadsheet`, `googleapis` are in `dependencies` but unused — sheet access goes through a raw `fetch` with a public API key. Don't pull them in for browser code; they're Node libs.
- `process.env` is shimmed to `{}` in `vite.config.ts` to keep transitive deps from crashing — don't rely on `process.env.*` in app code; use `import.meta.env`.

## Conventions

- All UI strings and content are in Russian — keep that voice when editing copy.
- Hardcoded credentials currently sit in `MainMap.tsx` (`token`, `sheetsApiKey`). The Mapbox token is scoped public-pk; the Sheets API key is a public browser key. Treat them as semi-public but don't expand their scope.
