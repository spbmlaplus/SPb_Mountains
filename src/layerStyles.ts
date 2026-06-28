// Vector layer styles, derived from three manifests:
//   - `src/assets/styles/layer-styles.json`        (QML-derived, augment-only)
//   - `src/assets/sections/section-overlays.json`  (per-section overlay styles)
//   - `src/assets/styles/base-composition.json`    (base composition #1)
//
// Priority (lowest → highest, later wins on collision): QML augment source,
// then the hand-tuned section overlay styles, then the calibrated base
// composition vector styles. The base values are the user-tuned baseline so
// they're merged last and win.

import baseCompositionManifest from './assets/styles/base-composition.json'
import sectionOverlaysManifest from './assets/sections/section-overlays.json'
import qmlLayerStylesManifest from './assets/styles/layer-styles.json'

import type maplibregl from 'maplibre-gl'

export type LayerStyle = {
  type?: 'fill' | 'point-symbol'
  symbol?: {
    icon: string
    shape?: 'triangle' | 'circle'
    // `color`/`size` may be MapLibre `match` expressions (categorized markers).
    color: string | maplibregl.ExpressionSpecification
    halo_color?: string
    halo_width?: number
    size: number | maplibregl.ExpressionSpecification
  }
  fill?: { color: string; opacity: number }
  // Categorized fill: one color per value of `property`, emitted as a MapLibre
  // `match` expression. Used for QGIS categorizedSymbol layers (e.g. land-use
  // and landscape overlays). Hatch-per-category from QGIS is approximated as a
  // solid per-category fill.
  fillCategories?: { property: string; opacity: number; cases: Record<string, string>; default: string }
  hatch?: { color: string; opacity: number; angleDeg: number; spacingPx: number; lineWidthPx: number }
  outline?: { color: string | maplibregl.ExpressionSpecification; width: number; opacity?: number; dasharray?: number[] }
  line?: { color: string; width: number; dasharray?: number[]; opacity?: number }
  // Label config parsed from the QGIS `labeling` block. Not yet consumed by the
  // runtime (planned for the inscription/label work in a later phase); kept here
  // so the data survives from `layer-styles.json` to the renderer.
  label?: {
    field: string
    sizePx: number
    bold: boolean
    italic: boolean
    color?: string
    font?: string
    halo?: { color?: string; width: number }
  }
}

type ManifestPaint = {
  color: string
  opacity?: number
  width_px?: number
  dasharray?: number[]
}

type ManifestSizeRamp = {
  z_low: number
  size_low: number
  z_high: number
  size_high: number
}

type ManifestHatch = {
  color: string
  opacity?: number
  angle_deg?: number
  spacing_px?: number
  line_width_px?: number
}

type ManifestStyle = {
  type?: 'point-symbol'
  icon?: string
  color?: string
  halo_color?: string
  halo_width_px?: number
  size_px?: ManifestSizeRamp
  fill?: ManifestPaint
  fill_categories?: { property: string; opacity?: number; cases: Record<string, string>; default?: string }
  hatch?: ManifestHatch
  outline?: ManifestPaint
  line?: ManifestPaint
}

const styleFromManifest = (style: ManifestStyle): LayerStyle => {
  if (style.type === 'point-symbol') {
    const ramp = style.size_px
    const size: number | maplibregl.ExpressionSpecification = ramp
      ? ([
          'interpolate',
          ['linear'],
          ['zoom'],
          ramp.z_low,
          ramp.size_low,
          ramp.z_high,
          ramp.size_high,
        ] as maplibregl.ExpressionSpecification)
      : 12
    return {
      type: 'point-symbol',
      symbol: {
        icon: style.icon ?? '▲',
        shape: shapeForMarker(style.icon === '▲' ? 'triangle' : 'circle'),
        color: style.color ?? 'rgb(40, 40, 40)',
        halo_color: style.halo_color,
        halo_width: style.halo_width_px,
        size,
      },
    }
  }

  return {
    fill: style.fill && {
      color: style.fill.color,
      opacity: style.fill.opacity ?? 1,
    },
    fillCategories: style.fill_categories && {
      property: style.fill_categories.property,
      opacity: style.fill_categories.opacity ?? 1,
      cases: style.fill_categories.cases,
      default: style.fill_categories.default ?? 'rgba(0,0,0,0)',
    },
    hatch: style.hatch && {
      color: style.hatch.color,
      opacity: style.hatch.opacity ?? 0.6,
      angleDeg: style.hatch.angle_deg ?? 45,
      spacingPx: style.hatch.spacing_px ?? 8,
      lineWidthPx: style.hatch.line_width_px ?? 1.5,
    },
    outline: style.outline && {
      color: style.outline.color,
      width: style.outline.width_px ?? 1,
      opacity: style.outline.opacity,
      dasharray: style.outline.dasharray,
    },
    line: style.line && {
      color: style.line.color,
      width: style.line.width_px ?? 1,
      opacity: style.line.opacity,
      dasharray: style.line.dasharray,
    },
  }
}

