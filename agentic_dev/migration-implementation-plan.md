# Implementation plan: Mapbox → self-hosted raster tiles + open-source engine

Companion to `migration-google-maps-to-custom-raster.md`. The original doc describes the *principle*; this file lists the concrete steps for **this** codebase, with file paths, commands, and decisions.

**Status (2026-05-15 evening):** Phases 1–4 are **done**. Phase 5 is **in progress** — PR-A (base composition #1) landed in code; the `relief_hillshade` pyramid is deployed to both tile origins; the SPA still needs a browser-visual sign-off + rebuild + deploy. PR-B (compositions #2/#3 + per-section selector + remaining styles) is the next remaining work. Phase 6 (cleanup) is not started.

Earlier status (Phases 1–4): Phase 1 (raster prep + tiling) revised the zoom range, raster selection, and hosting strategy downward — see "Revisions after Phase 1" below. Phase 2 shipped z=10–14 of `relief` to `github.com/Pashteto/gavr-tiles`, served via GitHub Pages at `https://pashteto.github.io/gavr-tiles/relief/{z}/{x}/{y}.png` (200 OK, `image/png`, CORS open). Phase 3 swapped the engine: `mapbox-gl` removed, `maplibre-gl` wired up in `Map-View-Client/src/MainMap.tsx` against an inline raster style pointing at `VITE_TILE_BASE_URL`; build + lint green. Phase 4 was user-verified visually: vector overlays align with the relief base across all zoom levels. **Additionally (out of original plan)**: the app is now deployed in production at `https://amphitheater.pashteto.com/` on oracle-1 with Let's Encrypt HTTPS — see `deploy-oracle-1.md`. **Tile hosting divergent between deployments:** GH Pages mirror keeps fetching tiles cross-origin from `pashteto.github.io/gavr-tiles`; oracle-1 self-hosts at `amphitheater.pashteto.com/tiles/`. The `VITE_TILE_BASE_URL` env var picks which origin to bake into the build.

---

## 0. Current state

**App**
- `Map-View-Client/` — React 19 + Vite + Mapbox GL v3.19. Single page; the map and the scroll-driven longread both live in `src/MainMap.tsx`.
- Base layer: hardcoded Mapbox token + `mapbox://styles/mapbox/satellite-streets-v11` (`MainMap.tsx:9, 436`).
- Overlays: ~80 GeoJSON files bundled from `src/assets/layers/*.geojson` via `import.meta.glob`. Files are stored in **EPSG:3857**; `MainMap.tsx:211-247` reprojects to lng/lat at runtime.
- Layer styling is procedural: `ensureLayerOnMap` (`MainMap.tsx:304-378`) picks a fill/line/circle paint based on geometry type and whether the filename starts with `mask_`. Two palettes total, no per-layer styling.
- Content (sections + which layers each section shows) comes from a public Google Sheet (`sheetId`, `sheetsApiKey` in `MainMap.tsx:11-13`), with `fallbackContentItems` hardcoded as backup.
- Build deploys to GitHub Pages via `.github/workflows/deploy.yml`. `vite.config.ts` `base: "/Map-View-Client/"`.

**Source data (`drive/Слои/`)** — measured, not estimated
- `relief.tif` — 22368 × 13773 px, **EPSG:3857**, 15 m/px, RGBA. 1.1 GB on disk.
- `hillshade-002.tif` — 33551 × 20658 px, **EPSG:3857**, 10 m/px, RGBA. 2.6 GB on disk.
- Both cover the same bbox: 28.92–31.94°E, 59.48–60.41°N (matches app centre `[30.61, 59.94]`).
- 79 vector layers (`.geojson` + parallel `.gpkg`). Subset already shipped under `src/assets/layers/`.

**Source styling (`drive/Стили/`)**
- 20 QGIS `.qml` style files. Not yet honored in the app — code uses two hardcoded palettes.

**Phase 1 output (already on disk)**
- `tile-build/tiles/relief/{z}/{x}/{y}.png` — 62,639 PNGs, 637 MB, zoom 10–15, XYZ.
- `tile-build/tiles/hillshade/{z}/{x}/{y}.png` — 62,639 PNGs, 286 MB, zoom 10–15, XYZ.
- `tile-build/logs/{relief,hillshade}.log` — gdal2tiles stdout.
- Spatial alignment verified against app centre at z=10, 12, 14, 15.

---

## 0.5. Revisions after Phase 1

Three things turned out very different from the original plan once we had real data:

1. **Storage is small, not huge.** Plan warned "tens of GB at z=17". Actual at z=10–15: **923 MB combined**. Even extrapolating to z=10–17 lands around 4–5 GB, not 30+. Tile storage is no longer a constraint that needs a CDN — **GitHub Pages is back in scope**.
2. **z=15 is mostly upsampled.** Native resolution is 10 m/px (hillshade) and 15 m/px (relief), which corresponds to z=13 and z=12 at this latitude. z=14 is one level past native (acceptable crispness). z=15 produces bilinear-interpolated soft tiles and accounts for **75% of the tile count** (46,920 of 62,639 per raster). Cutting z=15 is a 4× storage win for ~0 information loss.
3. **One raster is enough.** Relief alone already shows topography *and* urban context (whitish patches over the city). Hillshade alone is harder to read at low zoom. Stacking both adds polish but isn't load-bearing for the "amphitheater" narrative.

**Net effect on the plan**:
- **Zoom range**: 10–17 → **10–14** (default). Storage drops to ~200 MB for relief, ~80 MB for hillshade.
- **Raster choice**: tile both as base + overlay → **tile relief only as the base**. Hillshade stays in `tile-build/` as an optional later add.
- **Hosting**: pick R2/S3/GCS → **GitHub Pages on a sibling site / `gh-pages` branch**. No vendor selection, no CORS configuration, no separate credentials.
- **Effort**: 1.5 days → **~4–6 hours** end-to-end (Phase 1 took ~1 hour wall-clock, mostly waiting on `brew install`).
- **The 125k tiles currently on disk are not deleted** — they are a strict superset of what we'll ship. Once Phase 2 cuts down to z=10–14 / relief only, the unused portion can be archived or removed.

---

## 1. Goal & target architecture

Replace the Mapbox-hosted satellite base layer with a **self-hosted XYZ raster pyramid** generated from `relief.tif`. Keep all GeoJSON overlays, longread scroll behaviour, and the Google-Sheet content pipeline unchanged.

**Engine choice: MapLibre GL JS, not Leaflet.**
The migration doc recommends Leaflet by default and MapLibre "if a lot of vector data in the future". This project already has 80+ GeoJSON sources with paint-style rendering — porting them to Leaflet means rewriting `ensureLayerOnMap` from scratch (Leaflet doesn't have `addSource`/`addLayer`/`paint`). MapLibre GL JS is a hard fork of Mapbox GL JS v1 with an MIT licence and **API-compatible** `addSource`/`addLayer`/`setLayoutProperty`. Swapping `mapbox-gl` for `maplibre-gl` is a near drop-in; the only meaningful change is the style URL (no Mapbox token, point at a raster style we author or build inline). Leaflet stays as a fallback if MapLibre's WebGL turns out to be too heavy on target devices. Size data does not change this decision.

**CRS**: keep everything in EPSG:3857. Tile pyramid is XYZ Web Mercator, overlays already authored in 3857. `mercatorToLngLat` stays in the code because MapLibre, like Mapbox, expects GeoJSON in lng/lat — that reprojection is unrelated to the base-layer migration.

**Zoom range**: **10–14**, locked in by Phase 1 measurements. z=14 covers ~2.4 km/tile at this latitude — neighborhood scale, finer than the longread needs. z=15 is on disk if we change our mind, but won't be deployed.

**Base layer**: **relief** only. Single raster source in MapLibre. Hillshade can be added later as a second source with `raster-opacity: 0.5` if the cartography needs more shadow depth.

---

## 2. Phased plan

### Phase 1 — Raster prep — **DONE**

Original goal: produce a publicly servable `tiles/{z}/{x}/{y}.png` pyramid.

What actually happened:
- Installed GDAL 3.13.0 via Homebrew.
- `gdalinfo` confirmed both rasters already in EPSG:3857 → reprojection skipped.
- Ran `gdal2tiles.py --zoom=10-15 --xyz --processes=6 --webviewer=none --resampling=bilinear` against both rasters in parallel.
- Output: 62,639 tiles per raster, 923 MB total, ~3.5 min wall-clock.
- Verified spatial alignment by computing slippy-tile coordinates for the app centre and confirming each computed tile's bbox contained the centroid.

What we'll deploy:
- `tile-build/tiles/relief/{10..14}/...` — ~15,700 tiles, ~200 MB
- The remaining tiles (z=15 + all of hillshade) stay on disk as a fallback.

If you ever need to regenerate from scratch at the revised parameters:
```bash
gdal2tiles.py --zoom=10-14 --xyz --processes=6 --webviewer=none \
  --resampling=bilinear \
  drive/Слои/relief.tif \
  tile-build/tiles/relief
```

### Phase 2 — Tile hosting via GitHub Pages — **DONE (2026-05-15)**

**Result.** Live at `https://pashteto.github.io/gavr-tiles/relief/{z}/{x}/{y}.png`, served from the public repo `github.com/Pashteto/gavr-tiles` (Option A — dedicated tiles repo). 15,719 PNGs, 234 MB. First Pages build completed in ~20 s. Smoke test: `HTTP/2 200`, `content-type: image/png`, `access-control-allow-origin: *`, `cache-control: max-age=600`. Phase 3 should set `VITE_TILE_BASE_URL=https://pashteto.github.io/gavr-tiles`.

**What was actually run** (reproducible if you ever need to recreate the deploy):
```bash
mkdir -p /Users/dodonovpavel/gavr_mounty/gavr-tiles/relief
cp -R tile-build/tiles/relief/{10,11,12,13,14} ~/gavr_mounty/gavr-tiles/relief/
cd ~/gavr_mounty/gavr-tiles
# README.md and .gitattributes (`*.png binary`) authored
git init -b main
git add README.md .gitattributes relief
git commit -m "z=10-14 relief pyramid from relief.tif"
gh repo create gavr-tiles --public --source=. --remote=origin --push
gh api -X POST repos/Pashteto/gavr-tiles/pages \
  -f 'source[branch]=main' -f 'source[path]=/'   # zsh: quote brackets
```

**Why Option A (dedicated repo) over Option B (`gh-pages` branch on `Map-View-Client`).** App deploy and tile deploy stay independent — tiles re-uploaded without touching app CI; Pages quota/build minutes tracked per-repo; easier to hand off or move to a CDN later without disturbing app history.

**GitHub Pages limits, as observed.**
- **Repo size soft limit: 1 GB**. Currently 234 MB. Becomes uncomfortable only if we ever push z=15 (~437 MB more) or hillshade (~80 MB more at z=10–14).
- **100 GB/month bandwidth.** At ~15 KB/tile and ~50 tile loads per session, 100k sessions/month is ~75 GB. Comfortable.
- **CORS already open** — `access-control-allow-origin: *` confirmed in smoke test.
- **`cache-control: max-age=600`** — accepted for launch. Front with Cloudflare free tier only if request volume justifies it. Not a launch blocker.

**Re-smoke at any time:**
```bash
curl -I 'https://pashteto.github.io/gavr-tiles/relief/10/599/297.png'
# 200 OK, image/png, access-control-allow-origin: *
```

### Phase 3 — Engine swap in code — **DONE (2026-05-15)**

**Result.** `mapbox-gl` + unused Google libs removed; `maplibre-gl@^5` installed. `Map-View-Client/src/MainMap.tsx` now constructs the map from an inline raster `version: 8` style with a single `relief` source at `${TILE_BASE_URL}/relief/{z}/{x}/{y}.png` (`minzoom: 10`, `maxzoom: 14`). `TILE_BASE_URL` reads `import.meta.env.VITE_TILE_BASE_URL` with a default of `https://pashteto.github.io/gavr-tiles`. `ensureLayerOnMap` / `setLayerVisibility` got pure type swaps (`maplibregl.Map`, `maplibregl.GeoJSONSource`) — no logic changes. `.env.example` (new), `.gitignore` (added `public/tiles/`), and `.github/workflows/deploy.yml` (build step now passes `VITE_TILE_BASE_URL` from `vars.TILE_BASE_URL` with a fallback) shipped in the same change. `npm run build` and `npm run lint` are green (one preexisting `react-hooks/exhaustive-deps` warning on `useEffect` in `MainMap.tsx:557`, unrelated to migration).

**Original plan for reference** — what was actually applied:

Goal: replace Mapbox GL with MapLibre GL, point the base layer at `TILE_BASE_URL`, keep all overlay rendering intact.

**Dependency change** (`Map-View-Client/package.json`):
- Remove: `mapbox-gl`, `@types/mapbox-gl`.
- Add: `maplibre-gl` (the types ship with the package — no `@types/maplibre-gl`).
- Also remove `google-auth-library`, `google-spreadsheet`, `googleapis` — they're listed as dependencies but unused in the browser bundle (sheet access is plain `fetch`). Doing this in the same PR cuts node_modules noticeably.

**Code change (`Map-View-Client/src/MainMap.tsx`)**:

- L3: `import mapboxgl, { type GeoJSONSourceSpecification } from 'mapbox-gl'` → `import maplibregl, { type GeoJSONSourceSpecification } from 'maplibre-gl'`.
- L4: `import 'mapbox-gl/dist/mapbox-gl.css'` → `import 'maplibre-gl/dist/maplibre-gl.css'`.
- L8-9: delete the `token` const. MapLibre doesn't use Mapbox tokens.
- L432: delete `mapboxgl.accessToken = token`.
- L434-439: replace `new mapboxgl.Map({...})` with:
  ```ts
  const map = new maplibregl.Map({
    container: mapContainerRef.current,
    style: {
      version: 8,
      sources: {
        'relief': {
          type: 'raster',
          tiles: [`${TILE_BASE_URL}/relief/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 10,
          maxzoom: 14,
          attribution: '© Горные просторы',
        },
      },
      layers: [{ id: 'relief', type: 'raster', source: 'relief' }],
    },
    center: [30.61, 59.94],
    zoom: 9,
    minZoom: 9,
    maxZoom: 14,
  })
  ```
  Note `minZoom: 9` in the map options is one less than the source's `minzoom: 10` — at z=9 MapLibre upsamples z=10 tiles, which is acceptable for the initial view. Drop to `minZoom: 10` if you don't want any upsampling at all.
- L424-426: delete the `if (!token)` token-missing error branch.
- L304-378 (`ensureLayerOnMap`): **no logic changes**. Replace `mapboxgl.Map` and `mapboxgl.GeoJSONSource` type references with `maplibregl.Map` / `maplibregl.GeoJSONSource`. The `addSource`/`addLayer`/`setLayoutProperty`/`getSource`/`getLayer` API is identical.
- L380-388 (`setLayerVisibility`): identical, type swap only.

**Config**:
- Introduce `TILE_BASE_URL` via `import.meta.env.VITE_TILE_BASE_URL` and document it.
- `.env.example`:
  ```
  VITE_TILE_BASE_URL=https://<user>.github.io/gavr-tiles
  ```
- Local dev fallback (in `MainMap.tsx`): `const TILE_BASE_URL = import.meta.env.VITE_TILE_BASE_URL ?? '/tiles'`. Then `npm run dev` can serve a local `Map-View-Client/public/tiles/` for testing without hitting the deployed tiles. Add `public/tiles/` to `.gitignore`.

**Deploy workflow** (`.github/workflows/deploy.yml`): pass `VITE_TILE_BASE_URL` as a build-time env from a repo secret or `vars`:
```yaml
- name: Build
  env:
    VITE_TILE_BASE_URL: ${{ vars.TILE_BASE_URL }}
  run: npm run build
