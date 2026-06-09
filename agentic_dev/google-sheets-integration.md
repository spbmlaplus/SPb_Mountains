# Google Sheets integration — current state and recommendations

How `Map-View-Client` talks to Google Sheets today, what the relationship between the runtime sheet and the design-team CSV spec is, and what options exist for evolving the integration. Written 2026-05-15. Companion to `HANDOFF.md` and `migration-implementation-plan.md`.

---

## 1. What's fetched at runtime

The frontend makes **exactly one** call to the Google Sheets API, **once**, **at app boot** — before the user has interacted with anything.

**Endpoint:**
```
GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/{encodedRange}?key={apiKey}
```

**Values today (`Map-View-Client/src/MainMap.tsx:11-13`):**
```ts
const sheetId      = "1eRYnMzPMGck6lGlwGUCkT3tvwWLIQKRLvJ8dgu3oGnk";
const sheetsApiKey = "AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE";
const sheetsRange  = "Лист1!A:D";
```

`Лист1` is "Sheet1" in Russian — the default tab name in a Russian-locale Google Sheets file.

**Response shape:** `{ values: string[][] }` — raw cell values, no types, no formatting. Approximately 10–20 KB depending on how much copy is in `description`. The body has one row per sheet row including the header.

**Where it's parsed:** `parseSheetRows()` at `MainMap.tsx:153-183`. The four columns are matched by **lowercased header name**, case-insensitive:

