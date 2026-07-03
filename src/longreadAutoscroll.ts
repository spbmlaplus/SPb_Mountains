import type { ContentItem } from './contentTypes'
import { dwellMsForElement } from './longreadElementChain'

/** @deprecated Prefer dwellMsForElement for element-level autoscroll. */
export const dwellMsForItem = (item: ContentItem, isChapterStart: boolean): number => {
  const text = [
    item.subtitle,
    item.title,
    ...(item.paragraphs ?? []),
    item.description,
    item.fact,
    item.media?.caption,
  ]
    .filter(Boolean)
    .join(' ')
  return dwellMsForElement(text, isChapterStart)
}