```

### Phase 4 — Verify overlay parity — **DONE (2026-05-15)**

**Result.** User confirmed visually on the MapLibre dev build: *"the alignment of layers fit nicely with map even when scaling."* All overlays render in the right geographic positions across the deployed zoom range (z=10–14). The EPSG:3857→lng/lat reprojection (`mercatorToLngLat` in `MainMap.tsx`) is unchanged and works correctly under MapLibre.

**Still pending** (kept here so it doesn't get lost):

- Mobile profile — Safari iOS and Chrome Android pinch-zoom from 10 to 14. MapLibre's WebGL path has historical perf gaps on low-end Android; only matters if the target audience includes those devices. Test before any official launch.

### Production deploy — **DONE (2026-05-15, addition to original plan)**

Not originally a phase, but the migration's natural endpoint. The migration plan stops at "engine swapped, overlays verified" — deploying that build to a real domain was a separate workstream that landed in the same session.

**What shipped.**

- New subdomain `amphitheater.pashteto.com` → oracle-1 (`129.146.183.89`, Ubuntu 22.04 ARM).
- Namecheap A record pointing to oracle-1.
- nginx vhost at `/etc/nginx/sites-available/amphitheater.pashteto.com` with SPA fallback + 1y immutable cache on `/assets/`.
- Let's Encrypt cert via `certbot --nginx --redirect` (HTTP→HTTPS 301, certbot's in-place vhost edit, auto-renewal by systemd timer; cert valid through 2026-08-12).
- `vite.config.ts` `base` now reads `process.env.VITE_BASE_PATH ?? "/Map-View-Client/"` so the same codebase builds for both the GH Pages subpath and the domain root.

**Same-origin tile self-hosting (2026-05-15 addition).** After initial cutover the oracle-1 build still fetched tiles cross-origin from `pashteto.github.io/gavr-tiles` (the `VITE_TILE_BASE_URL` default). Moved the pyramid to oracle-1 itself in a follow-up:

1. `VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build` — bundles a same-origin tile URL.
2. `rsync -az tile-build/tiles/relief/{10,11,12,13,14} oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief/` — uploaded all 15,719 PNGs (236 MB).
3. **Critical post-rsync step**: `chmod -R` to fix `0600` perms preserved from macOS source — without this, nginx (`www-data`) returns 403 on every tile.
4. Added `location /tiles/ { expires 1y; add_header Cache-Control "public, immutable"; add_header Access-Control-Allow-Origin "*"; }` to the vhost.
5. `rsync -avz --delete --exclude='/tiles/' dist/ ...` — pushed the same-origin build while preserving the tile directory.

Net result: oracle-1 deployment has zero external runtime dependencies for map rendering. Sheets API call still goes out to Google for longread copy. GH Pages mirror is unchanged.

**GH Pages deploy is preserved** — unchanged workflow, still at `https://pashteto.github.io/Map-View-Client/`. Two live deployments now, **diverging in tile origin**.

