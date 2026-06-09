# Epic 2 — Mobile shell components

## Goal

Build the two mobile-only UI components: `MobileTopBar` (the fixed `☰ ... МЛА+` strip) and `MobileMenu` (the full-screen dark overlay with chapter + sector lists). Wire them into the app at `layout.tsx`. Components render unconditionally; visibility is later controlled by CSS in Epic 3.

## Dependencies

- Epic 1 (needs `CHAPTERS`/`SECTORS` from `navData.ts` and `mobileMenuOpen`/`setMobileMenuOpen` from `MapInteractionContext`).

## Tasks

### 2.1 Create `Map-View-Client/src/MobileTopBar.tsx`

A small functional component:
- Returns a `<header className="mobile-top-bar">` containing:
  - `<button className="mobile-top-bar__hamburger" aria-label="Открыть меню">` with three SVG bars (or simple spans, like `Sidebar.tsx:118–120`). `onClick` → `setMobileMenuOpen(true)`.
  - `<span className="mobile-top-bar__brand">МЛА+</span>` on the right.
- Pulls `setMobileMenuOpen` from `useMapInteraction()`.
- No internal state.

### 2.2 Create `Map-View-Client/src/MobileMenu.tsx`

A larger component:
- Pulls `mobileMenuOpen`, `setMobileMenuOpen`, `activeItemId`, `contentItems`, `scrollToItemId` from `useMapInteraction()`.
- If `!mobileMenuOpen`, render with `aria-hidden="true"` and a CSS class that hides it (so we can later transition it). Don't return `null` if you want a fade; for v1, returning `null` when closed is fine.
- Reuses the active-chapter logic from `Sidebar.tsx:71–98` — copy the `firstItemIdByChapter` + `activeChapterTitle` + `enrichedChapters` blocks verbatim into this component (small duplication; pulling into a hook is also fine, but copy keeps the diff focused).
- Renders, top to bottom:
  1. Header row: `<button className="mobile-menu__close" aria-label="Закрыть меню">✕</button>` on the left, `<span className="mobile-menu__brand">МЛА+</span>` on the right.
  2. `<h2>Всё о горных просторах Петербурга</h2>`.
  3. Numbered chapter list (`<ol>` or `<ul>`). For each chapter:
     - Show `01` num + title.
     - If `active`, color the row pink (`#e15989`, matching the desktop active border color in `layout.css`).
     - If `!hasContent`, dim it and skip click handling.
     - On click, call `scrollToItemId(firstItemId)` then `setMobileMenuOpen(false)`.
  4. `<hr />`.
  5. Footer row: three spans, "О проекте", "Глоссарий", "Исследовать горы". Non-interactive for now (matches `Sidebar.tsx:193–197`).
  6. `<h3>Всё о секторах горного амфитеатра</h3>`.
  7. Numbered sector list. **Click handler is a no-op for now** that just closes the menu — we agreed in scope that sector detail UI on mobile is deferred. Add a comment: `// TODO: mobile sector detail view (see deferred.md)`.

### 2.3 Wire components into `Map-View-Client/src/layout.tsx`

Current file (22 lines):
```tsx
<div className="layout">
  <main className="layout-main">
    <Sidebar />
    {children}
    <SectorDetailPanel />
  </main>
</div>
```

Add `<MobileTopBar />` and `<MobileMenu />` as siblings inside `.layout-main` (placement doesn't matter visually since both are `position: fixed`; put them after `<SectorDetailPanel />` so they're last in DOM order and naturally on top before z-index is applied).

```tsx
<div className="layout">
  <main className="layout-main">
    <Sidebar />
    {children}
    <SectorDetailPanel />
    <MobileTopBar />
    <MobileMenu />
  </main>
</div>
```

Imports added at the top of `layout.tsx`.

### 2.4 Minimum CSS so the components don't look broken before Epic 3

In `layout.css`, append rules (no media query yet — Epic 3 will wrap them):

```css
.mobile-top-bar { position: fixed; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 35; pointer-events: none; }
.mobile-top-bar > * { pointer-events: auto; }
.mobile-top-bar__hamburger { /* 24x24 button, three bars */ }
.mobile-top-bar__brand { font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.45); }

.mobile-menu { position: fixed; inset: 0; z-index: 40; background: #000; color: #fff; overflow-y: auto; padding: 16px 20px 32px; }
.mobile-menu__close { /* X icon button */ }
.mobile-menu__brand { /* МЛА+ top right */ }
.mobile-menu__chapters, .mobile-menu__sectors { list-style: none; padding: 0; margin: 0; }
.mobile-menu__chapter, .mobile-menu__sector { display: flex; gap: 16px; padding: 12px 0; cursor: pointer; }
.mobile-menu__chapter--active { color: #e15989; }
.mobile-menu__chapter--disabled { opacity: 0.4; cursor: default; }
.mobile-menu__footer { display: flex; justify-content: space-between; padding: 16px 0; border-block: 1px solid rgba(255,255,255,0.15); margin: 12px 0; }
```

(Exact pixel values can be tuned during the manual test pass. Goal here is "not visually broken", not "pixel-perfect Figma".)

### 2.5 Body scroll lock when menu open

Inside `MobileMenu.tsx`:
```ts
useEffect(() => {
  if (!mobileMenuOpen) return
  const prev = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = prev }
}, [mobileMenuOpen])
```

## Acceptance criteria

- `MobileTopBar` and `MobileMenu` render without runtime errors at any viewport size (visibility is still uncontrolled — that's Epic 3's job).
- Tapping the hamburger in `MobileTopBar` opens the menu.
- Tapping `X` in `MobileMenu` closes it.
- Tapping a chapter scrolls the page (or `.longread` — Epic 4 fixes the mobile scroll target) and closes the menu.
- Tapping a sector closes the menu and does nothing else.
- Active chapter is visibly highlighted in pink.
- Disabled chapters (03–08) are visibly dimmed and don't trigger scroll.
- Body doesn't scroll while menu is open.

## Test plan

**Static checks:**
```bash
cd Map-View-Client
npm run lint
npm run build
```

**Behaviour (desktop window, since Epic 3 hasn't hidden yet — they'll overlap the desktop UI):**
1. `npm run dev`. Open the app. Both new components are visible on top of the desktop layout (this is expected at this stage).
2. Click hamburger → menu overlay appears, blacks out the screen.
3. Verify chapter list — all 8 entries, current chapter colored pink.
4. Click chapter 02 → menu closes, `.longread` scrolls to chapter 2's first item.
5. Reopen menu, click sector 05 → menu closes, nothing else happens.
6. Reopen menu — try scrolling the page (`Cmd+Down` or trackpad). Body should not scroll under the overlay; the overlay itself should scroll if its content overflows.
7. Reopen menu, click X → menu closes.
8. Repeat in incognito to confirm no stale state.

**Regression:**
9. Click in the original left sidebar — still works as before.
10. Scroll the longread — active section highlight still updates as before.

**Done when:** lint + build green; menu opens, closes, navigates; body scroll locks; no console errors.
