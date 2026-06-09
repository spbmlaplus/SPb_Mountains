# 10 — Content gaps (design/editorial side, no code)

## Context

The Figma frames anticipate content the team hasn't produced yet. This file is the durable list so nothing falls through the cracks; once content lands, the implementation pieces are well-trodden (mostly Sheet edits + new asset drops).

## Gap 1 — Chapters 03–08

Frame 16's sidebar lists 8 chapters but `drive/Описание лонгрида - лонгрид.csv` only has 2 (chapter 1 «Как устроен амфитеатр» rows 2–23; chapter 2 «Горы Петербурга — геологическая летопись» rows 24–37). Chapters 03–08 are placeholders awaiting:

| # | Title (from Frame 16) | Content needed |
|---|---|---|
| 03 | Горные дюны | Longread copy + which id_maps each section uses + base composition + per-section overlays |
| 04 | Имперские наблюдатели | Same |
| 05 | Наука и горы | Same |
| 06 | Стратегические высоты | Same |
| 07 | Современный досуг | Same |
| 08 | Угрозы и угрозы | Same (and: is "Угрозы и угрозы" the final name, or a typo? Likely "Угрозы и риски" or similar.) |

Each chapter likely introduces new id_maps with their own overlay stacks. That means new rows in `drive/Описание лонгрида - порядок слоев.csv` and possibly new base compositions or per-id_map deviations.

Until content exists, the sidebar (per [01-toc-sidebar.md](01-toc-sidebar.md)) renders these rows as disabled with a "Скоро" badge.

## Gap 2 — Glossary

The sidebar footer / nav lists "Глоссарий". No glossary content exists in the repo or Drive. Open questions for the content team:

- Is the glossary an inline panel that opens over the map, or a separate page?
- Is the glossary content per-chapter or global?
- What are the canonical Russian terms vs translations to define?

## Gap 3 — "О проекте" (About)

"О проекте" link in the sidebar. Needs a page or modal with project description, credits, contact, methodology. Same routing question as the glossary.

## Gap 4 — "Исследовать горы" (Explore Mountains)

Top-nav link. Probably a different mode than the sector exploration ([09-sector-exploration.md](09-sector-exploration.md)) — possibly a list/grid of all 229 mountains with names, heights, photos. Or an alternate map view focused on individual mountains.

Needs design clarification. Until then, the link is inert.

## Gap 5 — Inset diagrams (Frames 39, 40, 41, 47, 48, 49)

Tracked separately in [06-inset-diagrams.md](06-inset-diagrams.md). The data flow is solved there; what's missing is the actual diagram assets from design.

## Gap 6 — Mountain photo dataset growth

Today: 5 photos for 3 of 229 mountains. Each new photo only needs:

1. A high-res source PNG/JPEG named `{4-digit-id}.png` placed in `mountain_images_large/`.
2. Run `scripts/convert-mountain-images.sh` (proposed in [04-mountain-image-conversion.md](04-mountain-image-conversion.md)) to produce the WebP variants.
3. Update `mountains.geojson` so the corresponding feature has `"photo id": "{id}"`.

No code changes needed per photo.

## Gap 7 — Amphitheater_bound placeholder QML

Tracked in `Map-View-Client/src/assets/styles/amphitheater_bound.qml`. Replace with canonical QML when design ships it.

## Gap 8 — Frames 43, 45, 51 (no plan file)

The README's frame ↔ row table maps three frames to no plan file:

- **Frame 43** (id_map=8, Внутренняя граница) and **Frame 45** (id_map=9, Внешняя граница) — urban-patch overlays. The rendering pipeline (`ensureLayerOnMap` + manifest-driven styling) already handles these; the only thing missing is the actual `VECTOR_STYLES` color/opacity entries, which today live in `section-overlays.json` as the placeholders tracked in Gap 9 below (`historical_resettlement`, `amphitheater_bound_1`, etc.). **No code change** — closing this gap means design hands off the canonical paint values and we drop them into the manifest.
- **Frame 51** (chapter 2 intro, «Горы Петербурга — геологическая летопись», row 24) — content-only. The frame is a chapter-intro card; the layout is the same as Frame 31 (chapter 1 intro), which the longread already renders correctly. No new code, no new asset. Closes when the row 24 copy lands.

## Gap 9 — Other placeholder styles

Tracked in `Map-View-Client/src/assets/sections/section-overlays.json`:

| Style | Used by | Status |
|---|---|---|
| `elements` | id_maps 2–6 (stage, parter, …) | Placeholder, mirrors today's two-palette |
| `historical_resettlement` | id_map 9 mandatory | Placeholder, ochre |
| `amphitheater_bound_1` | id_map 9 optional | Placeholder, dashed gray |
| `landscape_450` | id_maps 10–13 mandatory | Placeholder, warm brown |
| `landscape_2,5` | id_maps 11–13 optional | Placeholder, ochre |
| `slope` | id_map 9 optional | Placeholder, muted olive |

All ship as `placeholder: true`. Swap with design hand-off.

## Visual verification

**N/A** — this file tracks content/editorial gaps with no code deliverable. The shared dashboard ([00-visual-test-framework.md](00-visual-test-framework.md)) does not cover this file. As gaps close (frames 43/45/51 get styled, chapters 03–08 land, etc.), the relevant per-task plan files own the visual verification.

## Process

When new content lands:

1. Design or content team drops assets / Sheet rows.
2. Open the corresponding file in this folder + the related runtime manifest.
3. Replace placeholder fields or add new rows.
4. Verify in dev server.

This file gets updated as new gaps surface and as existing gaps close.

## Phase

Phase 4 — perennial. Reviewed when this folder gets a major update.