**Step-by-step procedure** for re-doing this from scratch or on another box: see `deploy-oracle-1.md` (will need a follow-up edit to add the tile self-host steps). Includes the Namecheap DNS instructions, the nginx vhost template, certbot invocation, smoke tests, rollback, and common pitfalls (Sheets API key referrer restrictions — see `google-sheets-integration.md`; macOS openrsync flag quirks; tile file perms).

### Phase 5 — Adopt QGIS styling — **IN PROGRESS** (PR-A done in code, PR-B pending)

> **2026-06-09 fidelity fix.** The QGIS styling adopted in PR-A/the overlay work was ported from the wrong block of the `.qml` files (`<elevation>` profile symbols instead of the map `<renderer-v2>`), so colors were wrong. All base + overlay styles were re-ported from `<renderer-v2>`, categorized renderers gained a `fill_categories`→`match` path, canonical QMLs were copied in-repo, and the result shipped to oracle-1. This corrects the *values*, not the architecture — PR-B's remaining scope (compositions #2/#3 CSV-baked entries, per-section selector polish) is unchanged. See `base-layer-1-plan.md` / `section-overlays-plan.md` status notes and memory `qml-port-renderer-v2-not-elevation`.

Goal: replace the two-palette procedural styling with the design team's full scheme — three base-layer compositions, per-section ordered overlay stacks, ~24 named vector styles.

