#!/usr/bin/env python3
"""Generate src/fallbackLongread.ts from new_legend/Лонгрид_1.csv."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "new_legend" / "Лонгрид_1.csv"
OUT_PATH = ROOT / "src" / "fallbackLongread.ts"

items = []
with CSV_PATH.open(encoding="utf-8-sig") as f:
    reader = csv.DictReader(f, delimiter=";")
    for i, row in enumerate(reader):
        chapter = (row.get("Chapter") or "").strip()
        subtitle = (row.get("Subtitle") or "").strip()
        description = (row.get("Description") or "").strip()
        media = (row.get("Media Link") or "").strip()
        id_map_raw = (row.get("id _map") or "").strip()
        id_map = int(id_map_raw) if id_map_raw.isdigit() else None

        title = subtitle or chapter or f"Раздел {i + 1}"
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:40].strip("-") or f"item-{i}"
        item_id = f"longread-{i}-{slug}"

        entry = {
            "id": item_id,
            "title": title,
            "fileList": [],
            "description": description,
            "base_id": 1,
        }
        if chapter:
            entry["chapter"] = chapter
        if id_map is not None:
            entry["id_map"] = id_map
        if media:
            entry["mediaLink"] = media
        items.append(entry)

OUT_PATH.write_text(
    "import type { ContentItem } from './contentTypes'\n\n"
    f"export const fallbackLongreadItems: ContentItem[] = {json.dumps(items, ensure_ascii=False, indent=2)}\n",
    encoding="utf-8",
)
print(f"Wrote {len(items)} items to {OUT_PATH}")
