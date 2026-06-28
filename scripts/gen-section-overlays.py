#!/usr/bin/env python3
"""Generate section-overlays.json from new_legend/Порядок_слоев.csv."""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "new_legend" / "Порядок_слоев.csv"
OUT_PATH = ROOT / "src" / "assets" / "sections" / "section-overlays.json"

# name_layer in CSV -> runtime layer name (geojson basename without extension)
NAME_FIX = {
    "walking routes": "walking_routes",
}

STYLE_FIX = {
    "walking routes": "walking_routes",
}

# CSV leaves name_layer_ru blank for historical_zones_* — use longread section titles.
LABEL_FIX = {
    "historical_zones_1": "Южные усадьбы",
    "historical_zones_2": "Дудергофские высоты",
    "historical_zones_3": "Путиловское плато",
    "historical_zones_4": "Колтушская возвышенность",
    "historical_zones_5": "Чухонская Швейцария",
}

sets: dict[str, dict] = defaultdict(lambda: {"default_base": 1, "layers": []})

with CSV_PATH.open(encoding="utf-8-sig") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        id_map = row["id _map"].strip()
        if not id_map:
            continue
        click = row.get("id_layer_click", "").strip()
        name_raw = row.get("name_layer", "").strip()
        label = row.get("name_layer_ru", "").strip() or name_raw
        style_raw = row.get("name_vector_style", "").strip()

        if not name_raw:
            continue

        name = NAME_FIX.get(name_raw, name_raw)
        style = STYLE_FIX.get(style_raw, style_raw) if style_raw else name
        mandatory = click == "1"
        display_label = LABEL_FIX.get(name, label)

        sets[id_map]["layers"].append({
            "name": name,
            "style": style,
            "mandatory": mandatory,
            "label": display_label,
        })

# Viewpoints / painting / photo sections — no vector layers in CSV rows.
for empty_id in (1, 21, 23):
    sets.setdefault(str(empty_id), {"default_base": 1, "layers": []})

