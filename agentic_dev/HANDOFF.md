# Handoff — Mapbox → self-hosted raster migration + base-layer #1 wiring

Snapshot for whoever picks this up next (human or future agent session). Read top-to-bottom; entries are date-stamped — the most recent (top) supersedes earlier conflicting state.

## 2026-06-09 update — Viewpoints photo layer + oracle-1 redeploy + GitHub Pages status

Committed + pushed as `b26dc9e "Viewpoints"` (origin/main in sync).

### Repo layout note (supersedes CLAUDE.md)

The app no longer lives in a `Map-View-Client/` subdirectory — **the Vite app is the repo root** (`src/`, `package.json`, `vite.config.ts`, `node_modules` are all at the top level of `/Users/dodonovpavel/gateway_fm/REAL_WORLD_ASSETS/3-spb/SPb_Mountains`). CLAUDE.md and the older `agentic_dev/deploy-oracle-1.md` still reference the legacy `…/gavr_mounty/gavr_mounty/Map-View-Client` path — ignore that prefix; run all commands from the repo root. The migration/handoff docs now live under `agentic_dev/`.

### New feature — Viewpoints (global toggleable photo layer)

A new always-available map layer that renders each viewpoint photo as a small (~32–40 px) rounded, white-bordered photo "pin" at its location instead of a dot. Independent on/off toggle ("Точки обзора") in the layers panel, shown in every chapter, **on by default**. Clicking an icon opens the full-size photo in a lightbox (reuses `.mountain-photo-modal` styles).

- **Source data**: `src/assets/layers/Viewpoints.geojson` (64 features, EPSG:3857 — transformed by the existing `loadGeoJson`). Each feature has `fid` (e.g. `1001`), `ID` (uuid), `Name` (source filename, e.g. `1001.JPG`), `Date`, `Time`, `Altitude`, `Azimuth`. `fid` == `Name` basename for all 64.
- **Prep script**: `scripts/prep-viewpoint-images.sh` (re-runnable, needs ImageMagick `magick` + python3). For each feature it bakes two `fid`-named outputs from the source photo archive (`…/3-spb/gavr_mounty/Фото`):
  - `src/assets/viewpoint_images/<fid>.webp` — 84 px square map icon, rounded corners + white border + soft shadow baked in (authored at 2x; registered with `addImage(..., {pixelRatio:2})`).
  - `src/assets/viewpoint_photos/<fid>.webp` — full-size lightbox photo (longest side 1280, plain).
  - Handles the one casing mismatch (`Viewpoints.geojson` says `613.jpg`, archive has `613.JPG`) via case-insensitive `find`.
- **Rendering** (`src/MainMap.tsx`): a native MapLibre `symbol` layer `viewpoints-symbol` from source `viewpoints-source`, `icon-image: ['to-string', ['get','fid']]`, `icon-allow-overlap: true`, zoom-ramped `icon-size` (0.55@z9 → 1.0@z13). Icons registered via `map.loadImage`/`addImage` keyed by `fid`. Built in a dedicated `mapReady` effect; a second effect mirrors the toggle onto layer `visibility`; a third binds `click`/`mouseenter`/`mouseleave` (click → `setViewpointModal({fid, caption})`, caption = `Date · Altitude м`). Esc/backdrop/× close the modal.
- **Asset module**: `src/viewpointPhotos.ts` — `viewpointIcons` map (fid→icon URL) + `viewpointPhotoUrl(fid)` (full photo).
- **Modal**: `src/ViewpointPhotoModal.tsx`.
- **Toggle UI**: `src/OverlayTogglePanel.tsx` gained optional `viewpointsOn` / `onToggleViewpoints` props and renders a persistent "Точки обзора" row; panel now renders whenever that toggle exists (not only when section layers exist). `MainMap.tsx` holds `viewpointsOn` state (default true) and always renders the panel.

**Watch-outs**: 64 icons overlap heavily at z9 (expected — they separate on zoom); tweak `icon-size`/`icon-allow-overlap` if undesired. `src/assets/viewpoint_photos/` is ~9.8 MB (lazy-fetched on click, not in the JS bundle).

### Reverted — mountains-with-photos pins (do NOT re-attempt as-was)

An earlier same-session attempt replaced the mountain `▲` triangles with photo pins (HTML markers, driven by the `"photo id"` field in `mountains.geojson`) and added 64 photos to `src/assets/mountain_images/`. **The user reverted all of it** ("didn't understand the correctness"). `mountain_images/` is back to its original 5 webp pairs; only 3 mountains have a `photo id`. The Viewpoints layer above is the user's preferred shape for showing photos on the map. The obsolete plan is at `~/.claude/plans/noble-bouncing-hummingbird.md` (marked superseded).

### oracle-1 redeploy — done