// --------------------------------------------------------------------------- #
// QML-derived manifest (`src/assets/styles/layer-styles.json`, emitted by
// `scripts/qml_to_style.py`). This is a *fallback* source: it only fills layers
// that have no hand-tuned style in the section/base manifests (those win on
// collision — see VECTOR_STYLES below). The schema mirrors the Python tool.
// --------------------------------------------------------------------------- #
type QmlColor = string | null
type QmlPaint = { color?: QmlColor }
type QmlStroke = { color?: QmlColor; width_px?: number; dasharray?: number[] | null }
type QmlMarker = { shape?: string; color?: QmlColor; size_px?: number; outline?: QmlStroke }
type QmlHatch = { color?: QmlColor; angle_deg?: number; spacing_px?: number; line_width_px?: number }

type QmlSymbol = {
  geometry?: 'fill' | 'line' | 'marker'
  alpha?: number
  fill?: QmlPaint
  outline?: QmlStroke
  line?: QmlStroke
  marker?: QmlMarker
  hatch?: QmlHatch
}

type QmlLabel = {
  field: string
  size_px: number
  bold: boolean
  italic: boolean
  color?: QmlColor
  font?: string
  buffer?: { color?: QmlColor; width_px?: number }
}

type QmlEntry = QmlSymbol & {
  renderer: 'single' | 'categorized' | 'rule'
  layer_opacity?: number
  attr?: string
  categories?: Record<string, QmlSymbol>
  default?: QmlSymbol
  rules?: Array<QmlSymbol & { filter?: QmlColor; label?: string }>
  label?: QmlLabel
}

type QmlManifest = { layers: Record<string, QmlEntry> }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const iconForShape = (shape?: string) => (shape === 'triangle' ? '▲' : '●')
const shapeForMarker = (shape?: string): 'triangle' | 'circle' =>
  shape === 'triangle' ? 'triangle' : 'circle'

// A single representative symbol for `single`/`rule` renderers (the entry
// itself for single; the first rule's symbol for rule renderers).
const repSymbol = (entry: QmlEntry): QmlSymbol =>
  entry.renderer === 'rule' ? entry.rules?.[0] ?? entry : entry

const entryGeometry = (entry: QmlEntry): 'fill' | 'line' | 'marker' => {
  if (entry.geometry) return entry.geometry
  if (entry.renderer === 'categorized') {
    return (
      entry.default?.geometry ??
      Object.values(entry.categories ?? {})[0]?.geometry ??
      'fill'
    )
  }
  return repSymbol(entry).geometry ?? 'fill'
}

const qmlEntryOpacity = (entry: QmlEntry, sym: QmlSymbol): number =>
  clamp01((entry.layer_opacity ?? 1) * (sym.alpha ?? 1))

