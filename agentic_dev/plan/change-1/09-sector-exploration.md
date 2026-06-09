# 09 — Post-story sector exploration mode

## Status

**MVP wired 2026-05-16.** Core loop works end-to-end; deeper data and polish deferred. Shipped:

- `MapInteractionContext.tsx` gained `exploreSector: number | null` + `setExploreSector` (state lives at the provider level so the sidebar and the map can stay decoupled).
- `Sidebar.tsx` sector rows now wire a click/Enter/Space handler that calls `setExploreSector(parseInt(s.num, 10))` and collapses the drawer. The active row gets `sidebar__sector--active` (coral text), and the previously-inert `cursor: default` is now `pointer`.
- `MainMap.tsx`:
  - Effect keyed on `[exploreSector, mapReady]` loads `sector.geojson`, finds the feature with matching `properties.id`, computes its bbox in lng/lat (new `computeBBox` walker), and `map.fitBounds(bbox, { padding: 60, maxZoom: 12, duration: 700 })`.
  - The same effect adds (or updates the filter on) three map layers backed by a shared `explore-sector-source`:
    - `explore-sector-dim` — fill `rgb(40,40,40) @ 0.35`, filter `['!=', ['get', 'id'], exploreSector]`
    - `explore-sector-active` — fill `rgb(225,89,137) @ 0.45`, filter `['==', ['get', 'id'], exploreSector]`
    - `explore-sector-active-line` — line `rgb(225,89,137)` width 2, same filter
  - Cleanup branch removes all three layers + the source when `exploreSector` returns to `null`.
- `SectorDetailPanel.tsx` (new) — floating top-center panel rendered from `layout.tsx`. Shows the zero-padded num + Russian title (inline table; same 13 names as the Sidebar) + a "Назад к рассказу" button. Esc and the × button both call `setExploreSector(null)`.
- `layout.css` — `.sidebar__sector` switched to pointer + hover/active styling; new `.sector-detail-panel*` rules (dark translucent card, coral accent, top-center positioning, z-index 20 so it floats over the map).