The design team's spec lives in three CSV files under `drive/` (exported from the original `Описание лонгрида.xlsx`, now the source of truth):

- `drive/Описание лонгрида - лонгрид.csv` — longread copy.
- `drive/Описание лонгрида - порядок слоев.csv` — per-section ordered layer stack with named vector styles.
- `drive/Описание лонгрида - порядок базовых слоев.csv` — base-layer compositions with raster blend modes / opacity.

**PR-A — Base composition #1 (DONE 2026-05-15)** — see `base-layer-1-plan.md` for the full design. What landed:

- **Tile pyramid**: `relief × hillshade luma` pre-baked into a single `relief_hillshade` XYZ pyramid via `base-layer-1-prep/scripts/multiply_tiles.py`. Deployed to GH Pages (`pashteto.github.io/gavr-tiles/relief_hillshade/{z}/{x}/{y}.png`) and oracle-1 (`amphitheater.pashteto.com/tiles/relief_hillshade/{z}/{x}/{y}.png`). 15,719 PNGs / ~262 MB each. Works around MapLibre's lack of `mix-blend-mode: multiply` for raster layers.
- **Simplified vectors**: `drive/Слои/isoline_5m.gpkg` (61 MB) reduced to a 3.5 MB GeoJSON at 25 m simplification tolerance (1843 features preserved). Bundled at `Map-View-Client/src/assets/layers/isoline_5m.geojson`. Three alternative tolerances saved in `base-layer-1-prep/vectors/` for tuning.
- **Style registry**: `Map-View-Client/src/layerStyles.ts` exports `VECTOR_STYLES` derived from `src/assets/styles/base-composition-1.json` (the runtime manifest). 5 entries today (sectors_level, isoline_5m, stage, water, placeholder amphitheater_bound).
- **Base composition map**: `Map-View-Client/src/baseCompositions.ts` exports `BASE_COMPOSITIONS: Record<1|2|3, BaseComposition>` from the per-composition JSON manifests. Compositions #1 and #3 populated; #2 is an empty array. (Base #3 prep landed 2026-05-15 — see below.)
- **App wiring**: `MainMap.tsx` calls `addBaseComposition(map, BASE_COMPOSITIONS[1])` on `map.on('load')`, before section overlays are added. Section overlays continue using the existing two-palette `mask_*` logic in `ensureLayerOnMap`.
- **Source-of-truth doc**: `Map-View-Client/src/assets/styles/README.md` documents what came from QML vs what was calibrated.
- **Placeholder**: `amphitheater_bound.qml` is hand-authored (no canonical QML existed). Replace when design ships one.