styles = {
    "mount": {
        "type": "point-symbol",
        "icon": "▲",
        "color": "rgb(0, 0, 0)",
        "halo_color": "rgba(255, 255, 255, 0.9)",
        "halo_width_px": 1,
        "size_px": {"z_low": 9, "size_low": 10, "z_high": 14, "size_high": 14},
        "qml": "src/assets/styles/sections/mount.qml",
    },
    "mount_polygon": {
        "qml": "src/assets/styles/sections/mount_polygon.qml",
        "fill": {"color": "rgb(185, 219, 210)", "opacity": 0.25},
        "outline": {"color": "rgb(143, 209, 187)", "width_px": 1.3},
    },
    "mask_stage": {
        "qml": "src/assets/styles/sections/mask_stage.qml",
        "fill": {"color": "rgb(0, 0, 0)", "opacity": 0.35},
        "outline": {"color": "rgba(35, 35, 35, 0)", "width_px": 0.736},
    },
    "mask_parter": {
        "qml": "src/assets/styles/sections/mask_parter.qml",
        "fill": {"color": "rgb(0, 0, 0)", "opacity": 0.35},
        "outline": {"color": "rgba(35, 35, 35, 0)", "width_px": 0.736},
    },
    "mask_belletazh": {
        "qml": "src/assets/styles/sections/mask_belletazh.qml",
        "fill": {"color": "rgb(0, 0, 0)", "opacity": 0.35},
        "outline": {"color": "rgba(35, 35, 35, 0)", "width_px": 0.736},
    },
    "mask_balcon": {
        "qml": "src/assets/styles/sections/mask_balcon.qml",
        "fill": {"color": "rgb(0, 0, 0)", "opacity": 0.35},
        "outline": {"color": "rgba(35, 35, 35, 0)", "width_px": 0.736},
    },
    "mask_amphitheater": {
        "qml": "src/assets/styles/sections/mask_amphitheater.qml",
        "fill": {"color": "rgb(0, 0, 0)", "opacity": 0.35},
        "outline": {"color": "rgba(35, 35, 35, 0)", "width_px": 0.736},
    },
    "vomitoria": {
        "qml": "src/assets/styles/sections/vomitoria.qml",
        "line": {"color": "rgb(29, 70, 205)", "width_px": 1.9},
    },
    "landscape_450": {
        "qml": "src/assets/styles/sections/landscape_450.qml",
        "fill": {"color": "rgb(244, 154, 90)", "opacity": 0.4},
    },
    "landscape_12": {
        "qml": "src/assets/styles/sections/landscape_12.qml",
        "fill_categories": {
            "property": "Ландшафт",
            "opacity": 0.4,
            "cases": {
                "Колтушская возвышенность": "rgb(244,154,90)",
                "Лемболовская возвышенность": "rgb(255,133,60)",
                "Озерковские косы": "rgb(224,23,23)",
                "Румболовская возвышенность": "rgb(244,154,90)",
                "Юкковская гряда": "rgb(219,135,122)",
            },
            "default": "rgb(244,154,90)",
        },
    },
    "landscape_7": {
        "qml": "src/assets/styles/sections/landscape_7.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.35},
    },
    "landscape_2,5": {
        "qml": "src/assets/styles/sections/landscape_2,5.qml",
        "fill": {"color": "rgb(202, 207, 90)", "opacity": 0.4},
    },
    "Finns": {
        "qml": "src/assets/styles/sections/Finns.qml",
        "fill": {"color": "rgb(29, 70, 205)", "opacity": 0.6},
        "outline": {"color": "rgb(29, 70, 205)", "width_px": 1.0},
    },
    "historical_resettlement": {
        "qml": "src/assets/styles/sections/historical_resettlement.qml",
        "fill": {"color": "rgba(89, 89, 89, 0.4784)"},
    },
    "maki_selki": {
        "qml": "src/assets/styles/sections/maki_selki.qml",
        "fill": {"color": "rgb(50, 126, 105)", "opacity": 0.35},
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.0},
    },
    "estate": {
        "qml": "src/assets/styles/sections/estate.qml",
        "fill": {"color": "rgb(56, 62, 81)", "opacity": 0.7},
        "outline": {"color": "rgb(56, 62, 81)", "width_px": 1.0},
    },
    "historical_zones_1": {
        "qml": "src/assets/styles/sections/historical_zones_1.qml",
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.9, "dasharray": [1, 2]},
    },
    "historical_zones_2": {
        "qml": "src/assets/styles/sections/historical_zones_2.qml",
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.9, "dasharray": [1, 2]},
    },
    "historical_zones_3": {
        "qml": "src/assets/styles/sections/historical_zones_3.qml",
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.9, "dasharray": [1, 2]},
    },
    "historical_zones_4": {
        "qml": "src/assets/styles/sections/historical_zones_4.qml",
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.9, "dasharray": [1, 2]},
    },
    "historical_zones_5": {
        "qml": "src/assets/styles/sections/historical_zones_5.qml",
        "outline": {"color": "rgb(35, 35, 35)", "width_px": 1.9, "dasharray": [1, 2]},
    },
    "paragliding_clubs": {
        "qml": "src/assets/styles/sections/paragliding_clubs.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.5},
    },
    "horse_riding_clubs": {
        "qml": "src/assets/styles/sections/horse_riding_clubs.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.5},
    },
    "ski_resorts": {
        "qml": "src/assets/styles/sections/ski_resorts.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.5},
    },
    "golf_clubs": {
        "qml": "src/assets/styles/sections/golf_clubs.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.5},
    },
    "motocross": {
        "qml": "src/assets/styles/sections/motocross.qml",
        "fill": {"color": "rgb(141, 90, 153)", "opacity": 0.5},
    },
    "walking_routes": {
        "qml": "src/assets/styles/sections/walking_routes.gpk_-_walking_routes.qml",
        "line": {"color": "rgb(29, 70, 205)", "width_px": 2.0},
    },
}

manifest = {
    "_comment": "23 id_map overlay stacks ported 2026-06-18 from new_legend/Порядок_слоев.csv. Single base composition #1.",
    "sets": {k: sets[k] for k in sorted(sets.keys(), key=int)},
    "styles": styles,
    "px_per_mm_assumption": 2.83,
}

OUT_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {OUT_PATH} with {len(sets)} sets")
