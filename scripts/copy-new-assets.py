#!/usr/bin/env python3
"""Copy layer geojson, viewpoints, QML styles, and longread photos from new_files/ into src/assets/."""
import glob
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEW = ROOT / "new_files"
LAYERS = ROOT / "src" / "assets" / "layers"
SECTIONS = ROOT / "src" / "assets" / "styles" / "sections"
BASE_STYLES = ROOT / "src" / "assets" / "styles"
LONGREAD = ROOT / "src" / "assets" / "longread"

# Not referenced by any id_map; ~948 MB — skip to keep dist lean.
SKIP_LAYER_FILES = {"isoline_2m.geojson"}

for src in glob.glob(str(NEW / "layers" / "*.geojson")):
    if Path(src).name in SKIP_LAYER_FILES:
        continue
    shutil.copy2(src, LAYERS)

shutil.copy2(NEW / "1" / "Viewpoints.geojson", LAYERS / "Viewpoints.geojson")

for src in glob.glob(str(NEW / "style" / "*.qml")):
    shutil.copy2(src, SECTIONS)

for name in ("isoline_5m.qml", "sectors_level.qml", "amphitheater_bound.qml"):
    shutil.copy2(NEW / "style" / name, BASE_STYLES / name)

LONGREAD.mkdir(parents=True, exist_ok=True)
photos_dir = NEW / "photos"
if photos_dir.is_dir():
    for src in photos_dir.iterdir():
        if src.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            shutil.copy2(src, LONGREAD / src.name)

print("Copied layers:", len(glob.glob(str(LAYERS / "*.geojson"))))
print("Copied section qml:", len(glob.glob(str(SECTIONS / "*.qml"))))
print("Copied longread photos:", len(glob.glob(str(LONGREAD / "*.*"))))
