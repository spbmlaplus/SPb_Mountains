# `plan/` — design-vs-build tracker

This folder is the durable record of "what the Figma frames promise" vs "what the React app does today" and how we close the gap. One file per workstream. Read this README first; each numbered file is largely self-contained, but a few have hard dependencies — see the "Depends on" column in the index below before picking one up.

The frames are in `/Users/dodonovpavel/gavr_mounty/gavr_mounty/figma_frames/`. The longread copy is in `/Users/dodonovpavel/gavr_mounty/gavr_mounty/drive/Описание лонгрида - лонгрид.csv`. The runtime app lives in `Map-View-Client/`.

## Phasing

| Phase | Files | Status |
|---|---|---|
| **This PR** (mountains + sidebar) | 04 → 02 → 01 → 03 | Approved 2026-05-16. **01 shipped 2026-05-16** — `Sidebar` + `MapInteractionContext` live; collapsed/expanded states, 8 chapters + 13 sectors render; Frame 30 visual diff 0.05%, Frame 16 48.77% (residual noise = un-rendered triangles — closes once 02 is exercised in the same capture). **02 shipped 2026-05-16** — `point-symbol` style + chapter-2 visibility gate live in code; visual sweep clean (chapter-1 frames 1.6–4.6%, chapter-2 frames 0.07–7.1%); human design sign-off on `.claude-reports/visual/<ts>/task-02/index.html` still pending. **04 shipped 2026-05-16** — `cwebp` run produced 10 WebPs at `Map-View-Client/src/assets/mountain_images/`; `mountainPhotos.ts` wired and now consumed by 03. **03 shipped 2026-05-16** — `MountainPopup` / `MountainPhotoModal` / `MountainPhotoFullscreen` live; click triangle → popup with name + height + optional thumb; thumb → modal → fullscreen; Esc/outside-click unwind one stage at a time. Outstanding: `1301`/`1302` `photo id` linkage in `mountains.geojson` (design input). |
| Phase 2.5 (UI polish) | 05, 06 | **05 shipped 2026-05-16** (CSS-only). **06 wired 2026-05-16** — type/manifest/render/CSS all in code; rendering is gated by file presence in `Map-View-Client/src/assets/insets/`, blocked on design handoff ([10](10-content-gaps.md) Gap 5). |
| Phase 3 (base-map fidelity + sector mode) | 07, 08, 09 | **07 + 08 shipped 2026-05-16** — base #1 now appends CartoCDN `light_only_labels` (opacity tunable from manifest); base #3 swapped from `opacity: 0.4` to a 3-knob `paint` block (`raster-opacity` / `raster-saturation` / `raster-brightness-max`). Both compositions tunable from their JSONs without code edits. **09 MVP wired 2026-05-16** — `MapInteractionContext.exploreSector` + Sidebar wiring + `MainMap` fitBounds/highlight/dim layers + `SectorDetailPanel` (Esc/× to exit). Deferred: per-sector bake script (area/peak/mountain count), hover preview, map-background-click exit. Awaits browser sign-off. |
| Phase 4 (content gaps) | 10 | Design/editorial side; no code change |

## Parallelism — who can fan out vs who must sequence

"Parallel" here means *separate branches landing as separate PRs*. Soft conflicts (same file, different region) cause merge friction, not blockers. Hard dependencies are listed in the "Depends on" column of the index.

### Phase 1 (this PR) — fan out to 3 workers, then converge on 03

| Worker | Task | Conflict surface |
|---|---|---|
| A | **04** — image conversion | Independent. Run script, link `1301`/`1302`, commit WebPs. Minutes of work; should land first. |
| B | **02** — triangle rendering | Independent of 01. Touches `layerStyles.ts`, `section-overlays.json`, and the `ensureLayerOnMap` branch of `MainMap.tsx`. |
| C | **01** — sidebar | Independent of 02. Touches new `Sidebar.tsx` + `MapInteractionContext.tsx`, `layout.tsx`/`layout.css`, and the `ContentItem` type in `MainMap.tsx`. |
| D | **03** — popup | **Blocked on A + B.** Needs 04's WebP assets and 02's triangle layer (the popup attaches click + hover handlers to the symbol layer). |

