# Epic 6 — End-to-end verification

## Goal

Confirm the mobile layout works end-to-end across realistic viewports and that the desktop layout has zero regressions. This is the sign-off pass before considering the work shippable.

## Dependencies

- Epics 1–5 complete.

## Tasks

### 6.1 Static gates

```bash
cd Map-View-Client
npm run lint        # must be clean
npm run build       # tsc -b && vite build — must succeed, no TS errors
```

### 6.2 Cross-viewport manual pass

Test in Chrome DevTools' device toolbar at each of these sizes:

| Device | Width × Height | Notes |
|---|---|---|
| iPhone SE | 375 × 667 | Tightest realistic mobile |
| iPhone 12 Pro | 390 × 844 | Reference for Figma frames |
| Pixel 5 | 393 × 851 | Android baseline |
| iPad Mini (portrait) | 768 × 1024 | At the boundary — should still be mobile |
| iPad Mini (landscape) | 1024 × 768 | First desktop width — should be desktop |
| Desktop | 1280 × 800 | Wide desktop baseline |

For each viewport, walk the checklist in §6.3.

### 6.3 Behaviour checklist

**Initial render:**
- [ ] Page loads without console errors.
- [ ] At ≤ 768px: `MobileTopBar` visible with `☰` top-left and `МЛА+` top-right. Map fills upper ~45vh. Longread starts immediately below the map.
- [ ] At ≥ 769px: Left sidebar visible (collapsed by default to 48px). Map fills viewport with `.longread` pinned right at 650px. No `MobileTopBar`.

**Map sticky behaviour (mobile only):**
- [ ] Scroll down — map stays glued to the top.
- [ ] Scroll all the way to the bottom — map is still pinned at the top of the viewport.

**Active section tracking:**
- [ ] On mobile, as user scrolls, the active section's pink underline updates to whichever section's center is closest to the visible region's midpoint (between 45vh and 100vh).
- [ ] On desktop, scrolling inside `.longread` updates active section as before.
- [ ] In both modes, scrolling to bottom forces the last item to be active even if it's only partially visible.

**Base composition swap:**
- [ ] On mobile, scroll from chapter 1 into chapter 2 (id_map ≥ 10) — base map raster visibly changes (relief opacity drops to 0.4 per `migration-implementation-plan.md`).
- [ ] On desktop, same behaviour as baseline.

**Mobile menu:**
- [ ] Tapping `☰` opens the menu with a smooth 200ms fade.
- [ ] Menu shows: header bar with `X` + `МЛА+`, "Всё о горных просторах Петербурга" heading, 8 chapters (active in pink), divider, footer row (О проекте / Глоссарий / Исследовать горы), "Всё о секторах горного амфитеатра" heading, 13 sectors.
- [ ] Body doesn't scroll while menu is open.
- [ ] Menu itself scrolls vertically if content exceeds the viewport (test on iPhone SE 375×667 — likely needed).
- [ ] Tapping a chapter (e.g. 02) closes the menu and smooth-scrolls so the chapter-2 first item is positioned just below the sticky map with ~16px padding.
- [ ] Tapping a sector closes the menu and does nothing else (no `SectorDetailPanel` appears on either resize).
- [ ] Tapping `X` closes the menu, scroll position preserved.
- [ ] Pressing Escape closes the menu (keyboard).

**Hidden overlays on mobile:**
- [ ] `OverlayTogglePanel` not visible.
- [ ] `MountainPopup` doesn't appear even when tapping mountain markers.
- [ ] `SectorDetailPanel` doesn't appear even if `exploreSector` somehow gets set.

**Desktop regression checks:**
- [ ] Sidebar expand/collapse works (collapsed = 48px, expanded = 260px).
- [ ] Clicking chapter in sidebar scrolls `.longread`.
- [ ] Clicking sector opens `SectorDetailPanel` centered on the map.
- [ ] `OverlayTogglePanel` (top-right) shows layer toggles, they work.
- [ ] Mountain markers on the map show `MountainPopup` on click.
- [ ] Photo modal opens (`MountainPhotoModal` + `MountainPhotoFullscreen`).
- [ ] URL hash `#sidebar=expanded` still expands the sidebar on load.
- [ ] URL hash `#item=<id>` still scrolls `.longread` to that item.

**Boundary resize:**
- [ ] Slowly drag DevTools width from 320 to 1200. Transition at 768/769 is clean — no flash, no console errors, no listener leak.
- [ ] Drag back. Reverse transition is clean.

**Console:**
- [ ] No errors or warnings during any of the above.
- [ ] No React warnings about missing keys, dependency arrays, or `setState` on unmounted components.

### 6.4 Real device test (optional but recommended)

Plug a phone into the laptop (or use the local network):
```bash
npm run dev -- --host 0.0.0.0
```
Connect from the phone to `http://<laptop-ip>:5173/Map-View-Client/`. Walk through §6.3's mobile-relevant items.

Look specifically for:
- Touch responsiveness on the hamburger and menu items.
- Map pan/zoom gestures inside the sticky map area — do they work? Do they conflict with page scroll? (Expected: touching the map pans the map; touching content area scrolls the page. Document any surprises.)
- Performance — is scrolling smooth? Does the base composition swap stutter?

### 6.5 Sign-off

If every checkbox in §6.3 is ticked and the static gates pass, the work is shippable. Open a PR with a screenshot of mobile (Figma-matching) and a screenshot of desktop (proof of no regression).

## Acceptance criteria

- All static gates pass.
- Every checkbox in §6.3 ticks at every viewport size in §6.2.
- No console errors.
- Real-device pass (if performed) shows no surprises beyond the documented gesture-conflict behaviour.

## Test plan

This epic IS the test plan. The work is "done" when this checklist is complete.
