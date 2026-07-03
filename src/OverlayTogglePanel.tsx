import type { OverlayLayer } from './sectionOverlays'

import { useMemo, useState, type ReactElement } from 'react'

type Props = {
  idMap: number
  layers: OverlayLayer[]
  disabled: Set<string>
  onToggle: (layerName: string) => void
  disabledCategories?: Record<string, Set<string>>
  onToggleCategory?: (layerName: string, categoryValue: string) => void
  viewpointsOn?: boolean
  onToggleViewpoints?: () => void
  paintingsOn?: boolean
  onTogglePaintings?: () => void
}

function LayerGroup({
  idMap,
  layer,
  disabled,
  disabledCategories,
  onToggle,
  onToggleCategory,
}: {
  idMap: number
  layer: OverlayLayer
  disabled: Set<string>
  disabledCategories?: Record<string, Set<string>>
  onToggle: (layerName: string) => void
  onToggleCategory?: (layerName: string, categoryValue: string) => void
}) {
  const checked = !disabled.has(layer.name)
  const layerDisabledCats = disabledCategories?.[layer.name] ?? new Set<string>()

  return (
    <div className="overlay-toggle-panel__group">
      <label className="overlay-toggle-panel__row">
        <input type="checkbox" checked={checked} onChange={() => onToggle(layer.name)} />
        <span>{layer.label ?? layer.name}</span>
      </label>
      {checked && layer.categories?.length && onToggleCategory ? (
        <div className="overlay-toggle-panel__categories">
          {layer.categories.map((cat) => {
            const catChecked = !layerDisabledCats.has(cat.value)
            return (
              <label
                key={`${idMap}-${layer.name}-${cat.value}`}
                className="overlay-toggle-panel__row overlay-toggle-panel__row--category"
              >
                <input
                  type="checkbox"
                  checked={catChecked}
                  onChange={() => onToggleCategory(layer.name, cat.value)}
                />
                <span className="overlay-toggle-panel__category">{cat.label}</span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function OverlayTogglePanel({
  idMap,
  layers,
  disabled,
  onToggle,
  disabledCategories,
  onToggleCategory,
  viewpointsOn,
  onToggleViewpoints,
  paintingsOn,
  onTogglePaintings,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const viewpointsRow = onToggleViewpoints ? (
    <label key="viewpoints" className="overlay-toggle-panel__row">
      <input type="checkbox" checked={!!viewpointsOn} onChange={onToggleViewpoints} />
      <span>Точки обзора</span>
    </label>
  ) : null

  const paintingsRow = onTogglePaintings ? (
    <label key="paintings" className="overlay-toggle-panel__row">
      <input type="checkbox" checked={!!paintingsOn} onChange={onTogglePaintings} />
      <span>Горная живопись</span>
    </label>
  ) : null

  const layerGroups = useMemo(
    () =>
      layers.map((layer) => (
        <LayerGroup
          key={`${idMap}-${layer.name}`}
          idMap={idMap}
          layer={layer}
          disabled={disabled}
          disabledCategories={disabledCategories}
          onToggle={onToggle}
          onToggleCategory={onToggleCategory}
        />
      )),
    [disabled, disabledCategories, idMap, layers, onToggle, onToggleCategory],
  )

  const rows: ReactElement[] =
    idMap === 23
      ? [...layerGroups, viewpointsRow, paintingsRow].filter(Boolean) as ReactElement[]
      : ([viewpointsRow, paintingsRow, ...layerGroups].filter(Boolean) as ReactElement[])

  const hasPanel =
    layers.length > 0 || onToggleViewpoints !== undefined || onTogglePaintings !== undefined

  if (!hasPanel) return null

  return (
    <div className="map-legend-dock">
      <div className="overlay-toggle-panel">
        <div className="overlay-toggle-panel__header" onClick={() => setCollapsed((c) => !c)}>
          <span>Слои</span>
          <span aria-hidden className="overlay-toggle-panel__chevron">
            {collapsed ? '▸' : '▾'}
          </span>
        </div>
        {!collapsed ? (
          <div className="overlay-toggle-panel__rows overlay-toggle-panel__rows--stack">
            {rows}
          </div>
        ) : null}
      </div>
    </div>
  )
}
