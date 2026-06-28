#!/usr/bin/env python3
"""QML -> MapLibre style transfer tool.

Parses every `new_files/style/<layer>.qml` (QGIS 3.x renderer-v2 + labeling) and
emits a single normalized manifest `src/assets/styles/layer-styles.json`, keyed
by layer name. The runtime (`src/layerStyles.ts`) reads this manifest and maps it
onto MapLibre paint/layout.

Supported renderers:
  - singleSymbol         -> one symbol (fill / line / marker)
  - categorizedSymbol    -> attr + per-value symbols (fill/line/marker), emitted
                            as MapLibre `match` expressions at runtime
  - RuleRenderer         -> flattened to a categorized-like set keyed by the rule
                            label (best-effort; complex filters are approximated)

Supported symbol-layer classes:
  - SimpleFill           -> fill + outline
  - SimpleLine           -> line (incl. dash from `customdash`)
  - SimpleMarker         -> marker (triangle/circle/square) with size + outline
  - LinePatternFill      -> hatch (angle / spacing / line color+width)
  - CentroidFill         -> treated as marker (point label anchor)

Also parses the `labeling` block (`text-style`) into a label spec
(field, size_px, bold, italic, color, font, buffer) used for `inscription`
layers and any layer that shows text.

Units: QGIS MM -> px via PX_PER_MM (2.83), Point -> px via PT_PER_PX (1.333).
Colors: QGIS color strings always start with "r,g,b,a" (0-255); we read those
and ignore the trailing rgb:/hsv: float forms.

Run:  python scripts/qml_to_style.py
"""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_DIR = ROOT / "new_files" / "style"
OUT_PATH = ROOT / "src" / "assets" / "styles" / "layer-styles.json"

PX_PER_MM = 2.83          # QGIS assumes ~96 dpi; 1 mm ~= 2.83 px (1px = 0.2645 mm)
PX_PER_PT = 96.0 / 72.0   # 1.333


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def qcolor(value: str | None) -> str | None:
    """QGIS color "r,g,b,a,rgb:..." -> "rgba(r,g,b,a01)"."""
    if not value:
        return None
    parts = value.split(",")
    if len(parts) < 4:
        return None
    try:
        r, g, b, a = (int(float(parts[i])) for i in range(4))
    except ValueError:
        return None
    return f"rgba({r}, {g}, {b}, {round(a / 255, 4)})"


def width_to_px(value: str | None, unit: str | None) -> float | None:
    if value is None:
        return None
    try:
        v = float(value)
    except ValueError:
        return None
    if unit == "Point":
        return round(v * PX_PER_PT, 3)
    # default MM (also "MapUnit" falls back to MM-ish; acceptable approximation)
    return round(v * PX_PER_MM, 3)


def dash_from(opts: dict[str, str]) -> list[float] | None:
    line_style = opts.get("line_style") or opts.get("outline_style")
    use_custom = opts.get("use_custom_dash") == "1"
    if line_style != "dash" and not use_custom:
        return None
    raw = opts.get("customdash") or "5;2"
    try:
        return [float(x) for x in raw.split(";") if x.strip()]
    except ValueError:
        return [5, 2]


def opts_of(layer: ET.Element) -> dict[str, str]:
    """Read the <Option type="Map"> children directly under a symbol <layer>."""
    out: dict[str, str] = {}
    omap = layer.find("./Option[@type='Map']")
    if omap is None:
        return out
    for opt in omap.findall("./Option"):
        name = opt.get("name")
        if name is not None and "value" in opt.attrib:
            out[name] = opt.get("value", "")
    return out


