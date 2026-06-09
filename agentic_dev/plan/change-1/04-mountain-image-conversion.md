# 04 — Mountain image conversion pipeline

> **Prerequisite for [03-mountain-info-popup.md](03-mountain-info-popup.md).** `03` imports `photoUrl(id)` from `mountainPhotos.ts`, which globs the WebPs produced by this file. Run this script (or commit its output) **before** starting `03`; the popup has no fallback when the WebP is missing.

## Status — implemented 2026-05-16

Shipped artifacts:

- `Map-View-Client/src/assets/mountain_images/{0601,1201,1202,1301,1302}.webp` (full, max 1200 px, `-q 85`).
- `Map-View-Client/src/assets/mountain_images/{0601,1201,1202,1301,1302}.thumb.webp` (max 480 px, `-q 80`).
- `Map-View-Client/src/mountainPhotos.ts` exporting `photoUrl(id, variant)` + `hasPhoto(id)` over a build-time `import.meta.glob`.

Output sizes: 30–55 KB per thumbnail, 157–416 KB per full — total **~1.6 MB** across the 10 files (plan estimated ~1 MB; full versions came in larger at q=85 but well under the original 52 MB payload). Build is green; the WebPs are **not** yet in `dist/assets/` because nothing imports `mountainPhotos.ts` (Vite tree-shakes the glob). They appear automatically once [03-mountain-info-popup.md](03-mountain-info-popup.md) consumes `photoUrl`.

Open items still requiring design input:

- **`1301`/`1302` linkage in `mountains.geojson`** — both PNGs were converted (4 of the 10 WebPs belong to them), but no feature has `"photo id": "1301"` or `"1302"` set. Either set the property on the two corresponding mountain features (design/data owner knows which) or delete those PNGs + the 4 WebPs to avoid ~150 KB of dead bundle weight after `03` lands.

## Context

`/Users/dodonovpavel/gavr_mounty/gavr_mounty/mountain_images_large/` holds 5 high-resolution PNGs (each 7–14 MB, total 52 MB) taken from mountain vantage points. The geojson features in `Map-View-Client/src/assets/layers/mountains.geojson` reference them by 4-digit `photo id` (e.g., `0601` → `0601.png`). Only 3 of the 229 mountains have photo IDs today (`0601`, `1201`, `1202`); the `1301`/`1302` PNGs are on disk but **not yet linked from `mountains.geojson`** — see "Phase-1 linkage step" below.

These PNGs cannot ship to the browser as-is (52 MB initial payload is unacceptable on metered connections). We need a web-optimized variant.

## Current state

- Source PNGs in `mountain_images_large/{0601,1201,1202,1301,1302}.png`, sizes 7.6 MB – 14 MB each.
- No corresponding files in `Map-View-Client/src/assets/`.
- `mountains.geojson` has `photo id` populated for 3 features (`0601`, `1201`, `1202`); `1301` and `1302` PNGs exist but aren't yet linked.

## Target state

- `Map-View-Client/src/assets/mountain_images/{id}.webp` — full-quality version at max 1200 px width, ~85% quality. Expected size: 80–150 KB each.
- `Map-View-Client/src/assets/mountain_images/{id}.thumb.webp` — thumbnail at max 480 px width, ~80% quality. Expected size: 20–35 KB each.
- Total bundle delta after conversion: ~1 MB across all 10 files (5 IDs × 2 variants).
- Build-time bundling via `import.meta.glob` so each file ends up content-hashed in `dist/assets/`.

## Tools

- `cwebp` is installed locally (`/opt/homebrew/bin/cwebp`). It comes from the `webp` Homebrew package; if a teammate doesn't have it, `brew install webp` installs it.

## Conversion command

```bash
# Run from the repo root.
mkdir -p Map-View-Client/src/assets/mountain_images

for src in mountain_images_large/*.png; do
  id="$(basename "$src" .png)"

  # Full-size — max 1200 px wide, 85% quality.
  cwebp -q 85 -resize 1200 0 "$src" \
        -o "Map-View-Client/src/assets/mountain_images/${id}.webp" -quiet

  # Thumbnail — max 480 px wide, 80% quality.
  cwebp -q 80 -resize 480 0 "$src" \
        -o "Map-View-Client/src/assets/mountain_images/${id}.thumb.webp" -quiet

  echo "→ ${id}.webp + ${id}.thumb.webp"
done

ls -lh Map-View-Client/src/assets/mountain_images/
```