**Still pending in PR-A**: visual browser sign-off + SPA rebuild + deploy to both origins. Code, lint, build are green; the deployed SPAs still consume the plain `relief` pyramid until rebuilt.

**PR-B — Compositions #2 + #3, per-section selector, 13 id_map overlay stacks** — extends the same scaffolding:

- ~~Populate `BASE_COMPOSITIONS[3]` (relief at opacity 0.4 for chapter 2)~~ — **DONE 2026-05-15**. `src/assets/styles/base-composition-3.json` authored from `drive/Описание лонгрида - порядок базовых слоев.csv` rows where `id_layer_base=3`; `baseCompositions.ts` refactored to a generic `compositionFromManifest()` helper that passes `opacity` through; `layerStyles.ts` merges vector styles from both manifests. No new tile assets — the plain `relief` pyramid from Phase 2 covers it; raster `opacity: 0.4` approximates the CSV's `multiply, opacity 40%` intent (MapLibre lacks raster multiply). See `src/assets/styles/README-base-composition-3.md`.
- ~~Author the 13 id_map overlay stacks from `drive/Описание лонгрида - порядок слоев.csv`~~ — **DONE 2026-05-15**. `Map-View-Client/src/assets/sections/section-overlays.json` carries all 13 sets + 19 overlay styles (14 ported from `drive/Стили/*.qml`, 5 placeholders flagged `placeholder: true`). New `src/sectionOverlays.ts` exposes `SECTION_OVERLAYS`. `layerStyles.ts` merges overlay styles into `VECTOR_STYLES`. Provenance in `src/assets/sections/README.md`.
- ~~Per-section base swap + per-section overlay rendering~~ — **DONE 2026-05-15**. `MainMap.tsx` `addBaseComposition` gained a `removeComposition` companion + `__overlay_anchor__` sentinel layer. `syncLayers` resolves `base_id` per active section (Sheet row override > manifest `default_base`) and swaps base when it changes. Overlay layers render with `beforeId: '__overlay_anchor__'` to stay above the base. Visible overlay set = `mandatory ∪ (optional \ userDisabled[id_map])`. `ensureLayerOnMap` consults `VECTOR_STYLES[styleName]` first, falls back to the legacy two-palette for sections without `id_map`. New `OverlayTogglePanel.tsx` (floating top-right, collapsible) provides the toggle UI.
- ~~Sheet schema wiring~~ — **DONE 2026-05-15**. The Sheet already follows the longread CSV schema; `parseSheetRows` reads `id _map` from column I (space-tolerant header alias), with `fillForwardIdMap` propagating across continuation rows. `sheetsRange` widened from `A:D` to `A:J`. `base_id` is inferred from the `Chapter` column (chapter 2 «Горы Петербурга — геологическая летопись» → base 3); no extra Sheet column required, though a per-row `base_id` override is still honored when present.
- Populate `BASE_COMPOSITIONS[2]` (Positron under/over) — **still pending**. Not referenced by any id_map in the CSV; ship if/when composition #2 sections are added to the longread.

