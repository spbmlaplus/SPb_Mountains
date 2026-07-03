import type { ContentItem } from './contentTypes'

export const EXPLORE_MOUNTAINS_ITEM_ID = 'longread-56-горные-активности'

const INTRO_INDEXES = [0, 1, 2, 3, 4] as const

export const isIntroItem = (itemId: string): boolean => {
  const m = /^longread-(\d+)-/.exec(itemId)
  if (!m) return false
  const n = Number(m[1])
  return INTRO_INDEXES.includes(n as (typeof INTRO_INDEXES)[number])
}

export const introGroupActive = (activeItemId: string): boolean => isIntroItem(activeItemId)

export const firstIntroItemId = (items: ContentItem[]): string | undefined =>
  items.find((i) => isIntroItem(i.id))?.id

export const introSubtitleKey = (items: ContentItem[]): string | null => {
  const first = items.find((i) => isIntroItem(i.id))
  if (!first?.subtitle) return null
  return `${first.id}:subtitle`
}

const MIN_DWELL_MS = 2000
const CHAPTER_DWELL_MS = 3000
const MIN_AUTO_MS = 4000
const MAX_AUTO_MS = 10000
const MS_PER_CHAR = 40

export const MANUAL_SCROLL_COOLDOWN_MS = 2000
export const LAYER_SWITCH_MIN_MS = 2000
export const AUTOSCROLL_SCROLL_GRACE_MS = 1000

export const dwellMsForElement = (text: string, isChapterStart = false): number => {
  if (isChapterStart) return Math.max(MIN_DWELL_MS, CHAPTER_DWELL_MS)
  const plain = text.replace(/<[^>]+>/g, '').trim()
  if (!plain) return MIN_DWELL_MS
  const computed = plain.length * MS_PER_CHAR
  return Math.max(MIN_DWELL_MS, Math.min(MAX_AUTO_MS, Math.max(MIN_AUTO_MS, computed)))
}

export type ChainElement = {
  itemId: string
  elKey: string
  text: string
  index: number
}

export const buildElementChain = (listEl: HTMLElement | null): ChainElement[] => {
  if (!listEl) return []
  const nodes = Array.from(
    listEl.querySelectorAll<HTMLElement>('.longread-el[data-el-key]'),
  )
  return nodes.map((el, index) => {
    const elKey = el.dataset.elKey ?? ''
    const itemId = elKey.split(':')[0] ?? ''
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return { itemId, elKey, text, index }
  })
}

export const chainIndexForKey = (chain: ChainElement[], elKey: string | null): number => {
  if (!elKey) return -1
  return chain.findIndex((c) => c.elKey === elKey)
}

export const findChainEl = (listEl: HTMLElement | null, elKey: string): HTMLElement | null => {
  if (!listEl) return null
  for (const el of listEl.querySelectorAll<HTMLElement>('.longread-el[data-el-key]')) {
    if (el.dataset.elKey === elKey) return el
  }
  return null
}

export const scrollLongreadElIntoView = (
  elKey: string,
  listRef: { current: HTMLElement | null },
  behavior: ScrollBehavior = 'smooth',
) => {
  const list = listRef.current
  const el = findChainEl(list, elKey)
  if (!el || !list) return

  const listRect = list.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const elTopInList = elRect.top - listRect.top + list.scrollTop
  const targetScroll = elTopInList + elRect.height / 2 - listRect.height * 0.42
  list.scrollTo({ top: Math.max(0, targetScroll), behavior })
}

export const itemIdFromElKey = (elKey: string | null): string | null => {
  if (!elKey) return null
  return elKey.split(':')[0] ?? null
}

/** Last chain index that autoscroll may enter (excludes explore-mountains final item). */
export const autoscrollStopBeforeKey = (
  chain: ChainElement[],
  exploreItemId: string,
): number => {
  const exploreStart = chain.findIndex((c) => c.itemId === exploreItemId)
  if (exploreStart <= 0) return chain.length - 1
  return exploreStart - 1
}
