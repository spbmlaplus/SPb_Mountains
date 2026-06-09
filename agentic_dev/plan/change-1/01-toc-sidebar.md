# 01 — Permanent collapsible left sidebar with chapter + sector TOC

## Status — implemented 2026-05-16

Shipped artifacts:

- `Map-View-Client/src/Sidebar.tsx`, `Map-View-Client/src/MapInteractionContext.tsx` (new)
- `Map-View-Client/src/MainMap.tsx` — `ContentItem.chapter?: string`, fill-forward in `fillForwardIdMap`, fallback array wrapped to backfill chapter, three `useEffect`s wiring the context (publish active id / content items, register `scrollIntoView`).
- `Map-View-Client/src/main.tsx` — tree wrapped in `<MapInteractionProvider>`.
- `Map-View-Client/src/layout.tsx`, `layout.css` — old `<header>` column + `<DrawerWithSides>` + redundant `<nav>` removed; `Sidebar` is a sibling of `{children}` inside `<main>`.
- `Map-View-Client/src/MenuDrawer.tsx` deleted; `vaul` dep retained.
- `Map-View-Client/visual-tests/frames.ts` — `SIDEBAR_WIDTH_COLLAPSED` updated 32 → 48 so the map mask aligns with the shipped rail.

Deltas from the spec:

- Collapsed width is **48 px** (plan said "~32 px") — 32 px is too tight for a 22 px hamburger with comfortable padding.
- Sidebar **auto-collapses on chapter click** (plan was silent) — keeps the post-click frame matching the collapsed state in every subsequent Figma frame.
- The entire left header column was removed, not just `<DrawerWithSides />` + `<nav>` — the remaining 96 px column held only the logo, which would have left a gap between the viewport edge and the new sidebar. The МЛА+ wordmark moved into the sidebar's collapsed footer (matches Figma).

Visual verification (`npm run visual`, sweep ts `20260516-030640`):

- Frame 30 (`#sidebar=collapsed`) — **0.05%** diff. Sidebar visually identical to the Figma frame.
- Frame 16 (`#sidebar=expanded`) — **48.77%** diff. Sidebar matches; the noise is the un-rendered mountain triangle layer (co-owned with plan 02). Expected to close once 02 is exercised in the same capture.

Still requires a human run-through in a real browser to drive the active-chapter highlight transition (no Figma frame combines `#sidebar=expanded` with a chapter-2 scroll position).

Open items deferred:

- Sector row clicks → exploration mode — owned by [09-sector-exploration.md](09-sector-exploration.md); `// TODO(plan/09)` breadcrumb left at the JSX site.
- Chapter 08 wording "Угрозы и угрозы" — kept as shown per the plan; update when design clarifies.

## Context

Frame 16 (the cover/intro state) and Frames 30/35/37/38/… (every section frame) show a permanent **left rail** that the user can collapse or expand. Today the project uses a `vaul`-based drawer (`MenuDrawer.tsx`) triggered by a hamburger button in the header — hidden by default, hostile to discoverability, and not the design intent.

## Current state

- `Map-View-Client/src/MenuDrawer.tsx` — vaul `<Drawer direction="left">` with a hamburger trigger; body is empty (just a placeholder `<ul>` of nav links).
- `Map-View-Client/src/layout.tsx` — `<DrawerWithSides />` in header + a separate `<nav class="layout-nav">` listing the same three items.
- The 8 chapters from Frame 16 are not represented anywhere in code.
- The 13 sectors from Frame 16 are not represented in the sidebar (only as the `sector.geojson` overlay on the map).

## Target state

Replace the drawer with a permanent left rail.

**Collapsed (default)** — Frames 30, 35, 37, 38, 39…
- Width: ~32 px
- Hamburger icon at the top
- Three vertical rotated text labels stacked: "Исследовать горы" / "Глоссарий" / "О проекте"
- "МЛА+" wordmark at the bottom, also vertical
- Dark or transparent background; matches the map's edge

**Expanded** — Frame 16
- Width: ~260 px
- "Всё о горных просторах Петербурга" title at top (white text on dark)
- 8-row chapter list:
  | # | Title | Status |
  |---|---|---|
  | 01 | Как устроен амфитеатра | active (clickable) |
  | 02 | Геологическая история | clickable when row reaches viewport |
  | 03 | Горные дюны | Скоро (disabled) |
  | 04 | Имперские наблюдатели | Скоро |
  | 05 | Наука и горы | Скоро |
  | 06 | Стратегические высоты | Скоро |
  | 07 | Современный досуг | Скоро |
  | 08 | Угрозы и угрозы | Скоро |
- A horizontal separator
- "Всё о секторах горного амфитеатра" sub-header
- 13-row sector list (01 Рощинский сектор … 13 Пенинский сектор)
- Footer links: О проекте / Глоссарий / Исследовать горы

