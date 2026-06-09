# 03 — Mountain click popup + 3-stage photo zoom

## Status — implemented 2026-05-16

Shipped artifacts:

- `Map-View-Client/src/MountainPopup.tsx`, `Map-View-Client/src/MountainPhotoModal.tsx`, `Map-View-Client/src/MountainPhotoFullscreen.tsx` (new) — option-2 HTML overlay anchored via `map.project([lng, lat])`.
- `Map-View-Client/src/MainMap.tsx` — three new pieces of state (`mountainPopup`, `mountainModalPhotoId`, `mountainFullscreen`) and three `useEffect`s: layer click + hover + outside-click handler set; `map.on('move')` pixel updater while a popup is open; window-level `Escape` cascade fullscreen → modal → popup → closed.
- `Map-View-Client/src/App.css` — popup card with arrow, modal with dimmed backdrop, fullscreen lightbox.

Behavior matches the plan's state diagram: click triangle → popup with name/height (and a thumb if `photo id` is set); click thumb → modal at 80vw cap; click modal image → fullscreen; Esc and outside/backdrop clicks unwind one level at a time. Clicking a different mountain while the modal/fullscreen are open closes them first (per the plan's recommendation). Height renders to 1 decimal across all states.

Open items / deferred:

- **`1301` / `1302` photo-id linkage** in `mountains.geojson` — still pending the design owner's input ([04](04-mountain-image-conversion.md)). Until then the popup for those mountains shows name + height only (their WebPs are on disk but no feature references them, so `hasPhoto(id)` returns false on the un-linked mountains).
- Pinch-zoom on touch devices — out of scope, desktop-first per the plan.
- Visual verification: **N/A** — no Figma frame shows the popup/modal/fullscreen state. Manual walkthrough on the dev server is the only path to sign-off.

## Context

Once mountains render as ▲ triangles ([02-mountains-triangle-rendering.md](02-mountains-triangle-rendering.md)), clicking one should reveal that mountain's information. The geojson features carry `Имя` (name), `height` (meters), and an optional `photo id` (4-digit string referencing a file in [04-mountain-image-conversion.md](04-mountain-image-conversion.md)'s output).

The user-approved photo UX is **three escalating zoom states**: thumbnail → modal → fullscreen lightbox. Each state closes one step on Esc / backdrop click.

## Current state

- No click handler on the mountains layer.
- No popup component.
- No photo display infrastructure.

## Target state

### State 1 — Popup card (always after a click)

Triggered: click on a mountain ▲ in the map.

Layout: a small card anchored near the clicked point. ~220 px wide; positioned so it doesn't overflow the map edges.

Contents:
- Mountain name in bold (large), Russian (`properties["Имя"]`).
- Height: rounded to 1 decimal, suffixed with " м". Example: "55.5 м".
- If `photo id` is set: a thumbnail `<img>` (~80×60, rounded corners) bound to `${id}.thumb.webp` from `src/assets/mountain_images/`.
- A small × close button in the top-right.

Behavior:
- Click ×, click anywhere outside the card, or press Esc → close.
- Click on the thumbnail (if present) → escalate to State 2.

### State 2 — Modal photo viewer

Triggered: click on the popup's thumbnail.

Layout: centered overlay over the map; semi-transparent dark backdrop. Image sized to ~640 px wide (max-width 80vw, max-height 80vh, contain). Image is the full `${id}.webp` (1200 px max-width version).

Caption below image: mountain name + height (same data as the popup), so the modal is self-contained.

Behavior:
- Click on the image → escalate to State 3.
- Click on the backdrop or press Esc → back to State 1 (popup still open).
- Click an × in the top-right → close everything.

### State 3 — Fullscreen lightbox

Triggered: click on the modal image.

Layout: image fills the entire viewport (max-width 100vw, max-height 100vh, contain), black backdrop.

Behavior:
- Click anywhere or press Esc → back to State 2 (modal still open).

### State diagram

```
[map] --click triangle--> State 1 (popup)
                                 ↑                         |
                                 |  Esc/backdrop           | click thumbnail
                                 |                         ↓
                              [closed]                  State 2 (modal)
                                                            ↑
                                                            |  Esc/backdrop
                                                            ↓
                                                         State 3 (fullscreen)
```

## Approach

Three pieces of React state in `MainMap.tsx`:

```ts
type MountainInfo = { lng: number; lat: number; name: string; height: number; photoId: string | null }

const [popup, setPopup] = useState<MountainInfo | null>(null)
const [modalPhotoId, setModalPhotoId] = useState<string | null>(null)
const [fullscreen, setFullscreen] = useState<boolean>(false)
```

State 1 = `popup !== null`. State 2 = `modalPhotoId !== null`. State 3 = `fullscreen === true`. Each state's "back" action sets only its own state field.