B and C both edit `MainMap.tsx` but in non-overlapping regions (B: `ensureLayerOnMap` ~lines 400s; C: `ContentItem` type + a new context near the component root). Plan on a small merge but no semantic conflict.

### Phase 2.5 — 2 workers in parallel; 05 can even ride alongside Phase 1

| Worker | Task | Conflict surface |
|---|---|---|
| A | **05** — active-subsection underline | Pure CSS, one rule in `App.css` or `layout.css`. Zero conflict surface — safe to ship anytime, including while Phase 1 is still in flight. |
| B | **06** — inset diagrams | Code skeleton (schema + render) is independent of 05 and can start in parallel; the actual assets are blocked on design handoff (see [10-content-gaps.md](10-content-gaps.md) Gap 5). |

### Phase 3 — 2 workers, with care around 07/08

| Worker | Task | Conflict surface |
|---|---|---|
| A | **07 + 08 together** — positron labels + base-3 desaturation | Same worker for both. Both modify `baseCompositions.ts` (the `RasterEntry` type) and `addBaseComposition` in `MainMap.tsx`. Sequencing them on one branch avoids paint-block conflicts. |
| B | **09** — sector exploration | Blocked on 01 having shipped (the sidebar must exist to wire sector clicks). Once unblocked, mostly independent from 07/08 — own state machine, own Sidebar handler, own map interaction layer. |

### Phase 4 — 10 is a perennial doc

One owner. Update as content gaps surface and close.

### Critical-path summary

- Phase 1's critical path is **04 → 03** (D waits on A) and **02 → 03** (D waits on B). Sidebar (01) runs alongside without affecting the critical path.
- Phase 3's critical path is **01 → 09**, which spans phases. If 09 is high priority, prioritize 01's merge.

## Visual verification

A shared visual-fidelity dashboard captures the running app against the Figma frames per task and emits an HTML report. Owned by [00-visual-test-framework.md](00-visual-test-framework.md).

