# Epic 4 — Scroll listener mobile mode

## Goal

Make the existing active-section tracking and `scrollToItemId` navigation work when the scroll happens on `window` (mobile) instead of inside the `.longread` element (desktop).

## Dependencies

- Epic 3 (mobile layout is in place, so `.longread` is in document flow rather than a 100vh scroll container).

## Why this epic exists

The current scroll tracker (`MainMap.tsx:1349–1412`) attaches to `listElement` (the `.longread` div), reads its `scrollTop` and `getBoundingClientRect()`, and picks the section closest to that container's viewport center. After Epic 3 makes `.longread` flow as a normal block, this stops working on mobile:

- `listElement.scrollTop` is always `0` (the element no longer scrolls).
- `listElement.getBoundingClientRect()` returns a rect spanning the entire content height — the math thinks every item is "inside the container".
- The `scroll` event never fires on `listElement` because scroll happens on `window`.

So:
1. Active-section highlight stops updating during page scroll.
2. The `id_map` → base composition swap (the chapter-1 ↔ chapter-2 base layer change in `MainMap.tsx:1463–1536`) stops firing.
3. Clicking a chapter in `MobileMenu` calls `scrollToItemId` which scrolls a non-scrolling element → no navigation.

## Tasks

### 4.1 Refactor `updateActiveItem` in `MainMap.tsx` around lines 1349–1412

Add a media-query check inside the effect, and a `MediaQueryList` listener so the effect re-binds when the viewport crosses the breakpoint.

```ts
useEffect(() => {
  const listElement = listRef.current
  if (!listElement) return

  const mql = window.matchMedia('(max-width: 768px)')

  let frameId = 0
  let isMobile = mql.matches

  const updateActiveItem = () => {
    if (contentItems.length === 0) return

    let rootTop: number
    let rootBottom: number
    let isAtBottom: boolean

    if (isMobile) {
      const stickyMapPx = 0.45 * window.innerHeight
      rootTop = stickyMapPx
      rootBottom = window.innerHeight
      isAtBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
    } else {
      const rect = listElement.getBoundingClientRect()
      rootTop = rect.top
      rootBottom = rect.bottom
      const maxScrollTop = listElement.scrollHeight - listElement.clientHeight
      isAtBottom = maxScrollTop <= 0 || listElement.scrollTop >= maxScrollTop - 2
    }

    if (isAtBottom) {
      const lastItemId = contentItems[contentItems.length - 1]?.id ?? ''
      setActiveItemId((currentId) => (currentId === lastItemId ? currentId : lastItemId))
      return
    }

    const viewportCenter = (rootTop + rootBottom) / 2
    let nextItemId = contentItems[0]?.id ?? ''
    let bestDistance = Number.POSITIVE_INFINITY

    for (const [itemId, element] of itemRefs.current.entries()) {
      const bounds = element.getBoundingClientRect()
      const visibleTop = Math.max(bounds.top, rootTop)
      const visibleBottom = Math.min(bounds.bottom, rootBottom)
      const visibleHeight = Math.max(0, visibleBottom - visibleTop)
      if (visibleHeight <= 0) continue
      const itemCenter = bounds.top + bounds.height / 2
      const distanceToCenter = Math.abs(itemCenter - viewportCenter)
      if (distanceToCenter < bestDistance) {
        bestDistance = distanceToCenter
        nextItemId = itemId
      }
    }

    setActiveItemId((currentId) => (currentId === nextItemId ? currentId : nextItemId))
  }

  const handleScroll = () => {
    cancelAnimationFrame(frameId)
    frameId = requestAnimationFrame(updateActiveItem)
  }

  const attach = () => {
    const target: Window | HTMLElement = isMobile ? window : listElement
    target.addEventListener('scroll', handleScroll, { passive: true })
    return () => target.removeEventListener('scroll', handleScroll)
  }

  let detach = attach()
  window.addEventListener('resize', handleScroll)

  const onMqlChange = (e: MediaQueryListEvent) => {
    isMobile = e.matches
    detach()
    detach = attach()
    handleScroll()
  }
  mql.addEventListener('change', onMqlChange)

  updateActiveItem()

  return () => {
    cancelAnimationFrame(frameId)
    detach()
    window.removeEventListener('resize', handleScroll)
    mql.removeEventListener('change', onMqlChange)
  }
}, [contentItems])
```