`cwebp -resize 1200 0` means "resize to 1200 px wide, height auto-computed to preserve aspect". `-q` controls quality (0-100; default is 75, we go a notch higher for the full-size).

## Runtime usage (`mountainPhotos.ts`)

```ts
// Map-View-Client/src/mountainPhotos.ts

const photoModules = import.meta.glob('./assets/mountain_images/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const photoUrl = (id: string, variant: 'full' | 'thumb' = 'full'): string | null => {
  const suffix = variant === 'thumb' ? '.thumb' : ''
  return photoModules[`./assets/mountain_images/${id}${suffix}.webp`] ?? null
}

export const hasPhoto = (id: string | null | undefined): boolean =>
  id !== null && id !== undefined && photoUrl(id, 'thumb') !== null
```

Used by [03-mountain-info-popup.md](03-mountain-info-popup.md) — the popup and modal components import `photoUrl(id, 'thumb')` / `photoUrl(id, 'full')`.

## Browser support

WebP is supported on all modern browsers (Chrome, Edge, Safari ≥ 14, Firefox ≥ 65). The project targets desktop-first for the longread and reaches users on recent browsers; no JPEG/PNG fallback required.

## Phase-1 linkage step

Before this PR closes, either:

- **Link `1301`/`1302`** in `Map-View-Client/src/assets/layers/mountains.geojson` by setting the `"photo id"` property on the two corresponding mountain features (ask design / data owner which mountains these photos correspond to), or
- **Remove `1301.png`/`1302.png`** from `mountain_images_large/` if they aren't going to land in this PR — so the conversion script doesn't produce 4 dead WebPs in the bundle.

`hasPhoto(id)` returning `true` for unlinked photos is harmless (no feature references them) but bloats `dist/` by ~150 KB. Pick one of the two paths above.

## Verification

1. After running the conversion script:
   ```bash
   ls -lh Map-View-Client/src/assets/mountain_images/
   ```
   Expect 10 files, each in the 20–150 KB range. Total under ~1 MB.
2. `npm run build` in `Map-View-Client/` — verify each WebP appears in `dist/assets/` with a content-hash suffix (e.g., `0601-abc12345.webp`).
3. `npm run dev` → open the app, click a mountain with a photo → DevTools Network tab shows the thumbnail loading (~25 KB). Click thumbnail → full version loads (~100 KB). (Step 3 requires [03-mountain-info-popup.md](03-mountain-info-popup.md); for verifying `04` alone, stop at step 2.)
4. Spot-check image quality visually — at 480 px the thumbnails should be clearly readable; at 1200 px the full versions should be sharp enough for the modal view.

### Visual verification

**N/A** — this task produces asset files, not screens. The shared dashboard ([00-visual-test-framework.md](00-visual-test-framework.md)) does not cover this task. The WebPs do appear indirectly in plan 03's popup state, but that state itself has no Figma frame.

## Open questions

- Should we delete the source PNGs after conversion? **Recommendation**: keep `mountain_images_large/` untouched as the canonical source. It's outside the build path so it doesn't bloat the bundle.
- Should we add the conversion script as an npm task (`npm run convert-mountain-images`)? **Recommendation**: yes if the photo dataset grows quickly. Add a tiny `scripts/convert-mountain-images.sh` that's idempotent (only re-converts when source is newer).
- AVIF instead of WebP? AVIF compresses ~20% better at equivalent quality but encoders are slower and Safari support landed in 16.4. **Recommendation**: WebP for now; revisit AVIF if bundle size pressure justifies the toolchain cost.
- High-DPI variants (`@2x`)? Modal and fullscreen at 1200 px source are already comfortable on retina at typical viewing sizes. **Recommendation**: not needed.

## Future work (out of scope here)

- When the geojson gets more `photo id` entries, the same script auto-picks up new PNGs (its loop is `mountain_images_large/*.png`). No code change needed.
- A separate plan/issue should cover **photo attribution / EXIF stripping** for privacy if the dataset starts including non-team photos.