### Click handler

Registered once after the mountain layer is added:

```ts
map.on('click', symbolIdForFile('mountains.geojson'), (e) => {
  const f = e.features?.[0]
  if (!f) return
  const props = f.properties as { 'Имя'?: string; height?: number; 'photo id'?: string | null }
  const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
  setPopup({
    lng, lat,
    name: props['Имя'] ?? '—',
    height: props.height ?? 0,
    photoId: props['photo id'] ?? null,
  })
})
map.on('mouseenter', symbolIdForFile('mountains.geojson'), () => { map.getCanvas().style.cursor = 'pointer' })
map.on('mouseleave', symbolIdForFile('mountains.geojson'), () => { map.getCanvas().style.cursor = '' })
```

### Popup positioning

Two options:
1. `maplibregl.Popup` — built-in, anchors to lng/lat, handles repositioning on pan/zoom. But popup content is a DOM string — to render React inside, we'd need to render to a portal then `popup.setDOMContent(node)`. Adds complexity.
2. **HTML overlay positioned by `map.project([lng, lat])`** — render an absolute-positioned `<MountainPopup>` directly in the `<section class="map-panel">`. Listen to `map.on('move')` to update its position. Simpler React story; matches the `OverlayTogglePanel.tsx` pattern.

**Recommendation**: option 2. Reuse the `position: absolute; pointer-events: auto` pattern.

### Components

```
Map-View-Client/src/MountainPopup.tsx
  props: { info: MountainInfo; pixel: { x: number; y: number }; onClose: () => void; onOpenPhoto: (id: string) => void }

Map-View-Client/src/MountainPhotoModal.tsx
  props: { photoId: string; name: string; height: number; onClose: () => void; onGoFullscreen: () => void }

Map-View-Client/src/MountainPhotoFullscreen.tsx
  props: { photoId: string; onClose: () => void }
```

### Esc key handler

A single `useEffect` in `MainMap.tsx` listens for `Escape`:

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (fullscreen) setFullscreen(false)
    else if (modalPhotoId) setModalPhotoId(null)
    else if (popup) setPopup(null)
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [fullscreen, modalPhotoId, popup])
```

### Position update

```ts
useEffect(() => {
  if (!mapRef.current || !popup) return
  const updatePixel = () => {
    const p = mapRef.current!.project([popup.lng, popup.lat])
    setPopupPixel({ x: p.x, y: p.y })
  }
  updatePixel()
  mapRef.current.on('move', updatePixel)
  return () => { mapRef.current?.off('move', updatePixel) }
}, [popup])
```

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/MainMap.tsx` | Register click handler; lift popup/modal/fullscreen state; key handler; render new components |
| `Map-View-Client/src/MountainPopup.tsx` | **new** |
| `Map-View-Client/src/MountainPhotoModal.tsx` | **new** |
| `Map-View-Client/src/MountainPhotoFullscreen.tsx` | **new** |
| `Map-View-Client/src/mountainPhotos.ts` | **new** — `photoUrl(id, variant)` helper (see [04-mountain-image-conversion.md](04-mountain-image-conversion.md)) |

## Verification

1. Click on any mountain triangle → popup opens with name + height.
2. Click on Вершина кама / Троицкая / Бабигонский холм / one of the 5 mountains with photos → thumbnail visible in popup.
3. Click on a mountain without a photo → popup shows name + height, no thumbnail row.
4. Click thumbnail → modal opens with the 1200 px image. Backdrop dim.
5. Click modal image → fullscreen lightbox.
6. Esc cycles back: fullscreen → modal → popup → closed.
7. Backdrop click outside the modal does the same.
8. Pan/zoom the map while popup is open — popup follows the mountain location smoothly.
9. Click a different mountain while popup is open — popup re-anchors to the new mountain.

### Visual verification

**N/A** — no Figma frame shows the popup, modal, or fullscreen state. The shared dashboard ([00-visual-test-framework.md](00-visual-test-framework.md)) does not cover this task; verification stays the manual walkthrough above (steps 1–9).

If design ever ships a popup mockup, register it in `frames.ts` with `taskOwners: ['03']` and a `hash` that drives the app into the popup state (would need a small extension to the hash parser, e.g. `#popup=mountain:0601`).

## Open questions

- Should clicking a different mountain while the modal is open close the modal first? **Recommendation**: yes — close modal (and fullscreen if open) when `setPopup` fires with a new info. Otherwise the modal would show the previously-clicked photo while popup talks about a different mountain.
- "Height" rounding: 1 decimal for sub-100 m mountains (most of them are), no decimal for ≥100 m? The dataset has names like "Орлиная" at 86.7 m — 1 decimal reads naturally. **Recommendation**: 1 decimal consistently.
- Pinch-zoom on touch devices — out of scope; desktop-first.