### 4.2 Refactor `scrollToItemId` callback

Locate the existing definition (search for `scrollToItemId` in `MainMap.tsx`). It almost certainly calls `listElement.scrollTo` or uses `element.scrollIntoView` inside the `.longread`. Wrap it with a mobile branch:

```ts
const scrollToItemId = useCallback((itemId: string) => {
  const listElement = listRef.current
  const itemElement = itemRefs.current.get(itemId)
  if (!itemElement) return

  const isMobile = window.matchMedia('(max-width: 768px)').matches

  if (isMobile) {
    const stickyMapPx = 0.45 * window.innerHeight
    const top = itemElement.getBoundingClientRect().top + window.scrollY - stickyMapPx - 16
    window.scrollTo({ top, behavior: 'smooth' })
  } else {
    // existing desktop behaviour — preserve verbatim
    if (!listElement) return
    listElement.scrollTo({ top: itemElement.offsetTop - 24, behavior: 'smooth' })
    // (or whatever the current implementation does — keep it intact)
  }
}, [/* same deps as before */])
```

### 4.3 Verify the URL-hash-driven scroll effect (around `MainMap.tsx:1414+`)

That effect parses `#item=foo` and calls `scrollToItemId`. Since 4.2 keeps the same function signature, no change needed there. But re-test: opening `…/#item=ставка-сцена` on mobile should land that item below the sticky map.

## Acceptance criteria

- On mobile (≤ 768px):
  - Active-section highlight (`.is-active`, pink underline) updates as the user scrolls and different sections cross the focal area (vertical center of the visible region below the sticky map).
  - Map base composition swaps when scrolling from chapter 1 to chapter 2 sections (`id_map ≥ 10` triggers the swap — see `MainMap.tsx:1463–1536`).
  - Tapping a chapter in `MobileMenu` smooth-scrolls the page so the section's title appears just below the sticky map (with ~16px padding).
  - URL hash `#item=...` scrolls to the correct item on load.
- On desktop (≥ 769px):
  - Active-section tracking unchanged — same behaviour as before this epic.
  - `scrollToItemId` unchanged.
- Crossing the 768/769 boundary mid-session (resize) re-binds listeners and continues to track scroll correctly without a reload.

## Test plan

**Static checks:**
```bash
cd Map-View-Client
npm run lint
npm run build
```

**Mobile (DevTools → iPhone 12 Pro, 390×844):**
1. Reload. Confirm initial active section is the first item (pink underline on first section's first bold word).
2. Slowly scroll down through chapter 1. Watch the underline shift to each new section as it crosses the midpoint between the sticky map (45vh) and the viewport bottom.
3. Continue scrolling into chapter 2 items (id_map ≥ 10). Confirm the base map raster visibly changes (relief layer opacity drops to 0.4, per `migration-implementation-plan.md`).
4. Scroll to the very bottom. The last item should become active even if it's only partially in the focal area (the `isAtBottom` branch handles this).
5. Open `MobileMenu`, tap chapter 02. Menu closes. Page scrolls smoothly. When animation ends, the chapter-2 first item's title is positioned just below the sticky map (not under it).
6. Reload at `http://localhost:5173/Map-View-Client/#item=<some-item-id>` — page lands with that item below the sticky map.

**Desktop (window ≥ 769px):**
7. Scroll inside `.longread` — active section updates as before, smoothly.
8. Click a chapter in left sidebar — `.longread` scrolls (not the window).

**Boundary resize:**
9. With page scrolled to chapter 2 in mobile view, drag the viewport wider past 769px:
   - Layout switches to desktop split-pane.
   - Active section continues to track scroll inside `.longread`.
   - No console errors about removed listeners.
10. Drag back below 768px — reverse transition, scroll-tracking continues to work on window.

**Console checks:**
11. No warnings or errors during any of the above. The effect should run cleanup (`detach()`, `removeEventListener`) on every resize crossing.

**Done when:** every checklist item passes; lint + build green; no listener leaks visible in DevTools Performance recording.
