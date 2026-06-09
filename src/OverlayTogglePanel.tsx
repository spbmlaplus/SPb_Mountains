import type { OverlayLayer } from './sectionOverlays'
import { useState } from 'react'

type Props = {
  idMap: number
  layers: OverlayLayer[]
  disabled: Set<string>
  onToggle: (layerName: string) => void
}

export default function OverlayTogglePanel({ idMap, layers, disabled, onToggle }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  if (layers.length === 0) return null

  return (
    <div className="overlay-toggle-panel">
      <div
        className="overlay-toggle-panel__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>Слои</span>
        <span aria-hidden style={{ marginLeft: 8 }}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed ? (
        <div>
          {layers.map((layer) => {
            const checked = !disabled.has(layer.name)
            return (
              <label
                key={`${idMap}-${layer.name}`}
                className="overlay-toggle-panel__row"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(layer.name)}
                />
                <span>{layer.label ?? layer.name}</span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
