import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type maplibregl from 'maplibre-gl'

export const CLICK_HIGHLIGHT_SOURCE_ID = 'click-highlight-source'
export const CLICK_HIGHLIGHT_FILL_ID = 'click-highlight-fill'
export const CLICK_HIGHLIGHT_LINE_ID = 'click-highlight-line'

export const HIGHLIGHT_FILL_COLOR = 'rgb(225, 89, 137)'
export const HIGHLIGHT_FILL_OPACITY = 0.45
export const HIGHLIGHT_LINE_WIDTH = 2.5

export type ClickHighlightStyle = {
  fillColor?: string
  fillOpacity?: number
  lineColor?: string
  lineWidth?: number
}

export const clearClickHighlight = (map: maplibregl.Map) => {
  for (const id of [CLICK_HIGHLIGHT_LINE_ID, CLICK_HIGHLIGHT_FILL_ID]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(CLICK_HIGHLIGHT_SOURCE_ID)) map.removeSource(CLICK_HIGHLIGHT_SOURCE_ID)
}

export const setClickHighlight = (
  map: maplibregl.Map,
  feature: Feature<Geometry> | null,
  beforeId?: string,
  style?: ClickHighlightStyle,
) => {
  clearClickHighlight(map)
  if (!feature?.geometry) return

  const fillColor = style?.fillColor ?? HIGHLIGHT_FILL_COLOR
  const fillOpacity = style?.fillOpacity ?? HIGHLIGHT_FILL_OPACITY
  const lineColor = style?.lineColor ?? HIGHLIGHT_FILL_COLOR
  const lineWidth = style?.lineWidth ?? HIGHLIGHT_LINE_WIDTH

  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [feature],
  }

  map.addSource(CLICK_HIGHLIGHT_SOURCE_ID, {
    type: 'geojson',
    data: collection,
  })

  const geomType = feature.geometry.type
  if (geomType.includes('Polygon')) {
    map.addLayer(
      {
        id: CLICK_HIGHLIGHT_FILL_ID,
        type: 'fill',
        source: CLICK_HIGHLIGHT_SOURCE_ID,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': fillOpacity,
        },
      },
      beforeId,
    )
  }

  if ((geomType.includes('Polygon') || geomType.includes('Line')) && lineWidth > 0) {
    map.addLayer(
      {
        id: CLICK_HIGHLIGHT_LINE_ID,
        type: 'line',
        source: CLICK_HIGHLIGHT_SOURCE_ID,
        paint: {
          'line-color': lineColor,
          'line-width': lineWidth,
        },
      },
      beforeId,
    )
  }

  if (geomType === 'Point') {
    map.addLayer(
      {
        id: CLICK_HIGHLIGHT_FILL_ID,
        type: 'circle',
        source: CLICK_HIGHLIGHT_SOURCE_ID,
        paint: {
          'circle-radius': 14,
          'circle-color': fillColor,
          'circle-opacity': fillOpacity,
          'circle-stroke-width': 2,
          'circle-stroke-color': fillColor,
        },
      },
      beforeId,
    )
  }
}
