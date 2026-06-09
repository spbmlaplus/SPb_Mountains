export type MaskRegion = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

export type FrameEntry = {
  frame: number
  hash: string
  taskOwners: string[]
  notes?: string
  maskRegions?: MaskRegion[]
}

// Widths match `Sidebar.tsx`'s `.sidebar--collapsed` / `.sidebar--expanded` rules.
const SIDEBAR_WIDTH_COLLAPSED = 48
const SIDEBAR_WIDTH_EXPANDED = 260

const LONGREAD_WIDTH = 340
const LONGREAD_X = 1920 - LONGREAD_WIDTH

const LONGREAD_COPY_MASK: MaskRegion = {
  x: LONGREAD_X,
  y: 0,
  width: LONGREAD_WIDTH,
  height: 1080,
  label: 'longread copy panel (CSV-driven, not equivalent to Figma text)',
}

const mapTileMask = (sidebarWidth: number): MaskRegion => ({
  x: sidebarWidth,
  y: 0,
  width: LONGREAD_X - sidebarWidth,
  height: 1080,
  label: 'map tile area (raster pixels, not equivalent to Figma vector)',
})

const STANDARD_MASKS = (sidebarWidth: number = SIDEBAR_WIDTH_COLLAPSED): MaskRegion[] => [
  LONGREAD_COPY_MASK,
  mapTileMask(sidebarWidth),
]

const NO_LONGREAD_MASK = (sidebarWidth: number = SIDEBAR_WIDTH_COLLAPSED): MaskRegion[] => [
  mapTileMask(sidebarWidth),
]

const NO_MAP_MASK = (): MaskRegion[] => [LONGREAD_COPY_MASK]

export const FRAMES: FrameEntry[] = [
  {
    frame: 16,
    hash: '#sidebar=expanded',
    taskOwners: ['01', '02'],
    notes: 'Expanded sidebar (8 chapters + 13 sectors); 229 triangles visible across the agglomeration.',
    maskRegions: NO_MAP_MASK(),
  },
  {
    frame: 30,
    hash: '#sidebar=collapsed',
    taskOwners: ['01'],
    notes: 'Collapsed sidebar (32 px rail with vertical labels); cover state, no chapter active.',
    maskRegions: STANDARD_MASKS(),
  },
  {
    frame: 35,
    hash: '#id_map=2',
    taskOwners: ['02', '05', '07'],
    notes: 'Сцена — bold underlined coral; triangles persist; positron labels overlay relief.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 37,
    hash: '#id_map=3',
    taskOwners: ['02', '05', '07'],
    notes: 'Партер — bold underlined; triangles persist; positron labels.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 38,
    hash: '#id_map=4',
    taskOwners: ['02', '05', '07'],
    notes: 'Бельэтаж — bold underlined; triangles persist; positron labels.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 39,
    hash: '#id_map=5',
    taskOwners: ['02', '05', '06', '07'],
    notes: 'Балкон — bold underlined; triangles persist; positron labels; amphitheater cross-section inset.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 40,
    hash: '#id_map=6',
    taskOwners: ['02', '05', '06', '07'],
    notes: 'Вомитории — bold underlined; triangles persist; positron labels; sector wedge diagram inset.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 41,
    hash: '#id_map=7',
    taskOwners: ['02', '05', '06', '07'],
    notes: 'Сектора — bold underlined; triangles persist; positron labels; sector diagram inset.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 46,
    hash: '#id_map=10',
    taskOwners: ['02', '08'],
    notes: '450 млн лет — desaturated chapter-2 base; triangles HIDDEN (verifies id_map>=10 gate).',
    maskRegions: STANDARD_MASKS(),
  },
  {
    frame: 47,
    hash: '#id_map=11',
    taskOwners: ['02', '06', '08'],
    notes: '2,5 млн лет — desaturated base; triangles HIDDEN; two geological inset diagrams.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 48,
    hash: '#id_map=12',
    taskOwners: ['02', '06', '08'],
    notes: '12 тыс. лет — desaturated base; triangles HIDDEN; Devonian + glacier diagrams.',
    maskRegions: NO_LONGREAD_MASK(),
  },
  {
    frame: 49,
    hash: '#id_map=13',
    taskOwners: ['02', '06', '08'],
    notes: '7 тыс. лет — desaturated base; triangles HIDDEN; Quaternary cross-section + diagrams.',
    maskRegions: NO_LONGREAD_MASK(),
  },
]

export const figmaPathFor = (frame: number): string => `Frame ${frame}.png`

export const filterByOwner = (entries: FrameEntry[], owner: string | null): FrameEntry[] =>
  owner ? entries.filter((entry) => entry.taskOwners.includes(owner)) : entries

export const ownerArgFromArgv = (argv: string[]): string | null => {
  const idx = argv.indexOf('--task')
  if (idx === -1 || idx === argv.length - 1) return null
  return argv[idx + 1]
}

export const allOwners = (entries: FrameEntry[] = FRAMES): string[] => {
  const set = new Set<string>()
  for (const e of entries) for (const o of e.taskOwners) set.add(o)
  return Array.from(set).sort()
}

export const SIDEBAR_WIDTHS = {
  collapsed: SIDEBAR_WIDTH_COLLAPSED,
  expanded: SIDEBAR_WIDTH_EXPANDED,
}
