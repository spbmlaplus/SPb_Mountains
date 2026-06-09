# 00 — Visual-fidelity dashboard against Figma frames

## Status

**Live.** Scaffolding is in `Map-View-Client/visual-tests/`; `npm run visual` runs end-to-end and writes the HTML dashboard to `.claude-reports/visual/<ts>/`.

Two bugs surfaced during plan 02's first run (2026-05-16) and were fixed in-place:

1. `playwright.config.ts` — `...devices['Desktop Chrome']` was spread **after** `viewport: { width: 1920, height: 1080 }`, so Chrome's 1280×720 default silently won. Result: every capture was a 1280×720 page padded with 640×360 of white by the 1920×1080 screenshot `clip`, so the CAPTURED column showed blank PNGs (each exactly 4254 bytes — the size of a 1920×1080 white PNG). Fixed by moving the device spread to the top of `use:`.
2. `report.ts` — `copyAssets` copies PNGs into `<reportDir>/assets/`, but `renderRow` emitted bare filenames (`<img src="Frame-16.figma.png">`), which the browser resolved as siblings of `index.html` and 404'd. Top-level page needs `assets/`, per-task subreport needs `../assets/`. Fixed by threading an `assetsPrefix` arg through `renderHTML` → `renderRow`. Same trip fixed the "All frames" filter link (top-level used `../index.html` which also resolved out of the report dir).

Known issue (cosmetic, deferred): `npm run visual:task -- 02` breaks `start-server-and-test` argument parsing — the `02` is appended past the third positional arg. Use `npm run visual` (which produces the same `task-NN/` subreports for every owner) until the wrapper script is reworked.

## Context

Each plan file (01–10) describes a slice of the design-vs-build gap. As we implement them, we want a repeatable way to **see** how close the running app is to the Figma frames, per task, without manual screenshotting.

This file owns the shared framework. Per-task plans link out to it from a "Visual verification" subsection in their existing Verification section. The framework runs `npm run visual` (one command, zero user input) and writes an HTML dashboard with side-by-side Figma | captured | diff per frame.

**This is a comparison dashboard, not a pass/fail gate.** Map raster tiles, real CSV copy, and system font rendering produce a ~15–30% pixel-mismatch noise floor that no implementation can close. The report exists for human design sign-off; the mismatch % is data, not a CI signal.

## What it produces

```
.claude-reports/visual/<timestamp>/
  index.html              ← top-level: all registered frames, sortable by mismatch %
  task-01/index.html      ← per-task subreport: only the frames plan 01 owns
  task-02/index.html
  ...
  assets/
    Frame16.figma.png
    Frame16.captured.png
    Frame16.diff.png
    ...
```

Each row in a report is: **Figma frame** | **rendered capture** | **pixelmatch diff PNG** | **mismatch %** | per-frame notes (what the diff is expected to show).

## Architecture

### Three pieces

1. **URL-hash deep-linking** (a tiny product feature; the test hook falls out of it)
2. **Playwright + pixelmatch + Node report builder** (this folder)
3. **Per-task ownership** via a registry in `frames.ts`

### URL-hash deep-linking

`Map-View-Client/src/MainMap.tsx` reads `window.location.hash` on mount and on `hashchange`:

| Hash | Effect |
|---|---|
| `#id_map=N` | Scroll the longread to the first `ContentItem` with `id_map === N`. `activeItemId` follows via the existing scroll-spy at `MainMap.tsx:804–860`. |
| `#item=<id>` | Same scroll, by item id. |
| `#sidebar=expanded` | Override the sidebar's default-collapsed initial state (consumed by [01-toc-sidebar.md](01-toc-sidebar.md)'s `Sidebar.tsx`). |

This is a real product feature (shareable section links). The test framework consumes it; users can paste `#id_map=5` to land on Балкон.

### File layout (under `Map-View-Client/visual-tests/`)

