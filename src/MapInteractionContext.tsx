/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type SidebarContentItem = {
  id: string
  chapter?: string
}

type Scroller = (id: string) => void

type MapInteractionContextValue = {
  activeItemId: string
  contentItems: SidebarContentItem[]
  scrollToItemId: Scroller
  publishActiveItemId: (id: string) => void
  publishContentItems: (items: SidebarContentItem[]) => void
  registerScroller: (fn: Scroller | null) => void
  exploreSector: number | null
  setExploreSector: (id: number | null) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

const MapInteractionContext = createContext<MapInteractionContextValue | null>(null)

export function MapInteractionProvider({ children }: { children: ReactNode }) {
  const [activeItemId, setActiveItemId] = useState('')
  const [contentItems, setContentItems] = useState<SidebarContentItem[]>([])
  const [exploreSector, setExploreSector] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const scrollerRef = useRef<Scroller | null>(null)

  const scrollToItemId = useCallback<Scroller>((id) => {
    scrollerRef.current?.(id)
  }, [])

  const registerScroller = useCallback((fn: Scroller | null) => {
    scrollerRef.current = fn
  }, [])

  const publishActiveItemId = useCallback((id: string) => setActiveItemId(id), [])
  const publishContentItems = useCallback(
    (items: SidebarContentItem[]) => setContentItems(items),
    [],
  )

  const value = useMemo<MapInteractionContextValue>(
    () => ({
      activeItemId,
      contentItems,
      scrollToItemId,
      publishActiveItemId,
      publishContentItems,
      registerScroller,
      exploreSector,
      setExploreSector,
      mobileMenuOpen,
      setMobileMenuOpen,
    }),
    [
      activeItemId,
      contentItems,
      scrollToItemId,
      publishActiveItemId,
      publishContentItems,
      registerScroller,
      exploreSector,
      mobileMenuOpen,
    ],
  )

  return (
    <MapInteractionContext.Provider value={value}>
      {children}
    </MapInteractionContext.Provider>
  )
}

export function useMapInteraction(): MapInteractionContextValue {
  const ctx = useContext(MapInteractionContext)
  if (!ctx) {
    throw new Error('useMapInteraction must be used inside <MapInteractionProvider>.')
  }
  return ctx
}
