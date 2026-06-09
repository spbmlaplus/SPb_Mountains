# Deferred work

Items deliberately scoped out of this pass. Capturing them here so they're not forgotten.

## 2026-05-20 — Resolved by the carousel rewrite

The mobile shell was rewritten on 2026-05-20 (horizontal scroll-snap carousel — see `HANDOFF.md`). Items below this line that are now done:

- **`OverlayTogglePanel`** — no longer hidden on mobile. Visible on both layouts via the `.overlay-toggle-panel` class (was: inline-styles `right: 16` hidden behind the longread on desktop). Position: top-right of map area on both layouts. All section layers (including ones formerly marked `mandatory: true`) are listed and individually toggleable; the `mandatory` field is still on the type but is no longer enforced. The hardcoded `setLayerVisibility(map, 'mountains.geojson', !(idMap >= 10))` override in `MainMap.tsx` is gone — mountains now obey section JSON + user toggle, no chapter-wide default.
- **Map gesture cooperation** — `touch-action: pan-x` on the carousel rail and `pan-y` on each card resolves the gesture conflict natively. Single-finger swipes inside a card scroll the card; horizontal swipes outside (or past a vertical boundary) page the carousel. `cooperativeGestures` was not needed.
- **Double-hamburger source-order bug** (not originally listed here but worth recording): `layout.css` had `@media (min-width: 769px) { .mobile-top-bar { display: none } }` declared *before* the base `.mobile-top-bar { display: flex }`, so the cascade kept the topbar visible on desktop and stacked it under the sidebar hamburger. Fixed by moving the desktop-hide block to the end of `layout.css`.

Items below remain genuinely deferred.

---

## Mobile equivalents of desktop map overlays

These desktop UI patterns are `display: none` on mobile in Epic 3:

### `SectorDetailPanel`

On desktop: centered modal over the map, shows sector name + description + close button. Triggered by clicking a sector in the sidebar.

On mobile: currently a tap on a sector in `MobileMenu` is a no-op (just closes the menu). A proper mobile flow needs design — likely:
- Full-screen sheet (similar to `MobileMenu` but with sector content), OR
- Bottom sheet (via the existing vaul `Drawer` component, already in `src/components/ui/drawer.tsx`).

Open questions: what's shown beyond the title? Geographic bounding box → does the map fly to that sector? Photos?

### `OverlayTogglePanel`

On desktop: top-right checkbox list for optional map layers (e.g. extra geological overlays). Triggered by checking/unchecking.

On mobile: hidden entirely. A proper mobile flow needs design:
- Could live as a sub-page of `MobileMenu` (e.g. tapping "Слои" opens a sub-list).
- Or a small floating button on the map that opens a bottom sheet.

Open question: which layers does the user actually need to toggle on mobile? If only experts use this, hiding it on mobile may be fine permanently.

### `MountainPopup`

On desktop: clicking a mountain marker on the map shows a popup with the mountain's name, elevation, photo, and a "view fullscreen" link.

On mobile: hidden entirely. A proper mobile flow needs design:
- Tap mountain marker → bottom sheet with same content.
- Or modal overlay.

Open question: is map-marker interaction important on mobile, or is the longread the primary interaction model?

## Accessibility — return focus to trigger

Epic 5.3 focuses the close button when the menu opens. It does NOT return focus to the hamburger when the menu closes (the components are separate; would need a ref hoisted into context or layout).

Real-world impact: keyboard users who close the menu via X or Escape lose their tab position. Fix: keep a `lastTriggerRef` in context, set it from `MobileTopBar`, focus it from `MobileMenu`'s cleanup.

## Mobile bottom indicator (iOS home indicator)

Figma frame 1 shows the iOS home indicator at the bottom of a screenshot — that's a system artifact, not something to design. But the bottom 16–32px of the viewport on iOS Safari is occluded by the home indicator. Test on a real iPhone to confirm the longread's bottom padding (`padding: 1.25rem 1rem 4rem` from Epic 3) is enough.

If not, add `padding-bottom: env(safe-area-inset-bottom)` to `.longread` in the mobile media block.

## Dead CSS cleanup

`App.css:216–242` has a `@media (max-width: 900px)` block that targets `.app-shell`, `.hero`, `.places-list`, `.map-panel`, and `.map-container`. The first three selectors don't exist in the live DOM — they're remnants from an earlier layout. Cleanup is a one-line task, but out of scope here to keep this change focused.

## Footer nav wiring (О проекте / Глоссарий / Исследовать горы)

Both `Sidebar.tsx:193–197` and `MobileMenu` render these as static spans. They're not clickable. Wiring them to actual destinations (route? modal? scroll target?) is a separate piece of work — design hasn't specified what each leads to.

## Map gesture cooperation

When the map is `position: sticky` on mobile, one-finger drag inside the map area pans the map (MapLibre default). This is the right behaviour for map exploration but means users can't vertically scroll the page while their finger is on the map.

Alternative: MapLibre `cooperativeGestures: true` requires two fingers to pan/zoom inside an embedded map and lets one-finger drags scroll the page. Worth considering if users report scroll friction.

## Real-device perf testing

Epic 6.4 mentions testing on a real phone. If smoothness or paint flashing is observed during the base composition swap (chapter 1 → chapter 2 raster change), consider preloading both base layers on mobile.

## Frame 1 (full-bleed map intro)

Figma includes a "full-screen map" frame. Our design treats this as just the initial state of the sticky map + content (map is 45vh, but if the first content section is short, the map dominates the view). If design intended a true full-bleed intro that transitions to the sticky layout on scroll, that's a different interaction model — flag with design if they push back.
