import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSourceSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import {
  BASE_COMPOSITIONS,
  DEFAULT_BASE_ID,
  type BaseComposition,
} from './baseCompositions'
import { VECTOR_STYLES, type LayerStyle } from './layerStyles'
import { SECTION_OVERLAYS, type OverlayLayer } from './sectionOverlays'
import OverlayTogglePanel from './OverlayTogglePanel'
import { useMapInteraction } from './MapInteractionContext'
import MountainPopup, { type ObjectPopupInfo } from './MountainPopup'
import MountainPhotoModal from './MountainPhotoModal'
import MountainPhotoFullscreen from './MountainPhotoFullscreen'
import { resolveObjectPhotoUrl } from './objectPhotos'
import MobileLongreadSheet from './MobileLongreadSheet'
import {
  buildClickConfigsForSection,
  folderVectorPointLayerFor,
  isFeatureClickable,
  matchFolderVectorKey,
  parseClickFeatureProps,
  viewpointPhotoFolder,
  type ClickLayerConfig,
} from './clickTrigger'
import { clearClickHighlight, setClickHighlight } from './mapHighlight'
import { viewpointIcons, viewpointPhotoUrl } from './viewpointPhotos'
import { paintingIcons } from './paintingPhotos'
import ViewpointPhotoModal, { type ViewpointInfo } from './ViewpointPhotoModal'
import {
  fadeLayerVisibility,
  instantLayerVisibility,
  registerLayerHoverFade,
  type LayerIdFns,
  type TargetOpacityResolver,
} from './layerFade'
import { fallbackLongreadItems } from './fallbackLongread'
import {
  EXPLORE_MOUNTAINS_ITEM_ID,
  LAYER_SWITCH_MIN_MS,
  AUTOSCROLL_SCROLL_GRACE_MS,
  autoscrollStopBeforeKey,
  buildElementChain,
  chainIndexForKey,
  dwellMsForElement,
  introSubtitleKey,
  itemIdFromElKey,
  scrollLongreadElIntoView,
} from './longreadElementChain'
import { nameLabelsFromCollection } from './nameLabels'
import MapControls from './MapControls'
import MapLayerPanel from './MapLayerPanel'
import SplashModal from './SplashModal'
import { isEraCaption, type BaseId, type ContentItem, type LongreadMedia, type MediaSide } from './contentTypes'
import { LAYER_URL_BY_FILE } from './layerUrls'

export type { ContentItem } from './contentTypes'

const sheetId = "1eRYnMzPMGck6lGlwGUCkT3tvwWLIQKRLvJ8dgu3oGnk";
const sheetsApiKey = "AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE";
// Sheet schema follows `drive/Описание лонгрида - лонгрид.csv` columns:
//   A=Chapter, B=Subtitle, C=Media Link, D=Line, E=Description, F=Link,
//   G=Coordinates_zoom, H=Zoom, I=id _map, J=Описание что на картах.
const sheetsRange = 'Лист1!A:J';

const isBaseId = (n: number): n is BaseId => n === 1 || n === 3

type GeometryCoordinates =
  | number[]
  | number[][]
  | number[][][]
  | number[][][][]
  | number[][][][][]

type GeoJsonGeometry = {
  type: string
  coordinates?: GeometryCoordinates
  geometries?: GeoJsonGeometry[]
}

type GeoJsonFeature = Omit<Feature, 'geometry'> & {
  geometry: GeoJsonGeometry | null
}

type GeoJsonFeatureCollection = Omit<FeatureCollection, 'features'> & {
  features: GeoJsonFeature[]
}

const fileUrlByName = LAYER_URL_BY_FILE

// Longread media photos, copied from `new_files/photos` to `src/assets/photos`
// by `scripts/copy-new-assets.py`. The CSV's `Media_Link` column is the basename.
const photoModules = import.meta.glob('./assets/photos/*.{png,jpg,jpeg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const photoUrlByName: Record<string, string> = Object.fromEntries(
  Object.entries(photoModules).map(([path, url]) => [path.split('/').pop() ?? path, url]),
)

const resolvePhoto = (name: string): string | undefined =>
  photoUrlByName[name] ?? photoUrlByName[name.replace(/,/g, '')]

// Chapter numbers ("01", "02"…) by first appearance, and a running fact index
// so each `fact` cell renders as "ФАКТ #N".
const buildLongreadMeta = (items: ContentItem[]) => {
  const chapterNumber = new Map<string, string>()
  const factNumberByItemId = new Map<string, number>()
  let factCount = 0
  for (const item of items) {
    if (item.chapter && !chapterNumber.has(item.chapter)) {
      chapterNumber.set(item.chapter, String(chapterNumber.size + 1).padStart(2, '0'))
    }
    if (item.fact) {
      factCount += 1
      factNumberByItemId.set(item.id, factCount)
    }
  }
  return { chapterNumber, factNumberByItemId }
}

/** Consecutive items sharing a `chapter` value — one sticky header per group. */
const groupContentByChapter = (items: ContentItem[]) => {
  const groups: { chapter: string; items: ContentItem[] }[] = []
  for (const item of items) {
    const chapter = item.chapter ?? '—'
    const last = groups[groups.length - 1]
    if (last && last.chapter === chapter) {
      last.items.push(item)
    } else {
      groups.push({ chapter, items: [item] })
    }
  }
  return groups
}


const firstItemIdForIdMap = (items: ContentItem[], idMap: number) =>
  items.find((i) => i.id_map === idMap)?.id

const getMapFitPadding = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  return isMobile
    ? { top: 48, bottom: 48, left: 32, right: 32 }
    : { top: 80, bottom: 80, left: 80, right: 680 }
}

const scrollContentItemIntoView = (
  itemId: string,
  itemRefs: { current: Map<string, HTMLDivElement> },
  _listRef: { current: HTMLDivElement | null },
  behavior: ScrollBehavior = 'smooth',
) => {
  const element = itemRefs.current.get(itemId)
  if (!element) return
  element.scrollIntoView({ behavior, block: 'start' })
}

const longreadElKey = (itemId: string, kind: string, index?: number) =>
  index !== undefined ? `${itemId}:${kind}:${index}` : `${itemId}:${kind}`

const firstElKeyForItem = (list: HTMLElement | null, itemId: string): string | null => {
  if (!list) return null
  for (const el of list.querySelectorAll<HTMLElement>('.longread-el[data-el-key]')) {
    const key = el.dataset.elKey
    if (key?.startsWith(`${itemId}:`)) return key
  }
  return null
}

const syncActiveLongreadElForItem = (
  itemId: string,
  listRef: { current: HTMLElement | null },
  elKeyRef: { current: string | null },
  setElKey: (key: string | null) => void,
) => {
  const key = firstElKeyForItem(listRef.current, itemId)
  if (key) {
    elKeyRef.current = key
    setElKey(key)
  }
}

type SheetValuesResponse = {
  values?: string[][]
}

const normalizeFileList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((fileName) => fileName.trim())
    .filter(Boolean)

const sanitizeItemId = (value: string, fallbackIndex: number) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')

  return normalized || `sheet-item-${fallbackIndex}`
}

const belvederAllowed = (subtitle: string, chapter: string) => {
  const sub = subtitle.trim().toLowerCase()
  const ch = chapter.trim().toLowerCase()
  return sub.includes('николай') && sub.includes('бельведер') && ch.includes('наблюдател')
}

const buildMediaFromLink = (
  link: string,
  opts: { subtitle?: string; chapter?: string; side?: MediaSide; caption?: string },
): LongreadMedia | undefined => {
  const trimmed = link.trim()
  if (!trimmed) return undefined
  if (trimmed.includes('Belveder') && !belvederAllowed(opts.subtitle ?? '', opts.chapter ?? '')) {
    return undefined
  }
  const side: MediaSide = trimmed.includes('Belveder')
    ? 'full'
    : opts.side ?? 'left'
  return {
    link: trimmed,
    side,
    ...(opts.caption ? { caption: opts.caption } : {}),
  }
}

/** Sheet rows only carry `mediaLink`; UI reads `media`. Fallback already has `media`. */
const normalizeItemMedia = (item: ContentItem): ContentItem => {
  if (item.media) return item
  if (!item.mediaLink) return item
  const media = buildMediaFromLink(item.mediaLink, {
    subtitle: item.subtitle ?? item.title,
    chapter: item.chapter,
  })
  return media ? { ...item, media } : item
}

const parseSheetRows = (rows: string[][]): ContentItem[] => {
  if (rows.length === 0) {
    return []
  }

  const [headerRow, ...dataRows] = rows
  const headerMap = new Map(headerRow.map((value, index) => [value.trim().toLowerCase(), index]))

  const idIndex = headerMap.get('id')
  const chapterIndex = headerMap.get('chapter')
  const subtitleIndex = headerMap.get('subtitle')
  const titleIndex =
    headerMap.get('title') ??
    headerMap.get('subtitle') ??
    chapterIndex
  const descriptionIndex = headerMap.get('description')
  const fileListIndex =
    headerMap.get('filelist') ?? headerMap.get('file_list') ?? headerMap.get('layers')
  const idMapIndex =
    headerMap.get('id_map') ?? headerMap.get('id _map') ?? headerMap.get('idmap')
  const baseIdIndex = headerMap.get('base_id') ?? headerMap.get('baseid')
  const mediaLinkIndex =
    headerMap.get('media link') ?? headerMap.get('medialink') ?? headerMap.get('media_link')
  const mediaTypeIndex =
    headerMap.get('media link_type') ?? headerMap.get('media link type')
  const mediaCaptionIndex = headerMap.get('name_media link')

  return dataRows
    .filter((row) => row.some((cell) => cell?.trim()))
    .map((row, index) => {
      const title = (titleIndex !== undefined ? row[titleIndex] : row[1])?.trim() ?? ''
      const subtitle =
        (subtitleIndex !== undefined ? row[subtitleIndex] : row[1])?.trim() ?? ''
      const description =
        (descriptionIndex !== undefined ? row[descriptionIndex] : row[2])?.trim() ?? ''
      const chapter = (chapterIndex !== undefined ? row[chapterIndex] : '')?.trim() ?? ''
      const explicitId = (idIndex !== undefined ? row[idIndex] : '')?.trim() ?? ''
      const fileListValue = fileListIndex !== undefined ? row[fileListIndex] : undefined

      const idMapRaw = idMapIndex !== undefined ? row[idMapIndex]?.trim() : ''
      const baseIdRaw = baseIdIndex !== undefined ? row[baseIdIndex]?.trim() : ''
      let mediaLinkRaw =
        mediaLinkIndex !== undefined ? row[mediaLinkIndex]?.trim() : ''
      const mediaTypeRaw =
        mediaTypeIndex !== undefined ? row[mediaTypeIndex]?.trim().toLowerCase() : ''
      const mediaCaptionRaw =
        mediaCaptionIndex !== undefined ? row[mediaCaptionIndex]?.trim() : ''
      const mediaSide: MediaSide | undefined = mediaTypeRaw.startsWith('right')
        ? 'right'
        : mediaTypeRaw.startsWith('left')
          ? 'left'
          : mediaTypeRaw.startsWith('full')
            ? 'full'
            : undefined
      if (mediaLinkRaw.includes('Belveder') && !belvederAllowed(subtitle || title, chapter)) {
        mediaLinkRaw = ''
      }
      const idMapParsed = idMapRaw ? Number(idMapRaw) : NaN
      const baseIdParsed = baseIdRaw ? Number(baseIdRaw) : NaN

      const resolvedIdMap =
        Number.isFinite(idMapParsed) && SECTION_OVERLAYS[idMapParsed]
          ? idMapParsed
          : undefined

      const explicitBaseId =
        Number.isFinite(baseIdParsed) && isBaseId(baseIdParsed) ? baseIdParsed : undefined
      const resolvedBaseId: BaseId = explicitBaseId ?? 1

      const id = explicitId
        ? sanitizeItemId(explicitId, index)
        : `sheet-item-${index}`

      const media = mediaLinkRaw
        ? buildMediaFromLink(mediaLinkRaw, {
            subtitle: subtitle || title,
            chapter,
            side: mediaSide,
            caption: mediaCaptionRaw || undefined,
          })
        : undefined

      return {
        id,
        title,
        description,
        paragraphs: description ? [description] : [],
        fileList: normalizeFileList(fileListValue),
        ...(chapter ? { chapter } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(resolvedIdMap !== undefined ? { id_map: resolvedIdMap } : {}),
        base_id: resolvedBaseId,
        ...(mediaLinkRaw ? { mediaLink: mediaLinkRaw } : {}),
        ...(media ? { media } : {}),
      }
    })
    .map(normalizeItemMedia)
}

const fillForwardIdMap = (items: ContentItem[]): ContentItem[] => {
  let lastIdMap: number | undefined
  let lastBaseId: BaseId | undefined
  let lastChapter: string | undefined
  return items
    .map((item) => {
      const carriedChapter = item.chapter ?? lastChapter
      if (item.chapter) {
        lastChapter = item.chapter
      }
      if (item.id_map !== undefined) {
        lastIdMap = item.id_map
        lastBaseId = item.base_id
        return carriedChapter && !item.chapter ? { ...item, chapter: carriedChapter } : item
      }
      return {
        ...item,
        ...(carriedChapter ? { chapter: carriedChapter } : {}),
        ...(lastIdMap !== undefined ? { id_map: lastIdMap } : {}),
        ...(lastBaseId !== undefined ? { base_id: lastBaseId } : {}),
      }
    })
    .map(normalizeItemMedia)
}

const loadContentItemsFromSheet = async () => {
  if (!sheetId || !sheetsApiKey) {
    return fillForwardIdMap(fallbackLongreadItems)
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    sheetsRange,
  )}?key=${sheetsApiKey}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Sheets request failed with status ${response.status}.`)
  }

  const data = (await response.json()) as SheetValuesResponse
  const items = fillForwardIdMap(parseSheetRows(data.values ?? []))
  const base = items.length > 0 ? items : fillForwardIdMap(fallbackLongreadItems)

  return fillForwardIdMap(base)
}

const fileCache = new Map<string, Promise<GeoJsonFeatureCollection>>()

const mercatorToLngLat = ([x, y]: number[]) => {
  const lng = (x / 20037508.34) * 180
  const latRadians = Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 2 - Math.PI / 2
  const lat = (latRadians * 180) / Math.PI
  return [lng, lat]
}

const transformCoordinates = (coordinates: GeometryCoordinates): GeometryCoordinates => {
  if (typeof coordinates[0] === 'number') {
    return mercatorToLngLat(coordinates as number[])
  }

  return (coordinates as GeometryCoordinates[]).map((entry) =>
    transformCoordinates(entry as GeometryCoordinates),
  ) as GeometryCoordinates
}

const normalizeGeometry = (geometry: GeoJsonGeometry | null): GeoJsonGeometry | null => {
  if (!geometry) {
    return null
  }

  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries?.map(normalizeGeometry).filter(Boolean) as GeoJsonGeometry[],
    }
  }

  if (!geometry.coordinates) {
    return geometry
  }

  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates),
  }
}

const loadGeoJson = (fileName: string) => {
  const cached = fileCache.get(fileName)
  if (cached) {
    return cached
  }

  const fileUrl = fileUrlByName[fileName]
  if (!fileUrl) {
    return Promise.reject(new Error(`Layer file "${fileName}" was not found.`))
  }

  const request = fetch(fileUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load "${fileName}" (${response.status}).`)
      }

      const data = (await response.json()) as GeoJsonFeatureCollection

      return {
        ...data,
        features: data.features.map((feature) => ({
          ...feature,
          geometry: normalizeGeometry(feature.geometry),
        })) as Feature<Geometry>[],
      }
    })
    .catch((error) => {
      fileCache.delete(fileName)
      throw error
    })

  fileCache.set(fileName, request)
  return request
}