Decisions taken (per the plan's open questions):
- **Entry point**: any-time via sidebar click (plan's recommendation). No end-of-longread auto-CTA.
- **Sector ↔ name match**: `sector.geojson` features carry `properties.id` (1–13) verbatim — no lookup table needed.
- **Zoom**: `fitBounds` with 60 px padding, `maxZoom: 12`, 700 ms ease.
- **Exit**: Esc or the in-panel × / "Назад" buttons. **Not yet wired**: map-background-click exit, scroll-to-exit.

Deferred (not in MVP):
- `assets/sectors/sector-details.json` + `scripts/bake-sector-details.ts` — area / peak elevation / mountain count per sector. Awaiting design sign-off on what the detail panel should actually display (the plan calls these "data depends on what `sector.geojson` features carry"; the answer is "just name + id today" which doesn't justify the bake script yet).
- Hover preview (light up the corresponding sector on the map when the row is hovered).
- Mountain-triangle interaction inside explore mode — should work as-is (no syncLayers override added).
- Per-sector `mask_*` reuse — explore mode uses a simpler dim-fill on non-active sectors instead of the per-sector mask companions.

Awaits browser sign-off (manual): click sectors 01–13 in turn, confirm fly-to + highlight + panel content; close via × / Esc.

## Context

Frame 16 (the cover/intro state) lists 13 sectors in the sidebar under "Всё о секторах горного амфитеатра":

| # | Sector |
|---|---|
| 01 | Рощинский сектор |
| 02 | Белоостровский сектор |
| 03 | Лембольский сектор |
| 04 | Токсовский сектор |
| 05 | Румбольский сектор |
| 06 | Колтушский сектор |
| 07 | Саблинско-Красноборский сектор |
| 08 | Федоровский сектор |
| 09 | Дудергофско-Пулковский сектор |
| 10 | Аннинский сектор |
| 11 | Ропшинский сектор |
| 12 | Гостилицкий сектор |
| 13 | Пенинский сектор |

These match individual features in `Map-View-Client/src/assets/layers/sector.geojson` (the layer rendered by id_map=7's `Сектора` overlay).

Frame 42's pink-text designer note asks: "после окончания рассказа про устройство амфитетра. По каждому сектору есть 13 масок и 13 секторов (элементов). Можно ли сделать самостоятельное переключение элементов после окончания рассказа?" → "After the end of the story about the amphitheater's structure. For each sector there are 13 masks and 13 sectors (elements). Can we make independent toggling of elements after the end of the story?"

In other words: after the linear longread ends, the user should be able to click any sector and explore it independently — zoom, highlight, see its name/details.

## Current state

- `sector.geojson` is rendered as a single layer with the `sector_1` style when id_map=7 is active. All 13 sectors are visible together; the user can't isolate one.
- The sidebar sector list (planned in [01-toc-sidebar.md](01-toc-sidebar.md)) renders rows but they're inert.
- No mechanism for "after the story ends" — the longread just stops at row 36; nothing changes when the user reaches the bottom.

## Target state

After the longread reaches its last row (or via an explicit toggle), the user can:

1. **Click a sector in the sidebar** → map zooms to that sector's bbox, the sector is highlighted (bright fill), other sectors fade or hide.
2. **Click an empty area on the map** → exit exploration mode; restore the last id_map's overlay stack.
3. **Hover the sector list** → preview by lighting up the corresponding sector on the map.

Visually, "exploration mode" replaces the linear longread panel with a sector-detail panel showing: sector name, area, peak elevations within it, mountain count, etc. (Data depends on what `sector.geojson` features carry.)

## Approach sketch

This is a significant new mode. Decompose into sub-pieces:

### 1. Sector data

Inspect `sector.geojson`:
- Confirm each sector has a `name` property matching the sidebar list.
- Note any properties that could feed the detail panel (area, elevation stats, etc.).

If properties are sparse, derive at build time: for each sector polygon, compute area + filter `mountains.geojson` for points inside + take their max height. Bake as a per-sector summary into a `sector-details.json` manifest.

### 2. Exploration mode state

In `MainMap.tsx`:
```ts
type ExploreState = { sectorId: string | null }
const [explore, setExplore] = useState<ExploreState>({ sectorId: null })
```

When `sectorId !== null`:
- The longread panel is replaced by a `SectorDetailPanel` component.
- The map zooms (via `map.fitBounds`) to the sector's bbox.
- The active overlay stack is overridden: only that sector polygon renders at full opacity; others at 0.2 or hidden.

### 3. Sidebar click handler

`Sidebar.tsx` calls `setExplore({ sectorId: '01' })` (or the sector's name) when a sector row is clicked.

### 4. Exit transitions

- Esc → `setExplore({ sectorId: null })`.
- Click on the map outside any sector → same.
- Scroll the longread → same (assumes the user wants to go back to the story).

### 5. UI affordance

A clear "Исследовать сектор / Назад к рассказу" toggle button to switch between modes. Probably at the top of the sidebar or as a floating button.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/assets/sectors/sector-details.json` | **new**, baked from `sector.geojson` + `mountains.geojson` |
| `Map-View-Client/src/SectorDetailPanel.tsx` | **new** |
| `Map-View-Client/src/MainMap.tsx` | Add explore state; render `<SectorDetailPanel>` when active; override `syncLayers` to filter `sector.geojson` features |
| `Map-View-Client/src/Sidebar.tsx` | Wire sector-row click → `setExplore` |
| `scripts/bake-sector-details.ts` (or .js) | **new** build-time helper; runs `point-in-polygon` to compute per-sector mountain summaries |

## Verification

1. Reach the end of the longread (or click the explore-mode toggle).
2. Click a sector in the sidebar → map zooms to it, sector highlighted, others dimmed.
3. Sector detail panel shows sector name, total area, mountain count, highest peak.
4. Click another sector → smooth transition.
5. Esc / map background click → exit; longread restored.
6. Hover behavior gives visual feedback before commit.

### Visual verification

**N/A** — Frame 42 is a designer note (pink text question about post-story sector toggling), not a Figma frame of the implementation. The shared dashboard ([00-visual-test-framework.md](00-visual-test-framework.md)) does not cover this task; verification stays the manual walkthrough above (steps 1–6).

If design produces explore-mode mockups, register them in `frames.ts` with `taskOwners: ['09']` and a `hash` (would need a small extension to the parser, e.g. `#explore=sector:01`).

## Open questions

- **Entry point**: should explore mode be available only after reaching the end of the longread, or always via a sidebar toggle? Frame 42 says "после окончания рассказа", suggesting "after end of story". **Recommendation**: explore mode available any time via sidebar click; reaching the end of the longread doesn't auto-enter explore mode but maybe shows a CTA banner pointing to it.
- **Sector polygon vs sector name match**: confirm sector.geojson property names match the Russian titles in Frame 16. If they're transliterated or differ, build a lookup table.
- **Map zoom level on sector click**: fit the sector's bbox with padding, capped at z=12 to avoid extreme zooms for small sectors.
- **What about masks during exploration?** Each sector has a `mask_*` companion that darkens everything else. Reuse that mechanism for the "fade other sectors" effect.
- **Mountain triangle interaction inside a sector**: mountain triangles + popup should keep working seamlessly in explore mode.

## Phase

Phase 3 — significant scope. Needs design sign-off on:
- Exploration mode entry/exit UX.
- Sector detail panel content + layout.
- Visual treatment of dimmed/active sectors.

Estimated effort: ~6–8 h once design clarifies. Should land as its own PR after Phase 1/2 stabilizes.
