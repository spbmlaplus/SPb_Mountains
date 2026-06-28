import { Drawer as DrawerPrimitive } from 'vaul'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Drawer, DrawerOverlay, DrawerPortal } from './components/ui/drawer'
import { cn } from '@/lib/utils'
import { useMapInteraction } from './MapInteractionContext'

const MOBILE_MQL = '(max-width: 768px)'
const SNAP_PEEK = '96px'
const SNAP_EXPANDED = 0.45

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
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(SNAP_EXPANDED)

  useEffect(() => {
    registerMobileSheetExpander(() => setActiveSnapPoint(SNAP_EXPANDED))
    return () => registerMobileSheetExpander(null)
  }, [registerMobileSheetExpander])

  const pillText = useMemo(() => {
    const item = contentItems.find((i) => i.id === activeItemId)
    return chapterPillLabel(item?.chapter, contentItems)
  }, [activeItemId, contentItems])

  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <Drawer
      open
      dismissible={false}
      modal={false}
      snapPoints={[SNAP_PEEK, SNAP_EXPANDED]}
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
          <DrawerPrimitive.Handle className="mobile-longread-sheet__handle" aria-hidden />
          <div className="mobile-longread-sheet__header">
            <button
              type="button"
              className="mobile-longread-sheet__pill"
              onClick={() => setActiveSnapPoint(SNAP_EXPANDED)}
            >
              {pillText}
            </button>
          </div>
          <div className="mobile-longread-sheet__body">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  )
}

export default MobileLongreadSheet
