import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSourceSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import img01 from './assets/longread-1-1.png'
import {
  BASE_COMPOSITIONS,
  DEFAULT_BASE_ID,
  type BaseComposition,
} from './baseCompositions'
import { VECTOR_STYLES, type LayerStyle } from './layerStyles'
import { SECTION_OVERLAYS, type OverlayLayer } from './sectionOverlays'
import OverlayTogglePanel from './OverlayTogglePanel'
import { useMapInteraction } from './MapInteractionContext'
import MountainPopup, { type MountainInfo } from './MountainPopup'
import MountainPhotoModal from './MountainPhotoModal'
import MountainPhotoFullscreen from './MountainPhotoFullscreen'
import MobileLongreadControls from './MobileLongreadControls'
import { viewpointIcons } from './viewpointPhotos'
import ViewpointPhotoModal, { type ViewpointInfo } from './ViewpointPhotoModal'

const sheetId = "1eRYnMzPMGck6lGlwGUCkT3tvwWLIQKRLvJ8dgu3oGnk";
const sheetsApiKey = "AIzaSyDhhReA6Fe3i-p8TzL1Xr4DESg_D2YrWhE";
// Sheet schema follows `drive/Описание лонгрида - лонгрид.csv` columns:
//   A=Chapter, B=Subtitle, C=Media Link, D=Line, E=Description, F=Link,
//   G=Coordinates_zoom, H=Zoom, I=id _map, J=Описание что на картах.
const sheetsRange = 'Лист1!A:J';

type BaseId = 1 | 3
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

export type ContentItem = {
  id: string
  title: string
  fileList: string[]
  description: string
  chapter?: string
  id_map?: number
  base_id?: BaseId
  mediaLink?: string
}