const qmlMarkerStyle = (entry: QmlEntry): LayerStyle => {
  if (entry.renderer === 'categorized' && entry.attr && entry.categories) {
    const cats = Object.entries(entry.categories).filter(([, s]) => s.marker)
    if (cats.length) {
      const repShape = entry.default?.marker?.shape ?? cats[0][1].marker?.shape
      const color = [
        'match',
        ['get', entry.attr],
        ...cats.flatMap(([value, s]) => [value, s.marker?.color ?? 'rgb(40, 40, 40)']),
        entry.default?.marker?.color ?? 'rgb(40, 40, 40)',
      ] as unknown as maplibregl.ExpressionSpecification
      const size = [
        'match',
        ['get', entry.attr],
        ...cats.flatMap(([value, s]) => [value, s.marker?.size_px ?? 10]),
        entry.default?.marker?.size_px ?? 10,
      ] as unknown as maplibregl.ExpressionSpecification
      return {
        type: 'point-symbol',
        symbol: { icon: iconForShape(repShape), shape: shapeForMarker(repShape), color, size },
      }
    }
  }
  const m = repSymbol(entry).marker
  const shape = shapeForMarker(m?.shape)
  return {
    type: 'point-symbol',
    symbol: {
      icon: iconForShape(m?.shape),
      shape,
      color: m?.color ?? 'rgb(40, 40, 40)',
      size: m?.size_px ?? 10,
    },
  }
}

const qmlLineStyle = (entry: QmlEntry): LayerStyle => {
  const ln =
    repSymbol(entry).line ??
    entry.default?.line ??
    Object.values(entry.categories ?? {}).find((s) => s.line)?.line
  if (!ln?.color) return {}
  return {
    line: {
      color: ln.color,
      width: ln.width_px ?? 1,
      opacity: qmlEntryOpacity(entry, repSymbol(entry)),
      dasharray: ln.dasharray ?? undefined,
    },
  }
}

const qmlFillStyle = (entry: QmlEntry): LayerStyle => {
  const style: LayerStyle = {}

  if (entry.renderer === 'categorized' && entry.attr && entry.categories) {
    const cats = Object.entries(entry.categories)
    style.fillCategories = {
      property: entry.attr,
      opacity: qmlEntryOpacity(entry, entry.default ?? {}),
      cases: Object.fromEntries(cats.map(([value, s]) => [value, s.fill?.color ?? 'rgba(0, 0, 0, 0)'])),
      default: entry.default?.fill?.color ?? 'rgba(0, 0, 0, 0)',
    }
    const outline = entry.default?.outline ?? cats.find(([, s]) => s.outline)?.[1].outline
    if (outline?.color) {
      style.outline = { color: outline.color, width: outline.width_px ?? 1, dasharray: outline.dasharray ?? undefined }
    }
    return style
  }

  const sym = repSymbol(entry)
  const opacity = qmlEntryOpacity(entry, sym)
  if (sym.fill?.color) style.fill = { color: sym.fill.color, opacity }
  if (sym.outline?.color) {
    style.outline = { color: sym.outline.color, width: sym.outline.width_px ?? 1, dasharray: sym.outline.dasharray ?? undefined }
  }
  if (sym.hatch?.color) {
    style.hatch = {
      color: sym.hatch.color,
      opacity,
      angleDeg: sym.hatch.angle_deg ?? 45,
      spacingPx: sym.hatch.spacing_px ?? 8,
      lineWidthPx: sym.hatch.line_width_px ?? 1.5,
    }
  }
  return style
}

const labelFromQml = (label: QmlLabel): NonNullable<LayerStyle['label']> => ({
  field: label.field,
  sizePx: label.size_px,
  bold: label.bold,
  italic: label.italic,
  color: label.color ?? undefined,
  font: label.font,
  halo: label.buffer?.color ? { color: label.buffer.color, width: label.buffer.width_px ?? 1 } : undefined,
})

const styleFromQml = (entry: QmlEntry): LayerStyle => {
  const geometry = entryGeometry(entry)
  const style =
    geometry === 'marker' ? qmlMarkerStyle(entry) : geometry === 'line' ? qmlLineStyle(entry) : qmlFillStyle(entry)
  if (entry.label) style.label = labelFromQml(entry.label)
  return style
}

const stylesFromQmlManifest = (manifest: QmlManifest): [string, LayerStyle][] =>
  Object.entries(manifest.layers).map(([name, entry]) => [name, styleFromQml(entry)])

type BaseManifestEntry =
  | { kind: 'raster'; name: string }
  | { kind: 'vector'; name: string; style: ManifestStyle }

type BaseManifest = { render_order: BaseManifestEntry[] }

