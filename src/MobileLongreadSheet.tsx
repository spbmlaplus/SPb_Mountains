import { Drawer as DrawerPrimitive } from 'vaul'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Drawer, DrawerOverlay, DrawerPortal } from './components/ui/drawer'
import { cn } from '@/lib/utils'
import { useMapInteraction } from './MapInteractionContext'

const MOBILE_MQL = '(max-width: 768px)'
const SNAP_COLLAPSED = '80px'
const SNAP_HALF = 0.42
const SNAP_EXPANDED = 0.72

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQL).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MQL)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

function chapterPillLabel(
  chapter: string | undefined,
  items: { chapter?: string }[],
): string {
  if (!chapter) return ''
  const order: string[] = []
  for (const item of items) {
    if (item.chapter && !order.includes(item.chapter)) {
      order.push(item.chapter)
    }
  }
  const idx = order.indexOf(chapter)
  const num = idx >= 0 ? String(idx + 1).padStart(2, '0') : '01'
  return `${num} ${chapter}`
}

export function MobileLongreadSheet({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const { activeItemId, contentItems, registerMobileSheetExpander } = useMapInteraction()
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(SNAP_HALF)

  useEffect(() => {
    registerMobileSheetExpander(() => setActiveSnapPoint(SNAP_EXPANDED))
    return () => registerMobileSheetExpander(null)
  }, [registerMobileSheetExpander])

  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty('--mobile-legend-bottom')
      return
    }
    let offset: string
    if (activeSnapPoint === SNAP_COLLAPSED) {
      offset = 'calc(80px + 10px)'
    } else if (typeof activeSnapPoint === 'number') {
      offset = `calc(${activeSnapPoint * 100}dvh + 10px)`
    } else {
      offset = 'calc(42dvh + 10px)'
    }
    document.documentElement.style.setProperty('--mobile-legend-bottom', offset)
    return () => {
      document.documentElement.style.removeProperty('--mobile-legend-bottom')
    }
  }, [isMobile, activeSnapPoint])

  const pillText = useMemo(() => {
    const item = contentItems.find((i) => i.id === activeItemId)
    return chapterPillLabel(item?.chapter, contentItems)
  }, [activeItemId, contentItems])

  const isCollapsed =
    activeSnapPoint === SNAP_COLLAPSED ||
    (typeof activeSnapPoint === 'number' && activeSnapPoint < 0.2)

  const toggleSheetHeight = () => {
    setActiveSnapPoint((current) => {
      if (current === SNAP_COLLAPSED || (typeof current === 'number' && current < 0.25)) {
        return SNAP_EXPANDED
      }
      return SNAP_COLLAPSED
    })
  }

  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <Drawer
      open
      dismissible={false}
      modal={false}
      snapPoints={[SNAP_COLLAPSED, SNAP_HALF, SNAP_EXPANDED]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      handleOnly
      noBodyStyles
    >
      <DrawerPortal>
        <DrawerOverlay className="mobile-longread-sheet__overlay bg-transparent" />
        <DrawerPrimitive.Content
          className={cn(
            'mobile-longread-sheet__content group/drawer-content fixed z-50 flex h-auto flex-col bg-white',
            'inset-x-0 bottom-0 max-h-[96dvh] rounded-t-2xl border-0 outline-none',
          )}
        >
          <div className="mobile-longread-sheet__drag-zone">
            <DrawerPrimitive.Handle
              className="mobile-longread-sheet__handle"
              aria-label="Потяните, чтобы изменить высоту панели"
            />
          </div>
          <div className="mobile-longread-sheet__header">
            <button
              type="button"
              className="mobile-longread-sheet__pill"
              onClick={toggleSheetHeight}
              aria-expanded={!isCollapsed}
            >
              {pillText}
            </button>
            <button
              type="button"
              className="mobile-longread-sheet__toggle"
              onClick={toggleSheetHeight}
              aria-label={isCollapsed ? 'Развернуть лонгрид' : 'Свернуть лонгрид'}
            >
              {isCollapsed ? '▴' : '▾'}
            </button>
          </div>
          <div className="mobile-longread-sheet__body">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  )
}

export default MobileLongreadSheet