**Both PRs keep the Google Sheet integration untouched** — it stays the editable surface for `id/title/description/fileList`. The CSVs are the spec; code is the implementation; CSV-vs-code drift requires a manual re-port.

**Rejected alternatives**: (1) Reading the CSVs at runtime — the JSON manifest in `src/assets/styles/` is essentially a runtime port of the relevant CSV columns, so the design hasn't drifted from the "bake the spec into code" recommendation. (2) Tippecanoe + vector tiles — higher quality at zoom but rewrites the runtime layer loader and adds a build dependency. Defer; revisit only if rendering perf becomes the bottleneck.

### Phase 5 PR-C — Frame 44 longread figures (DONE 2026-05-16, with caveat)

Goal: render the 5 illustrations from Figma frame `Frame 44.png` interleaved with the longread text, matching the design CSV's `Media Link` column.

What landed in `Map-View-Client/src/MainMap.tsx`:

- `ContentItem` gained `mediaLink?: string`; `parseSheetRows` reads a tolerant `media link` / `medialink` / `media_link` header from the Sheet (column C in the CSV). No-op on today's Sheet.
- `longreadImageByMediaName` maps the CSV's media filenames to the design team's renumbered `assets/longread/{1..5}.png`:
  - `amphitheater.png` → `1.png` (after Сектора, id_map=7)
  - `landscape_450.png` → `2.png` (after "450 млн лет назад…", id_map=10)
  - `landscape_2,5.png` → `3.png` (after "2,5 млн лет назад…", id_map=11)
  - `landscape_12.png` → `4.png` (after "12 тыс. лет назад…", id_map=12)
  - `landscape_7.png` → `5.png` (after "7 тыс. лет назад…", id_map=13)
