const photoModules = import.meta.glob('./assets/mountain_images/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const photoUrl = (id: string, variant: 'full' | 'thumb' = 'full'): string | null => {
  const suffix = variant === 'thumb' ? '.thumb' : ''
  return photoModules[`./assets/mountain_images/${id}${suffix}.webp`] ?? null
}

export const hasPhoto = (id: string | null | undefined): boolean =>
  id !== null && id !== undefined && photoUrl(id, 'thumb') !== null