# --------------------------------------------------------------------------- #
# symbol-layer parsing
# --------------------------------------------------------------------------- #
def parse_symbol_layer(layer: ET.Element) -> dict | None:
    cls = layer.get("class")
    o = opts_of(layer)

    if cls == "SimpleFill":
        res: dict = {"kind": "fill"}
        if o.get("style") not in (None, "no"):
            res["fill"] = {"color": qcolor(o.get("color"))}
        if o.get("outline_style") not in (None, "no"):
            res["outline"] = {
                "color": qcolor(o.get("outline_color")),
                "width_px": width_to_px(o.get("outline_width"), o.get("outline_width_unit")) or 1,
                "dasharray": dash_from(o),
            }
        return res

    if cls == "SimpleLine":
        return {
            "kind": "line",
            "line": {
                "color": qcolor(o.get("line_color")),
                "width_px": width_to_px(o.get("line_width"), o.get("line_width_unit")) or 1,
                "dasharray": dash_from(o),
            },
        }

    if cls == "SimpleMarker":
        size_px = width_to_px(o.get("size"), o.get("size_unit"))
        outline_px = width_to_px(o.get("outline_width"), o.get("outline_width_unit"))
        marker = {
            "shape": o.get("name", "circle"),
            "color": qcolor(o.get("color")),
            "size_px": round((size_px or 4) , 3),  # MM size = diameter
        }
        if o.get("outline_style") not in (None, "no") and outline_px:
            marker["outline"] = {
                "color": qcolor(o.get("outline_color")),
                "width_px": outline_px,
            }
        return {"kind": "marker", "marker": marker}

    if cls == "LinePatternFill":
        inner = layer.find("./symbol/layer[@class='SimpleLine']")
        line_o = opts_of(inner) if inner is not None else {}
        return {
            "kind": "hatch",
            "hatch": {
                "color": qcolor(line_o.get("line_color") or o.get("color")),
                "angle_deg": float(o.get("angle", 45) or 45),
                "spacing_px": round(float(o.get("distance", 2) or 2) * PX_PER_MM, 3),
                "line_width_px": width_to_px(o.get("line_width"), o.get("line_width_unit")) or 1,
            },
        }

    if cls == "CentroidFill":
        return {"kind": "marker", "marker": {"shape": "circle", "color": qcolor(o.get("color")), "size_px": 4}}

    return None


def merge_symbol(layers: list[ET.Element], alpha: float) -> dict:
    """Collapse a QGIS <symbol> (1+ symbol layers) into one normalized paint dict."""
    out: dict = {}
    for layer in layers:
        if layer.get("enabled") == "0":
            continue
        parsed = parse_symbol_layer(layer)
        if not parsed:
            continue
        kind = parsed["kind"]
        if kind == "fill":
            out.setdefault("geometry", "fill")
            if "fill" in parsed:
                out["fill"] = parsed["fill"]
            if "outline" in parsed:
                out["outline"] = parsed["outline"]
        elif kind == "line":
            # On a fill symbol an extra line layer is an outline; standalone -> line.
            if out.get("geometry") == "fill":
                out["outline"] = parsed["line"]
            else:
                out.setdefault("geometry", "line")
                out["line"] = parsed["line"]
        elif kind == "marker":
            out.setdefault("geometry", "marker")
            # keep the first (largest/top) marker as the representative
            out.setdefault("marker", parsed["marker"])
        elif kind == "hatch":
            out.setdefault("geometry", "fill")
            out["hatch"] = parsed["hatch"]
    if alpha is not None and alpha < 1:
        out["alpha"] = round(alpha, 3)
    return out


def symbol_layers(symbol: ET.Element) -> list[ET.Element]:
    """Direct child <layer> of a <symbol> (not the nested sub-symbol layers)."""
    return symbol.findall("./layer")


def symbol_alpha(symbol: ET.Element) -> float:
    try:
        return float(symbol.get("alpha", "1") or "1")
    except ValueError:
        return 1.0


