#!/usr/bin/env bash
# Prepare viewpoint map icons from the source photo archive.
#
# For every feature in src/assets/layers/Viewpoints.geojson, takes the source
# photo named by its `Name` property and produces two outputs, both keyed by the
# feature's fid (the MapLibre `icon-image` layer keys on <fid>):
#   - src/assets/viewpoint_images/<fid>.webp  — small square map icon with
#     rounded corners + white border + soft drop shadow baked in.
#   - src/assets/viewpoint_photos/<fid>.webp  — full-size photo shown in the
#     lightbox when an icon is clicked (longest side 1280, plain).
#
# Icon geometry is authored at 2x (registered with addImage pixelRatio:2), so
# the icons display at half these pixel sizes on the map.
#
# Requires: ImageMagick 7 (`magick`), python3. Re-runnable / idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-/Users/dodonovpavel/gateway_fm/REAL_WORLD_ASSETS/3-spb/gavr_mounty/Фото}"
GEOJSON="$ROOT/src/assets/layers/Viewpoints.geojson"
OUT="$ROOT/src/assets/viewpoint_images"
OUT_FULL="$ROOT/src/assets/viewpoint_photos"

INNER=68; TILE=76; CANVAS=84; RP=12; RT=16   # photo / white tile / canvas / radii
FULL=1280                                     # longest side of the lightbox photo

mkdir -p "$OUT" "$OUT_FULL"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# white rounded tile + (reused) shadow are constant across icons
magick -size ${TILE}x${TILE} xc:none -fill white \
  -draw "roundrectangle 0,0,$((TILE-1)),$((TILE-1)),$RT,$RT" "$tmp/tile.png"
magick -size ${CANVAS}x${CANVAS} xc:none -fill "rgba(0,0,0,0.45)" \
  -draw "roundrectangle 5,7,$((5+TILE-1)),$((7+TILE-1)),$RT,$RT" -blur 0x3 "$tmp/shadow.png"

ok=0; fail=0
while IFS=$'\t' read -r fid name; do
  # resolve source file case-insensitively (geojson casing != folder casing for some)
  f="$SRC/$name"
  [ -f "$f" ] || f="$(find "$SRC" -maxdepth 1 -iname "$name" | head -1)"
  if [ -z "${f:-}" ] || [ ! -f "$f" ]; then echo "MISSING source: $name (fid $fid)"; fail=$((fail+1)); continue; fi

  magick "$f" -auto-orient -strip -resize ${INNER}x${INNER}^ -gravity center -extent ${INNER}x${INNER} \
    \( -size ${INNER}x${INNER} xc:black -fill white -draw "roundrectangle 0,0,$((INNER-1)),$((INNER-1)),$RP,$RP" \) \
    -alpha off -compose CopyOpacity -composite "$tmp/inner.png"
  magick "$tmp/shadow.png" \
    \( "$tmp/tile.png" \) -gravity center -compose over -composite \
    \( "$tmp/inner.png" \) -gravity center -compose over -composite \
    -quality 90 "$OUT/$fid.webp"

  # full-size lightbox photo
  magick "$f" -auto-orient -strip -resize ${FULL}x${FULL}\> -quality 72 "$OUT_FULL/$fid.webp"
  ok=$((ok+1))
done < <(python3 -c "
import json
d=json.load(open('$GEOJSON'))
for ft in d['features']:
    p=ft['properties']; print(f\"{p['fid']}\t{p['Name']}\")
")

echo "viewpoint icons: ok=$ok fail=$fail -> $OUT"
echo "viewpoint photos (full): -> $OUT_FULL"
