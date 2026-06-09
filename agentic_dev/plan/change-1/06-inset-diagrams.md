# 06 — Inset diagrams anchored to longread sections

## Status

**Code wired 2026-05-16; awaiting design assets.** All scaffolding shipped:

- `SectionOverlay.inset_images?: string[]` (type in `sectionOverlays.ts`, passthrough from manifest).
- Manifest entries in `Map-View-Client/src/assets/sections/section-overlays.json` for id_maps 5, 6, 7, 11, 12, 13 (placeholder filenames per the Approach section below).
- `import.meta.glob('./assets/insets/*.{webp,svg,png}', { eager: true })` + `insetUrlByName` lookup in `MainMap.tsx`.
- Per-item rendering: each `.longread-content-item` now wraps a `.longread-content-item-body` (innerHTML) sibling-of inset `<img>`s. Missing-asset guard returns `null` rather than rendering a broken image, so the manifest can carry placeholder names with no runtime fallout.
- `.longread-inset` CSS in `App.css` (220 px, centered, 4 px radius, stacked-with-gap when multiple).

Deviations from the plan's example JSON, both grounded in the Frame verification table below:
- **id_map=7** reuses `sector-wedge-diagram.webp` (Frame 41 shows the same diagram as Frame 40 — the plan example JSON only listed 5, 6, 11; 7 added by analogy).
- **id_map=12** gets a second placeholder `era-12-glacier.webp` to match "Devonian + glacier diagrams" in Frame 48's verification row.

**Still blocked on**: design handing off canonical `.webp`/`.svg` assets into `Map-View-Client/src/assets/insets/` (see [10-content-gaps.md](10-content-gaps.md) Gap 5). Drop them in and they appear automatically.

## Context

Frames 39, 40, 41, 47, 48, 49 each show a small illustrative diagram at the bottom of the right panel:

- **Frame 39 (Балкон / id_map=5)**: architectural cross-section labeled СЦЕНА / ПАРТЕР / БЕЛЬЭТАЖ / БАЛКОН / АМФИТЕАТР. ~220 px wide.
- **Frame 40 (Вомитории / id_map=6)**: top-down sector diagram showing wedges around a central stage.
- **Frame 41 (Сектора / id_map=7)**: same sector diagram, plus a "Как мы очертили «сцену»" transition heading.
- **Frame 47 (2,5 млн лет / id_map=11)**: geological cross-section showing "Море" + plate margins. Plus a second diagram showing "Ледник" with named массивы.
- **Frame 48 (12 тыс. лет / id_map=12)**: two diagrams — one Devonian period, one with ледник arrows over named плато.
- **Frame 49 (7 тыс. лет / id_map=13)**: cross-section showing the глинт and plateaus + Quaternary diagrams.

These are static illustrations — not maps. They live inline in the longread panel at the end of the section text.

## Current state

- `ContentItem` carries `id, title, fileList, description, id_map?, base_id?`. No image/diagram field.
- The longread `.longread-content-item` renders only the description HTML.

## Target state

Optional inset image per `ContentItem`. When present, render at ~220 px wide below the description text, with a thin border-radius and a faint caption (style name + license credit if any).

## Approach

### Data

Two options:

1. **Sheet schema delta** — add a new column "Media Link" (already exists in the longread CSV at column C, currently unused) or a dedicated "inset_images" column. Each row's value is a comma-separated list of filenames matching bundled assets in `Map-View-Client/src/assets/insets/`.
2. **Manifest-driven** — extend `section-overlays.json`'s set entries with an optional `inset_images` field per id_map, since insets are clearly tied to id_maps (not arbitrary rows).

**Recommendation**: option 2 (manifest-driven) — keeps the Sheet schema simple and aligns with the existing per-id_map design intent.

### Manifest change

Use `inset_images: string[]` (always an array, even of length 1) so Frame 47 — which shows two diagrams (Море cross-section + Ледник massif diagram) — works without a schema change later:

