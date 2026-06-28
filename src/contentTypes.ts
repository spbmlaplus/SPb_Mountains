export type BaseId = 1 | 3

export type MediaSide = 'left' | 'right' | 'full'

export type LongreadMedia = {
  // Basename of a file in `new_files/photos` (copied to `src/assets/photos`).
  link: string
  side: MediaSide
  // `name_Media Link` — optional caption shown under the figure.
  caption?: string
}

export type LongreadZoom = {
  // `name_layer` the map should zoom to (resolved against LAYERS).
  layer: string
  // `Zoom_view=1` → the zoom-target layer itself stays hidden (zoom by a copy).
  hidden: boolean
}

// One longread row from `new_legend/LONGREAD.csv`. `chapter`/`subtitle` are
// fill-forwarded (a value persists until the next non-empty cell). The legacy
// fields (`title`, `description`, `fileList`, `mediaLink`) are kept so the
// existing runtime/Sheet code keeps compiling; new UI reads the richer fields.
export type ContentItem = {
  id: string
  // Fill-forwarded chapter / subtitle headings.
  chapter?: string
  subtitle?: string
  // Divider mode: 1 = single line above, 0 = lines above and below.
  line?: 0 | 1
  // One `Description` cell = one paragraph (kept verbatim; may contain newlines
  // and `<b>` runs which the UI renders as bold + underline).
  paragraphs: string[]
  media?: LongreadMedia
  // `fact` cell — rendered as the pink "ФАКТ #N" panel.
  fact?: string
  zoom?: LongreadZoom
  id_layer_base?: number
  id_map?: number
  base_id?: BaseId

  // --- legacy / compatibility fields (still consumed by current runtime) ---
  title: string
  description: string
  fileList: string[]
  mediaLink?: string
}

/** Geological timeline line, e.g. «2,5 млн лет назад — ледники. Силурийский период.» */
export const isEraCaption = (text: string): boolean =>
  /\d+[,.]?\d*\s*(?:млн|тыс\.)\s+лет\s+назад/i.test(text.replace(/<[^>]+>/g, ''))
