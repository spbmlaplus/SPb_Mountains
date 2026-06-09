# Epic 1 — Foundation

## Goal

Create shared infrastructure that later epics depend on: a single source of truth for chapter/sector navigation data, and a piece of global state to coordinate the mobile menu open/close.

## Why this epic exists

The chapter list (8 items) and sector list (13 items) currently live as hardcoded arrays inside `Sidebar.tsx:22–32` and `Sidebar.tsx:37–51`. The new `MobileMenu` needs the same data; forking the arrays guarantees they'll drift. Extracting first keeps the rest of the work clean.

Similarly, the mobile menu's open state needs to be readable by both `MobileTopBar` (the trigger) and `MobileMenu` (the consumer). It belongs in `MapInteractionContext`, which both components already need for `activeItemId` and `scrollToItemId`.

## Dependencies

None — start here.

## Tasks

### 1.1 Create `Map-View-Client/src/navData.ts`

New module. Move out of `Sidebar.tsx:14–53`:

```ts
export type Chapter = { num: string; title: string; hasContent: boolean }
export type Sector = { num: string; title: string }

export const CHAPTERS: Chapter[] = [ /* 01–08, verbatim from Sidebar.tsx:22–32 */ ]
export const SECTORS: Sector[] = [ /* 01–13, verbatim from Sidebar.tsx:37–51 */ ]

export const norm = (s: string) => s.trim().toLowerCase()
```

Preserve the comments above each array (they document where the data came from — chapter sheet, sector geojson).

### 1.2 Update `Map-View-Client/src/Sidebar.tsx`

- Remove the local `Chapter` type, `Sector` type, `CHAPTERS`, `SECTORS`, `norm` (lines 14–53).
- Add `import { CHAPTERS, SECTORS, norm } from './navData'` at the top.
- No other changes to the component body.

### 1.3 Update `Map-View-Client/src/MapInteractionContext.tsx`

- Add to the context type:
  ```ts
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  ```
- Add corresponding `useState<boolean>(false)` in the provider.
- Add `mobileMenuOpen` and `setMobileMenuOpen` to the provider's `value` object.
- Add a sensible default in the default context value (if there's a `createContext` default object): `mobileMenuOpen: false, setMobileMenuOpen: () => {}`.

## Acceptance criteria

- `Sidebar.tsx` no longer declares `CHAPTERS`, `SECTORS`, `Chapter`, `Sector`, or `norm` locally.
- `navData.ts` exports them, with identical content to the originals.
- `MapInteractionContext` exposes `mobileMenuOpen` and `setMobileMenuOpen`, both stable across renders (state lives in the provider).
- All existing imports of `useMapInteraction()` still work without modification.

## Test plan

**Static checks:**
```bash
cd Map-View-Client
npm run lint        # must pass
npm run build       # tsc + vite — must pass
```

**Manual regression (desktop):**
1. `npm run dev`, open `http://localhost:5173/Map-View-Client/` at full window.
2. Click the hamburger in the left sidebar to expand it.
3. Confirm chapter list shows all 8 entries (01 Как устроен амфитеатр … 08 Угрозы и угрозы) in the same order as before.
4. Confirm sector list shows all 13 sectors (01 Рощинский … 13 Пеникский).
5. Click chapter 02 — confirm the longread scrolls to the first item of chapter 2 (same behaviour as before).

**Context state check:**
6. Open React DevTools → Components → `MapInteractionProvider`. Confirm hooks panel shows `mobileMenuOpen: false`.
7. In the DevTools console while hovering on the provider, call the setter to flip it to `true`; verify no errors. Restore to `false`.

**Done when:** lint + build green, all manual steps pass, no console errors.

---

## Verification log — 2026-05-19

**Status: ✅ Done (automated checks). Human pass on UI clicks still pending.**

### Automated checks (passed)

| Check | Result |
|---|---|
| `npm run lint` | ✅ Clean — no warnings, no errors |
| `npm run build` (`tsc -b && vite build`) | ✅ `built in 1.47s`, no TS errors. Pre-existing chunk-size warning unchanged. |
| `navData.ts` exports | ✅ 5 exports: `Chapter` (type), `CHAPTERS`, `Sector` (type), `SECTORS`, `norm` |
| Item counts in `navData.ts` | ✅ 21 `title:` entries (8 chapters + 13 sectors) |
| `Sidebar.tsx` import | ✅ Line 3: `import { CHAPTERS, SECTORS, norm } from './navData'`. Local declarations removed. |
| `MapInteractionContext.tsx` state | ✅ Type field at lines 28–29; `useState` at line 38; in `value` at 65–66; in deps at 76 |
| Vite dev server start | ✅ `VITE v7.3.2 ready in 120 ms` on `http://localhost:5173/Map-View-Client/` |
| `GET /Map-View-Client/` | ✅ HTTP 200, 769 bytes, valid HTML shell with module script tag |
| `GET /Map-View-Client/src/navData.ts` | ✅ HTTP 200. Vite-transformed JS shows all 8 chapter titles + 13 sector titles in correct order, including the "Frame 16 typo" comment preserved |

### Still pending (require human in browser)

- Manual regression items 2–5 (click hamburger, visually confirm chapter/sector lists, click chapter 02 and observe scroll).
- Context state check items 6–7 (open React DevTools, confirm `mobileMenuOpen: false`, flip via setter).

These steps need a real browser session — automation tooling (Playwright/Puppeteer) is not installed in this project, and CLAUDE.md explicitly notes "There is no test runner configured." The dev server smoke test above is the closest automated equivalent and passed.

### Files modified

- `Map-View-Client/src/navData.ts` (new, 41 lines)
- `Map-View-Client/src/Sidebar.tsx` (–40 lines: removed local CHAPTERS/SECTORS/types/norm; +1 line: import)
- `Map-View-Client/src/MapInteractionContext.tsx` (+6 lines: type field, useState, value field, deps entry)
