# 02 — Render mountains.geojson as ▲ triangles

## Status

**Shipped 2026-05-16.** All three code changes landed (`section-overlays.json`, `layerStyles.ts`, `MainMap.tsx`); `npm run lint` and `npm run build` are clean. Visual sweep ran against all 11 owned frames — chapter-1 frames (16, 35–41) come in at 1.6–4.6% mismatch (Frame 16 is 56.92% because the expanded sidebar from [01](01-toc-sidebar.md) isn't shipped yet — sidebar pixels dominate the diff, not triangles); chapter-2 frames (46–49) come in at 0.07–7.1%, with the chapter-2 visibility gate (`id_map ≥ 10`) confirmed by the near-zero diffs on 46. Human design sign-off (triangles eyeball correctly across the chapter-1 frames, absent from chapter-2) still pending — open `.claude-reports/visual/<ts>/task-02/index.html` to review.

## Context

`Map-View-Client/src/assets/layers/mountains.geojson` is now 229 point features. Each carries `Имя` (name), `height` (meters), `type`, and an optional `photo id`. The Figma frames (notably Frames 16, 30, 31, 35, 51) render mountains as small dark ▲ triangle glyphs scattered across the agglomeration. The current implementation has no styled entry for the `mountains` layer, so it hits `ensureLayerOnMap`'s default point fallback (circles).

## Current state

- `mountains.geojson` exists in the bundle (54 KB, 229 features, EPSG:3857 points).
- `id_map=1` in `section-overlays.json` references the `mountains` layer with style key `mountains` (mandatory).
- `mountains` style in `section-overlays.json` defines a fill+outline+line color block — useless for points. Points fall through `ensureLayerOnMap` to the `circle` branch and render as orange circles (via the two-palette default since `style.fill` doesn't apply to points).

## Target state

- Mountains render as **▲ glyphs** (Unicode `▲`) at each point.
- Dark gray fill `rgb(40, 40, 40)`, subtle off-white halo (`rgba(255, 246, 226, 0.8)`, halo-width 1) for legibility over both relief base compositions.
- Size scales gently with zoom: ~10 px at z=9, ~14 px at z=14. MapLibre's `interpolate` expression on `text-size`.
- Triangles persist across **chapter 1** sections (id_map 1–9). **Hidden in chapter 2** (id_map ≥ 10): Frames 46–49 show no triangles over the geological-era patches. Visibility gate lives in `syncLayers` — see "Visibility" below.
- Cursor changes to pointer on hover (the `mouseenter`/`mouseleave` handlers are wired in [03-mountain-info-popup.md](03-mountain-info-popup.md) since they live alongside the click handler; `02` only sets up the layer, `03` attaches the events).

## Approach

Use MapLibre's `symbol` layer with `text-field: '▲'`. No external icon image needed — Unicode glyph rendered via the renderer's text engine.

**Font portability caveat**: MapLibre has no bundled default glyph set in this project (the style has no `glyphs:` URL). The renderer falls back to system fonts, so `▲` rendering varies slightly between macOS / Windows / Linux. The glyph is universally available in basic system fonts, so this works cross-platform; the variation is in stroke weight and exact proportions, not presence/absence. If pixel-perfect consistency is required later, swap to a tiny SDF icon via `map.loadImage` + `icon-image` (deferred — Unicode is good enough for v1; pre-bake an SDF in a follow-up if QA flags it).

### Manifest change (`section-overlays.json`)

Add a `type: 'point-symbol'` discriminator to the `mountains` style so `ensureLayerOnMap` can pick the symbol branch:

```json
"mountains": {
  "type": "point-symbol",
  "icon": "▲",
  "color": "rgb(40, 40, 40)",
  "halo_color": "rgba(255, 246, 226, 0.8)",
  "halo_width_px": 1,
  "size_px": {
    "z_low": 9,  "size_low": 10,
    "z_high": 14, "size_high": 14
  }
}
```

### Type change (`layerStyles.ts`)

```ts
export type LayerStyle = {
  type?: 'fill' | 'point-symbol'  // new discriminator
  symbol?: { icon: string; color: string; halo_color?: string; halo_width?: number; size: number | maplibregl.ExpressionSpecification }
  fill?: { color: string; opacity: number }
  outline?: { color: string; width: number; opacity?: number; dasharray?: number[] }
  line?: { color: string; width: number; dasharray?: number[]; opacity?: number }
}
```

`styleFromManifest` adds a branch for `point-symbol`:

```ts
if (style.type === 'point-symbol') {
  return {
    type: 'point-symbol',
    symbol: {
      icon: style.icon,
      color: style.color,
      halo_color: style.halo_color,
      halo_width: style.halo_width_px,
      size: ['interpolate', ['linear'], ['zoom'],
        style.size_px.z_low,  style.size_px.size_low,
        style.size_px.z_high, style.size_px.size_high,
      ],
    },
  }
}
```

### Render path (`MainMap.tsx`)

Add a new `symbolIdForFile` helper + a symbol branch at the top of `ensureLayerOnMap`'s point-handling block. The geometry-type detection already returns `Point` for mountains — gate the new branch on `style.type === 'point-symbol'`:

```ts
if (geometryType === 'Point' && style?.type === 'point-symbol') {
  if (!map.getLayer(symbolIdForFile(fileName))) {
    map.addLayer({
      id: symbolIdForFile(fileName),
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': style.symbol.icon,
        'text-size': style.symbol.size,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': style.symbol.color,
        ...(style.symbol.halo_color ? { 'text-halo-color': style.symbol.halo_color } : {}),
        ...(style.symbol.halo_width ? { 'text-halo-width': style.symbol.halo_width } : {}),
      },
    }, beforeId)
  }
  return
}
```

The existing `circle` fallback stays as the last branch for point layers without a `point-symbol` style.

### Visibility + cleanup

`setLayerVisibility` already toggles `fillIdForFile`, `lineIdForFile`, `circleIdForFile`. Extend it to also toggle `symbolIdForFile(fileName)`.

### Chapter-2 visibility rule

Mountains are hidden in chapter 2 (Frames 46–49 don't show them — the era-specific landscape patches dominate the visual). In `syncLayers`, after computing the active item, gate the mountains layer on `id_map`:

```ts
const idMap = contentItems.find((i) => i.id === activeItemId)?.id_map
setLayerVisibility(map, 'mountains.geojson', !(idMap !== undefined && idMap >= 10))
```

This runs every time `activeItemId` changes — same effect that already drives per-section overlay visibility.

### Placement at zoomed-out levels

`text-allow-overlap: true` + `text-ignore-placement: true` disable MapLibre's collision avoidance. At the default zoom (9) the 229 features will visually cluster in the dense agglomeration center — this matches Frame 16. If clustering becomes hard to read at lower zooms, revisit with `text-allow-overlap: false` (which will let MapLibre hide overlapping triangles at low zoom).

### Stacking

Mountains should sit **above** all per-section overlays so the user can always click them. Insert with `beforeId=undefined` (top of stack) when the style is `point-symbol`, even if `__overlay_anchor__` exists. Adjust `ensureLayerOnMap`:

```ts
const beforeId = style?.type === 'point-symbol' ? undefined : overlayBeforeId(map)
```

This means mountains stay above section overlays after a base swap too.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/assets/sections/section-overlays.json` | Replace the `mountains` style entry with the `point-symbol` form |
| `Map-View-Client/src/layerStyles.ts` | Extend `LayerStyle` type + `styleFromManifest` |
| `Map-View-Client/src/MainMap.tsx` | Add `symbolIdForFile`, the point-symbol branch in `ensureLayerOnMap`, extend `setLayerVisibility` |

## Verification

1. Lint + build green.
2. Dev server → open the app. Mountain triangles visible across the agglomeration matching Frame 16's distribution.
3. Zoom in/out — triangles scale smoothly (10→14 px range, no pop).
4. Triangle on light vs dark areas of the relief — halo keeps glyphs legible everywhere.
5. Scroll through the 13 id_maps — triangles persist; never hidden by section overlays.
6. Hover a triangle — cursor changes to pointer (wired in [03-mountain-info-popup.md](03-mountain-info-popup.md)).

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 16 | `#sidebar=expanded` | Triangle distribution across the agglomeration |
| 35 | `#id_map=2` | Triangles persist over Сцена overlay |
| 37 | `#id_map=3` | Triangles persist over Партер overlay |
| 38 | `#id_map=4` | Triangles persist over Бельэтаж overlay |
| 39 | `#id_map=5` | Triangles persist over Балкон overlay |
| 40 | `#id_map=6` | Triangles persist over Вомитории overlay |
| 41 | `#id_map=7` | Triangles persist over Сектора overlay |
| 46 | `#id_map=10` | Triangles **HIDDEN** (verifies the id_map≥10 visibility gate) |
| 47 | `#id_map=11` | Triangles **HIDDEN** |
| 48 | `#id_map=12` | Triangles **HIDDEN** |
| 49 | `#id_map=13` | Triangles **HIDDEN** |

Run `npm run visual:task -- 02` after implementation. Review `.claude-reports/visual/<timestamp>/task-02/index.html`.

Masks: longread copy panel (standard). The map tile area is **unmasked** here — that's where triangles need to be visible (frames 16, 35–41) or absent (frames 46–49).

Human sign-off: triangles appear in frames 16/35/37/38/39/40/41 in roughly the expected pattern; they are absent from frames 46/47/48/49.

## Open questions

- Mountain label (name) rendered as a `text-field` next to the triangle? Frame 16 shows triangles only, no labels. **Decision**: no label on the base layer; the name appears only on click in the popup ([03-mountain-info-popup.md](03-mountain-info-popup.md)).
