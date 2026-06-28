#!/usr/bin/env python3
"""Remove geojson files from src/assets/layers that are not listed in src/layerUrls.ts."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URLS = ROOT / "src" / "layerUrls.ts"
LAYERS = ROOT / "src" / "assets" / "layers"

keep = set(re.findall(r'^\s+"([^"]+\.geojson)":', URLS.read_text(encoding="utf-8"), re.MULTILINE))
removed: list[str] = []
for path in LAYERS.glob("*.geojson"):
    if path.name not in keep:
        path.unlink()
        removed.append(path.name)

print(f"Kept {len(keep)} whitelisted layers")
print(f"Removed {len(removed)} legacy geojson files")