| Sheet column | Recognized header(s) | Code field | Meaning |
|---|---|---|---|
| A | `id` | `ContentItem.id` | Slugified to kebab-case; falls back to `sheet-item-<N>` if blank. Joined with `activeItemId` to drive the scroll-based layer logic. |
| B | `title` | `ContentItem.title` | Display title for the section. (Note: not actually rendered in the current UI — there's no title element per section in the longread.) |
| C | `description` | `ContentItem.description` | **HTML allowed.** Rendered via `dangerouslySetInnerHTML` at `MainMap.tsx:592`. Sole source of section body copy. |
| D | `fileList` / `file_list` / `layers` | `ContentItem.fileList` | Comma-separated list of `.geojson` filenames (basenames, no path). Files must exist in `src/assets/layers/` or the layer silently fails. |

The header row may be in any order — code looks up the column index by name, with positional fallback (col A=0, B=1, C=2, D=3).

**Trigger:** `useEffect(..., [])` at `MainMap.tsx:405-420`. The empty dep array means **once, on mount of `MainMap`**, which is the only screen. Triggered as soon as React renders the component; before any user interaction. Not re-fetched on scroll, on section change, on resize, or on HMR. No retry on failure.

**Failure mode:** If the fetch throws or the parsed `items.length === 0`, the code silently falls back to `fallbackContentItems` hardcoded at `MainMap.tsx:49-131`. An error message is stored in component state and shown as a small `.notice` in the UI; the rest of the app continues working. This means **a misconfigured API key looks identical at first glance to a working one** — the longread renders, just with the fallback copy.

---

## 2. What's *not* fetched at runtime

| Asset | Where it lives | When fetched |
|---|---|---|
| Layer .geojson files | bundled into `dist/assets/` at build time (via `import.meta.glob('./assets/layers/*.geojson', { query: '?url', eager: true })`) | once per file, on demand when its section first becomes active; cached in `fileCache: Map<string, Promise>` |
| `relief` tile pyramid | external — `https://pashteto.github.io/gavr-tiles/relief/{z}/{x}/{y}.png` | per tile, as user pans within z=10–14 |
| Design spec CSVs (`drive/Описание лонгрида - {лонгрид,порядок слоев,порядок базовых слоев}.csv`) | repo files | **never** — they're spec documents, not runtime input |
| QGIS QML style files (`drive/Стили/*.qml`) | repo files | **never** — not loaded |

---

## 3. The API key and its referrer restriction

The key `AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE` is a **public browser key with HTTP-referrer restrictions** configured in Google Cloud Console. It is checked into git intentionally; the referrer list is the security boundary, not the key string.

**How the restriction works.** When the browser sends `Referer: https://pashteto.github.io/Map-View-Client/...`, Google's API gateway checks the referrer against the allowed list before accepting the request. Disallowed referrers get HTTP 403 with body `{"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "Requests from referer X are blocked."}}`. From `curl` with no referrer the response is `Requests from referer <empty> are blocked.` — easy to confirm from a terminal.

**What's currently allowed** (presumed, not yet verified by me): `https://pashteto.github.io/Map-View-Client/*` for the GH Pages deploy. Possibly also `http://localhost:5173/*` and `http://localhost:5174/*` for dev.

**What is almost certainly missing**: `https://amphitheater.pashteto.com/*`. Until added, the new production domain silently serves `fallbackContentItems`.

### How to add the new domain

1. Open <https://console.cloud.google.com/apis/credentials> (signed in as the owner of the project that owns this key — probably the `gateway.fm` Google account based on email context).
2. Find the API key whose value starts with `AIzaSyDhhReA6Fe3i`. Click its name to open the edit page.
3. Under **Application restrictions** → **Website restrictions**, ensure these entries exist (add if missing):
   - `https://amphitheater.pashteto.com/*`
   - `https://amphitheater.pashteto.com` (some implementations need both with and without the trailing slash; Google's documentation is ambiguous)
4. Under **API restrictions**, confirm "Restrict key" is selected and **Google Sheets API** is in the allowed list.
5. Save. Propagation is usually instant but can take up to ~5 minutes.

### How to verify

From the deployed site, open DevTools Network tab and reload. The request to `sheets.googleapis.com/v4/spreadsheets/.../values/Лист1!A:D` should return **200** with a JSON body. If you see 403 + `Requests from referer ...`, the restriction list needs the new domain.

You can also `curl` with a fake Referer to test from outside the browser:
```bash
curl -sS -H 'Referer: https://amphitheater.pashteto.com/' \
  'https://sheets.googleapis.com/v4/spreadsheets/1eRYnMzPMGck6lGlwGUCkT3tvwWLIQKRLvJ8dgu3oGnk/values/%D0%9B%D0%B8%D1%811!A:D?key=AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE' \
  | head -20
```

A 200 here means the referrer is allowed. A 403 means it isn't.

---

## 4. The two-document setup: Google Sheet vs design spec CSVs

There are **two separate documents** that look similar but aren't:

### A. The Google Sheet (runtime)

- ID `1eRYnMzPMGck6lGlwGUCkT3tvwWLIQKRLvJ8dgu3oGnk`.
- Lives in someone's Google Drive (owner unknown to me — likely the design team or the author of the longread).
- Fetched by the app on every page load.
- Has one tab `Лист1` with columns `id | title | description | fileList`.
- Editable by anyone with edit access on the Drive; the change is live within seconds (browser may cache for ~10 minutes via the API's Cache-Control headers).

### B. The design spec CSVs (spec / authoring archive)

- Three CSV files in `drive/` (exported from the design team's Google Sheet — these are now the source of truth, replacing the legacy `Описание лонгрида.xlsx` that may still be on disk):
  - `drive/Описание лонгрида - лонгрид.csv` (~18 KB) — longread copy split into **2 chapters** (*Как устроен амфитеатр* §1–9, *Горы Петербурга* §10–13). Per-section: chapter, subtitle, media link, description, link, anchor coordinates, zoom, id_map, "what's on the maps".
  - `drive/Описание лонгрида - порядок слоев.csv` (~2 KB) — **per-section ordered layer stack** with named vector styles. Each row = one layer in one section, with draw order and style name.
  - `drive/Описание лонгрида - порядок базовых слоев.csv` (~1 KB) — **three base-layer compositions** (always-visible bottom stack). Each composition lists layers + raster blend mode + opacity.
- **Never loaded by the frontend.** They sit as spec documents. Editing them by hand or re-exporting from the design team's Google Sheet keeps them current.

### Why this matters

Today's frontend honors only ~30% of the design intent: it uses the sheet's flat `fileList` per section, applies two procedural palettes, and shows nothing as an "always-on" base layer. The CSVs' per-section layer stacks + base-layer compositions + ~24 named styles are unimplemented.

The user has chosen **not to extend the runtime data flow to read these CSVs for now.** Phase 5 of the migration plan (styling adoption) is therefore deferred; when it lands, the CSVs will be baked into the codebase as static config (recommended approach), not loaded at runtime.

---

## 5. Recommendations for evolving the integration

Listed in order from "leave it alone" to "rebuild the data pipeline." Pick a row based on how much editability the design team needs and how much code complexity you want to absorb.

### Option 0 — Status quo, just add referrer (~5 min)

**What:** Add `amphitheater.pashteto.com` to the API key's allowed referrer list. Do nothing else. The design spec stays unimplemented; both deployments keep showing today's two-palette overlays.

**Pros:** Zero code changes. Both deployments work consistently. No new attack surface.

**Cons:** The design team's spec stays invisible to users. Visually, the app is uglier than intended.

**Recommended if:** You just need the new domain to behave like the old one.

### Option 1 — Bake the design spec CSVs into the frontend as static config (Recommended)

**What:** Two PRs (or one big one) that translate the CSVs into TypeScript modules:
- `Map-View-Client/src/layerStyles.ts` — `VECTOR_STYLES: Record<StyleName, LayerStyle>` (~24 entries, hand-ported from `drive/Стили/*.qml`).
- `Map-View-Client/src/layerScheme.ts` — `LAYER_STACKS_BY_SECTION: Record<SectionId, { baseId: 1|2|3, overlays: { file: string; style: StyleName }[] }>` and `BASE_COMPOSITIONS: Record<1|2|3, BaseLayer[]>` (from `drive/Описание лонгрида - порядок слоев.csv` and `drive/Описание лонгрида - порядок базовых слоев.csv`).

The Google Sheet keeps providing `id/title/description`. The `fileList` column becomes redundant (the layer stack comes from `LAYER_STACKS_BY_SECTION`), but can stay as a no-op for backward compatibility.

**Pros:**
- Honors the design intent end-to-end.
- No new Sheets API usage; no new keys, no new referrer config.
- Type-safe — refactors against the scheme become compile errors instead of runtime data-shape bugs.
- The CSVs become the spec; code is the implementation. Easy to verify by visual comparison.

**Cons:**
- Manual re-port when the design team revises the CSVs.
- Layer ordering / base composition decisions are now locked behind a deploy.

**Recommended if:** The design team rarely changes the scheme (true for a one-shot longread), and visual quality matters more than designer self-service. **This is my top recommendation under the current constraints.**

### Option 2 — Publish the spec as a second Google Sheet, fetch all 3 tabs at runtime

**What:** Re-publish the three `drive/Описание лонгрида - *.csv` files as a separate Google Sheet (call it "Layer scheme") with one tab per CSV. Add three more sheet fetches at boot — one per tab. Define types matching the columns. Build the same `LAYER_STACKS_BY_SECTION` / `BASE_COMPOSITIONS` / `VECTOR_STYLES` structures from the fetched data instead of from static TS.

**Pros:**
- Design team can edit ordering and styles live without a code deploy.
- Single source of truth (the spec Sheet) for the design intent.
- Closest to the current data flow architecturally.

**Cons:**
- Three more fetches at boot. Each ~5-20 KB but it's network round-trips on the critical path.
- Three more places the referrer restriction has to be configured correctly.
- Sheets returning malformed cell values (typo in style name, blank cell) now break the app in production. Today, code-level types catch these at build time.
- Color picker → "232,89,137" RGB triple → MapLibre hex translation has to happen in the runtime parser. Easier to get wrong than baking once.
- Sheets API quotas: 100 requests per 100 seconds per user, 500 requests per 100 seconds per project. Fine for normal traffic; can be a problem if there's a bot scraping the site.

**Recommended if:** The design team will iterate on layer styles and ordering over many revisions, and they want a "save and refresh" loop.

### Option 3 — Extend the existing Google Sheet with style/order columns

**What:** Add columns to the existing sheet for `style`, `draw_order`, `base_id`. Restructure so each row represents one layer in one section, not one section with a flat fileList. Add a second tab for base compositions and a third for the style registry.

**Pros:** Single Sheets API integration, single referrer config, all the runtime flexibility of Option 2.

**Cons:** Heaviest schema change. Existing flat `fileList` semantics breaks. Code parser has to grow significantly. The existing sheet's tab named `Лист1` may already be referenced in other places I don't know about.

**Recommended if:** Option 2 is selected but you want to minimize the number of distinct documents the design team has to maintain. I do not recommend this.

### Option 4 — Move to a CMS

**What:** Move the longread copy + scheme to a headless CMS (Strapi, Sanity, Contentful) with proper schema.

**Pros:** Best authoring experience long-term. Versioned content. Reviewer workflows.

**Cons:** Massive overkill for a 13-section longread that's unlikely to be substantially revised again. Adds hosting cost and operational burden.

**Not recommended** unless this app evolves into a multi-piece content site.

---

## 6. Decision matrix

| Concern | Status quo | Option 1 (bake) | Option 2 (3 sheets) | Option 3 (extend sheet) | Option 4 (CMS) |
|---|---|---|---|---|---|
| Designer self-service | ✗ | ✗ | ✓ | ✓ | ✓✓ |
| Visual fidelity to spec | ✗ | ✓ | ✓ | ✓ | ✓ |
| Risk of runtime breakage | low | low | medium | medium | medium |
| Setup effort | 5 min | 5 h | 6–8 h | 8–10 h | days |
| Maintenance burden | none | low | medium | medium | high |
| Compatible with "no new spec-data flow" constraint | ✓ | ✓ | ✗ | ✗ | ✗ |

Given the user's stated constraint ("do not change the site to get any more data from the design spec, for now") and the fact that the longread is a one-shot narrative not a CMS-backed product, **Option 1 (bake the CSV spec into static code) is the recommended path** when Phase 5 is picked up. It honors design intent, avoids new runtime dependencies, and is straightforward TypeScript.

If, later, the design team wants live edits, Option 2 is the natural next step — and the Option 1 code structure (named styles, base compositions, per-section stacks) is directly portable to it.

---

## 7. Things to fix while we're here

- **The Sheets API key referrer restriction is the only thing standing between `amphitheater.pashteto.com` and full longread copy.** This is the immediate todo regardless of which long-term option you pick.
- **The fallback content does not match the design spec**. `fallbackContentItems` in `MainMap.tsx:49-131` was hand-written and only covers 10 of the 13 sections (and uses a different structure than the CSVs). When Phase 5 lands, regenerate the fallback from `drive/Описание лонгрида - лонгрид.csv` so a Sheets API outage looks closer to the design intent.
- **No timeout on the Sheets fetch.** `MainMap.tsx:194` is `await fetch(url)` with no `AbortController`. A slow Sheets API response blocks the longread from rendering until the request completes (or the browser's default timeout, ~30s). Trivial fix: 5s timeout, then fall back. Recommend adding when Phase 5 lands.
- **No retry on failure**. One transient 503 from Sheets and the entire session uses fallback. Could add a single retry with exponential backoff, but probably not worth it — fallback works.
- **The sheet might be lost if its owner leaves**. The sheet ID is hardcoded; if the owner deletes it or changes its sharing, the app silently falls back forever. Mitigation: own the sheet under a stable account (e.g. a `noreply@…` Google Workspace user), or move to Option 1.
