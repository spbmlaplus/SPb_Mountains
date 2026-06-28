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
  viewpointsOn: boolean
  setViewpointsOn: (value: boolean | ((prev: boolean) => boolean)) => void
  exploreMountains: () => void
  registerExploreMountainsHandler: (fn: (() => void) | null) => void
  requestMobileSheetExpanded: () => void
  registerMobileSheetExpander: (fn: (() => void) | null) => void
}

const MapInteractionContext = createContext<MapInteractionContextValue | null>(null)

export function MapInteractionProvider({ children }: { children: ReactNode }) {
  const [activeItemId, setActiveItemId] = useState('')
  const [contentItems, setContentItems] = useState<SidebarContentItem[]>([])
  const [exploreSector, setExploreSector] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [viewpointsOn, setViewpointsOn] = useState(true)
  const scrollerRef = useRef<Scroller | null>(null)
  const exploreMountainsRef = useRef<(() => void) | null>(null)
  const mobileSheetExpanderRef = useRef<(() => void) | null>(null)

  const scrollToItemId = useCallback<Scroller>((id) => {
    scrollerRef.current?.(id)
  }, [])

  const registerScroller = useCallback((fn: Scroller | null) => {
    scrollerRef.current = fn
  }, [])

  const registerExploreMountainsHandler = useCallback((fn: (() => void) | null) => {
    exploreMountainsRef.current = fn
  }, [])

  const exploreMountains = useCallback(() => {
    exploreMountainsRef.current?.()
  }, [])

  const registerMobileSheetExpander = useCallback((fn: (() => void) | null) => {
    mobileSheetExpanderRef.current = fn
  }, [])

  const requestMobileSheetExpanded = useCallback(() => {
    mobileSheetExpanderRef.current?.()
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
      viewpointsOn,
      setViewpointsOn,
      exploreMountains,
      registerExploreMountainsHandler,
      requestMobileSheetExpanded,
      registerMobileSheetExpander,
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
      viewpointsOn,
      exploreMountains,
      registerExploreMountainsHandler,
      requestMobileSheetExpanded,
      registerMobileSheetExpander,
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