| File | Role |
|---|---|
| `playwright.config.ts` | viewport 1920×1080, baseURL `http://localhost:4173/`, single project, no parallelism (preview server is single-process), deterministic timeouts |
| `frames.ts` | **Single source of truth** — array of `{ frame, hash, taskOwners, maskRegions?, notes? }` |
| `capture.spec.ts` | Playwright spec — loops `frames.ts`, navigates to `baseURL + entry.hash`, waits for `map.on('idle')` + any inset images, captures viewport-sized PNG → `output/Frame<N>.captured.png` |
| `diff.ts` | Node script — reads each `figma_frames/Frame <N>.png` + `output/Frame<N>.captured.png`, applies optional masks, runs `pixelmatch` (threshold 0.1), writes `output/Frame<N>.diff.png` and `output/results.json` |
| `report.ts` | Node script — reads `results.json`, renders top-level `index.html` + one `task-<NN>/index.html` per owner |

### The registry — `frames.ts`

Single source of truth. One row per Figma frame to compare. Multiple `taskOwners` are normal — Frame 35 is co-owned by plans 02 (triangles persist), 05 (Сцена underline), and 07 (positron labels).

```ts
export type MaskRegion = { x: number; y: number; width: number; height: number; label: string }

export type FrameEntry = {
  frame: number              // e.g. 35
  hash: string               // e.g. '#id_map=2' or '#sidebar=expanded'
  taskOwners: string[]       // e.g. ['02', '05', '07']
  notes?: string             // what to look for; renders into the report
  maskRegions?: MaskRegion[] // pixels excluded from the diff (always-noisy areas)
}

export const FRAMES: FrameEntry[] = [
  { frame: 16, hash: '#sidebar=expanded', taskOwners: ['01', '02'],
    notes: 'Expanded sidebar; 229 triangles visible across the agglomeration.' },
  { frame: 30, hash: '#sidebar=collapsed', taskOwners: ['01'],
    notes: 'Collapsed sidebar (32 px rail); cover state.' },
  { frame: 35, hash: '#id_map=2', taskOwners: ['02', '05', '07'],
    notes: 'Сцена — bold underlined; triangles persist; positron labels visible.' },
  // ... 37, 38, 39, 40, 41 (chapter 1 sections)
  { frame: 46, hash: '#id_map=10', taskOwners: ['02', '08'],
    notes: 'Chapter 2 desaturated base; triangles HIDDEN (visibility gate).' },
  // ... 47, 48, 49 (chapter 2 sections)
]
```

### Masking convention

Regions that *cannot* match the Figma frame regardless of implementation — fill them with a known color in both images before diffing, so they contribute 0 to the mismatch %.

Standard masks:

| Mask | Box (1920×1080 frame) | Why |
|---|---|---|
| **Longread copy panel** | right-edge ~340 px wide × full height | Russian copy from Google Sheets ≠ Figma sample text; renders at different line heights, breaks |
| **Map tile area** | the area between the sidebar and the longread panel | Map tile PNGs vs Figma vector mockup of relief — fundamentally different pixel data |

Per-frame overrides go in `maskRegions` on the registry entry. Most frames will use the two standard masks (defined as helpers in `frames.ts`).

### Report layout

Two-tier output:

**Top-level `index.html`** — table of all registered frames:
- Sortable by mismatch %
- Each row links to the per-frame detail (Figma | captured | diff thumbnails inline)
- Filter chips at the top: "All tasks" + one chip per owner ("Task 01", "Task 02", …) — clicking a chip filters the table

**Per-task `task-NN/index.html`** — only the frames where `taskOwners.includes('NN')`. Same row layout, plus a header summarizing the task's deliverable and the human sign-off criterion (pulled from the per-task plan file).

Plain HTML + CSS, no JS framework. Matches the `report` skill's convention so the output lives at `.claude-reports/visual/<timestamp>/`.

## Single-command entry

```bash
cd Map-View-Client
npm install                       # one-time
npx playwright install chromium   # one-time, ~150 MB
npm run visual                    # full sweep
# or
npm run visual:task -- 05         # filter to one owner
```

Internally `npm run visual`:

1. `VITE_BASE_PATH=/ npm run visual:build` — build the app with root base path
2. `start-server-and-test` boots `vite preview --port 4173`, waits for `/` to 200
3. `playwright test` — runs `capture.spec.ts`
4. `node visual-tests/diff.ts` — diffs each captured PNG against its Figma frame
5. `node visual-tests/report.ts` — emits the HTML
6. Tears down the preview server
7. Prints the report path on exit