# --------------------------------------------------------------------------- #
# labeling
# --------------------------------------------------------------------------- #
def parse_labeling(qgis: ET.Element) -> dict | None:
    ts = qgis.find("./labeling/settings/text-style")
    if ts is None:
        return None
    rendering = qgis.find("./labeling/settings/rendering")
    if rendering is not None and rendering.get("drawLabels") == "0":
        return None
    field = ts.get("fieldName")
    if not field:
        return None
    try:
        weight = int(ts.get("fontWeight", "50") or "50")
    except ValueError:
        weight = 50
    bold = weight >= 75 or ts.get("forcedBold") == "1"
    italic = ts.get("fontItalic") == "1" or ts.get("forcedItalic") == "1"
    size_pt = float(ts.get("fontSize", "10") or "10")
    label = {
        "field": field,
        "size_px": round(size_pt * PX_PER_PT, 2),
        "bold": bold,
        "italic": italic,
        "color": qcolor(ts.get("textColor")),
        "font": ts.get("fontFamily", "Open Sans"),
    }
    buf = ts.find("./text-buffer")
    if buf is not None and buf.get("bufferDraw") == "1":
        label["buffer"] = {
            "color": qcolor(buf.get("bufferColor")),
            "width_px": width_to_px(buf.get("bufferSize"), buf.get("bufferSizeUnits")) or 1,
        }
    return label


# --------------------------------------------------------------------------- #
# renderer parsing
# --------------------------------------------------------------------------- #
def parse_renderer(renderer: ET.Element) -> dict:
    rtype = renderer.get("type")

    if rtype == "singleSymbol":
        sym = renderer.find("./symbols/symbol")
        if sym is None:
            return {"renderer": "single"}
        paint = merge_symbol(symbol_layers(sym), symbol_alpha(sym))
        paint["renderer"] = "single"
        return paint

    if rtype == "categorizedSymbol":
        attr = renderer.get("attr")
        # map symbol-name -> value
        name_to_value: dict[str, str] = {}
        for cat in renderer.findall("./categories/category"):
            if cat.get("render") == "false":
                continue
            name_to_value[cat.get("symbol")] = cat.get("value", "")
        categories: dict[str, dict] = {}
        geometry = None
        for sym in renderer.findall("./symbols/symbol"):
            value = name_to_value.get(sym.get("name"))
            if value is None:
                continue
            paint = merge_symbol(symbol_layers(sym), symbol_alpha(sym))
            geometry = geometry or paint.get("geometry")
            categories[value] = paint
        default = None
        src = renderer.find("./source-symbol/symbol")
        if src is not None:
            default = merge_symbol(symbol_layers(src), symbol_alpha(src))
        return {
            "renderer": "categorized",
            "attr": attr,
            "geometry": geometry,
            "categories": categories,
            **({"default": default} if default else {}),
        }

    if rtype == "RuleRenderer":
        rules = []
        for rule in renderer.findall("./rules/rule"):
            filt = rule.get("filter")
            label = rule.get("label") or filt or ""
            sym_name = rule.get("symbol")
            sym = renderer.find(f"./symbols/symbol[@name='{sym_name}']")
            if sym is None:
                continue
            paint = merge_symbol(symbol_layers(sym), symbol_alpha(sym))
            paint["filter"] = filt
            paint["label"] = label
            rules.append(paint)
        return {"renderer": "rule", "rules": rules}

    return {"renderer": rtype or "unknown"}


def parse_qml(path: Path) -> dict | None:
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        print(f"  ! parse error {path.name}: {exc}")
        return None
    qgis = tree.getroot()
    renderer = qgis.find("./renderer-v2")
    if renderer is None:
        return None
    style = parse_renderer(renderer)

    op = qgis.find("./layerOpacity")
    if op is not None and op.text:
        try:
            style["layer_opacity"] = round(float(op.text), 3)
        except ValueError:
            pass

    label = parse_labeling(qgis)
    if label:
        style["label"] = label
    return style


def main() -> None:
    layers: dict[str, dict] = {}
    for qml in sorted(STYLE_DIR.glob("*.qml")):
        name = qml.stem
        style = parse_qml(qml)
        if style is not None:
            layers[name] = style
            print(f"  + {name} ({style.get('renderer')})")
        else:
            print(f"  - {name}: no renderer-v2")

    manifest = {
        "_generated_by": "scripts/qml_to_style.py",
        "_note": "Normalized QGIS QML styles. Do not hand-edit; rerun the tool.",
        "px_per_mm": PX_PER_MM,
        "layers": layers,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH} with {len(layers)} layers")


if __name__ == "__main__":
    main()
