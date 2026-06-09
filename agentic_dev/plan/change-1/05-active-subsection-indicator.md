# 05 — Active-subsection indicator (red underline in longread)

## Status

**Implemented 2026-05-16** — Path A shipped. CSS rule added at `Map-View-Client/src/App.css:181-184`. Awaiting browser sign-off (manual until plan 00's visual-test framework lands).

## Context

Frames 35–41 (Сцена / Партер / Бельэтаж / Балкон / Вомитории / Сектора) show the longread right panel with a small text indicator: the bolded subsection name (e.g. "**Сцена**") has a 2 px red underline beneath it, marking it as the currently-active section. The rest of the section text is rendered normally.

Today the longread renders each `ContentItem.description` with `dangerouslySetInnerHTML` — the HTML can have inline `<b>Сцена</b> — ...` etc., but there's no visual indication of which item the scroll position has selected.

## Current state

- `MainMap.tsx:711–720` renders `contentItems.map((item) => <div … />)` with `className='is-active'` toggled on the matching item.
- `.longread-content-item.is-active` is styled in CSS but the visual delta (per `App.css` / `layout.css`) is subtle or absent.

## Target state

When `activeItemId === item.id`, the section name inside that item gets a 2 px solid underline in `rgb(225, 89, 137)` (the same coral-red the sidebar TOC uses for active chapters). Inactive items render without the underline.

## Approach

Two paths depending on how strictly we want to match the frames.

### Path A — CSS-only

Add a rule:
```css
.longread-content-item.is-active b:first-child {
  border-bottom: 2px solid rgb(225, 89, 137);
  padding-bottom: 2px;
}
```

This underlines the **first `<b>`** inside the active item — which is the section name in every sample row (e.g., "<b>Сцена</b> — центральное пространство…"). Simplest and zero-risk.

### Path B — explicit subsection label field

Extend `ContentItem` with optional `subsectionLabel?: string`, render it as a styled `<h3>` above the description, and only underline that element. Cleaner separation but requires Sheet-schema work.

**Recommendation**: ship Path A in this workstream. Path B becomes relevant when content team wants more layout control.

## Files to touch

| File | Change |
|---|---|
| `Map-View-Client/src/App.css` (or `layout.css`) | Add the `.is-active` underline rule |

## Verification

1. Scroll through chapter 1 sections (Сцена, Партер, …, Сектора). Each section's bolded label gets the underline as it becomes active. Previous section loses its underline.
2. Visual match against Frames 35, 37, 38, 39, 40, 41.
3. No regression on chapter intros (rows without bolded leading labels — they just show no underline, which is fine).

### Visual verification

Owned Figma frames (registered in `Map-View-Client/visual-tests/frames.ts`):

| Frame | Hash | Look for |
|---|---|---|
| 35 | `#id_map=2` | Bold "Сцена" underlined in coral |
| 37 | `#id_map=3` | Bold "Партер" underlined |
| 38 | `#id_map=4` | Bold "Бельэтаж" underlined |
| 39 | `#id_map=5` | Bold "Балкон" underlined |
| 40 | `#id_map=6` | Bold "Вомитории" underlined |
| 41 | `#id_map=7` | Bold "Сектора" underlined |

Run `npm run visual:task -- 05` after implementation. Review `.claude-reports/visual/<timestamp>/task-05/index.html`.

Masks: map tile area (standard). The **longread copy panel is NOT masked here** — the underline is the deliverable and lives in that panel. The Russian copy underneath the bold word may still vary (CSV-driven), so expect some diff there; the underline pixel rows should clearly match.

Human sign-off: the 2 px coral underline is present under the bold first word of the active section in every frame.

## Open questions

- Should the underline persist after the user scrolls past (so all already-seen subsections stay underlined)? **Recommendation**: no, follow the frames — only the current section is highlighted. Mirrors typical scroll-spy UX.
- Color exactness vs the `rgb(225, 89, 137)` placeholder — design has used this exact color for `stage` and `sectors_level` line colors in `base-composition-1.json`. Reuse for consistency.

## Phase

Phase 2.5 — schedule for the PR immediately after the sidebar/mountains PR lands.
