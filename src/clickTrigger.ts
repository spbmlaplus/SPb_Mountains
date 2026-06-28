import { SECTION_OVERLAYS, type OverlayLayer, type SectionOverlay } from './sectionOverlays'

export type ClickLayerConfig = {
  fileName: string
  layerName: string
  photoFolder: string
  classifyAttr?: string
  /** When set, only features whose classification value is in this set are clickable. */
  clickableValues: Set<string> | null
}

const fileForLayer = (layerName: string) => `${layerName}.geojson`

export const resolvePhotoFolder = (
  section: SectionOverlay | undefined,
  layer: OverlayLayer,
): string => {
  if (layer.folder?.trim()) return layer.folder.trim()
  if (section?.photo_folders?.length) {
    const preferred =
      section.photo_folders.find((p) => p.click_trigger) ?? section.photo_folders[0]
    return preferred.folder
  }
  return layer.style
}

/** Photo folder for folder_vector viewpoint clicks (non-click_trigger folders). */
export const viewpointPhotoFolder = (section: SectionOverlay | undefined): string | null => {
  if (!section?.photo_folders?.length) return null
  const folder =
    section.photo_folders.find((p) => !p.click_trigger) ?? section.photo_folders[0]
  return folder?.folder ?? null
}

const clickableValuesForLayer = (layer: OverlayLayer): Set<string> | null => {
  if (!layer.categories?.length) {
    return layer.click_trigger ? null : new Set()
  }
  const values = layer.categories.filter((c) => c.click_trigger).map((c) => c.value)
  if (values.length === 0) {
    return layer.click_trigger ? null : new Set()
  }
  return new Set(values)
}

export const isLayerClickEnabled = (layer: OverlayLayer): boolean => {
  if (layer.click_trigger) return true
  return (layer.categories ?? []).some((c) => c.click_trigger)
}

export const buildClickConfigsForSection = (idMap: number | undefined): ClickLayerConfig[] => {
  if (idMap === undefined) return []
  const section = SECTION_OVERLAYS[idMap]
  if (!section) return []

  const configs: ClickLayerConfig[] = []
  for (const layer of section.layers) {
    if (!isLayerClickEnabled(layer)) continue
    const clickableValues = clickableValuesForLayer(layer)
    if (clickableValues && clickableValues.size === 0) continue
    configs.push({
      fileName: fileForLayer(layer.name),
      layerName: layer.name,
      photoFolder: resolvePhotoFolder(section, layer),
      classifyAttr: layer.classify || undefined,
      clickableValues,
    })
  }
  return configs
}

export type ParsedFeatureProps = {
  name: string
  fact?: string
  type?: string
  description?: string
  objectId: string | number
  /** Basename used to resolve photos in object_photos/{folder}/ */
  photoKey: string
}

export const readFeatureProp = (
  props: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const val = props[key]
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      return String(val).trim()
    }
  }
  return undefined
}

export const parseClickFeatureProps = (props: Record<string, unknown>): ParsedFeatureProps => {
  const name = readFeatureProp(props, 'name') ?? '—'
  const fact =
    readFeatureProp(props, 'fact') ??
    readFeatureProp(props, 'hight', 'height_value') ??
    (typeof props.height_value === 'number' ? `${props.height_value.toFixed(2)} м` : undefined)
  const type = readFeatureProp(props, 'type')
  const description = readFeatureProp(props, 'description', 'description ')
  const objectId =
    props.id !== null && props.id !== undefined
      ? (props.id as string | number)
      : props.fid !== null && props.fid !== undefined
        ? (props.fid as string | number)
        : name

  const explicitPhoto = readFeatureProp(props, 'photo id', 'photo')
  const nameProp = readFeatureProp(props, 'name')
  let photoKey = explicitPhoto
  if (!photoKey) {
    if (nameProp && /^\d[\w.-]*$/i.test(nameProp)) {
      photoKey = nameProp
    } else {
      photoKey = String(props.id ?? props.fid ?? objectId)
    }
  }

  return { name, fact, type, description, objectId, photoKey }
}

export const isFeatureClickable = (
  props: Record<string, unknown>,
  config: ClickLayerConfig,
): boolean => {
  if (!config.clickableValues) return true
  const attr = config.classifyAttr
  const value = String(
    (attr ? props[attr] : undefined) ?? props.type ?? props.name ?? '',
  ).trim()
  return config.clickableValues.has(value)
}

/** Point layer file that follows a folder_vector polygon folder in the same id_map. */
export const folderVectorPointLayerFor = (
  idMap: number | undefined,
): { polygonFile: string; pointFile: string } | null => {
  if (idMap === undefined) return null
  const section = SECTION_OVERLAYS[idMap]
  if (!section?.folder_vectors?.length) return null

  const polygonName = section.folder_vectors[0].folder_vector
  const polygonFile = fileForLayer(polygonName)

  const byFolderVector = section.layers.find(
    (l) => l.folder_vector && l.folder_vector === polygonName,
  )
  if (byFolderVector) {
    return { polygonFile, pointFile: fileForLayer(byFolderVector.name) }
  }

  const byStyle = section.layers.find((l) => l.style === '23_1' || l.name.includes('23_1'))
  if (byStyle) {
    return { polygonFile, pointFile: fileForLayer(byStyle.name) }
  }

  const polygonOrder = section.folder_vectors[0].order ?? 0
  const pointLayer = section.layers
    .filter((l) => (l.order ?? 0) < polygonOrder)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0]
  if (!pointLayer) return null

  return { polygonFile, pointFile: fileForLayer(pointLayer.name) }
}

export const matchFolderVectorKey = (props: Record<string, unknown>): string | null => {
  if (props.layer !== null && props.layer !== undefined && String(props.layer).trim() !== '') {
    return String(props.layer).trim()
  }
  if (props.id !== null && props.id !== undefined) {
    return String(props.id)
  }
  return null
}
