#!/usr/bin/env python3
"""Generate src/assets/sections/section-overlays.json from new_legend/LAYERS.csv.

Comma-delimited CSV with columns:
  id_map, id_layer_click, name_layer, name_folder, name_folder_vector,
  inscription, name_layer_ru, name_layer_ru_style, Click_trigger

Faithful transform notes (see agentic_dev/new-legend-TZ.md §1.2):
  - `name_layer` is sometimes a *classification value* rather than a file:
      * mount: холм / возвышенность / гора  → one categorized layer `mount` (attr `type`)
      * estate: Дача / Дом / Вилла / Особняк / Мыза / Усадьба / Дворец
                                            → one categorized layer `estate`
                                              (attr `Типология владения`)
    Such rows are collapsed into a single map layer; each row becomes a legend
    `category` (value + ru label + per-value click_trigger).
  - `name_layer_ru_style == "name"` marks a layer classified by the geojson
    `name` attribute (landscape_*, routes). The generator reads the geojson and
    bakes the unique attribute values as legend categories.
  - `finns_*` are 10 separate geojson files (no per-file QML style → runtime
    fallback paint).
  - empty `name_layer` + `inscription` = a centroid label layer (file
    `<inscription>.geojson`), recorded under `inscriptions` for Phase 2.
  - empty `name_layer` + `name_folder` = a photo-folder entry (Phase 2),
    recorded under `photo_folders`.
  - `name_folder_vector` rows pair a point layer with a polygon folder
    (Phase 2 point→polygon), recorded under `folder_vectors`.

The hand-tuned `styles` block (consumed by src/layerStyles.ts as an augment
source) is preserved verbatim from the previous section-overlays.json so QML
augment-only merging from Phase 0 is never broken.
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "new_legend" / "LAYERS.csv"
LAYERS_DIR = ROOT / "new_files" / "layers"
OUT_PATH = ROOT / "src" / "assets" / "sections" / "section-overlays.json"

# --- classification-value groups: row name_layer -> parent (file/style/attr) ---
MOUNT_VALUES = {"холм", "возвышенность", "гора"}
ESTATE_VALUES = {"Дача", "Дом", "Вилла", "Особняк", "Мыза", "Усадьба", "Дворец"}

GROUP_OF_VALUE: dict[str, str] = {}
for v in MOUNT_VALUES:
    GROUP_OF_VALUE[v] = "mount"
for v in ESTATE_VALUES:
    GROUP_OF_VALUE[v] = "estate"

GROUP_META = {
    "mount": {"file": "mount", "style": "mount", "attr": "type", "label": "Горы, холмы и возвышенности"},
    "estate": {"file": "estate", "style": "estate", "attr": "type", "label": "Усадьбы и дачи"},
}

# Layers classified by the geojson `name` attribute (name_layer_ru_style=name)
# but missing a Russian legend label — friendly group labels for the panel.
GROUP_LABEL = {
    "mount_polygon": "Горные массивы",
    "landscape_450": "Ландшафт 450 млн лет назад",
    "landscape_2,5": "Ландшафт 2,5 млн лет назад",
    "landscape_12": "Ландшафт 12 тыс. лет назад",
    "landscape_7": "Ландшафт 7 тыс. лет назад",
    "routes": "Пешеходные маршруты",
}

# name_layer / name_folder_vector -> actual geojson basename when they differ.
NAME_FIX = {
    "23_1": "23_1_points",
    "23_2": "23_2_viewshed",
}


def _bool(value: str) -> bool:
    return (value or "").strip() == "1"


def _layer_file_exists(name: str) -> bool:
    return (LAYERS_DIR / f"{name}.geojson").is_file()


def _unique_attr_values(file_name: str, attr: str) -> list[str]:
    """Distinct, order-preserving values of `attr` across a geojson file."""
    path = LAYERS_DIR / f"{file_name}.geojson"
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    seen: list[str] = []
    for feat in data.get("features", []):
        val = (feat.get("properties") or {}).get(attr)
        if val is None:
            continue
        val = str(val).strip()
        if val and val not in seen:
            seen.append(val)
    return seen


def apply_qa_finns_id_map_overrides(sets: dict[int, dict]) -> None:
    """Hand-tuned id_map 12/13/14 split (PLAN-QA-2026-07, HANDOFF-2026-07-03).

    CSV still lists the old combined stacks; runtime needs:
      12 — historical_resettlement only (+ dynamic name labels)
      13 — maki_selki only (+ dynamic name labels)
      14 — historical_resettlement + all finns_* + inscription 12.geojson
    """
    old12 = sets.get(12)
    if not old12:
        return

    finns = [layer for layer in old12["layers"] if layer["name"].startswith("finns_")]
    historical = next(
        (layer for layer in old12["layers"] if layer["name"] == "historical_resettlement"),
        None,
    )
    maki = next(
        (layer for layer in sets.get(13, {}).get("layers", []) if layer["name"] == "maki_selki"),
        None,
    )
    if not historical or not maki:
        return

    hist12 = {**historical, "click_trigger": True, "order": 1}
    maki13 = {**maki, "click_trigger": True, "order": 1}
    hist14 = {**historical, "click_trigger": False, "order": 1}
    finns14 = [{**layer, "order": idx + 2} for idx, layer in enumerate(finns)]

    sets[12] = {
        "default_base": 1,
        "layers": [hist12],
        "inscriptions": [],
        "photo_folders": [],
        "folder_vectors": [],
    }
    sets[13] = {
        "default_base": 1,
        "layers": [maki13],
        "inscriptions": [],
        "photo_folders": [],
        "folder_vectors": [],
    }
    sets[14] = {
        "default_base": 1,
        "layers": [hist14, *finns14],
        "inscriptions": [{"name": "12", "order": 11}],
        "photo_folders": [],
        "folder_vectors": [],
    }


def apply_mount_and_activity_click_overrides(sets: dict[int, dict]) -> None:
    """Mount hills/elevations + id_map 22 «Горы сейчас» activity layers — all clickable like «гора»."""
    for id_map in (1, 2):
        bucket = sets.get(id_map)
        if not bucket:
            continue
        for layer in bucket.get("layers", []):
            if layer.get("name") != "mount":
                continue
            layer["click_trigger"] = True
            for cat in layer.get("categories") or []:
                if cat.get("value") in MOUNT_VALUES:
                    cat["click_trigger"] = True

    bucket22 = sets.get(22)
    if bucket22:
        for layer in bucket22.get("layers", []):
            layer["click_trigger"] = True

    bucket23 = sets.get(23)
    if bucket23:
        for layer in bucket23.get("layers", []):
            if layer.get("name") != "routes":
                continue
            layer["click_trigger"] = True
            for cat in layer.get("categories") or []:
                cat["click_trigger"] = True


def load_existing_styles() -> dict:
    """Reuse the hand-tuned `styles` block so we never regress calibrated paint."""
    if OUT_PATH.is_file():
        try:
            prev = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            if isinstance(prev.get("styles"), dict):
                return prev["styles"]
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def main() -> None:
    sets: dict[int, dict] = defaultdict(
        lambda: {
            "default_base": 1,
            "layers": [],
            "inscriptions": [],
            "photo_folders": [],
            "folder_vectors": [],
        }
    )
    # map layer index per (id_map, parent file) so classification rows merge.
    group_index: dict[tuple[int, str], int] = {}
    missing: list[str] = []

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            id_map = (row.get("id_map") or "").strip()
            if not id_map:
                continue
            id_map_i = int(id_map)
            order = int((row.get("id_layer_click") or "0").strip() or 0)
            name_layer = (row.get("name_layer") or "").strip()
            folder = (row.get("name_folder") or "").strip()
            folder_vector = (row.get("name_folder_vector") or "").strip()
            inscription = (row.get("inscription") or "").strip()
            label_ru = (row.get("name_layer_ru") or "").strip()
            classify = (row.get("name_layer_ru_style") or "").strip()
            click = _bool(row.get("Click_trigger"))

            bucket = sets[id_map_i]

            # --- inscription-only row (centroid labels, Phase 2) ---
            if not name_layer and inscription:
                if _layer_file_exists(inscription):
                    bucket["inscriptions"].append({"name": inscription, "order": order})
                else:
                    missing.append(f"inscription {inscription} (id_map {id_map_i})")
                continue

            # --- photo-folder row (Phase 2) ---
            if not name_layer and folder:
                bucket["photo_folders"].append(
                    {"folder": folder, "label": label_ru, "click_trigger": click, "order": order}
                )
                continue

            # --- folder_vector row: polygon folder paired with a point layer (Phase 2) ---
            if not name_layer and folder_vector:
                resolved_fv = NAME_FIX.get(folder_vector, folder_vector)
                if _layer_file_exists(resolved_fv):
                    bucket["folder_vectors"].append(
                        {"folder_vector": resolved_fv, "click_trigger": click, "order": order}
                    )
                else:
                    missing.append(f"folder_vector {resolved_fv} (id_map {id_map_i})")
                continue

            if not name_layer:
                continue

            # --- classification-value rows collapse into one categorized layer ---
            group = GROUP_OF_VALUE.get(name_layer)
            if group:
                meta = GROUP_META[group]
                key = (id_map_i, meta["file"])
                cat = {"value": name_layer, "label": label_ru or name_layer, "click_trigger": click}
                if key in group_index:
                    layer = bucket["layers"][group_index[key]]
                    layer["categories"].append(cat)
                    if click:
                        layer["click_trigger"] = True
                else:
                    group_index[key] = len(bucket["layers"])
                    bucket["layers"].append(
                        {
                            "name": meta["file"],
                            "style": meta["style"],
                            "mandatory": True,
                            "label": meta["label"],
                            "classify": meta["attr"],
                            "click_trigger": click,
                            "inscription": "",
                            "folder": "",
                            "folder_vector": "",
                            "order": order,
                            "categories": [cat],
                        }
                    )
                continue

            # --- ordinary file-backed layer ---
            file_name = NAME_FIX.get(name_layer, name_layer)
            if not _layer_file_exists(file_name):
                missing.append(f"{file_name} (id_map {id_map_i})")
            layer = {
                "name": file_name,
                "style": name_layer,
                "mandatory": True,
                "label": label_ru or GROUP_LABEL.get(name_layer, name_layer),
                "classify": classify,
                "click_trigger": click,
                "inscription": inscription,
                "folder": folder,
                "folder_vector": folder_vector,
                "order": order,
            }
            # name-classified layers: bake unique attribute values as legend rows.
            if classify == "name":
                values = _unique_attr_values(file_name, "name")
                if values:
                    layer["categories"] = [{"value": v, "label": v, "click_trigger": False} for v in values]
            bucket["layers"].append(layer)

    # Sort each set's layers by their CSV order.
    for bucket in sets.values():
        bucket["layers"].sort(key=lambda l: l["order"])
        bucket["inscriptions"].sort(key=lambda i: i["order"])
        bucket["folder_vectors"].sort(key=lambda fv: fv["order"])
        bucket["photo_folders"].sort(key=lambda p: p["order"])

    apply_qa_finns_id_map_overrides(sets)
    apply_mount_and_activity_click_overrides(sets)

    manifest = {
        "_comment": "Per-id_map overlay stacks, generated by scripts/gen-layers.py from new_legend/LAYERS.csv. The `styles` block is hand-tuned (consumed by src/layerStyles.ts as an augment source) and preserved across regenerations.",
        "sets": {str(k): sets[k] for k in sorted(sets.keys())},
        "styles": load_existing_styles(),
        "px_per_mm_assumption": 2.83,
    }

    OUT_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(ROOT)} with {len(sets)} sets")
    if missing:
        print("WARNING: referenced layer files not found in new_files/layers:")
        for m in missing:
            print("  -", m)


if __name__ == "__main__":
    main()