const sourceIdForFile = (fileName: string) => `content-source-${fileName}`
const fillIdForFile = (fileName: string) => `content-fill-${fileName}`
const lineIdForFile = (fileName: string) => `content-line-${fileName}`
const circleIdForFile = (fileName: string) => `content-circle-${fileName}`
const symbolIdForFile = (fileName: string) => `content-symbol-${fileName}`
const hatchIdForFile = (fileName: string) => `content-hatch-${fileName}`
const overlayLabelIdForFile = (fileName: string) => `content-overlay-label-${fileName}`
const inscriptionLabelIdForFile = (fileName: string) => `content-inscription-${fileName}`

// Viewpoints: a standalone, globally-toggleable layer that renders each
// viewpoint photo as a small rounded icon at its location.
const VIEWPOINTS_POINTS_FILE = '23_1_points.geojson'
const VIEWPOINTS_SOURCE_ID = 'viewpoints-source'
const VIEWPOINTS_LAYER_ID = 'viewpoints-symbol'

/** id_map → geojson layer file for dynamic name labels (centroids). */
const DYNAMIC_NAME_LABEL_ID_MAPS: Record<number, string> = {
  12: 'historical_resettlement.geojson',
  13: 'maki_selki.geojson',
}

const PAINTINGS_FILE = '21_живопись.geojson'
const PAINTINGS_SOURCE_ID = 'paintings-source'
const PAINTINGS_LAYER_ID = 'paintings-symbol'

const baseSourceId = (fileName: string) => `base-source-${fileName}`
const baseFillId = (fileName: string) => `base-fill-${fileName}`
const baseHatchId = (fileName: string) => `base-hatch-${fileName}`
const baseLineId = (fileName: string) => `base-line-${fileName}`
const baseOutlineId = (fileName: string) => `base-outline-${fileName}`

const isMaskFile = (fileName: string) => fileName.startsWith('mask_')

const EXPLORE_SOURCE_ID = 'explore-sector-source'
const EXPLORE_ACTIVE_LAYER_ID = 'explore-sector-active'
const EXPLORE_DIM_LAYER_ID = 'explore-sector-dim'
const EXPLORE_ACTIVE_LINE_LAYER_ID = 'explore-sector-active-line'

const computeBBox = (
  geometry: GeoJsonGeometry,
): [[number, number], [number, number]] | null => {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let pointCount = 0

  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (coords.length > 0 && typeof coords[0] === 'number') {
      const [lng, lat] = coords as number[]
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        pointCount += 1
      }
      return
    }
    for (const entry of coords) walk(entry)
  }

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries ?? []) {
      if (child.coordinates) walk(child.coordinates)
    }
  } else if (geometry.coordinates) {
    walk(geometry.coordinates)
  }

  if (pointCount === 0) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

const fillPaintFromStyle = (style: LayerStyle) => {
  if (style.fillCategories) {
    const fc = style.fillCategories
    const matchExpr = [
      'match',
      ['get', fc.property],
      ...Object.entries(fc.cases).flatMap(([value, color]) => [value, color]),
      fc.default,
    ] as unknown as maplibregl.ExpressionSpecification
    return {
      'fill-color': matchExpr,
      'fill-opacity': fc.opacity,
    }
  }
  return style.fill
    ? {
        'fill-color': style.fill.color,
        'fill-opacity': style.fill.opacity,
      }
    : null
}

const outlinePaintFromStyle = (style: LayerStyle) =>
  style.outline
    ? {
        'line-color': style.outline.color,
        'line-width': style.outline.width,
        'line-opacity': style.outline.opacity ?? 1,
        ...(style.outline.dasharray ? { 'line-dasharray': style.outline.dasharray } : {}),
      }
    : null

/** Skip outline line layer when QGIS border is fully transparent. */
const outlineIsVisible = (outline: NonNullable<LayerStyle['outline']>): boolean => {
  if (typeof outline.width === 'number' && outline.width <= 0) return false
  const color = outline.color
  if (typeof color !== 'string') return true
  const match = color.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/i)
  if (match?.[1] !== undefined) return parseFloat(match[1]) > 0
  return true
}

const setLayerPaint = (
  map: maplibregl.Map,
  layerId: string,
  paint: Record<string, unknown>,
) => {
  if (!map.getLayer(layerId)) return
  for (const [key, value] of Object.entries(paint)) {
    map.setPaintProperty(layerId, key, value)
  }
}

const linePaintFromStyle = (style: LayerStyle) =>
  style.line
    ? {
        'line-color': style.line.color,
        'line-width': style.line.width,
        'line-opacity': style.line.opacity ?? 1,
        ...(style.line.dasharray ? { 'line-dasharray': style.line.dasharray } : {}),
      }
    : null

type Hatch = NonNullable<LayerStyle['hatch']>

const hatchImageId = (hatch: Hatch) => {
  const key = `${hatch.color}|${hatch.opacity}|${hatch.angleDeg}|${hatch.spacingPx}|${hatch.lineWidthPx}`
  // Strip everything but [a-z0-9-] so the id is safe.
  return `hatch-${key.replace(/[^a-z0-9-]+/gi, '_').toLowerCase()}`
}

const createHatchImage = (hatch: Hatch): ImageData | null => {
  // Tile side N is chosen so that drawing the main diagonal at offsets 0, N/2, N
  // produces stripes whose perpendicular spacing equals hatch.spacingPx.
  // Perpendicular spacing for 45° stripes at half-tile offsets is N/(2·√2),
  // so N = spacingPx · 2 · √2.
  const N = Math.max(4, Math.round(hatch.spacingPx * 2 * Math.SQRT2))
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, N, N)
  ctx.strokeStyle = hatch.color
  ctx.globalAlpha = hatch.opacity
  ctx.lineWidth = hatch.lineWidthPx
  ctx.lineCap = 'butt'
  // Rotate so positive angle tilts stripes clockwise. Draw three parallel
  // lines (offsets 0, N/2, N relative to the unrotated axis) and rely on the
  // tile periodicity to wrap cleanly.
  const angleRad = (hatch.angleDeg * Math.PI) / 180
  ctx.translate(N / 2, N / 2)
  ctx.rotate(angleRad)
  ctx.translate(-N / 2, -N / 2)
  for (const offset of [-N, -N / 2, 0, N / 2, N]) {
    ctx.beginPath()
    ctx.moveTo(offset, -N)
    ctx.lineTo(offset, 2 * N)
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, N, N)
}

const ensureHatchImage = (map: maplibregl.Map, hatch: Hatch): string | null => {
  const id = hatchImageId(hatch)
  if (map.hasImage(id)) return id
  const image = createHatchImage(hatch)
  if (!image) return null
  map.addImage(id, image, { pixelRatio: 2 })
  return id
}

const getGeometryType = (data: GeoJsonFeatureCollection) => {
  for (const feature of data.features) {
    const geometryType = feature.geometry?.type
    if (geometryType) {
      return geometryType
    }
  }

  return null
}

const OVERLAY_ANCHOR_ID = '__overlay_anchor__'
const OVERLAY_ANCHOR_SOURCE_ID = '__overlay_anchor_source__'

const ensureOverlayAnchor = (map: maplibregl.Map) => {
  if (!map.getSource(OVERLAY_ANCHOR_SOURCE_ID)) {
    map.addSource(OVERLAY_ANCHOR_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    } satisfies GeoJSONSourceSpecification)
  }
  if (!map.getLayer(OVERLAY_ANCHOR_ID)) {
    map.addLayer({
      id: OVERLAY_ANCHOR_ID,
      type: 'fill',
      source: OVERLAY_ANCHOR_SOURCE_ID,
      paint: { 'fill-opacity': 0 },
    })
  } else {
    map.moveLayer(OVERLAY_ANCHOR_ID)
  }
}

const removeComposition = (map: maplibregl.Map, composition: BaseComposition) => {
  for (const entry of composition) {
    if (entry.kind === 'raster') {
      if (map.getLayer(entry.id)) map.removeLayer(entry.id)
      if (map.getSource(entry.id)) map.removeSource(entry.id)
      continue
    }
    for (const layerId of [baseFillId(entry.file), baseHatchId(entry.file), baseOutlineId(entry.file), baseLineId(entry.file)]) {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    }
    const sourceId = baseSourceId(entry.file)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }
}

const findLowestContentLayerId = (map: maplibregl.Map): string | undefined => {
  const layers = map.getStyle().layers ?? []
  for (const layer of layers) {
    if (layer.id.startsWith('content-')) return layer.id
  }
  return undefined
}

