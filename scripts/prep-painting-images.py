#!/usr/bin/env python3
"""Prepare painting map icons (84×84 @2x) from public/object_photos/21/.

Output: src/assets/painting_images/{fid}.webp — same rounded-tile look as viewpoints.
Requires: Pillow (`pip install pillow`).
"""
from __future__ import annotations

import json
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "public" / "object_photos" / "21"
GEOJSON = ROOT / "src" / "assets" / "layers" / "21_живопись.geojson"
OUT = ROOT / "src" / "assets" / "painting_images"

INNER = 68
TILE = 76
CANVAS = 84
RP = 12
RT = 16


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def prep_icon(source: Path, dest: Path) -> bool:
    try:
        photo = Image.open(source).convert("RGBA")
    except OSError:
        return False
    photo = photo.resize((INNER, INNER), Image.Resampling.LANCZOS)
    inner_mask = rounded_mask(INNER, RP)
    photo.putalpha(inner_mask)

    tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    tile_draw = ImageDraw.Draw(tile)
    tile_draw.rounded_rectangle((0, 0, TILE - 1, TILE - 1), radius=RT, fill=(255, 255, 255, 255))

    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((5, 7, 5 + TILE - 1, 7 + TILE - 1), radius=RT, fill=(0, 0, 0, 115))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=3))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(shadow)
    ox = (CANVAS - TILE) // 2
    oy = (CANVAS - TILE) // 2
    canvas.alpha_composite(tile, (ox, oy))
    px = ox + (TILE - INNER) // 2
    py = oy + (TILE - INNER) // 2
    canvas.alpha_composite(photo, (px, py))

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, format="WEBP", quality=90)
    return True


def main() -> None:
    if not GEOJSON.is_file():
        print(f"Missing {GEOJSON}")
        return
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    ok = fail = 0
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        fid = props.get("fid")
        if fid is None:
            continue
        fid_s = str(fid)
        source = None
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            candidate = PHOTOS / f"{fid_s}{ext}"
            if candidate.is_file():
                source = candidate
                break
        if not source:
            fail += 1
            continue
        if prep_icon(source, OUT / f"{fid_s}.webp"):
            ok += 1
        else:
            fail += 1
    print(f"painting icons: ok={ok} fail={fail} -> {OUT}")


if __name__ == "__main__":
    main()