- Render: `<img class="longread-figure" />` between the item body and any `.longread-inset`; CSS in `App.css` (full-column-width block).

**Caveat — Sheet schema lag**: the live Google Sheet still returns the legacy 4-column rows (`id, title, fileList, description`) and contains no chapter 2 content. To make Frame 44 render today, `MainMap.tsx` synthesizes the missing image rows + chapter 2 sections in code (`amphitheaterFigureItem`, `chapter2SupplementItems`, `mergeFrame44Supplement`) and merges them into every data path (initial state, sheet success, sheet failure, empty sheet). The merger detects an already-migrated sheet via `items.some(i => i.mediaLink) && items.some(i => isChapter2(i.chapter))` and no-ops in that case, so it's safe to leave in place. Remove the supplement constants + merger as a cleanup follow-up once the Sheet has been updated to the 10-column CSV schema.

### Phase 6 — Cleanup

- Keep `migration-google-maps-to-custom-raster.md` — it's the *why*. This file is the *how*. Both stay.
- ~~Remove the unused Google API node libraries from `package.json`~~ — done in Phase 3.
- Replace `Map-View-Client/README.md` (still the Vite template) with a project description, env table (`VITE_TILE_BASE_URL`, `VITE_BASE_PATH`), and deploy notes pointing at `deploy-oracle-1.md`.
- Decide on the fate of the on-disk z=15 tiles and the hillshade pyramid. Options: archive to a `tile-build-archive/` directory excluded from git, or delete. They cost ~700 MB if kept.
- Decide on the fate of `tmp/relief-zoom*.png` (one-off downsampled previews from a QGIS-installation interim; a few MB; safe to delete).
- Remove the Mapbox `pk.` token from git history if security wants — it's a public-scope token but still attributable. `git filter-repo` if so; otherwise leave the dead string alone.
- Consider rotating the Sheets API key (`AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE`) if it ever gets exposed beyond the configured referrer list. The referrer restriction is the actual security boundary, not the key string. See `google-sheets-integration.md`.
- After the Sheet is migrated to the 10-column CSV schema, delete `amphitheaterFigureItem`, `chapter2SupplementItems`, and `mergeFrame44Supplement` from `Map-View-Client/src/MainMap.tsx` — they were a temporary bridge documented in PR-C above. Leave the `mediaLink` parser change and `longreadImageByMediaName` map; those are the permanent implementation.

---

## 3. File-by-file change inventory

Inside `Map-View-Client/`:

| File | Change |
|---|---|
| `package.json` | Add `maplibre-gl`. Remove `mapbox-gl`, `@types/mapbox-gl`, `google-auth-library`, `google-spreadsheet`, `googleapis`. |
| `package-lock.json` | Regenerate via `npm install`. |
| `src/MainMap.tsx` | Replace mapbox imports, drop Mapbox token, swap `new mapboxgl.Map` for `new maplibregl.Map` with inline raster style pointing at the relief source, swap type annotations in `ensureLayerOnMap` / `setLayerVisibility`. No logic changes to the GeoJSON pipeline. |
| `vite.config.ts` | No change. (`process.env: {}` shim still useful.) |
| `.github/workflows/deploy.yml` | Add `VITE_TILE_BASE_URL` env from repo vars/secret to the build step. |
| `.env.example` (new) | Document `VITE_TILE_BASE_URL`. |
| `.gitignore` | Add `public/tiles/` (local dev tile copies). |
| `README.md` | Replace Vite template content with project description + setup. |

