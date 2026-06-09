# 07 — Positron labels overlay for chapter 1

## Status

**Implemented 2026-05-16.** Path A shipped:

- `positron_labels` raster entry appended to `Map-View-Client/src/assets/styles/base-composition-1.json` (`absolute_url: true`, `minzoom: 0`, `maxzoom: 19`, CartoCDN `light_only_labels` `@2x` tiles, CARTO/OSM attribution). Opacity is tunable from the manifest — plan suggested `0.85`, currently checked in at the calibrated value.
- `ManifestRasterEntry` gained `absolute_url?: boolean` (+ optional `minzoom`/`maxzoom`/`attribution` passthrough) in `Map-View-Client/src/baseCompositions.ts`; `compositionFromManifest` skips the `TILE_BASE_URL` prefix when `absolute_url` is true.
- `HANDOFF.md` resources table now lists `light_only_labels` as a base-#1 dependency, not just a base-#2 stub.

Awaits browser sign-off (manual until plan 00's visual-test framework lands) — confirm labels visible over Frames 30, 35, 37–41; opacity 0.85 matches; chapter 2 (base #3) shows no labels. Tune opacity in the manifest if too loud.

## Context

Frames 30, 31, 35, 36, 37, 38, 39, 40, 41 (all chapter 1 frames) show subtle gray city/town labels scattered over the map — "Saint Petersburg", "Gatchina", "Колтуши", "Парголово", etc. Base composition #1 (the deployed chapter-1 base) does **not** include any label layer; today the app renders the relief+vectors stack with no place names.

The `migration-implementation-plan.md` already mentions "Positron `light_only_labels` from CartoCDN" as the labels source for base composition #2 (the design's labels-overlay variant). The frames suggest those labels should also appear in chapter 1.

## Current state

- `Map-View-Client/src/assets/styles/base-composition-1.json` — 6 layers, no labels.
- `BASE_COMPOSITIONS[2]` is an empty stub in `baseCompositions.ts`.
- No CartoCDN raster source declared anywhere.

## Target state

Chapter 1 frames render with subtle place labels matching the frames. Two implementation paths:

### Path A — Add labels to base composition #1

Edit `base-composition-1.json` to append a raster entry pointing at `https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png`. Rendered at the top of the base stack (so labels sit above relief but below overlays — `beforeId=__overlay_anchor__` handles that automatically). Minor concern: this also activates labels for any other section that uses base #1, which we want anyway.

### Path B — Separate labels composition, toggle per chapter

Define a new layer in `baseCompositions.ts` that activates only when the active chapter is 1. More flexible, more wiring. Probably premature.

**Recommendation**: Path A.

## Approach

### Manifest change

Append to `base-composition-1.json` `render_order` (at the end, so labels are top of the base stack):

```json
{
  "kind": "raster",
  "name": "positron_labels",
  "source": "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png",
  "absolute_url": true,
  "minzoom": 0,
  "maxzoom": 19,
  "opacity": 0.85,
  "attribution": "© OpenStreetMap contributors © CARTO"
}
```

### Code change

`baseCompositions.ts`'s `compositionFromManifest` currently rewrites the `source` field by prepending `TILE_BASE_URL` for paths starting with `tiles/`. For CartoCDN URLs (already absolute) we want to pass through unchanged:

```ts
const relativePath = entry.source.replace(/^tiles\//, '')
const urlTemplate = entry.absolute_url
  ? entry.source
  : `${TILE_BASE_URL}/${relativePath}`
```

Add `absolute_url?: boolean` to the manifest raster entry type.

### Attribution

CartoCDN tiles require attribution per their TOS. The `attribution: '© OpenStreetMap contributors © CARTO'` field threads through to MapLibre's attribution control automatically.

### CORS

CartoCDN serves with `Access-Control-Allow-Origin: *` for the `basemaps.cartocdn.com` domain. No proxy needed.

### Referer / abuse policy

CartoCDN's free tier allows anonymous use for prototyping. For production usage at scale (>10k tiles/day per origin), they ask for a CartoDB account. We're well under that. Document as "monitor traffic; switch to self-hosted if usage grows" in `HANDOFF.md`.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/assets/styles/base-composition-1.json` | Append `positron_labels` raster entry |
| `Map-View-Client/src/baseCompositions.ts` | Honor `absolute_url` flag in `compositionFromManifest` |
| `HANDOFF.md` | Note the CartoCDN dependency + usage caveats |

## Verification

1. Lint + build green.
2. Dev server — chapter 1 sections show city labels matching Frames 30, 35, 37, 38, etc.
3. Network tab — labels load from `basemaps.cartocdn.com`; no 403/CORS errors.
4. Scroll to chapter 2 — labels disappear (base #3 doesn't include this layer).
5. Pan/zoom — labels track the map smoothly.

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 35 | `#id_map=2` | City/town labels visible over chapter-1 base |
| 37 | `#id_map=3` | Same |
| 38 | `#id_map=4` | Same |
| 39 | `#id_map=5` | Same |
| 40 | `#id_map=6` | Same |
| 41 | `#id_map=7` | Same |

Run `npm run visual:task -- 07` after implementation. Review `.claude-reports/visual/<timestamp>/task-07/index.html`.

Masks: longread copy panel (standard). Map tile area is unmasked — labels are the deliverable and overlay the map.

Human sign-off: text labels (St. Petersburg town names) overlay the relief in chapter 1; positions roughly match the Figma frames. Some position drift is inevitable (CartoCDN labels are real OSM data, not exactly what the Figma mockup shows).

## Open questions

- **Opacity** — Frames have very subtle labels. 0.85 should match; tune visually.
- **`@2x` retina variant** — using the @2x URL gives crisper labels on retina displays. Slightly larger payload. **Recommendation**: keep @2x for the desktop-first audience.
- **CartoDB account** — if we expect production-scale traffic, register for a free account and use their tile-server URL pattern. For now, anonymous CDN is fine.
- **Self-hosting labels** as a future hedge — if CartoCDN becomes a dependency risk, we could pre-render labels from OSM with `tilemaker` + serve from `gavr-tiles`. Estimated ~200 MB for z=0–14 over the agglomeration. Document as a follow-up.

## Phase

Phase 3 — gated on design confirming this is the intended behavior for chapter 1.
