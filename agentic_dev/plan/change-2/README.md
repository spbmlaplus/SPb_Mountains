# Mobile responsive support — plan breakdown

> **2026-05-20 — superseded by horizontal carousel rewrite.**
>
> The sticky-map-top + longread-flows-below layout this plan delivered shipped, but the user reported the map disappeared the moment they scrolled into the longread. On 2026-05-20 the mobile shell was rewritten into a 72/28 dvh flex column with a **horizontal scroll-snap carousel** of section cards in the bottom sheet — the map is now permanently visible. Section selection is now driven by horizontal `scrollLeft` instead of `window.scrollY`. See `HANDOFF.md` § "2026-05-20 update" for the architecture and `Map-View-Client/src/MobileLongreadControls.tsx` for the new chapter pill + dots + chevrons overlay.
>
> Items from `deferred.md` that **were resolved in the carousel rewrite**: `OverlayTogglePanel` is visible on desktop and on mobile (no longer `display: none`); double-hamburger source-order bug; gesture cooperation question (native `touch-action: pan-x` / `pan-y` resolved it without `cooperativeGestures`). `SectorDetailPanel` and `MountainPopup` on mobile remain deferred.

## Context

On phones the site is unusable: layout is a fixed two-pane split (`grid-template-columns: minmax(320px, 440px) 1fr` and a hardcoded 650px-wide `.longread`), and the map is absolutely positioned beneath a right-pinned white longread panel. At 375px viewport the user sees the left edge of the white longread and the map is hidden entirely.

We're adding a mobile layout matching `figma_frames/mobile/М_разв*.png`:
- **Default state:** Sticky map at top (~45vh), longread content scrolls underneath. Top bar with `☰` (left) and `МЛА+` (right).
- **Menu open:** Full-screen dark overlay with `X` close + `МЛА+`, chapter list `01–08`, divider, footer row (О проекте / Глоссарий / Исследовать горы), sector list `01–13`.

Desktop (>768px) must not regress.

## Decisions (locked in with user)

| Decision | Choice |
|---|---|
| Layout pattern | Sticky map top + content scrolls under |
| Breakpoint | `max-width: 768px` |
| Menu type | Full-screen dark overlay |
| Map overlays on mobile | Hide `OverlayTogglePanel`, `SectorDetailPanel`, `MountainPopup` for now |
| Sector menu taps on mobile | No-op (defer mobile sector view) |

## Execution order

Epics are mostly sequential — later epics build on earlier ones. Suggested order:

1. ✅ **[Epic 1 — Foundation](./01-foundation.md)** — Shared data module + context state for menu open/close. Small, mechanical, lays groundwork. *Automated verification passed 2026-05-19; human UI pass pending.*
2. ✅ **[Epic 2 — Mobile shell components](./02-mobile-shell-components.md)** — Build `MobileTopBar` and `MobileMenu`. Wires into `layout.tsx`. *Code complete + `npm run lint`/`npm run build` clean on 2026-05-19; human UI pass pending. Note: Epic 3's `layout.css` media blocks were already in place when this landed, so the visibility toggles (`@media (min-width: 769px)`) are wired — what's deferred to Epic 3 is `App.css` (sticky map, in-flow longread).*
3. ✅ **[Epic 3 — Responsive CSS](./03-responsive-css.md)** — `@media (max-width: 768px)` blocks that flip layout to sticky-map-on-top and hide desktop chrome. *Automated verification passed 2026-05-19; visual sticky-map + boundary-resize pass pending.*
4. ✅ **[Epic 4 — Scroll listener mobile mode](./04-scroll-listener-mobile.md)** — Refactor `updateActiveItem` and `scrollToItemId` in `MainMap.tsx` to handle window-scroll on mobile. *Code complete + `npm run lint`/`npm run build` clean on 2026-05-19; manual mobile-scroll + boundary-resize pass pending. Both effects branch on `matchMedia('(max-width: 768px)')`; the listener re-binds on `mql.change`, the scroller offsets by 45vh + 16px on mobile and uses `scrollIntoView` on desktop.*
5. ✅ **[Epic 5 — Polish + integration](./05-polish-integration.md)** — Fade-in, body scroll lock, ARIA, edge cases. *Code complete + `npm run lint`/`npm run build` clean on 2026-05-19; human animation/screen-reader pass pending. 200ms opacity fade via `.mobile-menu--open`; hamburger has `aria-expanded` + `aria-controls="mobile-menu"`; close button gets focus on open; Escape closes; sector taps still only call `setMobileMenuOpen(false)` (no `setExploreSector` leak). Return-focus-to-hamburger remains deferred per plan §5.3.*
6. **[Epic 6 — End-to-end verification](./06-end-to-end-verification.md)** — Full test pass + desktop regression check.

