# visual-tests/

Visual-fidelity dashboard against Figma frames. Owned by [`plan/00-visual-test-framework.md`](../../plan/00-visual-test-framework.md).

## One-time setup

```bash
cd Map-View-Client
npm install
npx playwright install chromium
```

## Run

```bash
npm run visual                  # full sweep — all 12 registered frames; emits both index.html and every task-NN/index.html
npm run visual:task -- 02       # one task — only frames plan 02 owns ⚠️ currently broken (arg-forwarding bug, see plan/00)
```

Until the wrapper is reworked, use the full sweep — it produces the per-task subreports anyway.

Output: `gavr_mounty/.claude-reports/visual/<timestamp>/index.html` (and `task-NN/index.html` per owner). Open in a browser.

## How it works

1. `npm run visual:build` builds the app with `VITE_BASE_PATH=/` so the preview server serves at the root.
2. `start-server-and-test` boots `vite preview --port 4173` and waits for it.
3. `playwright test` runs `capture.spec.ts`, which navigates to each `{baseURL}{hash}` from `frames.ts` and screenshots a 1920×1080 viewport.
4. `node visual-tests/diff.ts` runs pixelmatch on each captured PNG vs `figma_frames/Frame N.png`, applying the mask regions from `frames.ts`.
5. `node visual-tests/report.ts` writes the HTML dashboard.

## Files

| File | Role |
|---|---|
| `playwright.config.ts` | Single-process, viewport 1920×1080 |
| `frames.ts` | Registry of frame ↔ hash ↔ owners ↔ masks (source of truth) |
| `capture.spec.ts` | Playwright spec — captures one PNG per registered frame |
| `diff.ts` | Diffs captured vs Figma, writes `output/diff/*.diff.png` + `output/results.json` |
| `report.ts` | Reads `results.json`, writes `.claude-reports/visual/<ts>/index.html` |
| `output/` | Working files; gitignored |

## Adding a frame

Append an entry to `FRAMES` in `frames.ts`:

```ts
{
  frame: 51,
  hash: '#id_map=1',
  taskOwners: ['10'],
  notes: 'Chapter 2 intro card.',
  maskRegions: NO_LONGREAD_MASK(),
}
```

Re-run `npm run visual`. The new frame appears in the top-level report and any task subreport it owns.