`https://amphitheater.pashteto.com/` was rebuilt + rsynced with the Viewpoints feature, per `agentic_dev/deploy-oracle-1.md` §7:
```
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
rsync -avz --delete --exclude='/tiles/' dist/ oracle-1:/var/www/amphitheater.pashteto.com/html/
```
Verified live: HTTPS 200, tiles preserved, viewpoint icons render + clickable lightbox works. A pre-deploy backup sits on the server at `/var/www/amphitheater.pashteto.com/html.bak` (instant rollback via the §8 restore). The only console error is the **Google Sheets API 403** (the public key is HTTP-referrer-restricted; `amphitheater.pashteto.com` isn't allowlisted → content falls back to `fallbackContentItems`). Documented pitfall #6; needs the referrer added in Google Cloud Console — out of our access.

### GitHub Pages deploy — BLOCKED (two separate problems)

The repo is `spbmlaplus/SPb_Mountains`. `.github/workflows/deploy.yml` builds `dist/` and deploys to Pages on push to `main`. It currently **fails at `actions/configure-pages@v5`**:

1. **Pages is not enabled** on the repo, and the logged-in `gh` account (`Pashteto`) has `admin: false` there. We tried `with: enablement: true` — the workflow token got `Resource not accessible by integration` (token can't create the Pages site either). **Resolution: a `spbmlaplus` repo admin/owner must enable Pages once** (Settings → Pages → Build and deployment → Source: "GitHub Actions", or `gh api -X POST repos/spbmlaplus/SPb_Mountains/pages -f build_type=workflow`), and confirm Settings → Actions → Workflow permissions = Read and write. The `enablement: true` line was reverted (deploy.yml at HEAD is the plain `configure-pages@v5`).
2. **Base-path mismatch (will 404 even once Pages is on)**: `vite.config.ts` base defaults to `/Map-View-Client/`, but this repo's Pages site serves at `https://spbmlaplus.github.io/SPb_Mountains/`. The build needs `base: "/SPb_Mountains/"` — set `VITE_BASE_PATH=/SPb_Mountains/` in the deploy.yml build step (it already reads `VITE_BASE_PATH`), or change the default. Until then, assets resolve to `/Map-View-Client/...` and 404.

## 2026-05-20 update — Mobile horizontal carousel + desktop UI polish + oracle-1 redeploy

The mobile layout from `plan/change-2/` (sticky map 45vh on top, longread flowing below as a vertical document) was **replaced with a horizontal scroll-snap carousel**. The map is now permanently visible at the top of the mobile viewport, and longread sections page horizontally. Several long-standing desktop UI bugs were fixed in the same pass. Built + rsynced to oracle-1 at the end of the session — `https://amphitheater.pashteto.com/` serves the new bundle.

### Mobile layout — horizontal scroll-snap carousel

`Map-View-Client/src/App.css` mobile block (`@media (max-width: 768px)`) is now a 72/28 dvh flex column:

- Map: `flex: 0 0 calc(72dvh - var(--mobile-topbar-h))` (56 px topbar reserved at the top via `padding-top`).
- Sheet (`.longread-wrapper`): `flex: 1 1 28dvh`, fixed height, never scrolls vertically.
- The actual carousel is `.longread-content-items` — `display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-snap-stop: always`.
- Each `.longread-content-item` is `flex: 0 0 100%; height: 100%; overflow-y: auto; scroll-snap-align: start`. `touch-action: pan-x` on the rail and `pan-y` on each card resolves the gesture conflict natively — horizontal swipes page, vertical swipes inside a card scroll the card's own content.
- `.longread-header` and `.longread-description` are `display: none` on mobile (the Nazarov intro paragraph doesn't fit the card structure; flag as follow-up if it needs to surface as a synthetic first card).

The horizontal scroll-snap design was chosen over the original sticky-map vertical-scroll layout after the user reported that the map disappeared as soon as you scrolled into the longread. **The sheet is now the variable-content area, not the page.**

### Mobile carousel controls — new component

`Map-View-Client/src/MobileLongreadControls.tsx` (new) renders an overlay inside `.longread-wrapper` with three pieces:

- **Chapter pill** (top-left) — reads `contentItems.find(...).chapter`. Pink badge.
- **Pagination dots** (top-right) — row of dots when total ≤ 10 sections; "N / total" counter otherwise. Dots are tappable.
- **Chevron buttons** (left/right edges, vertical-center) — disabled at boundaries; call `scrollToItemId` on the next/prev section.

Hidden on desktop via a base `display: none` rule, then overridden inside the mobile media block.

### Mobile scroll/snap mechanics — `MainMap.tsx`

Both effects branch on `window.matchMedia('(max-width: 768px)').matches`:

- **`registerScroller`**: on mobile, finds the rail via `element.parentElement` and does `rail.scrollTo({ left: element.offsetLeft - rail.offsetLeft, behavior: 'smooth' })`. Desktop still uses `scrollIntoView`.
- **`updateActiveItem`** (refactored): mobile branch derives active card from `rail.scrollLeft` and each item's `offsetLeft` (closest match). Scroll listener attaches to the rail on mobile (not `window`). `mql.addEventListener('change', ...)` re-attaches when crossing the breakpoint. Resize handler re-snaps the active card after orientation changes via a new `activeIdRef` synced from the activeItemId state.

### Viewport-aware initial centre

`MainMap.tsx` now picks the map's initial centre at construction time:

```ts
const isMobile = window.matchMedia('(max-width: 768px)').matches
const initialCenter: [number, number] = isMobile ? [30.32, 59.95] : [30.61, 59.94]
```

Desktop keeps the agglomeration-centre coordinate (biased east because the 650px longread overlays the right side of the map). Mobile uses the SPB city centre so the "SAINT PETERSBURG" label lands at the visual centre. **No `map.flyTo` on breakpoint flips** — if the user rotates a tablet across the breakpoint mid-session the centre won't update. Acceptable for now; consider `flyTo` on the mql change handler if it becomes a complaint.

### Desktop UI bugs fixed in the same pass

1. **Double hamburger on desktop** (`layout.css`). The base `.mobile-top-bar { display: flex }` was declared *after* the `@media (min-width: 769px) { .mobile-top-bar { display: none } }` block — same specificity, source order won, so the mobile topbar was rendering on desktop and stacking under the sidebar hamburger. Fix: moved the desktop-hide media block to the end of the file.
2. **`OverlayTogglePanel` invisible on desktop.** The component used inline styles with `right: 16` — which on desktop puts it behind the 650 px longread overlay. Refactored to use a `.overlay-toggle-panel` CSS class (`OverlayTogglePanel.tsx`). Default desktop position: `top: 16px; right: calc(var(--longread-w) + 16px)` (with `--longread-w: 650px` defined in `:root`). Mobile override pulls it to `right: 12px` below the topbar.
3. **Map attribution.** Default MapLibre attribution sits bottom-right of the map, hidden behind the longread on desktop and rendering as a full-width strip between map and sheet on mobile. Fixed in `MainMap.tsx` map init: `attributionControl: false` on the constructor, then `map.addControl(new maplibregl.AttributionControl(), 'bottom-left')`. No `compact` flag — MapLibre auto-collapses to an `(i)` icon when the map is narrower than 640 px, expanded otherwise. CSS overrides in `App.css` give it a translucent backdrop-blur background for an overlay feel.

### Layer panel changes — all layers togglable

The previous behaviour split layers into "mandatory" (always shown, not in the panel) and "optional" (toggleable). At user request, **every layer is now in the panel and every layer can be toggled**:

- `MainMap.tsx`: `activeOptionalLayers = activeOverlay.layers` (was: `.filter(l => !l.mandatory)`).
- `MainMap.tsx`: visibility filter is now `.filter(l => !disabled.has(l.name))` (was: `l.mandatory || !disabled.has(l.name)`).
- The hardcoded `setLayerVisibility(map, 'mountains.geojson', !(idMap >= 10))` override was **removed**. Mountains visibility is now driven entirely by each section's `section-overlays.json` entry plus the user-disabled set.
- The `mandatory: boolean` field is still in the data type and JSON — just no longer enforced anywhere.

**Watch-out**: any chapter-1 section that previously relied on the hardcoded override (didn't list `mountains` in its `section-overlays.json` entry but expected mountains to render because of the chapter-wide default) will now hide mountains. If a section is missing mountains, add `{ "name": "mountains", "style": "mountains", "label": "Горы и холмы" }` to its `layers` array.

### Error notice → transient toast

`MainMap.tsx` had a permanent `.notice` banner inside the longread that read "Sheets request failed with status 403." whenever the Sheets fetch failed (which is most of the time because the live sheet is on the legacy schema). Now: error renders as a fixed-position `.error-toast` at top-center of the viewport, auto-dismisses after 2.5 s via a `useEffect`-driven `setTimeout`. A CSS keyframe handles the fade-in / hold / fade-out so the visual transition completes before React unmounts.

### Files changed

**New:**

- `Map-View-Client/src/MobileLongreadControls.tsx`

**Modified:**

- `Map-View-Client/src/App.css` — mobile `@media` block rewritten end-to-end; new sections for `.overlay-toggle-panel`, `.mobile-longread-controls__*`, `.error-toast`, MapLibre attribution overrides; `:root { --longread-w: 650px }` added.
- `Map-View-Client/src/MainMap.tsx` — `registerScroller` / `updateActiveItem` mobile branches rewritten; `attributionControl` disabled + custom control added; viewport-aware initial centre; `activeIdRef` for stable resize handling; error-clear `useEffect`; removed hardcoded mountains override; `activeOptionalLayers` no longer filters by `mandatory`.
- `Map-View-Client/src/OverlayTogglePanel.tsx` — inline-style object → `.overlay-toggle-panel` class.
- `Map-View-Client/src/layout.css` — desktop-hide media block moved to bottom of file so it wins source-order cascade.

### Deploy state

| Endpoint | URL | Bundle |
|---|---|---|
| **oracle-1** | <https://amphitheater.pashteto.com/> | **Today's build** (2026-05-20). Built with `VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/`, rsynced to `/var/www/amphitheater.pashteto.com/html/` with `--exclude='/tiles/'`, nginx reloaded. |
| GH Pages | <https://pashteto.github.io/Map-View-Client/> | Stale. Pre-Phase-5 SPA. Needs a `git push origin main` from the `Map-View-Client/` repo to trigger the Pages workflow. |

### Verification done this session

- `npm run lint` clean at every checkpoint.
- `npm run build` clean.
- Build + rsync + nginx reload succeeded; root URL returns 200, sample tile (`/tiles/relief_hillshade/10/599/297.png`) returns 200.
- **Browser verification deferred to the user** — they confirmed "the work is fine" after testing on real mobile/desktop browsers. Carousel paging, layer toggling, transient error toast, attribution placement, and the 72/28 split were all visually validated.

### Known follow-ups / open questions

- **Mobile intro section**: `.longread-description` (the Nazarov metaphor paragraph) is hidden on mobile. If product wants it surfaced, render it as a synthetic first carousel card.
- **Mobile sector view**: tapping a sector in `MobileMenu` still just closes the menu (no-op). Carryover from `plan/change-2/deferred.md`.
- **`plan/change-2/deferred.md` is partially out of date** — several items there were closed in this pass (OverlayTogglePanel desktop visibility, double-hamburger). Cross-referenced in that file's new "Resolved" section.
- **GH Pages bundle is stale** — if the production endpoint needs to track oracle-1, push to the `Map-View-Client` repo's `main` to fire the deploy workflow.

---

## 2026-05-16 update — Frame 44 longread figures + Sheet schema lag

Frame 44 (5 figures interleaved with the longread text) is now wired in code. **The live Google Sheet is still on the legacy 4-column schema** (`id, title, fileList, description`) — it doesn't have a `Media Link` column, image-only rows, or chapter 2 content. To make Frame 44 render today, `MainMap.tsx` synthesizes the missing pieces from the CSV and merges them in.

What landed (all in `Map-View-Client/src/MainMap.tsx`):

- `ContentItem` gained a `mediaLink?: string` field, and `parseSheetRows` now reads a tolerant `media link` / `medialink` / `media_link` column. No-op against the current Sheet, but ready for migration.
- `longreadImageByMediaName` maps the CSV's media filenames to the design team's renumbered `assets/longread/{1..5}.png`:
  - `amphitheater.png` → `1.png` (after Сектора, id_map=7)
  - `landscape_450.png` → `2.png` (after "450 млн лет назад…", id_map=10)
  - `landscape_2,5.png` → `3.png` (after "2,5 млн лет назад…", id_map=11)
  - `landscape_12.png` → `4.png` (after "12 тыс. лет назад…", id_map=12)
  - `landscape_7.png` → `5.png` (after "7 тыс. лет назад…", id_map=13)
- `amphitheaterFigureItem` + `chapter2SupplementItems` reproduce the missing CSV rows in code.
- `mergeFrame44Supplement(items)` injects the amphitheater figure after `sector` and appends chapter 2 (with the four landscape figures interleaved) when `items.some(i => i.mediaLink) === false` and/or no chapter 2 chapter exists. Called on every data path: initial `useState`, sheet success, sheet failure, and `loadContentItemsFromSheet`'s empty-result fallback.
- Render: a new `<img class="longread-figure" />` between the item body and any `.longread-inset` items.
- CSS: `.longread-figure { display:block; width:100%; height:auto; margin: 0.5rem 0 0 }` in `App.css`.

**Once the Sheet is migrated to the new 10-column schema (with `Media Link` + image rows + chapter 2):**

- `mergeFrame44Supplement` auto-no-ops (its detection condition flips).
- `chapter2SupplementItems` + `amphitheaterFigureItem` + the merger become dead code — fine to remove in a follow-up cleanup. Leave the `mediaLink` parser change and `longreadImageByMediaName` map in place; those become the real implementation.

### Known issue (not fixed this session) — mountains missing on chapter 1 sections

User reported (2026-05-16): scrolling through chapter 1 sections 2–7 (Сцена, Партер, …, Сектора), the `mountains.geojson` symbol layer doesn't render. Expected: per `section-overlays.json` and the override at `MainMap.tsx:1287-1291` (`setLayerVisibility(map, 'mountains.geojson', !(idMap !== undefined && idMap >= 10))`), mountains should persist across all chapter 1 sections.

Things to check next session:

- `mountains.geojson` is on disk at `Map-View-Client/src/assets/layers/mountains.geojson` — confirmed.
- It's in `ALL_OVERLAY_FILES` because `section-overlays.json` lists it in id_map=1.
- `ensureLayerOnMap` adds it as a `symbol`-type layer (mountain icons), with `beforeId: undefined` (so it sits on top, above the overlay anchor). That part is intentional — see the click handler at `MainMap.tsx:855-901`.
- The override at line 1287 runs *after* the visibility loop. If anything overrides it back to `none` (e.g. a base-composition swap that re-adds layers), that's the suspect.
- Possible cause: when the section changes id_map (and therefore base composition), `removeComposition` + `addBaseComposition` runs *before* the per-overlay visibility loop. If `mountains.geojson` was added once on id_map=1 and never re-added after a base swap, the layer might survive but be hidden by something else. Worth confirming via DevTools' MapLibre layer list.
- Also possible: chapter 1 (base 1) → chapter 2 (base 3) swap happening on the first chapter-2 visit removes the overlay anchor or re-orders mountains incorrectly. Inspect `__overlay_anchor__` placement after a swap.

**Workaround for now**: none — needs investigation. The user's report is the only signal; reproduce locally with `npm run dev` and the DevTools console before touching code.

## TL;DR

The base-layer migration is **functionally complete and live in production**. Phases 1–4 are done. **Phase 5 (styling adoption) is in progress: base composition #1 is fully wired in code and its tile pyramid is deployed to both origins, but the change has not yet been built + shipped to either deployed SPA.** The app today still renders the plain `relief` raster in production; the moment you build with the current `Map-View-Client/src/` and deploy, base composition #1 (relief × hillshade pre-baked multiply + 5 styled vectors) becomes the global basemap.

Two deployed endpoints (both still serving the **pre-Phase-5** SPA bundle):

- **GH Pages**: `https://pashteto.github.io/Map-View-Client/` — fetches tiles from `https://pashteto.github.io/gavr-tiles/`.
- **oracle-1**: `https://amphitheater.pashteto.com/` (manual SSH/rsync, HTTPS via Let's Encrypt, cert valid through 2026-08-12) — self-hosts tiles at same origin.

Tile pyramids on both origins:

| Pyramid | GH Pages | oracle-1 | Status |
|---|---|---|---|
| `relief/` (z=10–14, 15,719 PNGs, ~234 MB) | `pashteto.github.io/gavr-tiles/relief/{z}/{x}/{y}.png` | `amphitheater.pashteto.com/tiles/relief/{z}/{x}/{y}.png` | Live; consumed by the currently-deployed SPA. |
| **`relief_hillshade/`** (z=10–14, 15,719 PNGs, ~262 MB on GH Pages / 264 MB on oracle-1) — pre-baked pixel multiply of `relief × hillshade luma`. | `pashteto.github.io/gavr-tiles/relief_hillshade/{z}/{x}/{y}.png` | `amphitheater.pashteto.com/tiles/relief_hillshade/{z}/{x}/{y}.png` | **Deployed 2026-05-15** but not yet consumed in prod — the new SPA bundle that references it hasn't shipped. |

Local working folder `base-layer-1-prep/` holds the prep artifacts (multiply_tiles.py script, simplified isoline_5m at 25 m / 10 m / 100 m / WGS84 tolerances, placeholder amphitheater_bound QML, base-composition-1.json manifest, multiply tile pyramid). See its `README.md` and `base-layer-1-plan.md` for the design context.

**Phase 5 is in progress** with base composition #1 done in code:
- `Map-View-Client/src/baseCompositions.ts` + `src/layerStyles.ts` (new) derive `BASE_COMPOSITIONS` and `VECTOR_STYLES` from `src/assets/styles/base-composition-1.json` (the runtime source-of-truth manifest, ported from CSV + QML).
- `src/assets/styles/` (new folder) holds the 5 QMLs (4 from `drive/Стили/` + the placeholder `amphitheater_bound.qml`) and the JSON manifest.
- `src/assets/layers/isoline_5m.geojson` (3.5 MB, simplified at 25 m tolerance from the 181 MB source).
- `MainMap.tsx` calls `addBaseComposition(map, BASE_COMPOSITIONS[1])` on `map.on('load')`, layering the relief_hillshade raster + sectors_level + isoline_5m + amphitheater_bound + stage + water before any section overlays.

**Browser-side visual verification is not yet done** — I built, linted, type-checked, and dev-server-loaded, but I cannot operate a browser. Open `http://localhost:5173/Map-View-Client/` after `npm run dev` and visually confirm before tagging this complete.

**Phase 6 (cleanup) still open.**

---

## Project resources (external)

| Resource | URL |
|---|---|
| Original (pre-fork) site | <https://danilzmievskiy.github.io/Map-View-Client/> |
| Design Figma (Сайт «Горные просторы») | <https://www.figma.com/design/8KBWZCJBMxLJCaD80C6FhL/%D0%A1%D0%B0%D0%B9%D1%82-%D0%93%D0%BE%D1%80%D0%BD%D1%8B%D1%85-%D0%BF%D1%80%D0%BE%D1%81%D1%82%D0%BE%D1%80%D0%BE%D0%B2?node-id=131-668> |
| Source Google Drive folder (all data: rasters, vectors, styles, spec sheets) | <https://drive.google.com/drive/folders/11IDyeu1Sc1doRWTkXR-7VrK7UH1c72VT> |
| Positron base tiles (CartoDB, used for the labels/no-labels backdrop in base composition 2) | `https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png` |
| Positron labels overlay (CartoDB, **now also a base-#1 dependency** for chapter-1 city/town labels — see plan/07-positron-labels.md) | `https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png` — free tier; monitor traffic and switch to self-hosted (tilemaker over OSM) if usage exceeds ~10k tiles/day per origin |

Project GitHub login is `spbmlaplus` — credentials are kept **outside** this repo. Store them in a password manager / secrets store (do not commit them to git). See "Credentials handling" in your local notes.

## What's on disk

| Path | What it is |
|---|---|
| `migration-google-maps-to-custom-raster.md` | Original design note (the *why*). |
| `migration-implementation-plan.md` | Phased plan, kept in lock-step with reality. **Read first.** |
| `base-layer-1-plan.md` | Plan for assembling base composition #1 from the design CSV. PR-A (app-side wiring) landed 2026-05-15; tiles deployed; SPA redeploy pending. |
| `base-layer-1-prep/` | Working folder for base composition #1 assets: `scripts/multiply_tiles.py`, `tiles/relief_hillshade/` (the multiply output, 15,719 PNGs), `vectors/isoline_5m{,.tol10m,.tol100m,.wgs84}.geojson` (simplified at 4 tolerances), `styles/{amphitheater_bound.qml,base-composition-1.json}` (originals — also copied into `Map-View-Client/src/assets/styles/`), `README.md`, `logs/`. |
| `google-sheets-integration.md` | Detailed guide on how the frontend talks to Google Sheets + recommendations for evolving that layer. |
| `deploy-oracle-1.md` | Step-by-step manual deploy procedure for `amphitheater.pashteto.com`. |
| `CLAUDE.md` | Repo guidance for Claude Code sessions. |
| `tile-build/tiles/relief/{10..14}/...` | ~15,719 PNGs, ~234 MB — **deployed.** |
| `tile-build/tiles/relief/15/...` | 46,920 PNGs, ~437 MB — generated but not shipped (upsampled past native res). |
| `tile-build/tiles/hillshade/{10..15}/...` | 62,639 PNGs, 286 MB — source for the multiply fuse; not deployed standalone (consumed by `multiply_tiles.py`). |
| `tile-build/logs/{relief,hillshade}.log` | gdal2tiles stdout. |
| `tmp/relief-zoom*.png` | One-off downsampled previews of `relief.tif` created during a QGIS-installation interim. Safe to delete. |
| `.claude-reports/2026-05-14-2352-tile-pyramid-phase1.html` | Dashboard — Phase 1. |
| `.claude-reports/2026-05-15-0020-phase2-push-tiles-to-gh-pages.html` | Dashboard — Phase 2. |
| `.claude-reports/2026-05-15-0030-phase3-mapbox-to-maplibre.html` | Dashboard — Phase 3. |
| `.claude-reports/2026-05-15-0234-deploy-amphitheater-oracle-1.html` | Dashboard — production deploy. |

### New files inside `Map-View-Client/src/` (base compositions #1 + #3, 13 id_map overlay stacks)

| Path | What it is |
|---|---|
| `src/baseCompositions.ts` | `BASE_COMPOSITIONS: Record<1|2|3, BaseComposition>` + `TILE_BASE_URL` + `DEFAULT_BASE_ID`. Derives #1 and #3 from their JSON manifests at module load via a single `compositionFromManifest()` helper (passes `opacity` through, which is what makes base #3's 40% relief work). #2 is still an empty array awaiting its manifest. |
| `src/layerStyles.ts` | `VECTOR_STYLES: Record<string, LayerStyle>`. Merged from both manifests (later manifest wins on key collision). 5 distinct entries today (the four shared between #1 and #3 plus `amphitheater_bound` from #1); will hold ~24 once PR B's remaining styles land. |
| `src/assets/styles/base-composition-1.json` | Runtime source-of-truth for composition #1's render order + per-layer paint. Edits flow into both TS modules via HMR. |
| `src/assets/styles/base-composition-3.json` | **NEW 2026-05-15** — runtime source-of-truth for composition #3 (chapter 2 default). Stack: plain `relief` raster at `opacity: 0.4` + sectors_level + isoline_5m + stage + water. Vector styles duplicated verbatim from `base-composition-1.json` — keep in lockstep. |
| `src/assets/styles/README-base-composition-1.md` | Per-field provenance table for #1 — what was quoted from QML vs derived vs my-judgment-then-user-tuned. **Read before editing the JSON.** |
| `src/assets/styles/README-base-composition-3.md` | **NEW 2026-05-15** — provenance for #3 (deltas from #1 only). |
| `src/assets/styles/{sectors_level,isoline_5m,stage,water,amphitheater_bound}.qml` | The QGIS originals (4) + the placeholder (1). Not loaded at runtime; kept here so the spec sits next to the runtime code. Composition #3 reuses the same 4 vector QMLs. |
| `src/assets/layers/isoline_5m.geojson` | Simplified contour lines (3.5 MB, EPSG:3857, 25 m tolerance, 1843 features). Bundled by `import.meta.glob`. |
| `src/sectionOverlays.ts` | **NEW 2026-05-15** — `SECTION_OVERLAYS: Record<number, SectionOverlay>` derived from `section-overlays.json`. 13 id_map sets keyed 1..13. |
| `src/OverlayTogglePanel.tsx` | **NEW 2026-05-15** — floating top-right card listing optional layers (Russian labels) as checkboxes. Collapsible. Visible only when active section has optional layers. |
| `src/assets/sections/section-overlays.json` | **NEW 2026-05-15** — runtime source-of-truth for the 13 per-section overlay stacks + 19 overlay styles. Ported from `drive/Описание лонгрида - порядок слоев.csv` + `drive/Стили/*.qml`. 5 styles ship as placeholders (flagged `placeholder: true`). |
| `src/assets/sections/README.md` | **NEW 2026-05-15** — provenance for `section-overlays.json` + Sheet schema delta (`id_map` + `base_id` columns). |
| `tsconfig.app.json` | `"resolveJsonModule": true` added so the JSON manifest imports cleanly. |

Sibling workspaces (outside this repo):

| Path | What it is |
|---|---|
| `/Users/dodonovpavel/gavr_mounty/gavr-tiles/` | Local clone of `github.com/Pashteto/gavr-tiles`. **Now contains two pyramids**: `relief/{10..14}/` and `relief_hillshade/{10..14}/`, 15,719 PNGs each. Both served via GH Pages. |
| `oracle-1:/var/www/amphitheater.pashteto.com/html/` | Production webroot. SPA assets from `Map-View-Client/dist/` (built with `VITE_BASE_PATH=/ VITE_TILE_BASE_URL=/tiles`) **plus** the self-hosted tile pyramids. |
| `oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief/{10..14}/` | 15,719 PNGs, 236 MB. Served at `/tiles/relief/{z}/{x}/{y}.png`. Owned by `ubuntu:ubuntu`, mode `0644`. |
| `oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief_hillshade/{10..14}/` | **NEW 2026-05-15** — 15,719 PNGs, 264 MB. Pre-baked `relief × hillshade luma` multiply. Served at `/tiles/relief_hillshade/{z}/{x}/{y}.png`, same nginx cache + CORS rules. |
| `oracle-1:/etc/nginx/sites-{available,enabled}/amphitheater.pashteto.com` | nginx vhost. HTTP→HTTPS 301 + HTTPS server block (certbot-managed) + `location /tiles/` block adding `Cache-Control: public, immutable; max-age=31536000` and `Access-Control-Allow-Origin: *`. |
| `oracle-1:/etc/letsencrypt/live/amphitheater.pashteto.com/` | Let's Encrypt cert + key. Auto-renewed by certbot's systemd timer. |

---

## Production deploy targets

| Target | URL | Build flags | Tile origin | DNS | Cert |
|---|---|---|---|---|---|
| GitHub Pages | `https://pashteto.github.io/Map-View-Client/` | default (no env vars) | `pashteto.github.io/gavr-tiles` (cross-origin) | GitHub | GitHub-managed |
| oracle-1 | `https://amphitheater.pashteto.com/` | `VITE_BASE_PATH=/ VITE_TILE_BASE_URL=/tiles` | `amphitheater.pashteto.com/tiles` (same-origin, served by nginx) | Namecheap A → `129.146.183.89` | Let's Encrypt, expires 2026-08-12 |

Both consume the same Google Sheet — see `google-sheets-integration.md` for the **API-key referrer restriction** that needs configuring per host.

**The two deployments now diverge in tile origin.** GH Pages uses the public tile mirror; oracle-1 serves its own. Two consequences:
- Any change to the tile pyramid has to be pushed to *both* (the `gavr-tiles` repo for GH Pages, and rsync'd to oracle-1 for amphitheater).
- The `gavr-tiles` repo can be removed eventually if GH Pages of the app itself is sunset. For now it stays — it's free, the GH Pages deploy is the fallback if oracle-1 goes down.

### Re-deploy to oracle-1 — app only

Most common case. Excludes the tile directory so the existing 236 MB pyramid is preserved.

```bash
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty/Map-View-Client
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
rsync -avz --delete --exclude='/tiles/' dist/ oracle-1:/var/www/amphitheater.pashteto.com/html/
```

### Re-deploy to oracle-1 — tile pyramid

Only when the tile pyramid itself changes (re-tiling, new zoom level, hillshade addition).

```bash
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty
rsync -az \
  tile-build/tiles/relief/{10,11,12,13,14} \
  oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief/
# rsync from macOS preserves restrictive perms (0600); must chmod for nginx.
ssh oracle-1 '
  find /var/www/amphitheater.pashteto.com/html/tiles -type d -exec chmod 755 {} +
  find /var/www/amphitheater.pashteto.com/html/tiles -type f -exec chmod 644 {} +
'
```

### Re-deploy to GH Pages

Push to `main` (`.github/workflows/deploy.yml` runs automatically). Tile pyramid lives in the separate `Pashteto/gavr-tiles` repo — push there independently if it changes.

---

## Verified facts about the source data

- Both rasters (`drive/Слои/relief.tif`, `drive/Слои/hillshade-002.tif`) are **already in EPSG:3857** with valid georeferencing. No `gdalwarp` needed.
- Coverage: `28.92–31.94°E, 59.48–60.41°N` — St. Petersburg agglomeration, matches the app's map centre `[30.61, 59.94]`.
- Native resolution: relief 15 m/px (=z12 at this latitude), hillshade 10 m/px (=z13). z=14 is one level past native (acceptable). z=15 is upsampled and visibly soft.

## Tile scheme

- XYZ (OSM/Google), not TMS. MapLibre / Leaflet consume directly.
- 256×256 PNG.
- Convention: `tiles/{layer}/{z}/{x}/{y}.png`.
- Every tile that intersects the source raster bbox exists; no out-of-bbox tiles.

## Verified facts about the design scheme (CSVs under `drive/`)

Three CSV files exported from the design team's Google Sheet (replacing the legacy `Описание лонгрида.xlsx`). Not loaded at runtime; sit in the repo as spec documents.

- `drive/Описание лонгрида - лонгрид.csv` — longread copy split into **2 chapters**: *"Как устроен амфитеатр"* (sections 1–9), *"Горы Петербурга"* (sections 10–13).
- `drive/Описание лонгрида - порядок слоев.csv` — **per-section ordered layer stack** with named vector styles. Example section 6: amphitheater→`elements`, mask_amphitheater→`mask`, vomitoria→`vomitoria` (bottom→top).
- `drive/Описание лонгрида - порядок базовых слоев.csv` — **3 base-layer compositions** (always-visible bottom stack: relief.tif multiply + sectors_level + isoline_5m + amphitheater_bound + stage + water + hillshade.tif multiply, with composition 2 also layering `positron без подписей` underneath and `positron только подписи` on top). Each section references one composition.
- ~24 distinct named vector styles total (`mountains`, `mask`, `elements`, `vomitoria`, `sector_1`, `resettlement`, `stage_1`, `slope`, …) — most have a corresponding `.qml` in `drive/Стили/`.

**None of this is honored by the current frontend.** The app uses two procedural palettes (`mask_` prefix vs not). See `migration-implementation-plan.md` Phase 5 for what landing this would look like, and `google-sheets-integration.md` for context on why bringing the design spec into the runtime data flow was deferred.

---

## Decisions baked into Phases 1–4 (revisit only with cause)

1. **Zoom range deployed 10–14.** z=15 generated; ~75% of tile count, visibly upsampled. Cut for 4× storage win.
2. **Relief only as base; hillshade not shipped.** Relief alone shows topo + urban context. Hillshade on disk, deployable as a second `raster-opacity: 0.5` source without re-tiling.
3. **Tile hosting: GH Pages sibling repo, not a CDN.** 234 MB fits in 1 GB soft limit. No vendor selection, CORS auto-open, free.
4. **App hosting: oracle-1 + GH Pages in parallel.** GH Pages keeps working unchanged; oracle-1 is the user-facing prod URL via `amphitheater.pashteto.com`.
5. **MapLibre GL JS, not Leaflet.** Mapbox GL v1 API compatibility means `addSource`/`addLayer` overlays port 1:1. Leaflet would have required full rewrite of `ensureLayerOnMap`.
6. **Inline raster style spec, not a separate `style.json`.** Single source + single layer doesn't justify the extra HTTP hop.
7. **`minZoom: 9` map / `minzoom: 10` source.** MapLibre upsamples z=10 tiles at initial view (z=9 startup); acceptable softness for overview shot. Drop to `minZoom: 10` to forbid upsampling.
8. **`VITE_BASE_PATH` env, not config fork.** One `vite.config.ts`, env override for the domain build. Default keeps GH Pages working.
9. **certbot `--nginx --redirect`, not `certonly`.** Matches the existing `vpn.pashteto.com` / `mypass.pashteto.com` pattern on oracle-1; certbot writes the :443 server block and 301 in place; systemd timer handles renewal.
10. **Long-cache `/assets/`, no-cache HTML.** Vite content-hashes asset filenames, so 1-year immutable cache is safe; `index.html` stays dynamic so deploys are visible immediately.
11. ~~**Tiles stay on GH Pages, not moved to oracle-1.**~~ **Revised 2026-05-15:** the oracle-1 deployment now self-hosts tiles at `/tiles/relief/{z}/{x}/{y}.png`. GH Pages tile mirror (`pashteto.github.io/gavr-tiles`) is kept as the source-of-truth and as the fallback for the GH Pages deployment. Trade-off: 236 MB more on oracle-1 disk + bandwidth on outbound, but no external dependency for the production site. Oracle Cloud's free tier (10 TB/month egress) makes the bandwidth cost a non-issue at any plausible traffic level.
12. **`location /tiles/` block on oracle-1**: `expires 1y; Cache-Control: public, immutable; Access-Control-Allow-Origin: *`. Tile filenames are deterministic at given coords, so immutable cache is safe. ACAO is added for parity with the GH Pages mirror (and to support any future cross-origin embed of the map).
13. **Tile file permissions: `0644`, dirs `0755`**. macOS rsync (openrsync, BSD) preserves source perms; gdal2tiles wrote files as `0600` so a naïve rsync gave nginx `www-data` permission denied. The re-deploy command above explicitly `chmod`s after rsync. Don't skip it.
14. **Phase 5 deferred — do not extend the frontend to read the design spec yet.** User instruction. The CSV-defined scheme remains a spec, not runtime input. See `google-sheets-integration.md` for the options.

---

## Open issues / things to confirm in browser

1. **Sheets API key referrer restriction.** The hardcoded key in `MainMap.tsx:12` (`AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE`) is restricted to specific HTTP referrers. The new domain `amphitheater.pashteto.com` likely **isn't yet allowed** — until it is, the app silently falls back to `fallbackContentItems`. See `google-sheets-integration.md` § "Allowed referrers".
2. **Visual overlay parity** confirmed by user inspection on the MapLibre build (all layers align across zoom levels). Mobile Safari / Chrome Android pinch-zoom not yet exercised — MapLibre has historical perf gaps on low-end Android.
3. **Mapbox token in git history** at `MainMap.tsx:8-9` of any pre-Phase-3 commit. Dead code, public-scope `pk.…`. Decide whether to rotate in Mapbox dashboard for hygiene.

---

## What's next (in order)

### 1. ~~Phase 3 — code swap~~ — **DONE 2026-05-15**

`mapbox-gl` removed, `maplibre-gl` wired up against an inline raster style. Build + lint green. See migration plan § Phase 3.

### 2. ~~Phase 4 — overlay parity~~ — **DONE 2026-05-15**

User-confirmed visual parity: "the alignment of layers fit nicely with map even when scaling." Mobile profile still pending.

### 3. ~~Production deploy~~ — **DONE 2026-05-15**

`amphitheater.pashteto.com` live on oracle-1 with HTTPS. Full procedure in `deploy-oracle-1.md`.

### 4. Configure Sheets API key referrer for the new domain

Add `https://amphitheater.pashteto.com/*` and `https://amphitheater.pashteto.com` to the allowed referrers for the API key in Google Cloud Console → APIs & Services → Credentials. Until done, `amphitheater.pashteto.com` shows fallback content. ~5 min.

### 5. **← Next: visually verify + ship base composition #1**

Code is on disk and builds cleanly. Tiles are deployed to both origins. **The deployed SPAs have not been rebuilt yet** — they still render the plain `relief` pyramid.

Steps:
1. `cd Map-View-Client && npm run dev` → open `http://localhost:5173/Map-View-Client/`. Visually confirm: shaded relief (darker on slopes) + always-on sectors_level (orange) + isoline_5m (pink contours) + amphitheater_bound (dark dashed) + stage (pink) + water (red). Scroll sections; section overlays should appear on top of the base.
2. If something looks wrong, tweak `Map-View-Client/src/assets/styles/base-composition-1.json` (Vite HMRs). The fill opacities are the main calibration knob — the project owner already dialed sectors_level → 0.01, stage → 0.05, water → 0.05.
3. When happy, ship:
   - **GH Pages**: `git push origin main` in `Map-View-Client/` (CI rebuilds + redeploys).
   - **oracle-1**: `VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build && rsync -avz --delete --exclude='/tiles/' dist/ oracle-1:/var/www/amphitheater.pashteto.com/html/`.
4. Smoke-test both deployments — sample tile URL responses (already known good) + a manual browser load.

### 6. Phase 5 PR B — per-section selection + 13 id_map overlay stacks (mostly done)

- ~~Populate `BASE_COMPOSITIONS[3]` (relief at opacity 0.4 for chapter 2)~~ — **DONE 2026-05-15**. `src/assets/styles/base-composition-3.json` authored; `baseCompositions.ts` generalised to a manifest-driven helper that passes `opacity` through; `layerStyles.ts` now merges from both manifests; `README-base-composition-3.md` documents what's reused vs new. Nothing new to deploy — the raster source is the plain `relief` pyramid already on both tile origins.
- ~~Author the 13 id_map overlay stacks from `drive/Описание лонгрида - порядок слоев.csv`~~ — **DONE 2026-05-15**. `Map-View-Client/src/assets/sections/section-overlays.json` carries all 13 sets + 19 styles (14 ported from `drive/Стили/*.qml`, 5 placeholders flagged `placeholder: true`). `src/sectionOverlays.ts` exports `SECTION_OVERLAYS: Record<number, SectionOverlay>`. `layerStyles.ts` merges overlay styles into `VECTOR_STYLES`. Provenance at `src/assets/sections/README.md`.
- ~~Per-section base swap~~ — **DONE 2026-05-15**. `MainMap.tsx` `addBaseComposition` gained a `removeComposition` companion + `__overlay_anchor__` sentinel; `syncLayers` reads `activeItem.id_map` → resolves `base_id` (Sheet column override > manifest `default_base`) → swaps base if different from `currentBaseIdRef.current`. Overlay layers are added with `beforeId: '__overlay_anchor__'` so they stay above the base after swaps.
- ~~Per-section overlay rendering with mandatory + toggleable optional layers~~ — **DONE 2026-05-15**. `syncLayers` builds the visible set as `mandatory ∪ (optional \ userDisabled[id_map])`. `ensureLayerOnMap` consults `VECTOR_STYLES[styleName]` first, falls back to the original two-palette when no styleName/style is found. New floating `OverlayTogglePanel` (top-right) lists optional layers with checkboxes (Russian labels); collapsible. State is `userDisabled: Record<number, Set<string>>` in MainMap, session-scoped.
- ~~Sheet schema wiring~~ — **DONE 2026-05-15**. The Sheet's `id _map` column (I) is already populated; `parseSheetRows` now reads the longread-CSV schema (chapter/subtitle/description/.../id _map). `sheetsRange` widened to `A:J`. `base_id` is **inferred** from the `Chapter` column (chapter 2 → base 3), so no extra Sheet column is needed; the per-row `base_id` is still honored when present for future flexibility. `fillForwardIdMap` propagates the most-recent id_map across continuation rows.
- Populate `BASE_COMPOSITIONS[2]` (Positron under/over). **Still pending.** Not referenced by any id_map in the CSV; ship if/when composition #2 sections are added.
- Replace the 5 placeholder styles when design ships canonical QMLs (`elements`, `historical_resettlement`, `amphitheater_bound_1`, `landscape_450`, `landscape_2,5`, plus optionally `slope`). Track as a follow-up tied to design hand-off.

Estimated remaining effort: editorial Sheet update (~10 min), then browser sign-off + SPA ship.

### 7. Replace the `amphitheater_bound` placeholder style

`Map-View-Client/src/assets/styles/amphitheater_bound.qml` is hand-authored (dark gray dashed 0.8 mm). When design ships the canonical QML, drop it into this folder and re-port colors into `base-composition-1.json`. ~10 min.

### 8. Phase 6 — cleanup

- Decide fate of on-disk z=15 + hillshade tiers (~700 MB) — archive to `tile-build-archive/` or delete.
- Decide fate of `tmp/relief-zoom*.png` (a few MB, one-off previews).
- Replace `Map-View-Client/README.md` (still the Vite template) with project description + deploy notes.
- Consider rotating Mapbox token in Mapbox dashboard (dead but in history).
- Consider rotating Sheets API key if it gets exposed beyond expected referrers.

---

## Quick reference

**Build for each target**:
```bash
# GH Pages (default)
npm run build

# oracle-1 / amphitheater.pashteto.com — same-origin tiles, root base
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
```

**Smoke test deployed tiles** (both should be 200 with `image/png`):
```bash
curl -I 'https://pashteto.github.io/gavr-tiles/relief/10/599/297.png'
curl -I 'https://amphitheater.pashteto.com/tiles/relief/10/599/297.png'
```

**Smoke test deployed app**:
```bash
curl -sS -I https://amphitheater.pashteto.com/        # HTTP/2 200, text/html
curl -sS -I http://amphitheater.pashteto.com/         # 301 → HTTPS
```

**Browse a tile locally**: `open tile-build/tiles/relief/10/599/297.png`

**Compute slippy-tile coords for a lng/lat**:
```python
import math
def lnglat_to_tile(lng, lat, z):
    n = 2**z
    x = int((lng + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y
```

**Re-tile relief at the deployed parameters**:
```bash
rm -rf tile-build/tiles/relief
gdal2tiles.py --zoom=10-14 --xyz --processes=6 --webviewer=none \
  --resampling=bilinear drive/Слои/relief.tif tile-build/tiles/relief
```

**Delete unused z=15 tier** (~437 MB):
```bash
rm -rf tile-build/tiles/relief/15 tile-build/tiles/hillshade/15
```

**SSH access**: `ssh oracle-1` (alias resolves to `129.146.183.89`, user `ubuntu`, sudo without password).

---

## Known things that aren't broken

- `vite.config.ts` `base` reads `process.env.VITE_BASE_PATH` with fallback `"/Map-View-Client/"`. The GH Pages deploy workflow doesn't set the env, so it uses the fallback — don't touch unless you also touch the deploy target.
- `MainMap.tsx` `TILE_BASE_URL` reads `import.meta.env.VITE_TILE_BASE_URL` with fallback `"https://pashteto.github.io/gavr-tiles"`. GH Pages build uses the fallback (cross-origin tiles); oracle-1 build overrides to `"/tiles"` (same-origin). Same code, two builds.
- Vector layers (`MainMap.tsx`) reproject from EPSG:3857 → WGS84 at runtime. Unrelated to migration; stays as-is.
- `process.env` is shimmed in `vite.config.ts` define block (for transitive deps). Don't add app code that reads `process.env.X`; use `import.meta.env.VITE_X`.
- Three Google API node libraries (`google-auth-library`, `google-spreadsheet`, `googleapis`) were removed in Phase 3. The frontend's Sheets integration uses a plain `fetch` with the public API key — these libs were unused.
- The `pre-Phase-3` Mapbox dev server on :5173 was killed by the user; the MapLibre dev server can run on :5173 by default now.

## Gotchas worth not re-discovering

- **macOS bundled rsync is `openrsync` (BSD), not GNU rsync.** It doesn't support `--info=progress2`, `--info=stats`, and some other GNU-only flags. Use plain `-az` and accept no progress bar, or `brew install rsync` for GNU.
- **rsync preserves source permissions by default.** gdal2tiles wrote tiles as `0600`. After rsync to oracle-1, nginx (`www-data`) got 403s. Always `chmod` after rsync'ing tiles. The fix:
  ```bash
  ssh oracle-1 'find /var/www/.../tiles -type d -exec chmod 755 {} + ; \
                find /var/www/.../tiles -type f -exec chmod 644 {} +'
  ```
- **`rsync --delete --exclude='/tiles/'`** is non-obvious — the leading slash anchors the exclude to the top of the transfer, otherwise it matches any `tiles` anywhere. Without the anchor, rsync would also exclude `assets/tiles-foo` etc. if any existed.
- **Let's Encrypt's CAA lookup is sometimes flaky.** First `certbot --nginx` attempt failed with `SERVFAIL looking up CAA for com` — transient, not a config issue. Empty CAA records on `.com` are normal. Retry immediately.
- **`amphitheater.pashteto.com` was live (someone hit the site)** during the ~60-second window where tile permissions were broken. The nginx error log captured the IP `185.215.184.56`. If you ever do another tile re-upload, chmod *before* the app build references the new tile URL.

---

## Revised effort estimate

| Phase | Status |
|---|---|
| 1. Raster prep + tile generation | **DONE** |
| 2. Push tiles to GH Pages | **DONE** |
| 3. Engine swap in code | **DONE** |
| 4. Visual overlay parity | **DONE** |
| Production deploy to oracle-1 | **DONE** |
| Sheets API referrer config | ~5 min (Google Cloud Console) |
| 5 PR-A. Base composition #1 (code) | **DONE 2026-05-15** |
| 5 PR-A. Base composition #1 (tile pyramid deploy) | **DONE 2026-05-15** (both origins) |
| 5 PR-A. Base composition #1 (browser visual verify + SPA rebuild + ship) | ~30 min |
| 5 PR-B. Composition #3 manifest + TS wiring | **DONE 2026-05-15** |
| 5 PR-B. 13 id_map overlay stacks + per-section base swap + toggle UI | **DONE 2026-05-15** (code) |
| 5 PR-B. Sheet schema wiring (`id _map` col I, chapter-driven base_id) | **DONE 2026-05-15** |
| 5 PR-B. Composition #2 (Positron under/over) | TBD — no CSV references it |
| 5 PR-B. Replace 5 placeholder QMLs | gated on design |
| 6. Cleanup | 30 min |
| Replace `amphitheater_bound` placeholder | ~10 min (gated on design) |

**Remaining to fully ship the design intent**: ~3.5–4 h of focused work + the one-off design hand-off for the placeholder.
