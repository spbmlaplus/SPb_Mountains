import type { Feature, FeatureCollection, Geometry } from 'geojson'

type Coord = number[]

const ringCentroid = (ring: Coord[]): [number, number] => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of ring) {
    minX = Math.min(minX, c[0])
    maxX = Math.max(maxX, c[0])
    minY = Math.min(minY, c[1])
    maxY = Math.max(maxY, c[1])
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

const geometryCentroid = (geometry: Geometry): [number, number] | null => {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    return ring?.length ? ringCentroid(ring) : null
  }
  if (geometry.type === 'MultiPolygon') {
    const ring = geometry.coordinates[0]?.[0]
    return ring?.length ? ringCentroid(ring) : null
  }
  return null
}

/** Point labels from polygon `name` — used for id_map 12/13 dynamic inscriptions. */
export const nameLabelsFromCollection = (
  data: FeatureCollection,
): FeatureCollection => {
  const features: Feature[] = []
  for (const feature of data.features) {
    if (!feature.geometry) continue
    const rawName = feature.properties?.name
    if (rawName === null || rawName === undefined) continue
    const name = String(rawName).trim()
    if (!name) continue
    const center = geometryCentroid(feature.geometry)
    if (!center) continue
    features.push({
      type: 'Feature',
      properties: { name },
      geometry: { type: 'Point', coordinates: center },
    })
  }
  return { type: 'FeatureCollection', features }
}
