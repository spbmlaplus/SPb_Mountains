// Base-layer compositions derived from
// `src/assets/styles/base-composition-{1,3}.json` (the runtime-readable ports
// of `drive/Описание лонгрида - порядок базовых слоев.csv`). Composition #1
// is the chapter-1 default, #3 is the chapter-2 default. #2 (Positron
// under + relief multiply 40% + Positron labels over) is still a stub —
// CSV-baked manifest TBD in Phase 5 PR B.

import baseComposition1Manifest from './assets/styles/base-composition-1.json'
import baseComposition3Manifest from './assets/styles/base-composition-3.json'

export const TILE_BASE_URL =
  import.meta.env.VITE_TILE_BASE_URL ??
  'https://spbmlaplus.github.io/spb_mountains_tiles'

export type RasterEntry = {
  kind: 'raster'
  id: string
  urlTemplate: string
  minzoom?: number
  maxzoom?: number
  opacity?: number
  paint?: Record<string, unknown>
  attribution?: string
  scheme?: 'xyz' | 'tms'
}

export type VectorEntry = {
  kind: 'vector'
  file: string
  style: string
}

export type BaseComposition = (RasterEntry | VectorEntry)[]

type ManifestRasterEntry = {
  kind: 'raster'
  name: string
  source: string
  absolute_url?: boolean
  scheme?: 'xyz' | 'tms'
  minzoom?: number
  maxzoom?: number
  opacity?: number
  paint?: Record<string, unknown>
  attribution?: string
}

type ManifestVectorEntry = {
  kind: 'vector'
  name: string
  geojson: string
}

type ManifestEntry = ManifestRasterEntry | ManifestVectorEntry

type Manifest = { render_order: ManifestEntry[] }

const compositionFromManifest = (manifest: Manifest): BaseComposition =>
  manifest.render_order.map((entry) => {
    if (entry.kind === 'raster') {
      const relativePath = entry.source.replace(/^tiles\//, '')
      const urlTemplate = entry.absolute_url
        ? entry.source
        : `${TILE_BASE_URL}/${relativePath}`
      return {
        kind: 'raster',
        id: entry.name,
        urlTemplate,
        minzoom: entry.minzoom ?? 10,
        maxzoom: entry.maxzoom ?? 14,
        opacity: entry.opacity,
        paint: entry.paint,
        attribution: entry.attribution ?? '© Горные просторы',
        scheme: entry.scheme,
      }
    }
    return {
      kind: 'vector',
      file: entry.geojson,
      style: entry.name,
    }
  })

export const BASE_COMPOSITIONS: Record<1 | 2 | 3, BaseComposition> = {
  1: compositionFromManifest(baseComposition1Manifest as Manifest),
  2: [],
  3: compositionFromManifest(baseComposition3Manifest as Manifest),
}

export const DEFAULT_BASE_ID: 1 | 2 | 3 = 1