const addBaseComposition = async (
  map: maplibregl.Map,
  composition: BaseComposition,
) => {
  // On a base swap, overlay layers sit just below the anchor — they were
  // inserted with beforeId=anchor. Using the anchor as beforeId here would
  // land the new base layers between the overlays and the anchor (i.e.
  // ABOVE the overlays), so the new opaque base raster would cover them.
  // Anchor on the lowest existing overlay instead so the new base ends up
  // at the bottom of the stack. First call (no overlays yet) falls back to
  // the anchor, and ultimately to undefined (top), which is fine because
  // ensureOverlayAnchor moves the anchor over everything afterwards.
  const beforeId =
    findLowestContentLayerId(map) ??
    (map.getLayer(OVERLAY_ANCHOR_ID) ? OVERLAY_ANCHOR_ID : undefined)

  for (const entry of composition) {
    if (entry.kind === 'raster') {
      if (!map.getSource(entry.id)) {
        map.addSource(entry.id, {
          type: 'raster',
          tiles: [entry.urlTemplate],
          tileSize: 256,
          minzoom: entry.minzoom,
          maxzoom: entry.maxzoom,
          attribution: entry.attribution,
          ...(entry.scheme ? { scheme: entry.scheme } : {}),
        })
      }
      if (!map.getLayer(entry.id)) {
        const paint = {
          ...(entry.paint ??
            (entry.opacity != null ? { 'raster-opacity': entry.opacity } : {})),
          // Smooth 2 s cross-fade when the base composition is swapped.
          'raster-opacity-transition': { duration: 2000 },
        }
        map.addLayer(
          {
            id: entry.id,
            type: 'raster',
            source: entry.id,
            paint,
          },
          beforeId,
        )
      }
      continue
    }

    const style = VECTOR_STYLES[entry.style]
    if (!style) {
      console.warn(`No VECTOR_STYLES entry for "${entry.style}" (file ${entry.file})`)
      continue
    }

    let data: GeoJsonFeatureCollection
    try {
      data = await loadGeoJson(entry.file)
    } catch (loadError) {
      console.warn(`Base composition: failed to load ${entry.file}`, loadError)
      continue
    }

    const sourceId = baseSourceId(entry.file)
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: data as FeatureCollection,
      } satisfies GeoJSONSourceSpecification)
    }

    const geometryType = getGeometryType(data)

    if (geometryType?.includes('Polygon')) {
      const fillPaint = fillPaintFromStyle(style)
      if (fillPaint && !map.getLayer(baseFillId(entry.file))) {
        map.addLayer(
          {
            id: baseFillId(entry.file),
            type: 'fill',
            source: sourceId,
            paint: fillPaint,
          },
          beforeId,
        )
      }
      if (style.hatch && !map.getLayer(baseHatchId(entry.file))) {
        const imageId = ensureHatchImage(map, style.hatch)
        if (imageId) {
          map.addLayer(
            {
              id: baseHatchId(entry.file),
              type: 'fill',
              source: sourceId,
              paint: { 'fill-pattern': imageId },
            },
            beforeId,
          )
        }
      }
      const outlinePaint = outlinePaintFromStyle(style) ?? linePaintFromStyle(style)
      if (outlinePaint && !map.getLayer(baseOutlineId(entry.file))) {
        map.addLayer(
          {
            id: baseOutlineId(entry.file),
            type: 'line',
            source: sourceId,
            paint: outlinePaint,
          },
          beforeId,
        )
      }
    } else if (geometryType?.includes('LineString')) {
      const linePaint = linePaintFromStyle(style) ?? outlinePaintFromStyle(style)
      if (linePaint && !map.getLayer(baseLineId(entry.file))) {
        map.addLayer(
          {
            id: baseLineId(entry.file),
            type: 'line',
            source: sourceId,
            paint: linePaint,
          },
          beforeId,
        )
      }
    }
  }

  ensureOverlayAnchor(map)

  const isolineLineId = baseLineId('isoline_5m.geojson')
  if (map.getLayer(isolineLineId) && map.getLayer(OVERLAY_ANCHOR_ID)) {
    map.moveLayer(isolineLineId, OVERLAY_ANCHOR_ID)
  }
}

const overlayBeforeId = (map: maplibregl.Map) =>
  map.getLayer(OVERLAY_ANCHOR_ID) ? OVERLAY_ANCHOR_ID : undefined

/** QGIS marker `size_px` is diameter; MapLibre `circle-radius` is radius. */
const markerRadiusFromSize = (
  size: number | maplibregl.ExpressionSpecification,
): number | maplibregl.ExpressionSpecification =>
  typeof size === 'number' ? size / 2 : (['/', size, 2] as maplibregl.ExpressionSpecification)

const usesCircleMarker = (style: LayerStyle) =>
  style.type === 'point-symbol' && style.symbol?.shape === 'circle'

const ensureLayerOnMap = async (
  map: maplibregl.Map,
  fileName: string,
  styleName?: string,
) => {
  const sourceId = sourceIdForFile(fileName)
  const data = await loadGeoJson(fileName)

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: data as FeatureCollection,
    } satisfies GeoJSONSourceSpecification)
  } else {
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
    source.setData(data as FeatureCollection)
  }

  const geometryType = getGeometryType(data)
  const style = styleName ? VECTOR_STYLES[styleName] : undefined
  const masked = isMaskFile(fileName)
  // Point-symbol layers (mount) sit above all per-section overlays so they
  // remain clickable; everything else stacks beneath the overlay anchor.
  const beforeId = style?.type === 'point-symbol' ? undefined : overlayBeforeId(map)

  if (geometryType === 'Point' && style?.type === 'point-symbol' && style.symbol) {
    const { symbol } = style
    if (usesCircleMarker(style)) {
      if (!map.getLayer(circleIdForFile(fileName))) {
        map.addLayer(
          {
            id: circleIdForFile(fileName),
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': markerRadiusFromSize(symbol.size),
              'circle-color': symbol.color,
              ...(symbol.halo_width !== undefined
                ? {
                    'circle-stroke-width': symbol.halo_width,
                    'circle-stroke-color': symbol.halo_color ?? '#ffffff',
                  }
                : {}),
            },
          },
          beforeId,
        )
      }
    } else if (!map.getLayer(symbolIdForFile(fileName))) {
      map.addLayer(
        {
          id: symbolIdForFile(fileName),
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': symbol.icon,
            'text-size': symbol.size,
            'text-allow-overlap': false,
            'text-optional': true,
          },
          paint: {
            'text-color': symbol.color,
            'text-opacity': 1,
            ...(symbol.halo_color ? { 'text-halo-color': symbol.halo_color } : {}),
            ...(symbol.halo_width !== undefined ? { 'text-halo-width': symbol.halo_width } : {}),
          },
        },
        beforeId,
      )
    }
    hideSubLayersForFile(map, fileName)
    return
  }

  if (geometryType?.includes('Polygon')) {
    const fillPaint =
      (style && fillPaintFromStyle(style)) ?? {
        'fill-color': masked ? '#09131a' : '#f2a541',
        'fill-opacity': masked ? 0.12 : 0.28,
      }
    const fillId = fillIdForFile(fileName)
    if (!map.getLayer(fillId)) {
      map.addLayer(
        {
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: fillPaint,
        },
        beforeId,
      )
    } else {
      setLayerPaint(map, fillId, fillPaint)
    }

    const hatchId = hatchIdForFile(fileName)
    if (style?.hatch) {
      const imageId = ensureHatchImage(map, style.hatch)
      if (imageId) {
        if (!map.getLayer(hatchId)) {
          map.addLayer(
            {
              id: hatchId,
              type: 'fill',
              source: sourceId,
              paint: { 'fill-pattern': imageId },
            },
            beforeId,
          )
        } else {
          setLayerPaint(map, hatchId, { 'fill-pattern': imageId })
        }
      }
    } else if (map.getLayer(hatchId)) {
      map.setLayoutProperty(hatchId, 'visibility', 'none')
    }

    const lineId = lineIdForFile(fileName)
    const outlineVisible = style?.outline && outlineIsVisible(style.outline)
    const outlinePaint = outlineVisible
      ? (outlinePaintFromStyle(style) ?? linePaintFromStyle(style))
      : null
    if (outlinePaint) {
      if (!map.getLayer(lineId)) {
        map.addLayer(
          {
            id: lineId,
            type: 'line',
            source: sourceId,
            paint: outlinePaint,
          },
          beforeId,
        )
      } else {
        map.setLayoutProperty(lineId, 'visibility', 'visible')
        setLayerPaint(map, lineId, outlinePaint)
      }
    } else if (map.getLayer(lineId)) {
      map.setLayoutProperty(lineId, 'visibility', 'none')
    }
    hideSubLayersForFile(map, fileName)
    return
  }

  if (geometryType?.includes('LineString')) {
    const linePaint =
      (style && (linePaintFromStyle(style) ?? outlinePaintFromStyle(style))) ?? {
        'line-color': masked ? '#203745' : '#f2a541',
        'line-width': masked ? 2 : 3,
        'line-opacity': 0.9,
      }
    const lineId = lineIdForFile(fileName)
    if (!map.getLayer(lineId)) {
      map.addLayer(
        {
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: linePaint,
        },
        beforeId,
      )
    } else {
      setLayerPaint(map, lineId, linePaint)
    }
    hideSubLayersForFile(map, fileName)
    return
  }

  if (!map.getLayer(circleIdForFile(fileName))) {
    map.addLayer(
      {
        id: circleIdForFile(fileName),
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': masked ? '#203745' : '#f2a541',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff6e2',
        },
      },
      beforeId,
    )
  }
  hideSubLayersForFile(map, fileName)
}

const ensureInscriptionOnMap = async (map: maplibregl.Map, fileName: string) => {
  const sourceId = sourceIdForFile(fileName)
  const data = await loadGeoJson(fileName)

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: data as FeatureCollection,
    } satisfies GeoJSONSourceSpecification)
  } else {
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
    source.setData(data as FeatureCollection)
  }

  const labelId = inscriptionLabelIdForFile(fileName)
  const compact = COMPACT_INSCRIPTION_FILES.has(fileName)
  const labelLayout = {
    'text-field': ['coalesce', ['get', 'inscription'], ['get', 'name']],
    'text-font': ['literal', [compact ? 'Montserrat Regular' : 'Montserrat Bold']],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      9,
      0,
      11,
      compact ? 11 : 12,
      13,
      compact ? 13 : 14,
    ],
    'text-offset': [0, compact ? -1.5 : -1.2],
    'text-allow-overlap': false,
    'text-optional': true,
    'symbol-sort-key': ['-', ['coalesce', ['get', 'inscription'], ['get', 'name']]],
  } satisfies maplibregl.SymbolLayerSpecification['layout']
  const labelPaint = {
    'text-color': '#000000',
    'text-halo-width': 0,
  } satisfies maplibregl.SymbolLayerSpecification['paint']

  if (!map.getLayer(labelId)) {
    map.addLayer(
      {
        id: labelId,
        type: 'symbol',
        source: sourceId,
        layout: labelLayout,
        paint: labelPaint,
      },
      overlayBeforeId(map),
    )
  } else {
    for (const [key, value] of Object.entries(labelLayout)) {
      map.setLayoutProperty(labelId, key as keyof typeof labelLayout, value)
    }
    for (const [key, value] of Object.entries(labelPaint)) {
      map.setPaintProperty(labelId, key as keyof typeof labelPaint, value)
    }
  }
  hideSubLayersForFile(map, fileName)
}

const hideSubLayersForFile = (map: maplibregl.Map, fileName: string) => {
  for (const layerId of subLayerIdsForFile(fileName, layerIdFns)) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none')
    }
  }
}

const subLayerIdsForFile = (fileName: string, ids: LayerIdFns) => [
  ids.fillIdForFile(fileName),
  ids.hatchIdForFile(fileName),
  ids.lineIdForFile(fileName),
  ids.circleIdForFile(fileName),
  ids.symbolIdForFile(fileName),
  ids.overlayLabelIdForFile(fileName),
  ids.inscriptionLabelIdForFile(fileName),
]

const dynamicNameLabelFile = (idMap: number) => `dynamic-names-${idMap}.geojson`