const stylesFromBaseManifest = (manifest: BaseManifest): [string, LayerStyle][] =>
  manifest.render_order
    .filter((entry): entry is Extract<BaseManifestEntry, { kind: 'vector' }> => entry.kind === 'vector')
    .map((entry) => [entry.name, styleFromManifest(entry.style)])

type SectionStylesManifest = { styles: Record<string, ManifestStyle> }

const stylesFromSectionManifest = (manifest: SectionStylesManifest): [string, LayerStyle][] =>
  Object.entries(manifest.styles).map(([name, style]) => [name, styleFromManifest(style)])

/** Pre-split finns layers: population bucket sizes; color by FINNS% bucket. */
const finnsLayerStyle = (layerName: string): LayerStyle => {
  const pctBucket = layerName.includes('5_plus')
    ? '5_plus'
    : layerName.includes('1_5')
      ? '1_5'
      : '0_1'
  const color =
    pctBucket === '5_plus' ? '#0a2b70' : pctBucket === '1_5' ? '#0030cd' : '#149bdc'

  let size = 5.66
  if (layerName.includes('count_100_plus')) size = 17
  else if (layerName.includes('count_10_100')) size = 8.5
  else size = 5.66

  return {
    type: 'point-symbol',
    symbol: {
      icon: '●',
      shape: 'circle',
      color,
      size,
    },
  }
}

const ESTATE_PALACE_SIZE = 14.716

const withEstateStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => ({
  ...styles,
  estate: {
    type: 'point-symbol',
    symbol: {
      icon: '●',
      shape: 'circle',
      color: [
        'match',
        ['get', 'type'],
        'Дом',
        '#1dba91',
        'Дача',
        '#1dba91',
        'Вилла',
        '#1dba91',
        'Мыза',
        '#3486cf',
        'Особняк',
        '#0a2b70',
        'Усадьба',
        '#19a27e',
        'Дворец',
        '#ff7f00',
        '#1dba91',
      ] as unknown as maplibregl.ExpressionSpecification,
      size: [
        '*',
        [
          'match',
          ['get', 'type'],
          'Дом',
          1 / 3,
          'Дача',
          1 / 3,
          'Вилла',
          0.5,
          'Мыза',
          0.5,
          'Особняк',
          0.5,
          'Усадьба',
          0.5,
          'Дворец',
          1,
          0.5,
        ],
        ESTATE_PALACE_SIZE,
      ] as unknown as maplibregl.ExpressionSpecification,
    },
  },
})

const withMountStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => {
  const mount = styles.mount
  if (!mount?.symbol) return styles
  return {
    ...styles,
    mount: {
      ...mount,
      symbol: {
        ...mount.symbol,
        icon: '▲',
        shape: 'triangle',
        color: 'rgb(0, 0, 0)',
        halo_color: undefined,
        halo_width: undefined,
        size: [
          'match',
          ['get', 'type'],
          'гора',
          17,
          'возвышенность',
          10,
          'холм',
          6.5,
          10,
        ] as unknown as maplibregl.ExpressionSpecification,
      },
    },
  }
}

const clubStyle = (color: string): LayerStyle => ({
  type: 'point-symbol',
  symbol: {
    icon: '●',
    shape: 'circle',
    color,
    size: 8,
    halo_color: '#ffffff',
    halo_width: 0.2,
  },
})

const withClubStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => ({
  ...styles,
  paragliding_clubs: clubStyle('#3a97e9'),
  horse_riding_clubs: clubStyle('#1dba91'),
  golf_clubs: clubStyle('#f25656'),
  ski_resorts: clubStyle('#f34e9d'),
  motocross: clubStyle('#ba58e5'),
})

const withCalibratedStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => ({
  ...styles,
  '23_1': {
    type: 'point-symbol',
    symbol: {
      icon: '●',
      shape: 'circle',
      color: '#000000',
      size: 10,
    },
  },
  routes: {
    line: { color: '#f34e9d', width: 0.8 },
  },
  walking_routes: {
    line: { color: '#9479bc', width: 0.2 },
  },
  maki_selki: {
    fill: { color: '#3a97e9', opacity: 0.6 },
    outline: { color: '#3a97e9', width: 0.2 },
  },
})