Active chapter highlighted in red `rgb(225, 89, 137)` (matches the longread accent in Frame 35's "Сцена" underline).

## Behavior

- Hamburger toggles collapsed ↔ expanded. Default: **collapsed** (Frame 30, the state after the user starts scrolling).
- Click an enabled chapter → smooth-scrolls the longread panel to that chapter's first row (`itemRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth' })`).
- Active chapter derives from the existing `activeItemId` state in `MainMap.tsx` (the scroll-spy in `MainMap.tsx:804–860` already computes which item's center is closest to the longread viewport center; reuse it, don't add a second observer). Sidebar resolves `activeItemId → ContentItem.chapter → matching chapter row`.
- Sector rows are **inert in this PR** (no `onClick`). Wiring is owned by [09-sector-exploration.md](09-sector-exploration.md); leave a `// TODO(plan/09): wire setExplore` comment on the sector row element in `Sidebar.tsx` so the breadcrumb survives in code.
- Disabled chapters render with reduced opacity + "Скоро" badge.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/Sidebar.tsx` | **new** — the component |
| `Map-View-Client/src/MapInteractionContext.tsx` | **new** — tiny React context exposing `scrollToItemId(id)` so Sidebar can drive MainMap's scroll without prop-drilling |
| `Map-View-Client/src/layout.tsx` | Remove `<DrawerWithSides />` and the redundant `<nav>`; render `<Sidebar />` inside `<main>` as a sibling of `{children}` |
| `Map-View-Client/src/layout.css` | Add `.sidebar` + `.sidebar.collapsed` styles with width transitions; make `.layout-main` a flex container so the sidebar pushes the map's left edge or floats above it |
| `Map-View-Client/src/MenuDrawer.tsx` | Delete |
| `Map-View-Client/src/MainMap.tsx` | Extend `ContentItem` with `chapter?: string` (the Sheet range `Лист1!A:J` already pulls the column and `parseSheetRows` already extracts `chapter` at `MainMap.tsx:221` — it's just not stored on the type today); expose `scrollToItemId` via the new context (wraps `itemRefs.current.get(id)?.scrollIntoView`) |

The `vaul` dependency stays (shadcn registry — used nowhere else but cheap to keep). If we want to fully prune it, that's a separate cleanup.

## Implementation steps

1. **Data**: define the `CHAPTERS` and `SECTORS` arrays in `Sidebar.tsx`. Chapter titles come verbatim from Frame 16; sector titles come from `sector.geojson` properties + Frame 16 (cross-reference to confirm spelling).
2. **Active-chapter derivation**: in `Sidebar`, look up `activeItemId` → find the matching `ContentItem` → take its `chapter` field. Compare loosely (substring or exact) to `CHAPTERS[i].title`. Highlight matching row.
3. **Mapping chapter → first row id**: pre-compute on each `contentItems` change. The first row of chapter N is the first `ContentItem` whose `chapter` matches `CHAPTERS[N-1].title`. Store as `firstItemId` on the chapter entry. When `firstItemId` is null (chapter has no content rows), mark disabled.
4. **CSS**: `.sidebar { width: 32px; transition: width 200ms ease; }` collapsed, `.sidebar.expanded { width: 260px; }`. Rotated labels use `writing-mode: vertical-rl; transform: rotate(180deg)` so the text reads bottom-to-top.
5. **Map width** when sidebar expands: the simplest path is to let the sidebar overlay the map (matches the frames — Frame 16 shows the sidebar OVER the map, not next to it). The map keeps full width.

## Verification

1. Lint + build green.
2. Initial load: sidebar collapsed, vertical labels readable.
3. Click hamburger → expands, 8 chapters + 13 sectors visible.
4. Scroll the longread to chapter 2 (id_map=10) → chapter 02 highlighted in red.
5. Click chapter 01 → longread smooth-scrolls to its first row; chapter 01 highlights.
6. Chapters 03–08 grayed out with "Скоро" badges; clicking them does nothing.
7. Sector rows clickable affordance is absent (no cursor pointer); they render as static labels.
8. Resize the window — sidebar stays anchored to the left edge; expanded width remains 260 px.

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 16 | `#sidebar=expanded` | Expanded sidebar — title, 8 chapters + 13 sectors, footer links |
| 30 | `#sidebar=collapsed` | Collapsed rail — three vertical rotated labels, "МЛА+" bottom |

Run `npm run visual:task -- 01` after implementation. Review `.claude-reports/visual/<timestamp>/task-01/index.html`.

Masks: map tile area + longread copy panel (standard masks from `frames.ts`). The sidebar is the deliverable — the diff there should be near-zero.

Human sign-off: chapter titles, sector titles, active-chapter highlight, collapsed-state rotated labels, and overall width/positioning visually match the Figma frames.

## Deferred to later phases

- **Sector row clicks → exploration mode**: owned by [09-sector-exploration.md](09-sector-exploration.md). The 13 sector rows render in this PR but are inert; `09` adds the `setExplore(...)` wiring. The `// TODO(plan/09)` code comment is the breadcrumb.

## Open questions (design clarification needed; ship anyway)

- "08 Угрозы и угрозы" — the Frame 16 wording reads like a typo (Threats and threats). Likely meant "Угрозы и [something]". Ship as shown; update the constant when design clarifies.
- Active-chapter highlight color: `rgb(225, 89, 137)` matches Сцена/Партер underlines. Confirm with design that the chapter highlight uses the same hue.
- Collapsed vs expanded default — default **collapsed** since Frame 16 (cover) is a one-time "first paint" view; every subsequent frame shows the collapsed state. Reconsider if user testing suggests otherwise.
