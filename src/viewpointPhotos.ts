// Viewpoint map icons, prepped by scripts/prep-viewpoint-images.sh.
// Keyed by 23_1_points `name` (e.g. "1001"), which is also the MapLibre icon-image key.
const iconModules = import.meta.glob('./assets/viewpoint_images/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

// id -> bundled URL, e.g. { "1001": "/assets/1001-abc123.webp", ... }
export const viewpointIcons: Record<string, string> = Object.fromEntries(
  Object.entries(iconModules).map(([path, url]) => [
    (path.split('/').pop() ?? path).replace(/\.webp$/, ''),
    url,
  ]),
)

// Full-size photos shown in the lightbox when an icon is clicked. Same fid keys.
const photoModules = import.meta.glob('./assets/viewpoint_photos/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const viewpointPhotos: Record<string, string> = Object.fromEntries(
  Object.entries(photoModules).map(([path, url]) => [
    (path.split('/').pop() ?? path).replace(/\.webp$/, ''),
    url,
  ]),
)

export const viewpointPhotoUrl = (fid: string | number): string | null =>
  viewpointPhotos[String(fid)] ?? null
