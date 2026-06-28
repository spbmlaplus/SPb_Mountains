import type maplibregl from 'maplibre-gl'

export const LAYER_FADE_IN_MS = 500
const HOVER_OPACITY_BOOST = 1.15

export type OpacityProp = 'fill-opacity' | 'line-opacity' | 'circle-opacity' | 'text-opacity' | 'icon-opacity'

export type TargetOpacityResolver = (
  layerId: string,
  prop: OpacityProp,
) => number | undefined

const resolveOpacityTarget = (
  layerId: string,
  prop: OpacityProp,
  resolver?: TargetOpacityResolver,
): number => resolver?.(layerId, prop) ?? 1

export const opacityPropsForLayerType = (type: string): OpacityProp[] => {
  switch (type) {
    case 'fill':
      return ['fill-opacity']
    case 'line':
      return ['line-opacity']
    case 'circle':
      return ['circle-opacity']
    case 'symbol':
      return ['text-opacity', 'icon-opacity']
    default:
      return []
  }
}

const fadeTransition = (duration: number): maplibregl.TransitionSpecification => ({
  duration,
  delay: 0,
})

/** Attach MapLibre opacity transitions when a sub-layer is first created. */
export const ensureOpacityTransition = (
  map: maplibregl.Map,
  layerId: string,
  duration = LAYER_FADE_IN_MS,
) => {
  const layer = map.getLayer(layerId)
  if (!layer) return
  const transition = fadeTransition(duration)
  for (const prop of opacityPropsForLayerType(layer.type)) {
    const key = `${prop}-transition` as keyof maplibregl.LayerSpecification
    try {
      map.setPaintProperty(layerId, key as never, transition as never)
    } catch {
      /* layer may not support this paint prop */
    }
  }
}

const readOpacity = (map: maplibregl.Map, layerId: string, prop: OpacityProp): number => {
  const val = map.getPaintProperty(layerId, prop)
  return typeof val === 'number' ? val : 1
}

const setOpacityOnLayer = (
  map: maplibregl.Map,
  layerId: string,
  factor: number,
  targetByProp?: Map<string, number>,
) => {
  const layer = map.getLayer(layerId)
  if (!layer) return
  for (const prop of opacityPropsForLayerType(layer.type)) {
    const target = targetByProp?.get(`${layerId}:${prop}`) ?? 1
    map.setPaintProperty(layerId, prop, Math.max(0, Math.min(1, target * factor)))
  }
}

const storeTargetOpacities = (
  map: maplibregl.Map,
  layerIds: string[],
  store: Map<string, number>,
) => {
  for (const layerId of layerIds) {
    const layer = map.getLayer(layerId)
    if (!layer) continue
    for (const prop of opacityPropsForLayerType(layer.type)) {
      const key = `${layerId}:${prop}`
      if (!store.has(key)) {
        store.set(key, readOpacity(map, layerId, prop))
      }
    }
  }
}

export type LayerIdFns = {
  fillIdForFile: (fileName: string) => string
  hatchIdForFile: (fileName: string) => string
  lineIdForFile: (fileName: string) => string
  circleIdForFile: (fileName: string) => string
  symbolIdForFile: (fileName: string) => string
  overlayLabelIdForFile: (fileName: string) => string
  inscriptionLabelIdForFile: (fileName: string) => string
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

const pendingHideTimers = new Map<string, ReturnType<typeof setTimeout>>()
const targetOpacityStore = new Map<string, number>()
const hoverRegistered = new Set<string>()

const resetLayerOpacities = (
  map: maplibregl.Map,
  layerIds: string[],
  resolveTargetOpacity?: TargetOpacityResolver,
) => {
  for (const layerId of layerIds) {
    const layer = map.getLayer(layerId)
    if (!layer) continue
    for (const prop of opacityPropsForLayerType(layer.type)) {
      const key = `${layerId}:${prop}`
      const target = resolveOpacityTarget(layerId, prop, resolveTargetOpacity)
      targetOpacityStore.set(key, target)
      map.setPaintProperty(layerId, prop, target)
    }
  }
}

/** Instant show/hide — no opacity animation (mount, id_map 13/14). */
export const instantLayerVisibility = (
  map: maplibregl.Map,
  fileName: string,
  visible: boolean,
  idFns: LayerIdFns,
  resolveTargetOpacity?: TargetOpacityResolver,
) => {
  const layerIds = subLayerIdsForFile(fileName, idFns).filter((id) => Boolean(map.getLayer(id)))
  if (layerIds.length === 0) return

  const pending = pendingHideTimers.get(fileName)
  if (pending) {
    clearTimeout(pending)
    pendingHideTimers.delete(fileName)
  }

  for (const layerId of layerIds) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }
  if (visible) {
    resetLayerOpacities(map, layerIds, resolveTargetOpacity)
  }
}

export const fadeLayerVisibility = (
  map: maplibregl.Map,
  fileName: string,
  visible: boolean,
  idFns: LayerIdFns,
  duration = LAYER_FADE_IN_MS,
  resolveTargetOpacity?: TargetOpacityResolver,
) => {
  const layerIds = subLayerIdsForFile(fileName, idFns).filter((id) => Boolean(map.getLayer(id)))
  if (layerIds.length === 0) return

  if (visible) {
    for (const layerId of layerIds) {
      const layer = map.getLayer(layerId)
      if (!layer) continue
      for (const prop of opacityPropsForLayerType(layer.type)) {
        targetOpacityStore.set(
          `${layerId}:${prop}`,
          resolveOpacityTarget(layerId, prop, resolveTargetOpacity),
        )
      }
    }
  } else {
    storeTargetOpacities(map, layerIds, targetOpacityStore)
  }

  const pending = pendingHideTimers.get(fileName)
  if (pending) {
    clearTimeout(pending)
    pendingHideTimers.delete(fileName)
  }

  if (visible) {
    for (const layerId of layerIds) {
      map.setLayoutProperty(layerId, 'visibility', 'visible')
      ensureOpacityTransition(map, layerId, duration)
      setOpacityOnLayer(map, layerId, 0, targetOpacityStore)
    }
    requestAnimationFrame(() => {
      for (const layerId of layerIds) {
        if (!map.getLayer(layerId)) return
        setOpacityOnLayer(map, layerId, 1, targetOpacityStore)
      }
    })
    return
  }

  for (const layerId of layerIds) {
    ensureOpacityTransition(map, layerId, duration)
    setOpacityOnLayer(map, layerId, 0, targetOpacityStore)
  }
  pendingHideTimers.set(
    fileName,
    setTimeout(() => {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none')
          setOpacityOnLayer(map, layerId, 1, targetOpacityStore)
        }
      }
      pendingHideTimers.delete(fileName)
    }, duration),
  )
}

export const registerLayerHoverFade = (map: maplibregl.Map, layerId: string) => {
  if (hoverRegistered.has(layerId)) return
  const layer = map.getLayer(layerId)
  if (!layer) return
  hoverRegistered.add(layerId)

  storeTargetOpacities(map, [layerId], targetOpacityStore)
  ensureOpacityTransition(map, layerId, LAYER_FADE_IN_MS)

  const onEnter = () => {
    setOpacityOnLayer(map, layerId, HOVER_OPACITY_BOOST, targetOpacityStore)
  }
  const onLeave = () => {
    setOpacityOnLayer(map, layerId, 1, targetOpacityStore)
  }

  map.on('mouseenter', layerId, onEnter)
  map.on('mouseleave', layerId, onLeave)
}

export const unregisterAllLayerHoverFade = (_map: maplibregl.Map) => {
  hoverRegistered.clear()
}