const withLandscape12Outline = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => {
  const layer = styles['landscape_12']
  if (!layer) return styles
  return {
    ...styles,
    'landscape_12': {
      ...layer,
      outline: {
        width: 0.2,
        color: [
          'match',
          ['get', 'name'],
          'Щегловская возвышенность',
          '#9b9df3',
          'Юкковская гряда',
          '#f37598',
          'Румболовская возвышенность',
          '#7fc0f3',
          'Озерковские косы',
          '#f37c7c',
          'Лемболовская возвышенность',
          '#f382b8',
          'Колтушская возвышенность',
          '#5283cf',
          '#f49a5a',
        ] as unknown as maplibregl.ExpressionSpecification,
      },
    },
  }
}

const withFinnsStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => {
  const next = { ...styles }
  const sets = (sectionOverlaysManifest as { sets?: Record<string, { layers?: { name: string }[] }> })
    .sets
  if (sets) {
    for (const set of Object.values(sets)) {
      for (const layer of set.layers ?? []) {
        if (layer.name.startsWith('finns_')) {
          next[layer.name] = finnsLayerStyle(layer.name)
        }
      }
    }
  }
  for (const name of Object.keys(next)) {
    if (name.startsWith('finns_')) next[name] = finnsLayerStyle(name)
  }
  return next
}

const MASK_FILL = { color: 'rgb(0, 0, 0)', opacity: 0.35 }
const MASK_OUTLINE_NONE = { color: 'rgba(35, 35, 35, 0)', width: 0.736 }

const withMaskStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => {
  const next = { ...styles }
  for (const name of [
    'mask_stage',
    'mask_parter',
    'mask_belletazh',
    'mask_balcon',
    'mask_amphitheater',
  ] as const) {
    if (!next[name]) continue
    next[name] = { ...next[name], fill: MASK_FILL, outline: MASK_OUTLINE_NONE, hatch: undefined }
  }
  return next
}

const withHistoricalResettlementStyles = (
  styles: Record<string, LayerStyle>,
): Record<string, LayerStyle> => {
  if (!styles.historical_resettlement) return styles
  return {
    ...styles,
    historical_resettlement: {
      ...styles.historical_resettlement,
      fill: { color: 'rgba(89, 89, 89, 0.4784)', opacity: 1 },
      outline: undefined,
      hatch: undefined,
    },
  }
}

const withMountPolygonStyles = (styles: Record<string, LayerStyle>): Record<string, LayerStyle> => {
  const mp = styles.mount_polygon
  if (!mp) return styles
  return {
    ...styles,
    mount_polygon: {
      ...mp,
      fill: { color: '#acacac', opacity: 0.5 },
      outline: { color: '#acacac', width: 0.736 },
      hatch: undefined,
    },
  }
}

const augmentFromQml = (
  styles: Record<string, LayerStyle>,
  qmlStyles: Record<string, LayerStyle>,
): Record<string, LayerStyle> => {
  const next = { ...styles }
  for (const [name, qmlStyle] of Object.entries(qmlStyles)) {
    const merged = next[name]
    if (!merged) continue
    const patch: LayerStyle = { ...merged }
    // Section/base hand-tunes may override markers but QGIS labels/hatch still apply.
    if (qmlStyle.label) patch.label = qmlStyle.label
    if (qmlStyle.hatch && !merged.hatch) patch.hatch = qmlStyle.hatch
    next[name] = patch
  }
  return next
}

export const VECTOR_STYLES: Record<string, LayerStyle> = withFinnsStyles(
  withHistoricalResettlementStyles(
    withMaskStyles(
      withMountPolygonStyles(
      withLandscape12Outline(
        withCalibratedStyles(
          withClubStyles(
            withMountStyles(
              withEstateStyles(
                augmentFromQml(
                  Object.fromEntries([
                    ...stylesFromQmlManifest(qmlLayerStylesManifest as unknown as QmlManifest),
                    ...stylesFromSectionManifest(sectionOverlaysManifest as SectionStylesManifest),
                    ...stylesFromBaseManifest(baseCompositionManifest as BaseManifest),
                  ]),
                  Object.fromEntries(
                    stylesFromQmlManifest(qmlLayerStylesManifest as unknown as QmlManifest),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    ),
  ),
)
