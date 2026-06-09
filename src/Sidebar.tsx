import { useEffect, useMemo, useState } from 'react'
import { useMapInteraction } from './MapInteractionContext'
import { CHAPTERS, SECTORS, norm } from './navData'

const readInitialExpanded = (): boolean => {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash.replace(/^#/, '')
  for (const pair of hash.split('&')) {
    const [k, v] = pair.split('=')
    if (k === 'sidebar') return v === 'expanded'
  }
  return false
}

export default function Sidebar() {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded)
  const {
    activeItemId,
    contentItems,
    scrollToItemId,
    exploreSector,
    setExploreSector,
  } = useMapInteraction()

  useEffect(() => {
    const onHashChange = () => setExpanded(readInitialExpanded())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
    setExpanded(false)
  }

  return (
    <aside
      className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}
      aria-label="Навигация по лонгриду"
    >
      <button
        type="button"
        className="sidebar__hamburger"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Свернуть меню' : 'Развернуть меню'}
        aria-expanded={expanded}
      >
        <span className="sidebar__hamburger-bar" />
        <span className="sidebar__hamburger-bar" />
        <span className="sidebar__hamburger-bar" />
      </button>

      {expanded ? (
        <div className="sidebar__body sidebar__body--expanded">
          <h2 className="sidebar__title">Всё о горных просторах Петербурга</h2>
          <ul className="sidebar__chapters">
            {enrichedChapters.map((ch) => {
              const active = isActive(ch.title)
              const classes = [
                'sidebar__chapter',
                !ch.enabled ? 'sidebar__chapter--disabled' : '',
                active ? 'sidebar__chapter--active' : '',
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
                  <span className="sidebar__chapter-num">{ch.num}</span>
                  <span className="sidebar__chapter-title">{ch.title}</span>
                  {!ch.hasContent ? (
                    <span className="sidebar__chapter-badge">Скоро</span>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <hr className="sidebar__separator" />

          <h3 className="sidebar__subtitle">Всё о секторах горного амфитеатра</h3>
          <ul className="sidebar__sectors">
            {SECTORS.map((s) => {
              const sectorIdNum = parseInt(s.num, 10)
              const active = exploreSector === sectorIdNum
              const onActivate = () => {
                setExploreSector(sectorIdNum)
                setExpanded(false)
              }
              return (
                <li
                  key={s.num}
                  className={`sidebar__sector ${active ? 'sidebar__sector--active' : ''}`}
                  onClick={onActivate}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onActivate()
                    }
                  }}
                >
                  <span className="sidebar__sector-num">{s.num}</span>
                  <span className="sidebar__sector-title">{s.title}</span>
                </li>
              )
            })}
          </ul>

          <footer className="sidebar__footer">
            <span className="sidebar__footer-link">О проекте</span>
            <span className="sidebar__footer-link">Глоссарий</span>
            <span className="sidebar__footer-link">Исследовать горы</span>
          </footer>
        </div>
      ) : (
        <div className="sidebar__body sidebar__body--collapsed">
          <ul className="sidebar__vlabels">
            <li>Исследовать горы</li>
            <li>Глоссарий</li>
            <li>О проекте</li>
          </ul>
          <div className="sidebar__mla">МЛА+</div>
        </div>
      )}
    </aside>
  )
}
