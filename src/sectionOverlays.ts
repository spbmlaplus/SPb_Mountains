// Per-id_map overlay stacks, derived from
// `src/assets/sections/section-overlays.json` (the runtime-readable port of
// `drive/Описание лонгрида - порядок слоев.csv`). Each set pairs a
// `default_base` (composition #1 or #3) with an ordered list of overlay
// layers; the active section's `base_id` (set on the Sheet row, or hand-coded
// in the fallback) may override `default_base` per occurrence — used to
// disambiguate id_map=1 between its chapter-1 and chapter-2 appearances.

import manifest from './assets/sections/section-overlays.json'

export type OverlayLayer = {
  name: string
  style: string
  mandatory: boolean
  label?: string
}

export type SectionOverlay = {
  default_base: 1 | 3
  layers: OverlayLayer[]
  inset_images?: string[]
}

type ManifestSet = {
  default_base: number
  layers: OverlayLayer[]
  inset_images?: string[]
}

export const SECTION_OVERLAYS: Record<number, SectionOverlay> = Object.fromEntries(
  Object.entries(manifest.sets as Record<string, ManifestSet>).map(([k, v]) => [
    Number(k),
    {
      default_base: v.default_base as 1 | 3,
      layers: v.layers,
      ...(v.inset_images ? { inset_images: v.inset_images } : {}),
    },
  ]),
)

export const KNOWN_ID_MAPS: number[] = Object.keys(manifest.sets).map(Number).sort((a, b) => a - b)
