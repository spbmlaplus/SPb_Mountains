import { useMemo } from 'react'
import { useMapInteraction } from './MapInteractionContext'

const MAX_DOTS = 10

export function MobileLongreadControls() {
  const { activeItemId, contentItems, scrollToItemId } = useMapInteraction()

  const activeIndex = useMemo(() => {
    const idx = contentItems.findIndex((item) => item.id === activeItemId)
    return idx >= 0 ? idx : 0
  }, [activeItemId, contentItems])

  if (contentItems.length === 0) return null

  const total = contentItems.length
  const isFirst = activeIndex <= 0
  const isLast = activeIndex >= total - 1
  const activeChapter = contentItems[activeIndex]?.chapter

  const goTo = (index: number) => {
    const target = contentItems[index]
    if (target) scrollToItemId(target.id)
  }

  return (
    <div className="mobile-longread-controls" aria-hidden={false}>
      {activeChapter ? (
        <div className="mobile-longread-controls__pill">Глава {activeChapter}</div>
      ) : null}

      <div className="mobile-longread-controls__dots">
        {total <= MAX_DOTS ? (
          contentItems.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-longread-controls__dot${
                i === activeIndex ? ' mobile-longread-controls__dot--active' : ''
              }`}
              aria-label={`Раздел ${i + 1} из ${total}`}
              onClick={() => goTo(i)}
            />
          ))
        ) : (
          <span className="mobile-longread-controls__counter">
            {activeIndex + 1} / {total}
          </span>
        )}
      </div>

      <button
        type="button"
        className="mobile-longread-controls__chevron mobile-longread-controls__chevron--prev"
        aria-label="Предыдущий раздел"
        disabled={isFirst}
        onClick={() => goTo(activeIndex - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="mobile-longread-controls__chevron mobile-longread-controls__chevron--next"
        aria-label="Следующий раздел"
        disabled={isLast}
        onClick={() => goTo(activeIndex + 1)}
      >
        ›
      </button>
    </div>
  )
}

export default MobileLongreadControls
