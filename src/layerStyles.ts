// Vector layer styles, derived from three manifests:
//   - `src/assets/styles/base-composition-1.json`  (base composition #1)
//   - `src/assets/styles/base-composition-3.json`  (base composition #3)
//   - `src/assets/sections/section-overlays.json`  (the 13 per-section overlay styles)
//
// Each manifest is self-contained. When the same style name appears in more
// than one source, later sources override earlier ones — base-composition
// values are the most-calibrated (they're the user-tuned baseline) so they're
// merged last and win on collision. Per-base styles also appear in base
// composition #3 with identical values; if that ever drifts, base-#3 wins
// over base-#1 here, which is what the active base would render anyway.

import baseComposition1Manifest from './assets/styles/base-composition-1.json'
import baseComposition3Manifest from './assets/styles/base-composition-3.json'
import sectionOverlaysManifest from './assets/sections/section-overlays.json'

import type maplibregl from 'maplibre-gl'

export type LayerStyle = {
  type?: 'fill' | 'point-symbol'
  symbol?: {
    icon: string
    color: string
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
  outline?: { color: string; width: number; opacity?: number; dasharray?: number[] }
  line?: { color: string; width: number; dasharray?: number[]; opacity?: number }
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

export const VECTOR_STYLES: Record<string, LayerStyle> = Object.fromEntries([
  ...stylesFromSectionManifest(sectionOverlaysManifest as SectionStylesManifest),
  ...stylesFromBaseManifest(baseComposition1Manifest as BaseManifest),
  ...stylesFromBaseManifest(baseComposition3Manifest as BaseManifest),
])
