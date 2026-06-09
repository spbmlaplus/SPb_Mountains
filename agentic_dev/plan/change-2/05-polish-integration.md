# Epic 5 — Polish + integration

## Goal

Tighten edges: smooth menu transitions, accessibility, and confirmed no-regression on desktop.

## Dependencies

- Epics 1–4 complete.

## Tasks

### 5.1 Menu fade-in / fade-out (200ms)

In `MobileMenu.tsx`, instead of returning `null` when `mobileMenuOpen === false`, always render the overlay and toggle a class:

```tsx
return (
  <div
    className={`mobile-menu ${mobileMenuOpen ? 'mobile-menu--open' : ''}`}
    aria-hidden={!mobileMenuOpen}
    aria-modal="true"
    role="dialog"
  >
    {/* ... */}
  </div>
)
```

CSS:
```css
.mobile-menu {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}
.mobile-menu--open {
  opacity: 1;
  pointer-events: auto;
}
```

(Keep the existing `display: none` desktop override from Epic 3.2 — `display: none` overrides `opacity`, so the menu won't render at all on desktop.)

### 5.2 Hamburger button accessibility

In `MobileTopBar.tsx`:
- `aria-expanded={mobileMenuOpen}` on the hamburger button (so it needs to read `mobileMenuOpen` from context, not just the setter).
- `aria-controls="mobile-menu"` linking to the menu's `id="mobile-menu"`.

### 5.3 Focus management

When `mobileMenuOpen` flips to `true`, focus the close button. When it flips to `false`, return focus to the hamburger button.

```ts
// In MobileMenu.tsx
const closeRef = useRef<HTMLButtonElement>(null)
useEffect(() => {
  if (mobileMenuOpen) closeRef.current?.focus()
}, [mobileMenuOpen])
```

Return-focus is harder (the hamburger lives in a different component). Acceptable shortcut: skip return-focus for v1, note in deferred.md.

### 5.4 Escape key closes menu

```ts
useEffect(() => {
  if (!mobileMenuOpen) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setMobileMenuOpen(false)
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [mobileMenuOpen])
```

### 5.5 Orphan `exploreSector` state

If a user tapped a sector in `MobileMenu` (Epic 2.2 made this a no-op closing the menu), they don't see anything. But if Epic 2 instead called `setExploreSector` and relied on Epic 3's CSS to hide the desktop panel, then resizing to desktop would suddenly reveal a `SectorDetailPanel` for that sector — surprising.

Confirm: in `MobileMenu.tsx` (Epic 2.2), the sector click handler does **not** call `setExploreSector`. If it does, remove the call. Leave the comment pointing to `deferred.md`.

### 5.6 Smoke test the dev server start

```bash
cd Map-View-Client
npm run dev
```

Hit the URL on:
- Desktop browser (Chrome, 1280×800).
- Chrome DevTools mobile (iPhone 12 Pro, 390×844).

Confirm no console errors on either.

## Acceptance criteria

- Menu fades in/out smoothly.
- Hamburger button has correct `aria-expanded` / `aria-controls`.
- When menu opens, keyboard focus is on the close button.
- Pressing Escape closes the menu.
- Sector taps in mobile menu don't leak state to desktop layout on resize.
- No console errors in either viewport on dev server start.

## Test plan

**Static checks:**
```bash
cd Map-View-Client
npm run lint
npm run build
```

**Animation:**
1. Mobile viewport. Tap hamburger — menu fades in over ~200ms.
2. Tap X — menu fades out over ~200ms.
3. Open and rapidly close. Confirm no janky flash.

**Accessibility (manual):**
4. Open the menu with keyboard: tab to hamburger, press Enter. Menu opens. Focus lands on the X button.
5. Press Escape. Menu closes.
6. Inspect hamburger button. `aria-expanded` is `"true"` when open, `"false"` when closed. `aria-controls` matches the menu's id.
7. Screen reader (VoiceOver on Mac: Cmd+F5): announce hamburger as "Открыть меню, button". After opening, announce menu as a dialog.

**Cross-viewport state:**
8. Mobile viewport. Open menu. Tap sector 03. Menu closes.
9. Resize to desktop (>768px). Confirm `SectorDetailPanel` does NOT appear (`exploreSector` was not set).
10. Resize back to mobile. Open menu. Confirm sector 03 doesn't appear as highlighted/sticky.

**No regressions:**
11. Open at desktop width. Hamburger and menu invisible. Sidebar works as before. Active-section tracking works in `.longread` as before.

**Done when:** every checklist item passes; lint + build green; no console errors.