const ensureNameLabelsFromLayer = async (
  map: maplibregl.Map,
  layerFileName: string,
  idMap: number,
) => {
  const labelFile = dynamicNameLabelFile(idMap)
  const sourceId = sourceIdForFile(labelFile)
  const layerData = (await loadGeoJson(layerFileName)) as FeatureCollection
  const labelData = nameLabelsFromCollection(layerData)

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: labelData,
    } satisfies GeoJSONSourceSpecification)
  } else {
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
    source.setData(labelData)
  }

  const labelId = inscriptionLabelIdForFile(labelFile)
  const labelLayout = {
    'text-field': ['get', 'name'],
    'text-font': ['literal', ['Montserrat Regular']],
    'text-size': ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 13, 13, 15],
    'text-offset': [0, -1.2],
    'text-allow-overlap': false,
    'text-optional': true,
    'symbol-sort-key': ['-', ['get', 'name']],
  } satisfies maplibregl.SymbolLayerSpecification['layout']
  const labelPaint = {
    'text-color': '#000000',
    'text-halo-width': 0,
  } satisfies maplibregl.SymbolLayerSpecification['paint']

  if (!map.getLayer(labelId)) {
    map.addLayer(
      {
        id: labelId,
        type: 'symbol',
        source: sourceId,
        layout: labelLayout,
        paint: labelPaint,
      },
      overlayBeforeId(map),
    )
    hideSubLayersForFile(map, labelFile)
  }
}

const resolveFullRouteFeature = async (
  hit: Feature<Geometry>,
  fileName = 'routes.geojson',
): Promise<Feature<Geometry>> => {
  const name = (hit.properties as { name?: string } | null)?.name
  if (!name) return hit
  const data = (await loadGeoJson(fileName)) as FeatureCollection
  const full = data.features.find(
    (f) => (f.properties as { name?: string } | null)?.name === name,
  )
  return (full as Feature<Geometry> | undefined) ?? hit
}

const layerIdFns: LayerIdFns = {
  fillIdForFile,
  hatchIdForFile,
  lineIdForFile,
  circleIdForFile,
  symbolIdForFile,
  overlayLabelIdForFile,
  inscriptionLabelIdForFile,
}

const INSTANT_LAYER_FILES = new Set(['mount.geojson', 'mount_polygon.geojson'])
const NO_FADE_ID_MAPS = new Set([13, 14])

const buildCategoryFilter = (
  classifyAttr: string,
  enabledValues: string[],
): maplibregl.FilterSpecification | null => {
  if (enabledValues.length === 0) {
    return ['==', ['get', classifyAttr], '__none__']
  }
  return ['in', ['get', classifyAttr], ['literal', enabledValues]]
}

const applyCategoryFilterToFile = (
  map: maplibregl.Map,
  fileName: string,
  overlayLayer: OverlayLayer | undefined,
  disabledCats: Set<string>,
  layerVisible: boolean,
) => {
  const subIds = [
    fillIdForFile(fileName),
    hatchIdForFile(fileName),
    lineIdForFile(fileName),
    circleIdForFile(fileName),
    symbolIdForFile(fileName),
  ].filter((id) => Boolean(map.getLayer(id)))

  if (!layerVisible || !overlayLayer?.classify || !overlayLayer.categories?.length) {
    for (const id of subIds) {
      if (map.getLayer(id)) map.setFilter(id, null)
    }
    return
  }

  const enabled = overlayLayer.categories
    .filter((c) => !disabledCats.has(c.value))
    .map((c) => c.value)
  const filter = buildCategoryFilter(overlayLayer.classify, enabled)
  for (const id of subIds) {
    if (map.getLayer(id)) map.setFilter(id, filter)
  }
}

const fileForLayer = (layerName: string) => `${layerName}.geojson`

const overlayStylesByFile = new Map<string, string>()
const overlayLayerByFile = new Map<string, OverlayLayer>()
for (const set of Object.values(SECTION_OVERLAYS)) {
  for (const layer of set.layers) {
    overlayLayerByFile.set(fileForLayer(layer.name), layer)
    overlayStylesByFile.set(fileForLayer(layer.name), layer.style)
  }
}

const hasCustomFillOpacity = (fileName: string) =>
  isMaskFile(fileName) || fileName === 'mount_polygon.geojson'

const fillTargetOpacityForFile = (fileName: string): number | undefined => {
  if (!hasCustomFillOpacity(fileName)) return undefined
  const styleName = overlayStylesByFile.get(fileName)
  const style = styleName ? VECTOR_STYLES[styleName] : undefined
  const paint = style ? fillPaintFromStyle(style) : null
  const opacity = paint?.['fill-opacity']
  return typeof opacity === 'number' ? opacity : undefined
}

const setLayerVisibility = (
  map: maplibregl.Map,
  fileName: string,
  visible: boolean,
  idMap?: number,
) => {
  const resolveTargetOpacity: TargetOpacityResolver = (layerId, prop) => {
    if (prop !== 'fill-opacity' || layerId !== fillIdForFile(fileName)) return undefined
    return fillTargetOpacityForFile(fileName)
  }

  if (INSTANT_LAYER_FILES.has(fileName) || (idMap !== undefined && NO_FADE_ID_MAPS.has(idMap))) {
    instantLayerVisibility(map, fileName, visible, layerIdFns, resolveTargetOpacity)
    return
  }
  fadeLayerVisibility(map, fileName, visible, layerIdFns, undefined, resolveTargetOpacity)
}

const ALL_OVERLAY_FILES = Array.from(
  new Set(
    Object.values(SECTION_OVERLAYS).flatMap((set) =>
      set.layers.map((l) => fileForLayer(l.name)),
    ),
  ),
)

const ALL_INSCRIPTION_FILES = Array.from(
  new Set(
    Object.values(SECTION_OVERLAYS).flatMap((set) =>
      (set.inscriptions ?? []).map((i) => fileForLayer(i.name)),
    ),
  ),
)

const ALL_FOLDER_VECTOR_FILES = Array.from(
  new Set(
    Object.values(SECTION_OVERLAYS).flatMap((set) =>
      (set.folder_vectors ?? []).map((fv) => fileForLayer(fv.folder_vector)),
    ),
  ),
)

const ALL_STATIC_LAYER_FILES = Array.from(
  new Set([...ALL_OVERLAY_FILES, ...ALL_INSCRIPTION_FILES, ...ALL_FOLDER_VECTOR_FILES]),
)

/** id_map 12–20 inscription labels: 10px regular (12px bold elsewhere). */
const COMPACT_INSCRIPTION_FILES = new Set(
  Object.entries(SECTION_OVERLAYS).flatMap(([idMap, section]) => {
    const n = Number(idMap)
    if (n < 12 || n > 20) return []
    return (section.inscriptions ?? []).map((i) => fileForLayer(i.name))
  }),
)

const clickLayerIdsForFile = (map: maplibregl.Map, fileName: string): string[] =>
  [
    symbolIdForFile(fileName),
    circleIdForFile(fileName),
    fillIdForFile(fileName),
    lineIdForFile(fileName),
  ].filter((id) => Boolean(map.getLayer(id)))

function MainMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const activeIdRef = useRef('')
  const [mapReady, setMapReady] = useState(false)
  const [paintingsOn, setPaintingsOn] = useState(true)
  const paintingsOnRef = useRef(paintingsOn)
  paintingsOnRef.current = paintingsOn
  const [layersSyncGen, setLayersSyncGen] = useState(0)
  const [viewpointModal, setViewpointModal] = useState<ViewpointInfo | null>(null)
  const initialItems = useMemo(() => fillForwardIdMap(fallbackLongreadItems), [])
  const [contentItems, setContentItems] = useState(initialItems)
  const [activeItemId, setActiveItemId] = useState(initialItems[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [contentLoaded, setContentLoaded] = useState(false)
  const [splashDismissed, setSplashDismissed] = useState(false)
  const [manualIdMap, setManualIdMap] = useState<number | null>(null)
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  const [activeLongreadElKey, setActiveLongreadElKey] = useState<string | null>(null)
  const mapUserInteractedRef = useRef(false)
  const autoscrollPausedRef = useRef(false)
  const activeLongreadElKeyRef = useRef<string | null>(null)
  const isAutoscrollDrivingRef = useRef(false)
  const lastLayerSwitchAtRef = useRef(0)
  const lastScrollTopRef = useRef(0)
  const finalItemElIndexRef = useRef(0)
  const [displayedIdMap, setDisplayedIdMap] = useState<number | undefined>(
    () => initialItems[0]?.id_map,
  )

  const [objectPopup, setObjectPopup] = useState<ObjectPopupInfo | null>(null)
  const [objectPopupPixel, setObjectPopupPixel] = useState<{ x: number; y: number } | null>(null)
  const [photoModal, setPhotoModal] = useState<{
    folder: string
    photoKey: string
    slot: 1 | 2
    name: string
    fact?: string
  } | null>(null)
  const [photoFullscreen, setPhotoFullscreen] = useState(false)

  const closeObjectPopupAll = () => {
    setObjectPopup(null)
    setPhotoModal(null)
    setPhotoFullscreen(false)
    const map = mapRef.current
    if (map) {
      clearClickHighlight(map)
    }
  }

  const [userDisabled, setUserDisabled] = useState<Record<number, Set<string>>>({})
  const [userDisabledCategories, setUserDisabledCategories] = useState<
    Record<number, Record<string, Set<string>>>
  >({})

  const {
    publishActiveItemId,
    publishContentItems,
    registerScroller,
    exploreSector,
    setExploreSector,
    scrollToItemId,
    viewpointsOn,
    setViewpointsOn,
    registerExploreMountainsHandler,
    requestMobileSheetExpanded,
  } = useMapInteraction()

  const viewpointsOnRef = useRef(viewpointsOn)
  viewpointsOnRef.current = viewpointsOn

  useEffect(() => {
    registerExploreMountainsHandler(() => {
      const lastId =
        contentItems.find((i) => i.id === EXPLORE_MOUNTAINS_ITEM_ID)?.id ??
        contentItems.at(-1)?.id ??
        EXPLORE_MOUNTAINS_ITEM_ID
      setManualIdMap(null)
      setViewpointsOn(true)
      setExploreSector(null)
      scrollToItemId(lastId)
    })
    return () => registerExploreMountainsHandler(null)
  }, [
    contentItems,
    scrollToItemId,
    setViewpointsOn,
    setExploreSector,
    registerExploreMountainsHandler,
  ])

  useEffect(() => {
    activeIdRef.current = activeItemId
    publishActiveItemId(activeItemId)
    const map = mapRef.current
    setObjectPopup(null)
    setPhotoModal(null)
    setPhotoFullscreen(false)
    if (map) {
      clearClickHighlight(map)
    }
  }, [activeItemId, publishActiveItemId])

  useEffect(() => {
    if (!layerPanelOpen && splashDismissed) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (layerPanelOpen) setLayerPanelOpen(false)
      if (!splashDismissed) setSplashDismissed(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [layerPanelOpen, splashDismissed])

  useEffect(() => {
    publishContentItems(
      contentItems.map((item) => ({ id: item.id, chapter: item.chapter })),
    )
  }, [contentItems, publishContentItems])

  useEffect(() => {
    registerScroller((id) => {
      requestMobileSheetExpanded()
      scrollContentItemIntoView(id, itemRefs, listRef)
      syncActiveLongreadElForItem(
        id,
        listRef,
        activeLongreadElKeyRef,
        setActiveLongreadElKey,
      )
    })
    return () => registerScroller(null)
  }, [registerScroller, requestMobileSheetExpanded])

  useEffect(() => {
    if (!splashDismissed || contentItems.length === 0) return
    autoscrollPausedRef.current = false
    const key = introSubtitleKey(contentItems)
    if (!key) return
    activeLongreadElKeyRef.current = key
    setActiveLongreadElKey(key)
  }, [splashDismissed, contentItems])

  useEffect(() => {
    const target =
      manualIdMap ?? contentItems.find((i) => i.id === activeItemId)?.id_map
    if (target === undefined) return

    if (manualIdMap !== null) {
      setDisplayedIdMap(manualIdMap)
      lastLayerSwitchAtRef.current = Date.now()
      return
    }

    const elapsed = Date.now() - lastLayerSwitchAtRef.current
    const delay = Math.max(0, LAYER_SWITCH_MIN_MS - elapsed)

    const timer = window.setTimeout(() => {
      setDisplayedIdMap(target)
      lastLayerSwitchAtRef.current = Date.now()
    }, delay)

    return () => window.clearTimeout(timer)
  }, [activeItemId, manualIdMap, contentItems])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const idMap = manualIdMap ?? contentItems.find((i) => i.id === activeItemId)?.id_map
    const disabled =
      idMap !== undefined ? userDisabled[idMap] ?? new Set<string>() : new Set<string>()
    const configs = buildClickConfigsForSection(idMap).filter(
      (c) => !disabled.has(c.layerName),
    )

    const handleClickTrigger = async (
      e: maplibregl.MapLayerMouseEvent,
      config: ClickLayerConfig,
    ) => {
      const hit = e.features?.[0]
      if (!hit?.geometry) return
      const feature: Feature<Geometry> =
        config.fileName === 'routes.geojson' || config.fileName === 'walking_routes.geojson'
          ? await resolveFullRouteFeature(hit as Feature<Geometry>, config.fileName)
          : (hit as Feature<Geometry>)
      const props = (feature.properties ?? {}) as Record<string, unknown>
      if (!isFeatureClickable(props, config)) return

      const parsed = parseClickFeatureProps(props)
      setPhotoModal(null)
      setPhotoFullscreen(false)
      setObjectPopup({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: parsed.name,
        fact: parsed.fact,
        type: parsed.type,
        description: parsed.description,
        photoFolder: config.photoFolder,
        photoKey: parsed.photoKey,
        objectId: parsed.objectId,
      })
      setObjectPopupPixel({ x: e.point.x, y: e.point.y })

      setClickHighlight(map, feature)
      const bbox = computeBBox(feature.geometry as GeoJsonGeometry)
      if (bbox) {
        map.fitBounds(bbox, { padding: 80, maxZoom: 14, duration: 700 })
      }
    }

    const cleanups: Array<() => void> = []
    for (const config of configs) {
      for (const layerId of clickLayerIdsForFile(map, config.fileName)) {
        const onClick = (e: maplibregl.MapLayerMouseEvent) => handleClickTrigger(e, config)
        const onMouseEnter = () => {
          map.getCanvas().style.cursor = 'pointer'
        }
        const onMouseLeave = () => {
          map.getCanvas().style.cursor = ''
        }
        map.on('click', layerId, onClick)
        map.on('mouseenter', layerId, onMouseEnter)
        map.on('mouseleave', layerId, onMouseLeave)
        cleanups.push(() => {
          map.off('click', layerId, onClick)
          map.off('mouseenter', layerId, onMouseEnter)
          map.off('mouseleave', layerId, onMouseLeave)
        })
      }
    }

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const clickableIds = configs.flatMap((c) => clickLayerIdsForFile(map, c.fileName))
      if (clickableIds.length === 0) return
      const hits = map.queryRenderedFeatures(e.point, { layers: clickableIds })
      if (hits.length === 0) closeObjectPopupAll()
    }
    map.on('click', onMapClick)
    cleanups.push(() => map.off('click', onMapClick))

    return () => {
      for (const off of cleanups) off()
    }
  }, [mapReady, activeItemId, manualIdMap, contentItems, userDisabled, layersSyncGen])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const idMap = contentItems.find((i) => i.id === activeItemId)?.id_map
    const pairing = folderVectorPointLayerFor(idMap)
    if (!pairing) return

    const section = idMap !== undefined ? SECTION_OVERLAYS[idMap] : undefined
    const photoFolder = viewpointPhotoFolder(section)

    const pointLayerIds = clickLayerIdsForFile(map, pairing.pointFile)
    if (pointLayerIds.length === 0) return

    const onPointClick = async (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return
      const props = (feature.properties ?? {}) as Record<string, unknown>
      const matchKey = matchFolderVectorKey(props)
      if (!matchKey) return

      if (photoFolder) {
        const parsed = parseClickFeatureProps(props)
        setPhotoModal(null)
        setPhotoFullscreen(false)
        setObjectPopup({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          name: parsed.name,
          fact: parsed.fact,
          type: parsed.type,
          description: parsed.description,
          photoFolder,
          photoKey: parsed.photoKey,
          objectId: parsed.objectId,
        })
        setObjectPopupPixel({ x: e.point.x, y: e.point.y })
      }

      try {
        const polygonData = await loadGeoJson(pairing.polygonFile)
        const polygonFeature = polygonData.features.find((f) => {
          const p = (f.properties ?? {}) as Record<string, unknown>
          const polyKey =
            p.layer !== null && p.layer !== undefined
              ? String(p.layer).trim()
              : p.name !== null && p.name !== undefined
                ? String(p.name).trim()
                : p.id !== null && p.id !== undefined
                  ? String(p.id).trim()
                  : ''
          return polyKey === matchKey
        })
        if (polygonFeature?.geometry) {
          setClickHighlight(map, polygonFeature as Feature<Geometry>, undefined, {
            fillColor: '#000000',
            fillOpacity: 0.3,
            lineWidth: 0,
          })
          map.easeTo({
            center: e.lngLat,
            zoom: Math.max(map.getZoom(), 12),
            duration: 700,
          })
        }
      } catch (err) {
        console.warn('folder_vector: failed to highlight polygon', err)
      }
    }

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    const cleanups: Array<() => void> = []
    for (const layerId of pointLayerIds) {
      map.on('click', layerId, onPointClick)
      map.on('mouseenter', layerId, onMouseEnter)
      map.on('mouseleave', layerId, onMouseLeave)
      cleanups.push(() => {
        map.off('click', layerId, onPointClick)
        map.off('mouseenter', layerId, onMouseEnter)
        map.off('mouseleave', layerId, onMouseLeave)
      })
    }

    return () => {
      for (const off of cleanups) off()
    }
  }, [mapReady, activeItemId, contentItems, layersSyncGen])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !objectPopup) return
    const update = () => {
      const p = map.project([objectPopup.lng, objectPopup.lat])
      setObjectPopupPixel({ x: p.x, y: p.y })
    }
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [objectPopup])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewpointModal) setViewpointModal(null)
      else if (photoFullscreen) setPhotoFullscreen(false)
      else if (photoModal) setPhotoModal(null)
      else if (objectPopup) closeObjectPopupAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photoFullscreen, photoModal, objectPopup, viewpointModal])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const cleanup = () => {
      for (const id of [
        EXPLORE_ACTIVE_LINE_LAYER_ID,
        EXPLORE_ACTIVE_LAYER_ID,
        EXPLORE_DIM_LAYER_ID,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource(EXPLORE_SOURCE_ID)) map.removeSource(EXPLORE_SOURCE_ID)
    }

    if (exploreSector == null) {
      cleanup()
      return
    }

    let cancelled = false
    loadGeoJson('sector.geojson')
      .then((data) => {
        if (cancelled) return
        const feature = data.features.find(
          (f) => (f.properties as { id?: number } | null)?.id === exploreSector,
        )
        if (!feature?.geometry) return

        const bbox = computeBBox(feature.geometry)
        if (bbox) {
          map.fitBounds(bbox, { padding: 60, maxZoom: 12, duration: 700 })
        }

        if (!map.getSource(EXPLORE_SOURCE_ID)) {
          map.addSource(EXPLORE_SOURCE_ID, {
            type: 'geojson',
            data: data as FeatureCollection,
          } satisfies GeoJSONSourceSpecification)
        } else {
          ;(map.getSource(EXPLORE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(
            data as FeatureCollection,
          )
        }

        const dimFilter = ['!=', ['get', 'id'], exploreSector] as maplibregl.FilterSpecification
        const activeFilter = ['==', ['get', 'id'], exploreSector] as maplibregl.FilterSpecification

        if (!map.getLayer(EXPLORE_DIM_LAYER_ID)) {
          map.addLayer({
            id: EXPLORE_DIM_LAYER_ID,
            type: 'fill',
            source: EXPLORE_SOURCE_ID,
            filter: dimFilter,
            paint: { 'fill-color': 'rgb(40, 40, 40)', 'fill-opacity': 0.35 },
          })
        } else {
          map.setFilter(EXPLORE_DIM_LAYER_ID, dimFilter)
        }

        if (!map.getLayer(EXPLORE_ACTIVE_LAYER_ID)) {
          map.addLayer({
            id: EXPLORE_ACTIVE_LAYER_ID,
            type: 'fill',
            source: EXPLORE_SOURCE_ID,
            filter: activeFilter,
            paint: { 'fill-color': 'rgb(225,89,137)', 'fill-opacity': 0.45 },
          })
        } else {
          map.setFilter(EXPLORE_ACTIVE_LAYER_ID, activeFilter)
        }

        if (!map.getLayer(EXPLORE_ACTIVE_LINE_LAYER_ID)) {
          map.addLayer({
            id: EXPLORE_ACTIVE_LINE_LAYER_ID,
            type: 'line',
            source: EXPLORE_SOURCE_ID,
            filter: activeFilter,
            paint: { 'line-color': 'rgb(225,89,137)', 'line-width': 2 },
          })
        } else {
          map.setFilter(EXPLORE_ACTIVE_LINE_LAYER_ID, activeFilter)
        }
      })
      .catch((err) => {
        console.warn('Explore mode: failed to load sector.geojson', err)
      })

    return () => {
      cancelled = true
    }
  }, [exploreSector, mapReady])

  const allLayerFiles = useMemo(
    () =>
      Array.from(
        new Set([
          ...contentItems.flatMap((item) => item.fileList),
          ...ALL_STATIC_LAYER_FILES,
        ]),
      ),
    [contentItems],
  )

  const currentBaseIdRef = useRef<BaseId>(
    isBaseId(DEFAULT_BASE_ID) ? DEFAULT_BASE_ID : 1,
  )
  // Captured at map init — the "home" view scroll-zoom returns to when the
  // active longread item carries no `zoom.layer`.
  const initialViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  // Remembers the last layer we zoomed to, so we don't re-fit on every render.
  const lastZoomKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (exploreSector === null) {
      lastZoomKeyRef.current = null
    }
  }, [exploreSector])

  const activeItem = useMemo(
    () => contentItems.find((item) => item.id === activeItemId),
    [contentItems, activeItemId],
  )

  const activeIdMap = manualIdMap ?? displayedIdMap ?? activeItem?.id_map
  const exploreMountainsActive = activeItemId === EXPLORE_MOUNTAINS_ITEM_ID

  const flyToZoomLayer = (zoomLayer: string | undefined, duration = 1500) => {
    const map = mapRef.current
    if (!map) return
    const trimmed = zoomLayer?.trim()
    if (!trimmed) {
      lastZoomKeyRef.current = null
      const home = initialViewRef.current
      if (home) {
        map.flyTo({
          center: home.center,
          zoom: home.zoom,
          bearing: 0,
          pitch: 0,
          duration,
        })
      }
      return
    }
    lastZoomKeyRef.current = trimmed
    const padding = getMapFitPadding()
    loadGeoJson(`${trimmed}.geojson`)
      .then((data) => {
        let bbox: [[number, number], [number, number]] | null = null
        for (const feature of data.features) {
          if (!feature.geometry) continue
          const fb = computeBBox(feature.geometry as GeoJsonGeometry)
          if (!fb) continue
          bbox = bbox
            ? [
                [Math.min(bbox[0][0], fb[0][0]), Math.min(bbox[0][1], fb[0][1])],
                [Math.max(bbox[1][0], fb[1][0]), Math.max(bbox[1][1], fb[1][1])],
              ]
            : fb
        }
        if (bbox) {
          map.fitBounds(bbox, { padding, maxZoom: 13, duration })
        }
      })
      .catch((err) => {
        console.warn(`Zoom: failed to load ${trimmed}.geojson`, err)
      })
  }

  const handleSelectIdMap = (idMap: number) => {
    setManualIdMap(idMap)
    autoscrollPausedRef.current = true
    const itemId = firstItemIdForIdMap(contentItems, idMap)
    if (itemId) {
      setActiveItemId(itemId)
      activeIdRef.current = itemId
      requestMobileSheetExpanded()
      scrollContentItemIntoView(itemId, itemRefs, listRef)
      syncActiveLongreadElForItem(
        itemId,
        listRef,
        activeLongreadElKeyRef,
        setActiveLongreadElKey,
      )
      const item = contentItems.find((i) => i.id === itemId)
      flyToZoomLayer(item?.zoom?.layer, 1200)
    }
  }

  const handleExploreMountains = () => {
    const lastId =
      contentItems.find((i) => i.id === EXPLORE_MOUNTAINS_ITEM_ID)?.id ??
      contentItems.at(-1)?.id ??
      EXPLORE_MOUNTAINS_ITEM_ID
    setManualIdMap(null)
    autoscrollPausedRef.current = true
    setViewpointsOn(true)
    setExploreSector(null)
    setActiveItemId(lastId)
    activeIdRef.current = lastId
    requestMobileSheetExpanded()
    scrollContentItemIntoView(lastId, itemRefs, listRef)
    syncActiveLongreadElForItem(
      lastId,
      listRef,
      activeLongreadElKeyRef,
      setActiveLongreadElKey,
    )
    flyToZoomLayer(undefined, 1200)
  }
  const activeOverlay: { layers: OverlayLayer[] } | undefined =
    activeIdMap !== undefined ? SECTION_OVERLAYS[activeIdMap] : undefined
  const activeOptionalLayers = activeOverlay
    ? [...activeOverlay.layers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : []
  const activeDisabled = activeIdMap !== undefined ? userDisabled[activeIdMap] : undefined

  const toggleOptional = (idMap: number, layerName: string) => {
    setUserDisabled((prev) => {
      const next = new Set(prev[idMap] ?? [])
      if (next.has(layerName)) next.delete(layerName)
      else next.add(layerName)
      return { ...prev, [idMap]: next }
    })
  }

  const toggleCategory = (idMap: number, layerName: string, categoryValue: string) => {
    setUserDisabledCategories((prev) => {
      const byLayer = { ...(prev[idMap] ?? {}) }
      const next = new Set(byLayer[layerName] ?? [])
      if (next.has(categoryValue)) next.delete(categoryValue)
      else next.add(categoryValue)
      return { ...prev, [idMap]: { ...byLayer, [layerName]: next } }
    })
  }

  useEffect(() => {
    loadContentItemsFromSheet()
      .then((items) => {
        setContentItems(items)
        setActiveItemId(items[0]?.id ?? '')
        setContentLoaded(true)
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = 0
        })
      })
      .catch((loadError) => {
        const items = fillForwardIdMap(fallbackLongreadItems)
        setContentItems(items)
        setActiveItemId(items[0]?.id ?? '')
        setContentLoaded(true)
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = 0
        })
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить данные из Google Sheets.',
        )
      })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    // Desktop has a 650px longread overlay on the right, so the map's visual
    // centre sits west of the geometric centre — bias the initial centre east
    // to compensate. On mobile the map fills the full width, so anchor on the
    // city centre instead.
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const initialCenter: [number, number] = isMobile
      ? [30.32, 59.95]
      : [30.61, 59.94]
    initialViewRef.current = { center: initialCenter, zoom: 10 }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: initialCenter,
      zoom: 10,
      minZoom: 9,
      maxZoom: 14,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl(), 'bottom-left')

    const markMapInteracted = () => {
      mapUserInteractedRef.current = true
    }
    map.on('dragend', markMapInteracted)
    map.on('zoomend', markMapInteracted)

    mapRef.current = map

    const handleLoad = async () => {
      try {
        await addBaseComposition(map, BASE_COMPOSITIONS[DEFAULT_BASE_ID])
      } catch (compositionError) {
        console.warn('Base composition failed to fully load', compositionError)
      }
      setMapReady(true)
    }
    map.on('load', handleLoad)

    return () => {
      map.off('load', handleLoad)
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // Viewpoint photo pins from 23_1_points (merged with «Точки обзора» toggle).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false

    const build = async () => {
      const data = (await loadGeoJson(VIEWPOINTS_POINTS_FILE)) as FeatureCollection
      if (cancelled) return

      await Promise.all(
        data.features.map(async (f) => {
          const key = String(
            (f.properties as { name?: string; fid?: string | number } | null)?.name ??
              (f.properties as { fid?: string | number } | null)?.fid ??
              '',
          )
          if (!key || map.hasImage(key)) return
          const url = viewpointIcons[key]
          if (!url) return
          try {
            const img = await map.loadImage(url)
            if (cancelled || map.hasImage(key)) return
            map.addImage(key, img.data, { pixelRatio: 2 })
          } catch {
            /* missing icon */
          }
        }),
      )
      if (cancelled) return

      if (!map.getSource(VIEWPOINTS_SOURCE_ID)) {
        map.addSource(VIEWPOINTS_SOURCE_ID, {
          type: 'geojson',
          data,
        } satisfies GeoJSONSourceSpecification)
      } else {
        const source = map.getSource(VIEWPOINTS_SOURCE_ID) as maplibregl.GeoJSONSource
        source.setData(data)
      }
      if (!map.getLayer(VIEWPOINTS_LAYER_ID)) {
        map.addLayer({
          id: VIEWPOINTS_LAYER_ID,
          type: 'symbol',
          source: VIEWPOINTS_SOURCE_ID,
          layout: {
            'icon-image': ['to-string', ['get', 'name']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 13, 1],
            'icon-allow-overlap': false,
            'icon-optional': true,
            visibility: viewpointsOnRef.current ? 'visible' : 'none',
          },
        })
      }
    }

    build().catch((err) => console.warn('Viewpoints layer failed', err))

    return () => {
      cancelled = true
      if (map.getLayer(VIEWPOINTS_LAYER_ID)) map.removeLayer(VIEWPOINTS_LAYER_ID)
      if (map.getSource(VIEWPOINTS_SOURCE_ID)) map.removeSource(VIEWPOINTS_SOURCE_ID)
    }
  }, [mapReady])

  // Reflect the on/off toggle onto the Viewpoints layer visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.getLayer(VIEWPOINTS_LAYER_ID)) {
      map.setLayoutProperty(
        VIEWPOINTS_LAYER_ID,
        'visibility',
        viewpointsOn ? 'visible' : 'none',
      )
    }
    const vpCircleId = circleIdForFile(VIEWPOINTS_POINTS_FILE)
    if (map.getLayer(vpCircleId)) {
      map.setLayoutProperty(vpCircleId, 'visibility', viewpointsOn ? 'none' : 'visible')
    }
  }, [viewpointsOn, mapReady])

  // Click a viewpoint icon -> open the full-size photo in a lightbox.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as
        | {
            fid?: number | string
            name?: string
            altitude?: number
            azimuth?: number
          }
        | undefined
      const photoKey = String(props?.name ?? props?.fid ?? '')
      if (!photoKey) return
      const alt =
        typeof props?.altitude === 'number' ? `${Math.round(props.altitude)} м` : undefined
      setObjectPopup({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: photoKey,
        fact: alt,
        description: viewpointPhotoUrl(photoKey) ? 'Фото смотровой точки' : undefined,
        photoFolder: '1',
        photoKey,
        objectId: photoKey,
      })
      setObjectPopupPixel({ x: e.point.x, y: e.point.y })
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', VIEWPOINTS_LAYER_ID, onClick)
    map.on('mouseenter', VIEWPOINTS_LAYER_ID, onEnter)
    map.on('mouseleave', VIEWPOINTS_LAYER_ID, onLeave)
    return () => {
      map.off('click', VIEWPOINTS_LAYER_ID, onClick)
      map.off('mouseenter', VIEWPOINTS_LAYER_ID, onEnter)
      map.off('mouseleave', VIEWPOINTS_LAYER_ID, onLeave)
    }
  }, [mapReady])

  // Paintings layer (id_map 21): map icons, click → modal photo (same UX as mountains).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false

    const build = async () => {
      const data = (await loadGeoJson(PAINTINGS_FILE)) as FeatureCollection
      if (cancelled) return

      await Promise.all(
        data.features.map(async (f) => {
          const fid = (f.properties as { fid?: number | string } | null)?.fid
          if (fid === undefined || fid === null) return
          const id = String(fid)
          const imageId = `paint-${id}`
          if (map.hasImage(imageId)) return
          const bundled = paintingIcons[id]
          const url = bundled ?? resolveObjectPhotoUrl('21', id, 1)
          if (!url) return
          try {
            const img = await map.loadImage(url)
            if (cancelled || map.hasImage(imageId)) return
            map.addImage(imageId, img.data, { pixelRatio: bundled ? 2 : 2 })
          } catch {
            /* missing thumbnail */
          }
        }),
      )
      if (cancelled) return

      if (!map.getSource(PAINTINGS_SOURCE_ID)) {
        map.addSource(PAINTINGS_SOURCE_ID, {
          type: 'geojson',
          data,
        } satisfies GeoJSONSourceSpecification)
      }
      if (!map.getLayer(PAINTINGS_LAYER_ID)) {
        map.addLayer({
          id: PAINTINGS_LAYER_ID,
          type: 'symbol',
          source: PAINTINGS_SOURCE_ID,
          layout: {
            'icon-image': ['concat', 'paint-', ['to-string', ['get', 'fid']]],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 13, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility: 'none',
          },
        })
      }
    }

    build().catch((err) => console.warn('Paintings layer failed', err))

    return () => {
      cancelled = true
      if (map.getLayer(PAINTINGS_LAYER_ID)) map.removeLayer(PAINTINGS_LAYER_ID)
      if (map.getSource(PAINTINGS_SOURCE_ID)) map.removeSource(PAINTINGS_SOURCE_ID)
    }
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!map.getLayer(PAINTINGS_LAYER_ID)) return
    const show = activeIdMap === 21 && paintingsOn
    map.setLayoutProperty(PAINTINGS_LAYER_ID, 'visibility', show ? 'visible' : 'none')
  }, [activeIdMap, paintingsOn, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || activeIdMap !== 21) return

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as
        | { fid?: number | string; name?: string }
        | undefined
      if (props?.fid === undefined || props.fid === null) return
      setObjectPopup(null)
      setPhotoFullscreen(false)
      setPhotoModal({
        folder: '21',
        photoKey: String(props.fid),
        slot: 1,
        name: props.name?.trim() || 'Горная живопись',
      })
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', PAINTINGS_LAYER_ID, onClick)
    map.on('mouseenter', PAINTINGS_LAYER_ID, onEnter)
    map.on('mouseleave', PAINTINGS_LAYER_ID, onLeave)
    return () => {
      map.off('click', PAINTINGS_LAYER_ID, onClick)
      map.off('mouseenter', PAINTINGS_LAYER_ID, onEnter)
      map.off('mouseleave', PAINTINGS_LAYER_ID, onLeave)
    }
  }, [mapReady, activeIdMap])

  useEffect(() => {
    const listElement = listRef.current

    if (!listElement) {
      return
    }

    let frameId = 0

    const updateActiveItem = () => {
      if (contentItems.length === 0) {
        return
      }

      const listElement = listRef.current
      if (!listElement) return

      const maxScrollTop = listElement.scrollHeight - listElement.clientHeight
      const isAtBottom = maxScrollTop <= 0 || listElement.scrollTop >= maxScrollTop - 2

      if (!isAtBottom) {
        return
      }

      const lastItemId = contentItems[contentItems.length - 1]?.id ?? ''
      setActiveItemId((currentId) => (currentId === lastItemId ? currentId : lastItemId))
      syncActiveLongreadElForItem(
        lastItemId,
        listRef,
        activeLongreadElKeyRef,
        setActiveLongreadElKey,
      )
    }

    const pauseAutoscroll = () => {
      autoscrollPausedRef.current = true
    }

    const handleScroll = () => {
      setManualIdMap(null)

      if (mapUserInteractedRef.current) {
        mapUserInteractedRef.current = false
        lastZoomKeyRef.current = null
        const map = mapRef.current
        const activeId = activeIdRef.current
        const item = contentItems.find((i) => i.id === activeId)
        const zoomLayer = item?.zoom?.layer?.trim()
        if (map) {
          if (zoomLayer) {
            loadGeoJson(`${zoomLayer}.geojson`)
              .then((data) => {
                let bbox: [[number, number], [number, number]] | null = null
                for (const feature of data.features) {
                  if (!feature.geometry) continue
                  const fb = computeBBox(feature.geometry as GeoJsonGeometry)
                  if (!fb) continue
                  bbox = bbox
                    ? [
                        [Math.min(bbox[0][0], fb[0][0]), Math.min(bbox[0][1], fb[0][1])],
                        [Math.max(bbox[1][0], fb[1][0]), Math.max(bbox[1][1], fb[1][1])],
                      ]
                    : fb
                }
                if (bbox) {
                  map.fitBounds(bbox, { padding: 80, maxZoom: 13, duration: 1500 })
                }
              })
              .catch(() => undefined)
          } else {
            const home = initialViewRef.current
            if (home) {
              map.flyTo({
                center: home.center,
                zoom: home.zoom,
                bearing: 0,
                pitch: 0,
                duration: 1500,
              })
            }
          }
        }
      }

      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(updateActiveItem)
    }

    const handleResize = () => {
      const activeId = activeIdRef.current
      if (activeId) {
        const el = itemRefs.current.get(activeId)
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }
      handleScroll()
    }

    listElement.addEventListener('scroll', handleScroll, { passive: true })
    listElement.addEventListener('wheel', pauseAutoscroll, { passive: true })
    listElement.addEventListener('touchstart', pauseAutoscroll, { passive: true })

    updateActiveItem()

    return () => {
      cancelAnimationFrame(frameId)
      listElement.removeEventListener('scroll', handleScroll)
      listElement.removeEventListener('wheel', pauseAutoscroll)
      listElement.removeEventListener('touchstart', pauseAutoscroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [contentItems])

  useEffect(() => {
    const list = listRef.current
    if (!list || contentItems.length === 0) return

    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    lastScrollTopRef.current = list.scrollTop

    const commitActiveEl = (resolved: string | null) => {
      activeLongreadElKeyRef.current = resolved
      setActiveLongreadElKey(resolved)
      const itemId = itemIdFromElKey(resolved)
      if (itemId && itemId !== activeIdRef.current) {
        activeIdRef.current = itemId
        setActiveItemId(itemId)
      }
    }

    const pickActiveEl = () => {
      if (isAutoscrollDrivingRef.current) return
      // Autoscroll drives highlight + activeItemId; scroll-spy would reset the timer.
      if (splashDismissed && !autoscrollPausedRef.current) return

      const activeId = activeIdRef.current
      const nodes = Array.from(
        list.querySelectorAll<HTMLElement>('.longread-el[data-el-key]'),
      )

      if (nodes.length === 0) {
        commitActiveEl(null)
        return
      }

      const scrollingUp = list.scrollTop < lastScrollTopRef.current - 1
      lastScrollTopRef.current = list.scrollTop

      const rect = list.getBoundingClientRect()
      const centerY = rect.top + rect.height * 0.42
      const lastItemId = contentItems.at(-1)?.id
      const isFinalItem =
        activeId === lastItemId || activeId === EXPLORE_MOUNTAINS_ITEM_ID
      const HYSTERESIS_PX = isFinalItem ? 56 : 28
      let bestKey: string | null = null
      let bestDist = Number.POSITIVE_INFINITY

      for (const el of nodes) {
        const r = el.getBoundingClientRect()
        if (r.bottom <= rect.top + 8 || r.top >= rect.bottom - 8) continue
        const dist = Math.abs(r.top + r.height / 2 - centerY)
        if (dist < bestDist) {
          bestDist = dist
          bestKey = el.dataset.elKey ?? null
        }
      }

      const fallbackKey = bestKey ?? nodes[0]?.dataset.elKey ?? null
      const prevKey = activeLongreadElKeyRef.current
      if (prevKey && fallbackKey && prevKey !== fallbackKey) {
        const prevEl = nodes.find((n) => n.dataset.elKey === prevKey)
        const nextEl = nodes.find((n) => n.dataset.elKey === fallbackKey)
        if (prevEl && nextEl) {
          const prevDist = Math.abs(
            prevEl.getBoundingClientRect().top +
              prevEl.getBoundingClientRect().height / 2 -
              centerY,
          )
          const nextDist = Math.abs(
            nextEl.getBoundingClientRect().top +
              nextEl.getBoundingClientRect().height / 2 -
              centerY,
          )
          if (nextDist > prevDist - HYSTERESIS_PX) {
            bestKey = prevKey
          }
        }
      }

      let resolved = bestKey ?? fallbackKey

      if (isFinalItem && resolved && prevKey && resolved !== prevKey) {
        const chain = buildElementChain(list)
        const prevIdx = chainIndexForKey(chain, prevKey)
        const nextIdx = chainIndexForKey(chain, resolved)
        if (prevIdx >= 0 && nextIdx >= 0) {
          if (scrollingUp && nextIdx > prevIdx) {
            resolved = prevKey
          } else if (!scrollingUp && nextIdx < prevIdx) {
            resolved = prevKey
          } else {
            finalItemElIndexRef.current = nextIdx
          }
        }
      }

      if (!isAutoscrollDrivingRef.current && resolved && prevKey && resolved !== prevKey) {
        const chain = buildElementChain(list)
        const prevIdx = chainIndexForKey(chain, prevKey)
        const nextIdx = chainIndexForKey(chain, resolved)
        if (prevIdx >= 0 && nextIdx >= 0 && nextIdx - prevIdx >= 3) {
          resolved = chain[prevIdx + 1]?.elKey ?? resolved
        }
      }

      if (isFinalItem) {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => commitActiveEl(resolved), 80)
      } else {
        commitActiveEl(resolved)
      }
    }

    pickActiveEl()

    const observer = new IntersectionObserver(() => pickActiveEl(), {
      root: list,
      rootMargin: '-35% 0px -35% 0px',
      threshold: [0, 0.15, 0.4, 0.7, 1],
    })

    const observeAll = () => {
      observer.disconnect()
      list.querySelectorAll<HTMLElement>('.longread-el[data-el-key]').forEach((el) => {
        observer.observe(el)
      })
      pickActiveEl()
    }

    observeAll()
    list.addEventListener('scroll', pickActiveEl, { passive: true })

    const mo = new MutationObserver(observeAll)
    mo.observe(list, { childList: true, subtree: true })

    return () => {
      clearTimeout(debounceTimer)
      observer.disconnect()
      mo.disconnect()
      list.removeEventListener('scroll', pickActiveEl)
    }
  }, [contentItems, activeItemId, splashDismissed])

  useEffect(() => {
    if (contentItems.length === 0 || !splashDismissed) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (autoscrollPausedRef.current) return
      const list = listRef.current
      if (!list) return

      const chain = buildElementChain(list)
      if (chain.length === 0) {
        timer = setTimeout(schedule, 100)
        return
      }

      const stopIdx = autoscrollStopBeforeKey(chain, EXPLORE_MOUNTAINS_ITEM_ID)
      let idx = chainIndexForKey(chain, activeLongreadElKeyRef.current)
      if (idx < 0) idx = 0
      if (idx > stopIdx) {
        autoscrollPausedRef.current = true
        return
      }

      const current = chain[idx]
      const itemIdx = contentItems.findIndex((i) => i.id === current.itemId)
      const prevChapter = itemIdx > 0 ? contentItems[itemIdx - 1]?.chapter : undefined
      const isChapterStart =
        itemIdx >= 0 && contentItems[itemIdx]?.chapter !== prevChapter
      const isSubtitle = current.elKey.endsWith(':subtitle')
      const dwell = dwellMsForElement(current.text, isChapterStart && isSubtitle)

      timer = setTimeout(() => {
        if (autoscrollPausedRef.current) return
        const freshChain = buildElementChain(listRef.current)
        if (freshChain.length === 0) return
        const freshStop = autoscrollStopBeforeKey(freshChain, EXPLORE_MOUNTAINS_ITEM_ID)
        const curIdx = chainIndexForKey(freshChain, activeLongreadElKeyRef.current)
        if (curIdx < 0 || curIdx >= freshStop) {
          autoscrollPausedRef.current = true
          return
        }

        const next = freshChain[curIdx + 1]
        if (!next) {
          autoscrollPausedRef.current = true
          return
        }

        isAutoscrollDrivingRef.current = true
        activeLongreadElKeyRef.current = next.elKey
        setActiveLongreadElKey(next.elKey)

        if (activeIdRef.current !== next.itemId) {
          activeIdRef.current = next.itemId
          setActiveItemId(next.itemId)
        }

        requestMobileSheetExpanded()
        scrollLongreadElIntoView(next.elKey, listRef, 'auto')

        window.setTimeout(() => {
          isAutoscrollDrivingRef.current = false
        }, AUTOSCROLL_SCROLL_GRACE_MS)
      }, dwell)
    }

    schedule()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [activeLongreadElKey, contentItems, splashDismissed, requestMobileSheetExpanded])

  useEffect(() => {
    if (contentItems.length === 0) {
      return
    }

    const parseHash = (raw: string): Record<string, string> => {
      const trimmed = raw.replace(/^#/, '')
      if (!trimmed) return {}
      const params: Record<string, string> = {}
      for (const pair of trimmed.split('&')) {
        const [k, v] = pair.split('=')
        if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''
      }
      return params
    }

    const applyHash = () => {
      const params = parseHash(window.location.hash)

      if (params.sidebar === 'expanded' || params.sidebar === 'collapsed') {
        document.documentElement.dataset.initialSidebar = params.sidebar
      }

      let targetItemId: string | null = null
      if (params.item) {
        const match = contentItems.find((i) => i.id === params.item)
        if (match) targetItemId = match.id
      } else if (params.id_map) {
        const idMapValue = Number(params.id_map)
        if (Number.isFinite(idMapValue)) {
          const match = contentItems.find((i) => i.id_map === idMapValue)
          if (match) targetItemId = match.id
        }
      }

      if (targetItemId) {
        setActiveItemId(targetItemId)
        const id = targetItemId
        requestAnimationFrame(() => {
          scrollContentItemIntoView(id, itemRefs, listRef, 'auto')
        })
      }
    }

    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [contentItems])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    let cancelled = false

    const syncLayers = async () => {
      const item = contentItems.find((i) => i.id === activeItemId)

      // 1. Resolve base composition for this section and swap if changed.
      const idMap = manualIdMap ?? displayedIdMap ?? item?.id_map
      const desiredBaseId: BaseId =
        item?.base_id ??
        (idMap !== undefined ? SECTION_OVERLAYS[idMap]?.default_base : undefined) ??
        currentBaseIdRef.current

      if (desiredBaseId !== currentBaseIdRef.current) {
        removeComposition(map, BASE_COMPOSITIONS[currentBaseIdRef.current])
        try {
          await addBaseComposition(map, BASE_COMPOSITIONS[desiredBaseId])
        } catch (compositionError) {
          console.warn('Base composition swap failed', compositionError)
        }
        currentBaseIdRef.current = desiredBaseId
        if (cancelled) return
      }

      // 2. Build the visible-overlay set for this section.
      let visibleFiles: Set<string>
      const folderVectorHidden = new Set<string>()
      if (idMap !== undefined && SECTION_OVERLAYS[idMap]) {
        const section = SECTION_OVERLAYS[idMap]
        const disabled = userDisabled[idMap] ?? new Set<string>()
        visibleFiles = new Set(
          section.layers
            .filter((l) => !disabled.has(l.name))
            .map((l) => fileForLayer(l.name)),
        )
        for (const insc of section.inscriptions ?? []) {
          visibleFiles.add(fileForLayer(insc.name))
        }
        for (const fv of section.folder_vectors ?? []) {
          folderVectorHidden.add(fileForLayer(fv.folder_vector))
        }
      } else {
        // Fallback: legacy Sheet-driven fileList + two-palette path.
        visibleFiles = new Set(item?.fileList ?? [])
      }

      if (viewpointsOn && idMap !== 23) {
        visibleFiles.add(VIEWPOINTS_POINTS_FILE)
      }

      for (const mapIdStr of Object.keys(DYNAMIC_NAME_LABEL_ID_MAPS)) {
        const mapId = Number(mapIdStr)
        if (idMap === mapId) {
          visibleFiles.add(dynamicNameLabelFile(mapId))
        }
      }

      const orderedFiles = [
        ...allLayerFiles.filter((f) => visibleFiles.has(f)),
        ...allLayerFiles.filter((f) => !visibleFiles.has(f)),
      ]

      // 3. Ensure every known layer is on the map (idempotent) and toggle visibility.
      for (const fileName of orderedFiles) {
        const styleName = overlayStylesByFile.get(fileName)
        if (ALL_INSCRIPTION_FILES.includes(fileName)) {
          await ensureInscriptionOnMap(map, fileName)
        } else {
          await ensureLayerOnMap(map, fileName, styleName)
        }

        if (cancelled) {
          return
        }

        const visible =
          visibleFiles.has(fileName) && !folderVectorHidden.has(fileName)
        setLayerVisibility(map, fileName, visible, idMap)

        const overlayLayer = overlayLayerByFile.get(fileName)
        const layerName = overlayLayer?.name
        const disabledCats =
          idMap !== undefined && layerName
            ? (userDisabledCategories[idMap]?.[layerName] ?? new Set<string>())
            : new Set<string>()
        applyCategoryFilterToFile(map, fileName, overlayLayer, disabledCats, visible)

        if (visible && !INSTANT_LAYER_FILES.has(fileName)) {
          for (const layerId of [
            fillIdForFile(fileName),
            hatchIdForFile(fileName),
            lineIdForFile(fileName),
            circleIdForFile(fileName),
            symbolIdForFile(fileName),
            inscriptionLabelIdForFile(fileName),
          ]) {
            if (map.getLayer(layerId)) registerLayerHoverFade(map, layerId)
          }
        }
        if (visible && fileName === 'mount.geojson') {
          const symbolId = symbolIdForFile(fileName)
          if (map.getLayer(symbolId)) {
            map.setPaintProperty(symbolId, 'text-opacity', 1)
          }
        }
      }

      for (const [mapIdStr, layerFile] of Object.entries(DYNAMIC_NAME_LABEL_ID_MAPS)) {
        const mapId = Number(mapIdStr)
        await ensureNameLabelsFromLayer(map, layerFile, mapId)
        if (cancelled) return
        const labelFile = dynamicNameLabelFile(mapId)
        const show = idMap === mapId
        setLayerVisibility(map, labelFile, show, idMap)
      }

      if (!cancelled) {
        setLayersSyncGen((g) => g + 1)
      }
    }

    syncLayers().catch((error) => {
      setError(error instanceof Error ? error.message : 'Не удалось загрузить слои карты.')
    })

    return () => {
      cancelled = true
    }
  }, [activeItemId, manualIdMap, displayedIdMap, allLayerFiles, mapReady, contentItems, userDisabled, userDisabledCategories, viewpointsOn])

  // Scroll-zoom: as the active longread item changes, ease the map to the
  // extent of its `zoom.layer` over ~3 s. A `hidden` target is never rendered
  // (we only read its geometry for the bbox), so the zoom happens "by a copy".
  // Items without a zoom layer return the map to the captured home view.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (manualIdMap !== null) return

    const item = contentItems.find((i) => i.id === activeItemId)
    if (!item || item.id_map !== displayedIdMap) return

    const zoomLayer = item.zoom?.layer?.trim()

    if (!zoomLayer) return

    if (lastZoomKeyRef.current === zoomLayer) return
    lastZoomKeyRef.current = zoomLayer

    const padding = getMapFitPadding()

    let cancelled = false
    loadGeoJson(`${zoomLayer}.geojson`)
      .then((data) => {
        if (cancelled) return
        let bbox: [[number, number], [number, number]] | null = null
        for (const feature of data.features) {
          if (!feature.geometry) continue
          const fb = computeBBox(feature.geometry)
          if (!fb) continue
          bbox = bbox
            ? [
                [Math.min(bbox[0][0], fb[0][0]), Math.min(bbox[0][1], fb[0][1])],
                [Math.max(bbox[1][0], fb[1][0]), Math.max(bbox[1][1], fb[1][1])],
              ]
            : fb
        }
        if (bbox) {
          map.fitBounds(bbox, { padding, maxZoom: 13, duration: 3000 })
        }
      })
      .catch((err) => {
        console.warn(`Scroll-zoom: failed to load ${zoomLayer}.geojson`, err)
      })

    return () => {
      cancelled = true
    }
  }, [activeItemId, displayedIdMap, manualIdMap, mapReady, contentItems])

  const setItemRef = (itemId: string) => (element: HTMLDivElement | null) => {
    if (!element) {
      itemRefs.current.delete(itemId)
      return
    }

    itemRefs.current.set(itemId, element)
  }

  return (
    <section className="map-panel">
      <div ref={mapContainerRef} className="map-container" />
      {error ? <div className="error-toast" role="alert">{error}</div> : null}
      <SplashModal
        open={mapReady && contentLoaded && !splashDismissed}
        onClose={() => setSplashDismissed(true)}
      />
      <MapControls
        layersOpen={layerPanelOpen}
        onLayers={() => setLayerPanelOpen((o) => !o)}
        onNorth={() => {
          const map = mapRef.current
          const home = initialViewRef.current
          if (map && home) {
            map.easeTo({
              center: home.center,
              zoom: home.zoom,
              bearing: 0,
              pitch: 0,
              duration: 800,
            })
          }
        }}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 300 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 300 })}
      />
      <MapLayerPanel
        open={layerPanelOpen}
        onClose={() => setLayerPanelOpen(false)}
        activeIdMap={activeIdMap}
        exploreActive={exploreMountainsActive}
        onExploreMountains={handleExploreMountains}
        onSelectIdMap={(id) => {
          handleSelectIdMap(id)
          if (window.matchMedia('(max-width: 768px)').matches) {
            setLayerPanelOpen(false)
          }
        }}
      />
      <OverlayTogglePanel
        idMap={activeIdMap ?? -1}
        layers={activeOptionalLayers}
        disabled={activeDisabled ?? new Set<string>()}
        onToggle={(name) => {
          if (activeIdMap !== undefined) toggleOptional(activeIdMap, name)
        }}
        disabledCategories={
          activeIdMap !== undefined ? userDisabledCategories[activeIdMap] : undefined
        }
        onToggleCategory={
          activeIdMap !== undefined
            ? (layerName, value) => toggleCategory(activeIdMap, layerName, value)
            : undefined
        }
        viewpointsOn={viewpointsOn}
        onToggleViewpoints={() => setViewpointsOn((v) => !v)}
        paintingsOn={activeIdMap === 21 ? paintingsOn : undefined}
        onTogglePaintings={
          activeIdMap === 21 ? () => setPaintingsOn((v) => !v) : undefined
        }
      />

      {objectPopup && objectPopupPixel ? (
        <MountainPopup
          info={objectPopup}
          pixel={objectPopupPixel}
          onClose={closeObjectPopupAll}
          onOpenPhoto={(slot) =>
            setPhotoModal({
              folder: objectPopup.photoFolder,
              photoKey: objectPopup.photoKey,
              slot,
              name: objectPopup.name,
              fact: objectPopup.fact,
            })
          }
        />
      ) : null}
      {photoModal ? (
        <MountainPhotoModal
          photoFolder={photoModal.folder}
          photoKey={photoModal.photoKey}
          slot={photoModal.slot}
          name={photoModal.name}
          fact={photoModal.fact}
          onClose={() => {
            setPhotoModal(null)
            setPhotoFullscreen(false)
          }}
          onGoFullscreen={() => setPhotoFullscreen(true)}
        />
      ) : null}
      {photoModal && photoFullscreen ? (
        <MountainPhotoFullscreen
          photoFolder={photoModal.folder}
          photoKey={photoModal.photoKey}
          slot={photoModal.slot}
          onClose={() => setPhotoFullscreen(false)}
        />
      ) : null}
      {viewpointModal ? (
        <ViewpointPhotoModal info={viewpointModal} onClose={() => setViewpointModal(null)} />
      ) : null}
      <div className="longread-wrapper">
        <MobileLongreadSheet>
          <div ref={listRef} className="longread">
            <div className="longread-content-items">
            {(() => {
              const { chapterNumber, factNumberByItemId } = buildLongreadMeta(contentItems)
              // Global media counter: the very first photo keeps its floated
              // inline layout; every later photo renders full-width below text.
              let mediaCount = 0
              return groupContentByChapter(contentItems).map((group, groupIndex) => (
                <div key={`${group.chapter}-${groupIndex}`} className="longread-chapter-group">
                  <div
                    className="longread-chapter"
                    style={{ zIndex: groupIndex + 3 }}
                  >
                    <span className="longread-chapter__num">
                      {chapterNumber.get(group.chapter)}
                    </span>
                    <span className="longread-chapter__title">{group.chapter}</span>
                  </div>
                  {(() => {
                    let lastSubtitle: string | undefined
                    return group.items.map((item) => {
                      const subtitleChanged = !!item.subtitle && item.subtitle !== lastSubtitle
                      const headerSubtitle = subtitleChanged ? item.subtitle : undefined
                      lastSubtitle = item.subtitle ?? lastSubtitle

                      const photo = item.media ? resolvePhoto(item.media.link) : undefined
                      const factNo = factNumberByItemId.get(item.id)

                      const hasMedia = Boolean(item.media && photo)
                      const isFullMedia = item.media?.side === 'full'
                      const isFirstMedia = hasMedia && !isFullMedia && mediaCount++ === 0
                      const subtitleKey = headerSubtitle
                        ? longreadElKey(item.id, 'subtitle')
                        : null
                      const mediaKey = hasMedia ? longreadElKey(item.id, 'media') : null
                      const factKey = item.fact ? longreadElKey(item.id, 'fact') : null
                      const elActive = (key: string | null) =>
                        key !== null && item.id === activeItemId && activeLongreadElKey === key

                      const figureEl =
                        hasMedia && item.media ? (
                          <figure
                            className={
                              isFullMedia || !isFirstMedia
                                ? `longread-media longread-media--full longread-el longread-el--media ${
                                    elActive(mediaKey) ? 'longread-el--active' : ''
                                  }`
                                : `longread-media longread-media--${item.media.side} longread-el longread-el--media ${
                                    elActive(mediaKey) ? 'longread-el--active' : ''
                                  }`
                            }
                            data-el-key={mediaKey ?? undefined}
                          >
                            <img src={photo} alt={item.media.caption ?? ''} />
                            {item.media.caption ? (
                              <figcaption>{item.media.caption}</figcaption>
                            ) : null}
                          </figure>
                        ) : null

                      return (
                        <div
                          key={item.id}
                          ref={setItemRef(item.id)}
                          className="longread-block longread-content-item"
                        >
                          {headerSubtitle ? (
                            <div
                              className={`longread-subtitle longread-el longread-el--subtitle ${
                                elActive(subtitleKey) ? 'longread-el--active' : ''
                              }`}
                              data-el-key={subtitleKey ?? undefined}
                            >
                              {headerSubtitle}
                            </div>
                          ) : null}
                          <div
                            className={`longread-item ${item.id === activeItemId ? 'is-active' : ''}`}
                          >
                            {item.line !== undefined ? <hr className="longread-divider" /> : null}
                            {isFirstMedia ? figureEl : null}
                            {item.paragraphs.map((para, i) => {
                              const textKey = longreadElKey(item.id, 'text', i)
                              return (
                              <p
                                key={i}
                                className={`longread-el longread-el--text ${
                                  elActive(textKey) ? 'longread-el--active' : ''
                                } ${isEraCaption(para) ? 'longread-era' : 'longread-paragraph'}`}
                                data-el-key={textKey}
                                dangerouslySetInnerHTML={{ __html: para }}
                              />
                            )})}
                            {isFullMedia ? figureEl : null}
                            {item.fact ? (
                              <div
                                className={`longread-fact longread-el longread-el--fact ${
                                  elActive(factKey) ? 'longread-el--active' : ''
                                }`}
                                data-el-key={factKey ?? undefined}
                              >
                                <div className="longread-fact__label">ФАКТ #{factNo}</div>
                                <div className="longread-fact__body">{item.fact}</div>
                              </div>
                            ) : null}
                            {hasMedia && !isFirstMedia && !isFullMedia ? figureEl : null}
                            {item.line === 0 ? <hr className="longread-divider" /> : null}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ))
            })()}
          </div>
        </div>
        </MobileLongreadSheet>
      </div>
    </section>
  )
}

export default MainMap