```json
"sets": {
  "5": {
    "default_base": 1,
    "inset_images": ["amphitheater-cross-section.webp"],
    "layers": [ ... ]
  },
  "6": {
    "default_base": 1,
    "inset_images": ["sector-wedge-diagram.webp"],
    "layers": [ ... ]
  },
  "11": {
    "default_base": 3,
    "inset_images": ["era-25-silurian-sea.webp", "era-25-silurian-glacier.webp"],
    "layers": [ ... ]
  }
}
```

**Filenames are placeholders** — design has not handed off the canonical asset names. The manifest can land with these guessed names + the assets stubbed; ownership of "what's the real filename" is a design dependency tracked in [10-content-gaps.md](10-content-gaps.md) Gap 5.

### Asset folder

```
Map-View-Client/src/assets/insets/
  amphitheater-cross-section.webp
  sector-wedge-diagram.webp
  era-450-ordovician.webp
  era-25-silurian-sea.webp
  era-25-silurian-glacier.webp
  era-12-devonian.webp
  era-7-quaternary.webp
```

Bundle via `import.meta.glob`. Use WebP for size; if design ships as SVG, ship as SVG instead — that's lossless and scales.

### Render

In `MainMap.tsx`, alongside the description block:

```tsx
{activeOverlay?.inset_images?.map((name) => (
  <img
    key={name}
    src={insetUrlByName[name]}
    alt=""
    className="longread-inset"
  />
))}
```

Position: in the longread panel, after the active item's description. Width 220 px each, centered, stacked vertically when multiple. Click → optional zoom (could reuse [03-mountain-info-popup.md](03-mountain-info-popup.md)'s modal pattern).

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/assets/sections/section-overlays.json` | Add `inset_images` field (array of strings) to relevant sets |
| `Map-View-Client/src/sectionOverlays.ts` | Add `inset_images?: string[]` to `SectionOverlay` type |
| `Map-View-Client/src/MainMap.tsx` | Read `inset_images`, render `<img>` per entry in longread |
| `Map-View-Client/src/App.css` (or `layout.css`) | `.longread-inset` styles |
| `Map-View-Client/src/assets/insets/*.webp` | **new** assets, from design |

## Verification

1. Scroll to Балкон section (id_map=5) — amphitheater cross-section appears at the bottom of the longread panel.
2. Scroll to Вомитории (id_map=6) — sector diagram appears.
3. Scroll to chapter 2 sections (id_map=11–13) — era-appropriate geological diagrams appear.
4. Sections without inset (id_map=1, 2, 3, 4, 7, 8, 9, 10) render normally — no empty `<img>` placeholder.

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 39 | `#id_map=5` | Amphitheater cross-section inset (Балкон) |
| 40 | `#id_map=6` | Sector wedge diagram inset (Вомитории) |
| 41 | `#id_map=7` | Sector diagram inset (Сектора) |
| 47 | `#id_map=11` | Two geological diagrams (Море + Ледник) |
| 48 | `#id_map=12` | Devonian + glacier diagrams |
| 49 | `#id_map=13` | Quaternary cross-section + diagrams |

Run `npm run visual:task -- 06` after implementation (and after design ships the actual inset assets). Review `.claude-reports/visual/<timestamp>/task-06/index.html`.

Masks: map tile area + the upper portion of the longread copy panel (standard). The inset region at the bottom of the longread panel is unmasked — that's the deliverable.

Human sign-off: each frame's expected inset(s) appear at the bottom of the longread panel at approximately the size and position the Figma frame shows. Until design ships canonical assets, the diff will show placeholder-vs-Figma mismatches; that's expected.

## Open questions

- **Asset format**: PNG, WebP, or SVG? **Recommendation**: SVG if design delivers it (scalable, smaller for line-art diagrams). WebP otherwise.
- **Click to zoom**: reuse the modal/lightbox infrastructure from mountain photos? **Recommendation**: defer until the design team confirms whether the inset diagrams need a zoom interaction at all. Likely yes for the geological diagrams.

## Phase

Phase 2.5 — gated on design delivering the inset assets. Until then, the manifest fields stay empty and nothing renders.