- **One command, zero user input**: `cd Map-View-Client && npm run visual`.
- **Per-task filter**: `npm run visual:task -- 05` runs only the frames plan 05 owns.
- **Output**: `.claude-reports/visual/<timestamp>/index.html` plus one `task-NN/index.html` per owner.
- **Comparison, not pass/fail**: map raster tiles + real CSV copy + system fonts create a 15–30% inherent noise floor. The mismatch % is data for human design sign-off, not a CI gate.
- **Each Phase-1+ plan file** has a "Visual verification" subsection listing the Figma frames it owns. Plans 03, 04, 09, 10 are N/A (no Figma frame corresponds to the deliverable, or the deliverable isn't visual).

The framework also adds URL-hash deep-linking (`#id_map=N`, `#item=<id>`, `#sidebar=expanded`) as a real product feature — shareable section links. See `00-visual-test-framework.md` for the full design.

## Frame ↔ longread row correlation

Best-guess mapping of `figma_frames/Frame NN.png` to rows in `drive/Описание лонгрида - лонгрид.csv`. The Figma export numbers are arbitrary export IDs, not tied to id_map values.

| Frame | CSV row(s) | Subject |
|---|---|---|
| 16 | (cover) | Landing/intro shell — chapter TOC sidebar expanded, sector list expanded, 229 mountain triangles rendered. Not in лонгрид.csv. |
| 30 | (cover) | Same shell, sidebar collapsed to vertical labels. "No chapter active yet" state. |
| 31 | row 2 | Chapter 1 intro with Nazarov photo + longread right panel. |
| 36 | row 5 | Transitional intro — clean light base, central scene boundary drawn. |
| 35 | row 6 | Сцена (id_map=2) — first map id_map; "Сцена" highlighted with red underline. |
| 37 | row 7 | Партер (id_map=3). |
| 38 | row 8 | Бельэтаж (id_map=4). |
| 39 | row 9 | Балкон (id_map=5) — bottom-right inset architectural cross-section diagram. |
| 40 | row 10 | Вомитории (id_map=6) — sector diagram inset bottom-right. |
| 41 | row 11 | Сектора (id_map=7) — sector diagram inset + transition copy. |
| 42 | (designer note) | Pink-text question to devs about post-story sector toggling. Not an implementation frame. |
| 43 | rows 13–14 | Внутренняя граница (id_map=8) — red urban patches showing inner boundary. |
| 45 | rows 19–20 | Внешняя граница (id_map=9) — outer boundary highlighted. |
| 51 | row 24 | Chapter 2 intro («Горы Петербурга — геологическая летопись», id_map=1 in ch.2 context). |
| 46 | row 26 | 450 млн лет (id_map=10) — monochrome relief + ordovician plateau patch. |
| 47 | row 29 | 2,5 млн лет (id_map=11) — Silurian period + sea/ice cross-section diagrams. |
| 48 | row 32 | 12 тыс. лет (id_map=12) — Devonian + glacier diagrams. |
| 49 | row 35 | 7 тыс. лет (id_map=13) — Quaternary + final landscape diagrams. |
| 44 | (mobile/composite) | Tall narrow composite of the chapter-1 column — preview of mobile/scroll experience. |

Row references are 1-based and match the line numbers in `drive/Описание лонгрида - лонгрид.csv`.

## Index

| # | File | Workstream | Depends on |
|---|---|---|---|
| 00 | [00-visual-test-framework.md](00-visual-test-framework.md) | Shared visual-fidelity dashboard (Playwright + pixelmatch + HTML report) | — |
| 01 | [01-toc-sidebar.md](01-toc-sidebar.md) | Permanent collapsible left sidebar with 8 chapters + 13 sectors | — |
| 02 | [02-mountains-triangle-rendering.md](02-mountains-triangle-rendering.md) | Render `mountains.geojson` as ▲ symbols instead of circles | — |
| 03 | [03-mountain-info-popup.md](03-mountain-info-popup.md) | Click handler + popup with name/height/photo + 3-stage zoom | 04 (WebP assets), 02 (triangle layer) |
| 04 | [04-mountain-image-conversion.md](04-mountain-image-conversion.md) | Convert `mountain_images_large/*.png` → `src/assets/mountain_images/*.webp` | — |
| 05 | [05-active-subsection-indicator.md](05-active-subsection-indicator.md) | Red underline on active subsection in the longread panel | — |
| 06 | [06-inset-diagrams.md](06-inset-diagrams.md) | Static illustrative diagrams anchored to longread sections | — |
| 07 | [07-positron-labels.md](07-positron-labels.md) | City/town labels overlay for chapter 1 | — |
| 08 | [08-base-3-tuning.md](08-base-3-tuning.md) | Tune chapter-2 base composition (#3) to match frame fidelity | 02 (mountain visibility rule lives there) |
| 09 | [09-sector-exploration.md](09-sector-exploration.md) | Post-story mode: toggle the 13 sectors individually | 01 (sidebar must wire sector clicks) |
| 10 | [10-content-gaps.md](10-content-gaps.md) | Chapters 03–08 + glossary/about pages — design/editorial side | — |

## Cross-references

- Architecture, build, deploy: `../HANDOFF.md`, `../migration-implementation-plan.md`.
- Repo guide: `../CLAUDE.md`.
- Base composition manifests: `../Map-View-Client/src/assets/styles/`.
- Per-section overlay manifest: `../Map-View-Client/src/assets/sections/section-overlays.json`.
- Source data: `../drive/`, `../mountain_images_large/`, `../figma_frames/`.
