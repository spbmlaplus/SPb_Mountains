import { useEffect, useMemo, useRef } from 'react'
import { useMapInteraction } from './MapInteractionContext'
import { CHAPTERS, SECTORS, norm } from './navData'
import { MLA_PLUS_HOME, PROJECT_ABOUT_URL } from './externalLinks'

export default function MobileMenu() {
  const {
    mobileMenuOpen,
    setMobileMenuOpen,
    activeItemId,
    contentItems,
    scrollToItemId,
    exploreMountains,
    setExploreSector,
    exploreSector,
  } = useMapInteraction()

  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (mobileMenuOpen) closeRef.current?.focus()
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileMenuOpen, setMobileMenuOpen])

  const firstItemIdByChapter = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of contentItems) {
      if (item.chapter && !map.has(norm(item.chapter))) {
        map.set(norm(item.chapter), item.id)
      }
    }
    return map
  }, [contentItems])

  const activeChapterTitle = useMemo(() => {
    const item = contentItems.find((i) => i.id === activeItemId)
    return item?.chapter ?? ''
  }, [activeItemId, contentItems])

  const enrichedChapters = CHAPTERS.map((ch) => {
    const firstItemId = firstItemIdByChapter.get(norm(ch.title)) ?? null
    return {
      ...ch,
      firstItemId,
      enabled: ch.hasContent && firstItemId !== null,
    }
  })

  const isActive = (chapterTitle: string) => {
    if (!activeChapterTitle) return false
    return norm(chapterTitle) === norm(activeChapterTitle)
  }

  const handleChapterClick = (firstItemId: string | null, enabled: boolean) => {
    if (!enabled || !firstItemId) return
    scrollToItemId(firstItemId)
    setMobileMenuOpen(false)
  }

  const handleExploreMountains = () => {
    exploreMountains()
    setMobileMenuOpen(false)
  }

  return (
    <div
      id="mobile-menu"
      className={`mobile-menu ${mobileMenuOpen ? 'mobile-menu--open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!mobileMenuOpen}
      aria-label="Меню навигации"
    >
      <div className="mobile-menu__header">
        <button
          ref={closeRef}
          type="button"
          className="mobile-menu__close"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenuOpen(false)}
        >
          ✕
        </button>
        <span className="mobile-menu__brand">
          <a
            className="mobile-menu__brand-link"
            href={MLA_PLUS_HOME}
            target="_blank"
            rel="noopener noreferrer"
          >
            МЛА+
          </a>
        </span>
      </div>

      <h2 className="mobile-menu__title">Всё о горных просторах Петербурга</h2>

      <ol className="mobile-menu__chapters">
        {enrichedChapters.map((ch) => {
          const active = isActive(ch.title)
          const classes = [
            'mobile-menu__chapter',
            !ch.enabled ? 'mobile-menu__chapter--disabled' : '',
            active ? 'mobile-menu__chapter--active' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li
              key={ch.num}
              className={classes}
              onClick={() => handleChapterClick(ch.firstItemId, ch.enabled)}
              role={ch.enabled ? 'button' : undefined}
              tabIndex={ch.enabled ? 0 : -1}
              onKeyDown={(e) => {
                if (!ch.enabled) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleChapterClick(ch.firstItemId, ch.enabled)
                }
              }}
            >
              <span className="mobile-menu__chapter-num">{ch.num}</span>
              <span className="mobile-menu__chapter-title">{ch.title}</span>
            </li>
          )
        })}
      </ol>

      <hr className="mobile-menu__divider" />

      <div className="mobile-menu__footer">
        <a
          className="mobile-menu__footer-link"
          href={PROJECT_ABOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          О проекте
        </a>
        <span className="mobile-menu__footer-link">Глоссарий</span>
        <button
          type="button"
          className="mobile-menu__footer-link mobile-menu__footer-link--button"
          onClick={handleExploreMountains}
        >
          Исследовать горы
        </button>
      </div>

      <h3 className="mobile-menu__subtitle">Всё о секторах горного амфитеатра</h3>

      <ol className="mobile-menu__sectors">
        {SECTORS.map((s) => {
          const sectorIdNum = parseInt(s.num, 10)
          const active = exploreSector === sectorIdNum
          return (
          <li
            key={s.num}
            className={`mobile-menu__sector ${active ? 'mobile-menu__sector--active' : ''}`}
            onClick={() => {
              setExploreSector(sectorIdNum)
              setMobileMenuOpen(false)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setExploreSector(sectorIdNum)
                setMobileMenuOpen(false)
              }
            }}
          >
            <span className="mobile-menu__sector-num">{s.num}</span>
            <span className="mobile-menu__sector-title">{s.title}</span>
          </li>
          )
        })}
      </ol>
    </div>
  )
}
