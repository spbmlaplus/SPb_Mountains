# Epic 3 — Responsive CSS

## Goal

At `max-width: 768px`, flip the layout to: sticky map on top (~45vh), longread flowing below as document content. Hide the desktop sidebar and overlays. Above 768px, nothing changes.

## Dependencies

- Epic 2 (so we have `MobileTopBar` and `MobileMenu` to control visibility of).

## Why this epic exists

Today on a 375px viewport:
- `.app-shell` has hardcoded `grid-template-columns: minmax(320px, 440px) 1fr` (`App.css:4`). The dead `@media (max-width: 900px)` block at `App.css:216` tries to fix this, but `.app-shell` isn't in the live DOM — it's stale CSS.
- `.map-container` is `position: absolute; height: 100vh; width: 100%` (`App.css:116–124`).
- `.longread` is `width: 650px; height: 100vh; overflow-y: auto` (`App.css:134–143`), pinned to `right: 0` via `.longread-wrapper` (`App.css:126–132`).

Result: at 375px the user sees the left ~10px of the longread, the map is fully obscured, and there's nothing else to navigate.

We swap the geometry under `@media (max-width: 768px)`.

## Tasks

### 3.1 `Map-View-Client/src/App.css` — mobile media block

Add a new media block. Place it near the existing 900px block (around line 216). Don't touch the existing 900px block — it's dead but ripping it out isn't this task.

```css
@media (max-width: 768px) {
  .map-container {
    position: sticky;
    top: 0;
    height: 45vh;
    min-height: 45vh;
    box-shadow: none;
  }

  .longread-wrapper {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    z-index: auto;
  }

  .longread {
    width: 100%;
    height: auto;
    overflow-y: visible;
    padding: 1.25rem 1rem 4rem;
    font-size: 1.05rem;
  }

  .longread-header {
    font-size: 2rem;
  }

  .longread-content > .longread-content-title {
    font-size: 1.3rem;
  }

  .longread-content-item.is-active {
    transform: none;
  }

  /* Hide desktop-only overlays on mobile (deferred per scope decisions) */
  .mountain-popup,
  .overlay-toggle-panel {
    display: none !important;
  }
}
```

### 3.2 `Map-View-Client/src/layout.css` — mobile media block

Append after the existing `@media (max-width: 600px)` at line 289:

```css
@media (max-width: 768px) {
  .sidebar { display: none; }
  .sector-detail-panel { display: none; }
}

/* Inverse: hide mobile UI on desktop */
@media (min-width: 769px) {
  .mobile-top-bar { display: none; }
  .mobile-menu { display: none; }
}
```

The inverse rule lives outside the mobile block so it always applies on wide screens, regardless of media-query ordering.

### 3.3 Verify `.layout-main` accommodates the new flow

`.layout-main` at `layout.css:6–10` is `position: relative; min-height: 100vh`. That's fine — when `.map-container` becomes sticky and `.longread` becomes a normal flow child, the document height naturally extends past 100vh as content is added below. Sticky top works because `.layout-main` is the scroll container's nearest positioning ancestor with a non-static position.

Test point: confirm sticky map actually sticks during page scroll on mobile. If it doesn't, an ancestor probably has `overflow: hidden` or `transform`. Suspect `.map-panel` (`App.css:109–114`, `position: relative; width: 100%; height: 100%`). The `height: 100%` may collapse since `.layout-main` has `min-height: 100vh` not `height: 100vh`. **Fix if needed:** add to the mobile media block:

```css
.map-panel { height: auto; }
```

## Acceptance criteria

- At `≤ 768px`:
  - Map fills the upper 45% of the viewport and stays sticky as the user scrolls.
  - Longread content flows below the map, full width.
  - Desktop sidebar is invisible.
  - `OverlayTogglePanel`, `SectorDetailPanel`, and `MountainPopup` are invisible.
  - `MobileTopBar` and `MobileMenu` (added in Epic 2) are visible / available.
- At `≥ 769px`: layout pixel-identical to current baseline; mobile components invisible.

## Test plan

**Static checks:**
```bash
cd Map-View-Client
npm run lint
npm run build
```

**Mobile viewport (DevTools → device toolbar → iPhone 12 Pro, 390×844):**
1. Reload page. Expect:
   - Top bar with `☰` left, `МЛА+` right (Epic 2).
   - Map fills upper ~45% of viewport.
   - First section of longread starts immediately below the map, full width.
