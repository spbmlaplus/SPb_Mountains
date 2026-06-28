// Painting map icons, prepped by scripts/prep-painting-images.py (or .sh).
// Keyed by geojson feature `fid`, same as the MapLibre `icon-image` layer.
const iconModules = import.meta.glob('./assets/painting_images/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const paintingIcons: Record<string, string> = Object.fromEntries(
  Object.entries(iconModules).map(([path, url]) => [
    (path.split('/').pop() ?? path).replace(/\.webp$/, ''),
    url,
  ]),
)