Out of scope: **[deferred.md](./deferred.md)** lists items deliberately not in this pass.

## Параллелизация работ

Граф зависимостей:

```
Эпик 1 (Фундамент)
   │
   ├──→ Эпик 2 (Компоненты)  ─┐
   │                          │
   ├──→ Эпик 3 (CSS)          ├──→ Эпик 5 (Полировка) ──→ Эпик 6 (E2E)
   │                          │
   └──→ Эпик 4 (Скролл)       ─┘
```

**Строго последовательно:**
- **Эпик 1 — первым.** Без `navData.ts` и `mobileMenuOpen` остальные эпики писать не на чем.
- **Эпик 5 — после Эпика 2.** Полирует компоненты, которые создаёт Эпик 2.
- **Эпик 6 — последним.** Финальный прогон всего вместе.

**Параллельно (после Эпика 1):**
- **Эпик 2** (новые файлы `MobileTopBar.tsx`, `MobileMenu.tsx`, правки `layout.tsx`)
- **Эпик 3** (`@media` блоки в `App.css` + `layout.css`)
- **Эпик 4** (рефакторинг скролл-слушателя в `MainMap.tsx`)

Эти три эпика трогают разные файлы и не блокируют друг друга.

**Точки трения при параллельной работе:**

1. **`layout.css` — мягкий конфликт.** Эпик 2 добавляет базовые стили `.mobile-top-bar` / `.mobile-menu`, Эпик 3 добавляет `@media`-блоки. Разнести по разным секциям файла — git merge пройдёт без проблем.

2. **Тестируемость Эпика 4.** Код можно написать до Эпика 3, но **проверить** работу мобильного режима скролла нельзя, пока `.longread` не выйдет из режима `100vh + overflow-y: auto` — это делает Эпик 3. То есть пишите параллельно, но финальный smoke-test Эпика 4 — после мержа Эпика 3.

3. **Имена классов `.mobile-top-bar` / `.mobile-menu`.** Эпик 3 пишет правило `@media (min-width: 769px) { .mobile-top-bar, .mobile-menu { display: none } }` — нужно заранее согласовать имена с тем, кто делает Эпик 2 (или зафиксировать в README перед стартом).

**Практический порядок для одного исполнителя:** 1 → 3 → 2 → 4 → 5 → 6. Эпик 3 раньше Эпика 2 даёт быструю обратную связь — сразу видно, что мобильный layout работает, ещё до того как готовы компоненты.

**Для команды 2–3 человека:** Эпик 1 (все ждут) → Эпики 2/3/4 параллельно в трёх ветках → Эпик 5 → Эпик 6.

## Final checks

After every epic: `npm run lint` and `npm run build` must pass. The desktop layout (>768px) must be byte-identical to the baseline.

## File-touch inventory

**Modified:**
- `Map-View-Client/src/App.css`
- `Map-View-Client/src/layout.css`
- `Map-View-Client/src/layout.tsx`
- `Map-View-Client/src/MainMap.tsx`
- `Map-View-Client/src/MapInteractionContext.tsx`
- `Map-View-Client/src/Sidebar.tsx`

**New:**
- `Map-View-Client/src/navData.ts`
- `Map-View-Client/src/MobileTopBar.tsx`
- `Map-View-Client/src/MobileMenu.tsx`
