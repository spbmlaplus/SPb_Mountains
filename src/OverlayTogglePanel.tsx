import type { OverlayLayer } from './sectionOverlays'

import { useState } from 'react'

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

  if (layers.length === 0 && !onToggleViewpoints && !onTogglePaintings) return null

  const layerRows = layers.map((layer) => {
    const checked = !disabled.has(layer.name)
    const layerDisabledCats = disabledCategories?.[layer.name] ?? new Set<string>()
    return (
      <div key={`${idMap}-${layer.name}`} className="overlay-toggle-panel__group">
        <label className="overlay-toggle-panel__row">
          <input type="checkbox" checked={checked} onChange={() => onToggle(layer.name)} />
          <span>{layer.label ?? layer.name}</span>
        </label>
        {layer.categories && layer.categories.length > 0 && checked && onToggleCategory ? (
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
  })

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

  // id_map 23 / «Исследовать горы»: смотровые точки секции — первыми в списке.
  const rows =
    idMap === 23
      ? [...layerRows, viewpointsRow, paintingsRow]
      : [viewpointsRow, paintingsRow, ...layerRows]

  return (
    <div className="overlay-toggle-panel">
      <div className="overlay-toggle-panel__header" onClick={() => setCollapsed((c) => !c)}>
        <span>Слои</span>
        <span aria-hidden style={{ marginLeft: 8 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </div>
      {!collapsed ? <div>{rows}</div> : null}
    </div>
  )
}