const layerModules = import.meta.glob('./assets/layers/*.geojson', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const insetModules = import.meta.glob('./assets/insets/*.{webp,svg,png}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const insetUrlByName: Record<string, string> = Object.fromEntries(
  Object.entries(insetModules).map(([path, url]) => [path.split('/').pop() ?? path, url]),
)

// Full-width longread figures. The CSV's `Media Link` column names the figure
// (e.g. `amphitheater.png`, `landscape_450.png`); the files on disk are the
// design team's renumbered 1.png–5.png set under `assets/longread/`.
const longreadImageModules = import.meta.glob('./assets/longread/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const longreadByBasename: Record<string, string> = Object.fromEntries(
  Object.entries(longreadImageModules).map(([path, url]) => [
    path.split('/').pop() ?? path,
    url,
  ]),
)

const longreadImageByMediaName: Record<string, string | undefined> = {
  'amphitheater.png': longreadByBasename['1.png'],
  'landscape_450.png': longreadByBasename['2.png'],
  'landscape_2,5.png': longreadByBasename['3.png'],
  'landscape_12.png': longreadByBasename['4.png'],
  'landscape_7.png': longreadByBasename['5.png'],
}

const fallbackContentItems: ContentItem[] = ([
  {
    id: 'amphitheater',
    title: 'Амфитеатр',
    fileList: [],
    id_map: 1,
    base_id: 1,
    description:
      'Амфитеатр состоит из сцены, нескольких ярусов зрительного зала (партер, бельэтаж, балкон) и вомиториев — проходов между секторами. Подобная структура удивительно точно повторяется в рельефе окрестностей Санкт-Петербурга',
  },
  {
    id: 'stage',
    title: 'Сцена',
    fileList: ['stage.geojson', 'mask_stage.geojson'],
    id_map: 2,
    base_id: 1,
    description:
      '<b>Сцена</b> — центральное пространство, на которое направлен взгляд зрителей. В географии Петербурга этой «сценой» является плотное урбанизированное ядро города, расположенное в Приневской низине. Вокруг этой низины располагаются три возвышающиеся ступени рельефа, напоминающие ярусы зрительного зала амфитеатра.',
  },
  {
    id: 'parter',
    title: 'Партер',
    fileList: ['parter.geojson', 'mask_parter.geojson'],
    id_map: 3,
    base_id: 1,
    description:
      'Партер — нижний ярус, ближайший к сцене. Ему соответствует литориновый уступ — берег древнего Литоринового моря, который проходит как на севере, так и на юге города.',
  },
  {
    id: 'belletazh',
    title: 'Бельэтаж',
    fileList: ['belletazh.geojson', 'mask_belletazh.geojson'],
    id_map: 4,
    base_id: 1,
    description:
      'Бельэтаж — второй ярус, расположенный выше партера. На юге ему соответствует моренный пояс (например, Пулковские высоты и Троицкая гора). На севере эту ступень образуют камовые гряды (Юкки, Парголово), а на востоке — камовые холмы (Колтушская и Румболовская возвышенности).',
  },
  {
    id: 'balcon',
    title: 'Балкон',
    fileList: ['balcon.geojson', 'mask_balcon.geojson'],
    id_map: 5,
    base_id: 1,
    description:
      'Балкон — самый высокий ярус. В петербургском «амфитеатре» ему соответствуют крупные возвышенности: на юге — Ордовикское (Ижорское) и Силурийское (Путиловское) плато, ограниченные Балтийско-Ладожским уступом (глинтом); на севере — Лемболовская возвышенность, на востоке — Угловские высоты.',
  },
  {
    id: 'vomitoria',
    title: 'Вомитории',
    fileList: ['vomitoria.geojson', 'mask_amphitheater.geojson'],
    id_map: 6,
    base_id: 1,
    description:
      'Вомитории — естественные коридоры, проходы между ярусами седений от выхода к сцене. В природном рельефе их роль выполняют долины рек, которые стекают с возвышенностей в Неву или Финский залив, формируя каньоны. Среди них — Тосна, Ижора, Дудергофка, Сестра и другие.',
  },
  {
    id: 'sector',
    title: 'Сектора',
    fileList: ['sector.geojson', 'mask_amphitheater.geojson'],
    id_map: 7,
    base_id: 1,
    description: 'Сектора — разделенные вомиториями ярусы сидений.',
  },
  {
    id: 'boundaries',
    title: 'Границы',
    fileList: [],
    id_map: 1,
    base_id: 1,
    description: 'Границы в исследовании — это всегда условность, инструмент для удобства анализа. Мы подошли к задаче определения территории исследования творчески, опираясь на морфологию и ландшафты города: выделили внешнюю границу — широкий контекст агломерации и внутреннюю — плотное урбанизированное ядро, или "сцену Амфитеатра".',
  },
  {
    id: 'innerBoundaries',
    title: 'Внутренняя граница',
    fileList: ['resettlement.geojson', 'resettlement_after_stage.geojson', 'stage_isolated_urban_areas.geojson', 'stage_barier.geojson', 'stage.geojson'],
    id_map: 8,
    base_id: 3,
    description: `
      - это граница сцены Амфитеатра, плотное урбанизированное ядро агломерации Петербурга. По сути, это непрерывный город, ткань которого сформировалась достаточно давно и не разрывается крупными барьерами. Для определения этой границы, нам понадобились следующие слои:
      <ul>
        <li>Плотная застройка: кварталы с плотностью > 100 зданий на км², которые сформировались до 1950 года. Они образуют сплошную ткань, которая не прерывается крупными барьерами.</li>
        <li>Планировочные барьеры: крупные автомагистрали вроде КАД, железные дороги и реки — они разрезают город на куски.</li>
        <li>Разрывы в застройке (>200 м): парки, луга, леса, пустыри и парковки, которые прерывают плотную ткань кварталов.</li>
      </ul>
    `,
  },
  {
    id: 'outerBoundaries',
    title: 'Внешняя граница',
    fileList: ['historical_resettlement.geojson', 'stage.geojson', 'slope.geojson', 'search_bound_one_step.geojson', 'search_bound.geojson', 'amphitheater_bound.geojson'],
    id_map: 9,
    base_id: 3,
    description: `
      — это граница Амфитеатра, край ближней периферии (или окрестностей) агломерации Петербурга. По сути, она задает ландшафтно-градостроительный комплекс:  территорию, где экосистема (реки, рельеф, и тд) и расселение людей (города, дороги, инфраструктура) тесно переплетены и влияют друг на друга.
      <br />
      Для определения внешней границы мы использовали слои из области геоморфологии и структуры модели расселения: 
      <br />
      <b>Бровка рельефа</b> — линия резкого перелома рельефа, отделяющая пологий участок или горизонтальную поверхность от более крутого склона. Бровка определяет, где заканчивается ландшафт низменности и начинается — возвышенности.
      <br />
      <b>Историческая система расселения</b> —  текст в разработке
    `,
  }
] as ContentItem[]).map((item) => ({ chapter: 'Как устроен амфитеатр', ...item }))

// Image rows + chapter-2 content sourced from
// `drive/Описание лонгрида - лонгрид.csv` (the design team's source of truth).
// The live Google Sheet still has the legacy 4-column schema (id/title/
// fileList/description) so it doesn't include these rows yet — we merge them
// in until the sheet is migrated.
const amphitheaterFigureItem: ContentItem = {
  id: 'amphitheater-overview',
  title: 'Амфитеатр',
  chapter: 'Как устроен амфитеатр',
  fileList: [],
  id_map: 7,
  base_id: 1,
  description: '',
  mediaLink: 'amphitheater.png',
}

const chapter2SupplementItems: ContentItem[] = ([
  {
    id: 'mountains-intro',
    title: 'Горы Петербурга — геологическая летопись',
    fileList: [],
    id_map: 1,
    base_id: 3,
    description:
      'В окрестностях Петербурга насчитывается 101 именная гора, высота и холм. Эти возвышенности образуют своеобразное природное кольцо вокруг города, которое иногда называют Петербургским амфитеатром. Их происхождение связано с древними геологическими процессами: одни холмы сложены известняками древних морей, другие образованы ледниками, а самые молодые связаны с берегами древнего Балтийского моря. Даже растительность отражает это прошлое: на песчаных камах чаще растут сосны, на глинистых моренах — еловые леса, а на известняковых возвышенностях юга — лиственные.',
  },
  {
    id: 'mountains-how',
    title: 'Как появились горы вокруг Петербурга?',
    fileList: [],
    id_map: 1,
    base_id: 3,
    description:
      '<b>Как появились горы вокруг Петербурга?</b><br /><br />Рельеф региона формировался на протяжении сотен миллионов лет. Сначала здесь было дно древнего моря, затем территорию покрывали огромные ледники, а позже возникли берега древнего Балтийского моря. Каждый из этих этапов оставил свой след в ландшафте и сформировал разные «ярусы» возвышенностей вокруг города.',
  },
  {
    id: 'era-450',
    title: '450 млн лет назад — конец ордовика, начало силура',
    fileList: [],
    id_map: 10,
    base_id: 3,
    description:
      '<b>450 млн лет назад — конец ордовика, начало силура</b><br /><br />Территория будущего Петербурга была покрыта мелководным морем. Здесь накапливались осадочные породы — известняки, песчаники и мергели, формируя основу будущих плато и уступов. Эти осадки стали фундаментом, на котором впоследствии сформировались основные ступени амфитеатра.',
  },
  {
    id: 'era-450-figure',
    title: '',
    fileList: [],
    id_map: 10,
    base_id: 3,
    description: '',
    mediaLink: 'landscape_450.png',
  },
  {
    id: 'era-2_5',
    title: '2,5 млн лет назад — силурийский период',
    fileList: [],
    id_map: 11,
    base_id: 3,
    description:
      '<b>2,5 млн лет назад — силурийский период</b><br /><br />Происходило постепенное поднятие морского дна, формировались ордовикские и силурийские платформы. Эти поднятия стали прообразом современных высоких уступов — Ордовикского и Силурийского плато, включая Дудергофские высоты, Путиловское плато и Балтийско-Ладожский глинт.',
  },
  {
    id: 'era-2_5-figure',
    title: '',
    fileList: [],
    id_map: 11,
    base_id: 3,
    description: '',
    mediaLink: 'landscape_2,5.png',
  },
  {
    id: 'era-12',
    title: '12 тыс. лет назад — девонский период',
    fileList: [],
    id_map: 12,
    base_id: 3,
    description:
      '<b>12 тыс. лет назад — девонский период</b><br /><br />На месте древнего Литоринового моря образовался литориновый уступ — низменная терраса, которая стала нижним ярусом «амфитеатра» Петербурга. В этот период также шло накопление осадочных и ледниковых отложений, закладывавших моренный пояс, камовые гряды и холмы, будущие бельэтаж и балкон рельефа.',
  },
  {
    id: 'era-12-figure',
    title: '',
    fileList: [],
    id_map: 12,
    base_id: 3,
    description: '',
    mediaLink: 'landscape_12.png',
  },
  {
    id: 'era-7',
    title: '7 тыс. лет назад — четвертичный период',
    fileList: [],
    id_map: 13,
    base_id: 3,
    description:
      '<b>7 тыс. лет назад — четвертичный период</b><br /><br />Рельеф окончательно оформился под действием ледниковых потоков, выветривания и эрозии. Речные долины, карстовые углубления и каньоны образовали естественные «вомитории», отделяющие возвышенности друг от друга и формируя сеть рек, стекающих в Неву и Финский залив.',
  },
  {
    id: 'era-7-figure',
    title: '',
    fileList: [],
    id_map: 13,
    base_id: 3,
    description: '',
    mediaLink: 'landscape_7.png',
  },
] as ContentItem[]).map((item) => ({
  chapter: 'Горы Петербурга — геологическая летопись',
  ...item,
}))

// If the live source (sheet) is missing image-only rows or chapter 2, weave
// the CSV-derived content in. Insertion anchors: amphitheater figure goes
// right after the chapter-1 `sector` item; chapter 2 appends at the end.
const mergeFrame44Supplement = (items: ContentItem[]): ContentItem[] => {
  const hasFigures = items.some((i) => i.mediaLink)
  const hasChapter2 = items.some((i) => i.chapter && isChapter2(i.chapter))
  if (hasFigures && hasChapter2) return items

  const result: ContentItem[] = []
  let figureInserted = false
  for (const item of items) {
    result.push(item)
    if (!hasFigures && !figureInserted && item.id === 'sector') {
      result.push(amphitheaterFigureItem)
      figureInserted = true
    }
  }
  if (!hasFigures && !figureInserted) {
    result.push(amphitheaterFigureItem)
  }
  if (!hasChapter2) {
    result.push(...chapter2SupplementItems)
  }
  return result
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

// True for any chapter header whose Russian copy refers to the geological
// "Горы Петербурга" arc (chapter 2). Chapter 2 always uses base #3, including
// for id_map=1's recap shot — this overrides the manifest's `default_base`.
const isChapter2 = (chapter: string) =>
  /горы петербурга|геологическая летопись/i.test(chapter)

const parseSheetRows = (rows: string[][]): ContentItem[] => {
  if (rows.length === 0) {
    return []
  }

  const [headerRow, ...dataRows] = rows
  const headerMap = new Map(headerRow.map((value, index) => [value.trim().toLowerCase(), index]))

  // The Sheet follows the longread CSV schema (chapter/subtitle/description/id_map/...).
  // Header `id _map` carries a space in the source CSV; tolerate both forms.
  const idIndex = headerMap.get('id')
  const chapterIndex = headerMap.get('chapter')
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

  return dataRows
    .filter((row) => row.some((cell) => cell?.trim()))
    .map((row, index) => {
      const title = (titleIndex !== undefined ? row[titleIndex] : row[1])?.trim() ?? ''
      const description =
        (descriptionIndex !== undefined ? row[descriptionIndex] : row[2])?.trim() ?? ''
      const chapter = (chapterIndex !== undefined ? row[chapterIndex] : '')?.trim() ?? ''
      const explicitId = (idIndex !== undefined ? row[idIndex] : '')?.trim() ?? ''
      const fileListValue = fileListIndex !== undefined ? row[fileListIndex] : undefined

      const idMapRaw = idMapIndex !== undefined ? row[idMapIndex]?.trim() : ''
      const baseIdRaw = baseIdIndex !== undefined ? row[baseIdIndex]?.trim() : ''
      const mediaLinkRaw =
        mediaLinkIndex !== undefined ? row[mediaLinkIndex]?.trim() : ''
      const idMapParsed = idMapRaw ? Number(idMapRaw) : NaN
      const baseIdParsed = baseIdRaw ? Number(baseIdRaw) : NaN

      const resolvedIdMap =
        Number.isFinite(idMapParsed) && SECTION_OVERLAYS[idMapParsed]
          ? idMapParsed
          : undefined

      // Resolve base_id: explicit column > chapter inference (chapter 2 = base 3).
      const explicitBaseId =
        Number.isFinite(baseIdParsed) && isBaseId(baseIdParsed) ? baseIdParsed : undefined
      const inferredBaseId: BaseId | undefined = isChapter2(chapter) ? 3 : undefined

      // Each Sheet row needs a unique id for scroll tracking. When there's no
      // dedicated `id` column, fall back to position-based ids — chapter
      // values repeat across many rows so they aren't unique on their own.
      const id = explicitId
        ? sanitizeItemId(explicitId, index)
        : `sheet-item-${index}`

      return {
        id,
        title,
        description,
        fileList: normalizeFileList(fileListValue),
        ...(chapter ? { chapter } : {}),
        ...(resolvedIdMap !== undefined ? { id_map: resolvedIdMap } : {}),
        ...(explicitBaseId !== undefined
          ? { base_id: explicitBaseId }
          : inferredBaseId !== undefined
          ? { base_id: inferredBaseId }
          : {}),
        ...(mediaLinkRaw ? { mediaLink: mediaLinkRaw } : {}),
      }
    })
}

const fillForwardIdMap = (items: ContentItem[]): ContentItem[] => {
  let lastIdMap: number | undefined
  let lastBaseId: BaseId | undefined
  let lastChapter: string | undefined
  return items.map((item) => {
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
}

const loadContentItemsFromSheet = async () => {
  if (!sheetId || !sheetsApiKey) {
    return mergeFrame44Supplement(fallbackContentItems)
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
  const base = items.length > 0 ? items : fallbackContentItems

  return mergeFrame44Supplement(base)
}

const fileUrlByName = Object.fromEntries(
  Object.entries(layerModules).map(([path, url]) => [path.split('/').pop() ?? path, url]),
)

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

// Viewpoints: a standalone, globally-toggleable layer that renders each
// viewpoint photo as a small rounded icon at its location.
const VIEWPOINTS_FILE = 'Viewpoints.geojson'
const VIEWPOINTS_SOURCE_ID = 'viewpoints-source'
const VIEWPOINTS_LAYER_ID = 'viewpoints-symbol'

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
        })
      }
      if (!map.getLayer(entry.id)) {
        const paint =
          entry.paint ??
          (entry.opacity != null ? { 'raster-opacity': entry.opacity } : {})
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
}

const overlayBeforeId = (map: maplibregl.Map) =>
  map.getLayer(OVERLAY_ANCHOR_ID) ? OVERLAY_ANCHOR_ID : undefined

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
  // Point-symbol layers (mountains) sit above all per-section overlays so they
  // remain clickable; everything else stacks beneath the overlay anchor.
  const beforeId = style?.type === 'point-symbol' ? undefined : overlayBeforeId(map)

  if (geometryType === 'Point' && style?.type === 'point-symbol' && style.symbol) {
    if (!map.getLayer(symbolIdForFile(fileName))) {
      const { symbol } = style
      map.addLayer(
        {
          id: symbolIdForFile(fileName),
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': symbol.icon,
            'text-size': symbol.size,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': symbol.color,
            ...(symbol.halo_color ? { 'text-halo-color': symbol.halo_color } : {}),
            ...(symbol.halo_width !== undefined ? { 'text-halo-width': symbol.halo_width } : {}),
          },
        },
        beforeId,
      )
    }
    return
  }

  if (geometryType?.includes('Polygon')) {
    const fillPaint =
      (style && fillPaintFromStyle(style)) ?? {
        'fill-color': masked ? '#09131a' : '#f2a541',
        'fill-opacity': masked ? 0.12 : 0.28,
      }
    if (!map.getLayer(fillIdForFile(fileName))) {
      map.addLayer(
        {
          id: fillIdForFile(fileName),
          type: 'fill',
          source: sourceId,
          paint: fillPaint,
        },
        beforeId,
      )
    }

    const outlinePaint =
      (style && (outlinePaintFromStyle(style) ?? linePaintFromStyle(style))) ?? {
        'line-color': masked ? '#203745' : '#f7c56b',
        'line-width': masked ? 1.5 : 2.2,
        'line-opacity': masked ? 0.55 : 0.95,
      }
    if (!map.getLayer(lineIdForFile(fileName))) {
      map.addLayer(
        {
          id: lineIdForFile(fileName),
          type: 'line',
          source: sourceId,
          paint: outlinePaint,
        },
        beforeId,
      )
    }
    return
  }

  if (geometryType?.includes('LineString')) {
    const linePaint =
      (style && (linePaintFromStyle(style) ?? outlinePaintFromStyle(style))) ?? {
        'line-color': masked ? '#203745' : '#f2a541',
        'line-width': masked ? 2 : 3,
        'line-opacity': 0.9,
      }
    if (!map.getLayer(lineIdForFile(fileName))) {
      map.addLayer(
        {
          id: lineIdForFile(fileName),
          type: 'line',
          source: sourceId,
          paint: linePaint,
        },
        beforeId,
      )
    }
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
}

const setLayerVisibility = (map: maplibregl.Map, fileName: string, visible: boolean) => {
  const visibility = visible ? 'visible' : 'none'

  for (const layerId of [
    fillIdForFile(fileName),
    lineIdForFile(fileName),
    circleIdForFile(fileName),
    symbolIdForFile(fileName),
  ]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  }
}

const fileForLayer = (layerName: string) => `${layerName}.geojson`

const overlayStylesByFile = new Map<string, string>()
for (const set of Object.values(SECTION_OVERLAYS)) {
  for (const layer of set.layers) {
    overlayStylesByFile.set(fileForLayer(layer.name), layer.style)
  }
}

const ALL_OVERLAY_FILES = Array.from(
  new Set(
    Object.values(SECTION_OVERLAYS).flatMap((set) =>
      set.layers.map((l) => fileForLayer(l.name)),
    ),
  ),
)

function MainMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const activeIdRef = useRef('')
  const [mapReady, setMapReady] = useState(false)
  const [viewpointsOn, setViewpointsOn] = useState(true)
  const viewpointsOnRef = useRef(viewpointsOn)
  viewpointsOnRef.current = viewpointsOn
  const [viewpointModal, setViewpointModal] = useState<ViewpointInfo | null>(null)
  const initialItems = useMemo(() => mergeFrame44Supplement(fallbackContentItems), [])
  const [contentItems, setContentItems] = useState(initialItems)
  const [activeItemId, setActiveItemId] = useState(initialItems[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const [mountainPopup, setMountainPopup] = useState<MountainInfo | null>(null)
  const [mountainPopupPixel, setMountainPopupPixel] = useState<{ x: number; y: number } | null>(null)
  const [mountainModalPhotoId, setMountainModalPhotoId] = useState<string | null>(null)
  const [mountainFullscreen, setMountainFullscreen] = useState(false)

  const closeMountainAll = () => {
    setMountainPopup(null)
    setMountainModalPhotoId(null)
    setMountainFullscreen(false)
  }

  const {
    publishActiveItemId,
    publishContentItems,
    registerScroller,
    exploreSector,
  } = useMapInteraction()

  useEffect(() => {
    activeIdRef.current = activeItemId
    publishActiveItemId(activeItemId)
  }, [activeItemId, publishActiveItemId])

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 2500)
    return () => window.clearTimeout(id)
  }, [error])

  useEffect(() => {
    publishContentItems(
      contentItems.map((item) => ({ id: item.id, chapter: item.chapter })),
    )
  }, [contentItems, publishContentItems])

  useEffect(() => {
    registerScroller((id) => {
      const element = itemRefs.current.get(id)
      if (!element) return

      const isMobile = window.matchMedia('(max-width: 768px)').matches
      if (isMobile) {
        const rail = element.parentElement as HTMLElement | null
        if (!rail) return
        const left = element.offsetLeft - rail.offsetLeft
        rail.scrollTo({ left, behavior: 'smooth' })
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
    return () => registerScroller(null)
  }, [registerScroller])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const mountainsLayerId = symbolIdForFile('mountains.geojson')

    const onMountainClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      const props = feature.properties as {
        'Имя'?: string
        height?: number
        'photo id'?: string | null
      }
      const [lng, lat] = feature.geometry.coordinates as [number, number]
      setMountainModalPhotoId(null)
      setMountainFullscreen(false)
      setMountainPopup({
        lng,
        lat,
        name: props['Имя'] ?? '—',
        height: typeof props.height === 'number' ? props.height : 0,
        photoId: props['photo id'] ?? null,
      })
    }

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!map.getLayer(mountainsLayerId)) return
      const hits = map.queryRenderedFeatures(e.point, { layers: [mountainsLayerId] })
      if (hits.length === 0) {
        closeMountainAll()
      }
    }

    map.on('click', mountainsLayerId, onMountainClick)
    map.on('mouseenter', mountainsLayerId, onMouseEnter)
    map.on('mouseleave', mountainsLayerId, onMouseLeave)
    map.on('click', onMapClick)

    return () => {
      map.off('click', mountainsLayerId, onMountainClick)
      map.off('mouseenter', mountainsLayerId, onMouseEnter)
      map.off('mouseleave', mountainsLayerId, onMouseLeave)
      map.off('click', onMapClick)
    }
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mountainPopup) return
    const update = () => {
      const p = map.project([mountainPopup.lng, mountainPopup.lat])
      setMountainPopupPixel({ x: p.x, y: p.y })
    }
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [mountainPopup])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewpointModal) setViewpointModal(null)
      else if (mountainFullscreen) setMountainFullscreen(false)
      else if (mountainModalPhotoId) setMountainModalPhotoId(null)
      else if (mountainPopup) setMountainPopup(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mountainFullscreen, mountainModalPhotoId, mountainPopup, viewpointModal])

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
          ...ALL_OVERLAY_FILES,
        ]),
      ),
    [contentItems],
  )

  const [userDisabled, setUserDisabled] = useState<Record<number, Set<string>>>({})
  const currentBaseIdRef = useRef<BaseId>(
    isBaseId(DEFAULT_BASE_ID) ? DEFAULT_BASE_ID : 1,
  )

  const activeItem = useMemo(
    () => contentItems.find((item) => item.id === activeItemId),
    [contentItems, activeItemId],
  )

  const activeIdMap = activeItem?.id_map
  const activeOverlay: { layers: OverlayLayer[] } | undefined =
    activeIdMap !== undefined ? SECTION_OVERLAYS[activeIdMap] : undefined
  const activeOptionalLayers = activeOverlay ? activeOverlay.layers : []
  const activeDisabled = activeIdMap !== undefined ? userDisabled[activeIdMap] : undefined

  const toggleOptional = (idMap: number, layerName: string) => {
    setUserDisabled((prev) => {
      const next = new Set(prev[idMap] ?? [])
      if (next.has(layerName)) next.delete(layerName)
      else next.add(layerName)
      return { ...prev, [idMap]: next }
    })
  }

  useEffect(() => {
    loadContentItemsFromSheet()
      .then((items) => {
        setContentItems(items)
        setActiveItemId(items[0]?.id ?? '')
      })
      .catch((loadError) => {
        const supplemented = mergeFrame44Supplement(fallbackContentItems)
        setContentItems(supplemented)
        setActiveItemId(supplemented[0]?.id ?? '')
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

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: initialCenter,
      zoom: 9,
      minZoom: 9,
      maxZoom: 14,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl(), 'bottom-left')

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

  // Build the Viewpoints layer once the map is ready: register one icon image
  // per feature (keyed by fid), then add the source + icon-image symbol layer.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false

    const build = async () => {
      const data = (await loadGeoJson(VIEWPOINTS_FILE)) as FeatureCollection
      if (cancelled) return

      await Promise.all(
        data.features.map(async (f) => {
          const fid = (f.properties as { fid?: number | string } | null)?.fid
          if (fid === undefined || fid === null) return
          const id = String(fid)
          if (map.hasImage(id)) return
          const url = viewpointIcons[id]
          if (!url) return
          try {
            const img = await map.loadImage(url)
            if (cancelled || map.hasImage(id)) return
            map.addImage(id, img.data, { pixelRatio: 2 })
          } catch {
            /* missing icon — that feature just won't render */
          }
        }),
      )
      if (cancelled) return

      if (!map.getSource(VIEWPOINTS_SOURCE_ID)) {
        map.addSource(VIEWPOINTS_SOURCE_ID, {
          type: 'geojson',
          data,
        } satisfies GeoJSONSourceSpecification)
      }
      if (!map.getLayer(VIEWPOINTS_LAYER_ID)) {
        map.addLayer({
          id: VIEWPOINTS_LAYER_ID,
          type: 'symbol',
          source: VIEWPOINTS_SOURCE_ID,
          layout: {
            'icon-image': ['to-string', ['get', 'fid']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 13, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
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
  }, [viewpointsOn, mapReady])

  // Click a viewpoint icon -> open the full-size photo in a lightbox.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as
        | { fid?: number | string; Date?: string; Altitude?: number }
        | undefined
      if (props?.fid === undefined || props.fid === null) return
      const parts = [props.Date, typeof props.Altitude === 'number' ? `${Math.round(props.Altitude)} м` : null]
      setViewpointModal({ fid: props.fid, caption: parts.filter(Boolean).join(' · ') || undefined })
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

  useEffect(() => {
    const listElement = listRef.current

    if (!listElement) {
      return
    }

    const getRail = (): HTMLElement | null =>
      listElement.querySelector<HTMLElement>('.longread-content-items')

    const mql = window.matchMedia('(max-width: 768px)')
    let isMobile = mql.matches
    let frameId = 0

    const updateActiveItem = () => {
      if (contentItems.length === 0) {
        return
      }

      if (isMobile) {
        const rail = getRail()
        if (!rail) return
        const left = rail.scrollLeft
        const maxLeft = rail.scrollWidth - rail.clientWidth
        if (maxLeft > 0 && left >= maxLeft - 2) {
          const lastItemId = contentItems[contentItems.length - 1]?.id ?? ''
          setActiveItemId((currentId) => (currentId === lastItemId ? currentId : lastItemId))
          return
        }

        let nextItemId = contentItems[0]?.id ?? ''
        let bestDistance = Number.POSITIVE_INFINITY
        for (const [itemId, element] of itemRefs.current.entries()) {
          const itemLeft = element.offsetLeft - rail.offsetLeft
          const distance = Math.abs(itemLeft - left)
          if (distance < bestDistance) {
            bestDistance = distance
            nextItemId = itemId
          }
        }
        setActiveItemId((currentId) => (currentId === nextItemId ? currentId : nextItemId))
        return
      }

      const rect = listElement.getBoundingClientRect()
      const rootTop = rect.top
      const rootBottom = rect.bottom
      const maxScrollTop = listElement.scrollHeight - listElement.clientHeight
      const isAtBottom = maxScrollTop <= 0 || listElement.scrollTop >= maxScrollTop - 2

      if (isAtBottom) {
        const lastItemId = contentItems[contentItems.length - 1]?.id ?? ''
        setActiveItemId((currentId) => (currentId === lastItemId ? currentId : lastItemId))
        return
      }

      const viewportCenter = (rootTop + rootBottom) / 2
      let nextItemId = contentItems[0]?.id ?? ''
      let bestDistance = Number.POSITIVE_INFINITY

      for (const [itemId, element] of itemRefs.current.entries()) {
        const bounds = element.getBoundingClientRect()
        const visibleTop = Math.max(bounds.top, rootTop)
        const visibleBottom = Math.min(bounds.bottom, rootBottom)
        const visibleHeight = Math.max(0, visibleBottom - visibleTop)
        const itemCenter = bounds.top + bounds.height / 2
        const distanceToCenter = Math.abs(itemCenter - viewportCenter)

        if (visibleHeight <= 0) {
          continue
        }

        if (distanceToCenter < bestDistance) {
          bestDistance = distanceToCenter
          nextItemId = itemId
        }
      }

      setActiveItemId((currentId) => (currentId === nextItemId ? currentId : nextItemId))
    }

    const handleScroll = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(updateActiveItem)
    }

    const handleResize = () => {
      if (isMobile) {
        const rail = getRail()
        const activeId = activeIdRef.current
        if (rail && activeId) {
          const el = itemRefs.current.get(activeId)
          if (el) {
            rail.scrollTo({ left: el.offsetLeft - rail.offsetLeft, behavior: 'auto' })
          }
        }
      }
      handleScroll()
    }

    const attach = () => {
      const target: HTMLElement | null = isMobile ? getRail() : listElement
      if (!target) return () => undefined
      target.addEventListener('scroll', handleScroll, { passive: true })
      return () => target.removeEventListener('scroll', handleScroll)
    }

    let detach = attach()
    window.addEventListener('resize', handleResize)

    const onMqlChange = (e: MediaQueryListEvent) => {
      isMobile = e.matches
      detach()
      detach = attach()
      handleScroll()
    }
    mql.addEventListener('change', onMqlChange)

    updateActiveItem()

    return () => {
      cancelAnimationFrame(frameId)
      detach()
      window.removeEventListener('resize', handleResize)
      mql.removeEventListener('change', onMqlChange)
    }
  }, [contentItems])

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
        const id = targetItemId
        requestAnimationFrame(() => {
          const el = itemRefs.current.get(id)
          if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' })
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
      const idMap = item?.id_map
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
      if (idMap !== undefined && SECTION_OVERLAYS[idMap]) {
        const disabled = userDisabled[idMap] ?? new Set<string>()
        visibleFiles = new Set(
          SECTION_OVERLAYS[idMap].layers
            .filter((l) => !disabled.has(l.name))
            .map((l) => fileForLayer(l.name)),
        )
      } else {
        // Fallback: legacy Sheet-driven fileList + two-palette path.
        visibleFiles = new Set(item?.fileList ?? [])
      }

      // 3. Ensure every known layer is on the map (idempotent) and toggle visibility.
      for (const fileName of allLayerFiles) {
        const styleName = overlayStylesByFile.get(fileName)
        await ensureLayerOnMap(map, fileName, styleName)

        if (cancelled) {
          return
        }

        setLayerVisibility(map, fileName, visibleFiles.has(fileName))
      }
    }

    syncLayers().catch((error) => {
      setError(error instanceof Error ? error.message : 'Не удалось загрузить слои карты.')
    })

    return () => {
      cancelled = true
    }
  }, [activeItemId, allLayerFiles, mapReady, contentItems, userDisabled])

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
      <OverlayTogglePanel
        idMap={activeIdMap ?? -1}
        layers={activeOptionalLayers}
        disabled={activeDisabled ?? new Set<string>()}
        onToggle={(name) => {
          if (activeIdMap !== undefined) toggleOptional(activeIdMap, name)
        }}
        viewpointsOn={viewpointsOn}
        onToggleViewpoints={() => setViewpointsOn((v) => !v)}
      />

      {mountainPopup && mountainPopupPixel ? (
        <MountainPopup
          info={mountainPopup}
          pixel={mountainPopupPixel}
          onClose={closeMountainAll}
          onOpenPhoto={(id) => setMountainModalPhotoId(id)}
        />
      ) : null}
      {mountainPopup && mountainModalPhotoId ? (
        <MountainPhotoModal
          photoId={mountainModalPhotoId}
          name={mountainPopup.name}
          height={mountainPopup.height}
          onClose={() => setMountainModalPhotoId(null)}
          onGoFullscreen={() => setMountainFullscreen(true)}
        />
      ) : null}
      {mountainModalPhotoId && mountainFullscreen ? (
        <MountainPhotoFullscreen
          photoId={mountainModalPhotoId}
          onClose={() => setMountainFullscreen(false)}
        />
      ) : null}
      {viewpointModal ? (
        <ViewpointPhotoModal info={viewpointModal} onClose={() => setViewpointModal(null)} />
      ) : null}
      <div className="longread-wrapper">
        <MobileLongreadControls />
        <div ref={listRef} className="longread">
          <div className="longread-header">01 Как устроен амфитеатр</div>
          <div className="longread-description">
            <div className="flex flex-row my-3 items-center gap-4">
              <img src={img01} alt="Валентин Назаров" className="w-1/2 aspect-square h-1/2" />
              <p>
                Природа подарила нашему городу уникальную, но малоизвестную возможность обзора.
                Окруженный с трех сторон возвышенностями, с которых открываются потрясающие виды,
                Петербург лежит в Приневской низине — словно на сцене амфитеатра.
              </p>
            </div>
            <p>
              Эту метафору предложил градостроитель Валентин Назаров в своей книге &quot;Записки
              питерского урбаниста&quot;. Простое сравнение, но чрезвычайно глубокое. Если
              посмотреть на город и его окрестности как на гигантский амфитеатр, все соединяется
              воедино: физическая география, геология, история.
            </p>
          </div>
          <div className="longread-content">
          <div className="longread-content-title">Как работает метафора Амфитеатра?</div>
          <div className="longread-content-items">
              {contentItems.map((item) => {
                const insets =
                  item.id_map !== undefined ? SECTION_OVERLAYS[item.id_map]?.inset_images : undefined
                const figureSrc = item.mediaLink
                  ? longreadImageByMediaName[item.mediaLink]
                  : undefined
                return (
                  <div
                    key={item.id}
                    ref={setItemRef(item.id)}
                    className={`longread-content-item ${item.id === activeItemId ? 'is-active' : ''}`}
                  >
                    <div
                      className="longread-content-item-body"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                    {figureSrc ? (
                      <img src={figureSrc} alt="" className="longread-figure" />
                    ) : null}
                    {insets?.map((name) => {
                      const src = insetUrlByName[name]
                      if (!src) return null
                      return <img key={name} src={src} alt="" className="longread-inset" />
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MainMap