2. Scroll down slowly. The map should stay glued to the top — content scrolls past it.
3. Scroll further. Confirm:
   - The map is still pinned at the top of the visible viewport.
   - You don't see `OverlayTogglePanel` (was top-right on desktop).
   - You don't see `MountainPopup` even if you tap on a mountain marker (it's now `display: none`).
4. Open `MobileMenu` → click a sector → menu closes → no `SectorDetailPanel` appears (it's CSS-hidden).

**Boundary test (resize across 768/769):**
5. Drag DevTools viewport from 320px slowly to 1200px. At 769px there should be a clear visual transition:
   - Below 769px: mobile layout, top bar visible, sidebar invisible.
   - At/above 769px: top bar invisible, sidebar visible, longread snaps to 650px right pane.
6. Drag back down. Reverse transition is clean.

**Desktop regression (1280×800 window):**
7. Open in a real desktop window. Confirm:
   - Sidebar (collapsed 48px on left) visible.
   - Map fills viewport with longread pinned right at 650px.
   - Top bar and mobile menu invisible.
   - Active section underline and translateX shift on `.longread-content-item.is-active` still work.

**Sticky map check (the one that's most likely to fail):**
8. On mobile viewport, scroll down. The map MUST stay at the top of the visible area. If it scrolls away, an ancestor has `overflow: hidden` or a transform — apply the `.map-panel { height: auto; }` fix from task 3.3.

**Done when:** every checklist item passes; lint + build green.

---

## Verification log — 2026-05-19

**Status: ✅ Done (automated checks). Visual sticky-map + boundary-resize pass still needs a human.**

### Automated checks (passed)

| Check | Result |
|---|---|
| `npm run lint` | ✅ Clean |
| `npm run build` (`tsc -b && vite build`) | ✅ `built in 1.61s`. Pre-existing chunk-size warning unchanged. CSS bundle: 98.21 → 98.86 kB (+0.65 kB) — the new media blocks. |
| `App.css` mobile block | ✅ Appended after the existing 900px block; contains `.map-panel { height: auto; padding: 0 }`, `.map-container { position: sticky; top: 0; height: 45vh; ... }`, `.longread-wrapper { position: relative; ... }`, `.longread { width: 100%; height: auto; ... }`, font-size overrides, `.longread-content-item.is-active { transform: none }`, and `display: none !important` for `.mountain-popup, .overlay-toggle-panel`. |
| `layout.css` mobile block | ✅ Appended after the 600px block; `@media (max-width: 768px)` hides `.sidebar` and `.sector-detail-panel`. |
| `layout.css` desktop-inverse block | ✅ `@media (min-width: 769px)` hides `.mobile-top-bar` and `.mobile-menu`. |
| Built CSS bundle | ✅ Both 768px occurrences present (grep on `dist/assets/index-*.css`); minified to single line. |
| Vite dev server | ✅ `ready in 122 ms`, no errors. |
| `GET /Map-View-Client/src/App.css` | ✅ HTTP 200, mobile block visible in response. |
| `GET /Map-View-Client/src/layout.css` | ✅ HTTP 200, both 768px and 769px blocks visible in response. |
| Cohabitation with Epic 2 | ✅ Epic 2's agent added base `.mobile-top-bar` / `.mobile-menu` styles to `layout.css` AFTER my media blocks. Order is correct — base styles render the chrome, media queries control visibility. No merge conflict, no overlap. |

### Applied preemptively

The plan's task 3.3 called out a potential `.map-panel { height: 100% }` collapse on mobile if `.layout-main` doesn't expand. I applied the suggested fix (`.map-panel { height: auto; padding: 0 }`) upfront rather than waiting for the test pass to flag it — cheaper than a round-trip and matches the intent.

### Still pending (require human in browser)

- Visual confirmation that the map is actually sticky (scrolls under, not away).
- Boundary resize across 768/769 — clean transition both directions.
- Desktop regression check at 1280×800 (sidebar, longread 650px right, active-section underline + translateX still work).
- Confirmation overlays (`OverlayTogglePanel`, `SectorDetailPanel`, `MountainPopup`) really are invisible on mobile.

These need a real browser session. No automation tooling is installed in this project per CLAUDE.md.

### Files modified

- `Map-View-Client/src/App.css` (+44 lines: new `@media (max-width: 768px)` block at the end)
- `Map-View-Client/src/layout.css` (+22 lines: new 768px and 769px blocks after the existing 600px block)
