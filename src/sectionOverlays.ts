// Per-id_map overlay stacks, derived from
// `src/assets/sections/section-overlays.json` (the runtime-readable port of
// `drive/Описание лонгрида - порядок слоев.csv`). Each set pairs a
// `default_base` (composition #1 or #3) with an ordered list of overlay
// layers; the active section's `base_id` (set on the Sheet row, or hand-coded
// in the fallback) may override `default_base` per occurrence — used to
// disambiguate id_map=1 between its chapter-1 and chapter-2 appearances.

import manifest from './assets/sections/section-overlays.json'

// A legend category (a single value of a classified layer). For mount/estate
// the values come from the LAYERS.csv enumeration rows; for `classify == "name"`
// layers (landscape_*, routes) they are the unique geojson `name` values baked
// at generation time.
export type OverlayCategory = {
  value: string
  label: string
  click_trigger?: boolean
}

export type OverlayLayer = {
  name: string
  style: string
  mandatory: boolean
  label?: string
  // `name_layer_ru_style` — classification attribute, or '' when not classified.
  classify?: string
  click_trigger?: boolean
  inscription?: string
  folder?: string
  folder_vector?: string
  order?: number
  categories?: OverlayCategory[]
}

// Centroid label layer (Phase 2 inscription rendering): file `<name>.geojson`.
export type InscriptionLayer = { name: string; order?: number }
// Photo-folder entry (Phase 2): clickable gallery keyed by a folder name.
export type PhotoFolder = { folder: string; label?: string; click_trigger?: boolean; order?: number }
// Point→polygon pairing (Phase 2): a polygon folder lit by a sibling point layer.
export type FolderVector = { folder_vector: string; click_trigger?: boolean; order?: number }

export type SectionOverlay = {
  default_base: 1 | 3
  layers: OverlayLayer[]
  inscriptions?: InscriptionLayer[]
  photo_folders?: PhotoFolder[]
  folder_vectors?: FolderVector[]
  inset_images?: string[]
}

type ManifestSet = {
  default_base: number
  layers: OverlayLayer[]
  inscriptions?: InscriptionLayer[]
  photo_folders?: PhotoFolder[]
  folder_vectors?: FolderVector[]
  inset_images?: string[]
}

export const SECTION_OVERLAYS: Record<number, SectionOverlay> = Object.fromEntries(
  Object.entries(manifest.sets as Record<string, ManifestSet>).map(([k, v]) => [
    Number(k),
    {
      default_base: (v.default_base as 1 | 3) ?? 1,
      layers: v.layers,
      ...(v.inscriptions ? { inscriptions: v.inscriptions } : {}),
      ...(v.photo_folders ? { photo_folders: v.photo_folders } : {}),
      ...(v.folder_vectors ? { folder_vectors: v.folder_vectors } : {}),
      ...(v.inset_images ? { inset_images: v.inset_images } : {}),
    },
  ]),
)

export const KNOWN_ID_MAPS: number[] = Object.keys(manifest.sets).map(Number).sort((a, b) => a - b)