Outside the app, in the tiles repo (`github.com/Pashteto/gavr-tiles`, **shipped 2026-05-15**):
- `relief/{10..14}/{x}/{y}.png` — 15,719 PNGs, 234 MB.
- `README.md` — one paragraph.
- `.gitattributes` — `*.png binary`.

---

## 4. Risks & open decisions

1. ~~**Are `relief.tif` / `hillshade-002.tif` georeferenced?**~~ Answered: yes, both already EPSG:3857.
2. ~~**Total tile size at z=17.**~~ Answered: 923 MB at z=10–15. Not a constraint.
3. **Vector labels.** The current Mapbox style ships street-name and city labels for free; a pure raster relief has none. Decide: (a) live without labels (the app is a longread, not a navigation tool), (b) overlay a transparent labels-only raster from a free source (Stadia, Carto), (c) add a vector labels layer from OSM extracts. Recommend (a) — matches the longread's atmospheric feel.
4. **Mobile WebGL perf.** MapLibre is heavier than Leaflet. If profiling shows issues on the target audience's devices, fall back to Leaflet — but then `ensureLayerOnMap` needs a full rewrite (estimate +1 day).
5. **Bundle size.** `maplibre-gl` is ~200 KB gzipped, similar to `mapbox-gl`. No meaningful change.
6. **Mapbox token leak.** The current token in `MainMap.tsx:8-9` is checked into git. After migration it's dead, but it's still in history. Decide whether to rotate (in Mapbox dashboard) and/or rewrite history.
7. **GH Pages cache headers.** Default `Cache-Control: max-age=600` is short for immutable tiles. **Accepted for launch (Phase 2).** Revisit only if request volume becomes a problem. Mitigation: front with Cloudflare free tier.
8. **Adding hillshade later.** If the cartography ends up too flat-looking with relief alone, the hillshade pyramid is on disk and can be deployed as a second layer (`paint: { 'raster-opacity': 0.5 }`) without re-tiling. Add another ~80 MB to the tiles repo at z=10–14.

---

## 5. Effort estimate (revised)

| Phase | Effort |
|---|---|
| 1. Raster prep + tile generation | **DONE** |
| 2. Push z=10–14 relief tiles to a GH Pages repo + smoke test | **DONE** |
| 3. Engine swap in code | **DONE** (~30 min wall clock) |
| 4. Overlay parity verification | **DONE** (user inspection) |
| Production deploy to oracle-1 (out of original scope) | **DONE** (~25 min wall clock) |
| Sheets API referrer config for new domain | ~5 min (Google Cloud Console click-ops) |
| 5 PR-A. Base composition #1 — code | **DONE** |
| 5 PR-A. Base composition #1 — tile pyramid deploy | **DONE** (GH Pages + oracle-1) |
| 5 PR-A. Browser visual sign-off + SPA rebuild + ship | ~30 min |
| 5 PR-B. Compositions #2/#3 + per-section selector + remaining ~19 styles | ~3 h |
| Replace `amphitheater_bound` placeholder style | ~10 min (gated on design) |
| 6. Cleanup | 30 min |
| **Remaining to fully ship design intent** | **~3.5–4 h + click-ops + design hand-off** |

The migration is functionally complete and live in production with the plain relief pyramid. PR-A is on disk and one rebuild-and-ship away from being live; PR-B is the only substantial work after that.

---

## 6. Test plan

- Local: `npm run dev`, scroll through all 10 longread sections, verify layers toggle.
- Build: `npm run build && npm run preview`, check `dist/` size, verify the built version loads from `http://localhost:4173/Map-View-Client/`.
- Network: throttle to Slow 3G in DevTools, confirm tiles stream in without breaking the longread.
- Mobile: iOS Safari + Android Chrome, pinch-zoom from 10 to 14, no layout shifts.
- CORS: `curl -I` a sample tile from the deployed page's origin (GH Pages is permissive by default; still worth a sanity check).
- Tile boundary: verify there's no visible seam at tile edges (would indicate a missed gdal2tiles flag or a no-data colour mismatch).

---

## 7. Rollback

The engine swap is a single PR. If it lands and breaks on production, revert the PR — the Mapbox token + style are still valid for a while after migration (Mapbox keeps them live until quota expires). Keep the Mapbox account active for 30 days after cutover as insurance. The tiles repo is independent — leaving it deployed costs nothing while the Mapbox version runs.