`--task NN` is read by `diff.ts` and `report.ts` (the capture step always runs all frames; filtering at diff/report time avoids running the same frame twice when multiple tasks own it).

CI-friendly: single command, exit code reflects Playwright spec exit (a capture failure), not mismatch % (that's just data).

## New dependencies

Added to `Map-View-Client/package.json` devDependencies:

- `@playwright/test` — capture
- `pixelmatch` — diff
- `pngjs` — PNG I/O (pixelmatch consumes raw RGBA)
- `start-server-and-test` — boots preview, waits for it, tears down

Total install footprint: small (~20 MB) plus Playwright's Chromium download (~150 MB) — the latter is a one-time `npx playwright install chromium`.

## Files this plan creates

| File | Owner |
|---|---|
| `Map-View-Client/visual-tests/playwright.config.ts` | this file |
| `Map-View-Client/visual-tests/frames.ts` | this file |
| `Map-View-Client/visual-tests/capture.spec.ts` | this file |
| `Map-View-Client/visual-tests/diff.ts` | this file |
| `Map-View-Client/visual-tests/report.ts` | this file |
| `Map-View-Client/visual-tests/lib/masks.ts` | this file (mask helpers reused across frames) |
| `Map-View-Client/package.json` | new `visual*` scripts + 4 devDeps |
| `Map-View-Client/.gitignore` | `visual-tests/output/` |
| `Map-View-Client/src/MainMap.tsx` | URL-hash `useEffect` (Piece 1) — reuses existing `itemRefs.current` + scroll-spy at `MainMap.tsx:804–860`; no new state |

## Per-task ownership map (registry contents)

| Plan | Owned frames | Notes |
|---|---|---|
| 01 (sidebar) | 16, 30 | Expanded vs collapsed |
| 02 (triangles) | 16, 35, 37, 38, 39, 40, 41 (triangles **present**); 46, 47, 48, 49 (triangles **absent** — verifies the id_map≥10 gate) |
| 03 (popup) | — | No Figma frame shows the popup open state. Manual verification only. |
| 04 (image prep) | — | Output is asset files, not screens. |
| 05 (underline) | 35, 37, 38, 39, 40, 41 |
| 06 (insets) | 39, 40, 41, 47, 48, 49 |
| 07 (positron labels) | 35, 37, 38, 39, 40, 41 |
| 08 (base-3 tuning) | 46, 47, 48, 49 |
| 09 (sector exploration) | — | Frame 42 is a designer note, not an implementation target. |
| 10 (content gaps) | — | No code. |

## Verification

End-to-end check the framework works without user input:

1. `cd Map-View-Client && npm install && npx playwright install chromium` (one-time)
2. `npm run visual` — runs to completion, prints `.claude-reports/visual/<timestamp>/index.html`
3. Open the HTML — top-level table lists all 13 frames with mismatch %, sortable
4. Open `.claude-reports/visual/<timestamp>/task-05/index.html` — only the 6 frames plan 05 owns, each row Figma | Captured | Diff
5. Re-run; mismatch % is deterministic to within ±0.1%
6. `npm run visual:task -- 02` writes only `task-02/`
7. Smoke regression: temporarily comment out the `point-symbol` branch from `ensureLayerOnMap`, re-run `visual:task -- 02`; the captured PNG no longer shows triangles, the diff PNG lights up where they should be. Restore the code; diff returns to baseline.

## Phase

Phase 0 — prerequisite scaffolding. Lands once; every later plan consumes it.

## Limits to be honest about

- Map raster tiles vs Figma vector mockups: fundamental medium mismatch. Masked.
- Real Russian CSV copy vs Figma sample text: line-breaks and exact words differ. Masked.
- System font rendering varies across the headless Chromium that Playwright drives.
- Phase 1 hasn't shipped yet — the first run will show large diffs everywhere. That's the **baseline**; each subsequent task's PR should show its owned frames' diffs shrinking toward the noise floor.
