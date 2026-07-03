import { useEffect, useState } from 'react'
import { MAP_LAYER_THUMBS } from './mapLayerThumbs'

export type MapLayerOption =
  | { kind: 'single'; idMap: number; label: string; thumb: string }
  | {
      kind: 'group'
      label: string
      thumb: string
      options: { idMap: number; label: string; thumb: string }[]
    }
  | { kind: 'wide'; label: string; thumb: string }

export const MAP_LAYER_OPTIONS: MapLayerOption[] = [
  { kind: 'single', idMap: 1, label: 'Горы Петербурга', thumb: MAP_LAYER_THUMBS.mountains },
  {
    kind: 'group',
    label: 'Из чего состоит амфитеатр?',
    thumb: MAP_LAYER_THUMBS.amphitheater,
    options: [
      { idMap: 3, label: 'Сцена', thumb: MAP_LAYER_THUMBS.amphitheater1 },
      { idMap: 4, label: 'Партер', thumb: MAP_LAYER_THUMBS.amphitheater2 },
      { idMap: 5, label: 'Бельэтаж', thumb: MAP_LAYER_THUMBS.amphitheater3 },
      { idMap: 6, label: 'Балкон', thumb: MAP_LAYER_THUMBS.amphitheater4 },
      { idMap: 7, label: 'Вомитории', thumb: MAP_LAYER_THUMBS.amphitheater },
    ],
  },
  { kind: 'single', idMap: 11, label: 'Горная геология', thumb: MAP_LAYER_THUMBS.geology },
  { kind: 'single', idMap: 12, label: 'История горных финнов', thumb: MAP_LAYER_THUMBS.finns },
  { kind: 'single', idMap: 15, label: 'Высочайшие наблюдатели', thumb: MAP_LAYER_THUMBS.observers },
  { kind: 'single', idMap: 22, label: 'Современные горы', thumb: MAP_LAYER_THUMBS.modern },
  { kind: 'wide', label: 'Исследуйте горы', thumb: MAP_LAYER_THUMBS.explore },
]

export function labelForIdMap(idMap?: number): string {
  if (idMap === undefined || idMap === 1) return '01 Горы Петербурга'
  for (const opt of MAP_LAYER_OPTIONS) {
    if (opt.kind === 'single' && opt.idMap === idMap) return opt.label
    if (opt.kind === 'group') {
      const sub = opt.options.find((o) => o.idMap === idMap)
      if (sub) return sub.label
    }
  }
  return '01 Горы Петербурга'
}

type Props = {
  open: boolean
  onClose: () => void
  activeIdMap?: number
  onSelectIdMap: (idMap: number) => void
  onExploreMountains?: () => void
  exploreActive?: boolean
}

function LayerCard({
  label,
  thumb,
  selected,
  wide,
  onClick,
}: {
  label: string
  thumb: string
  selected?: boolean
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`map-layer-card ${wide ? 'map-layer-card--wide' : ''} ${selected ? 'map-layer-card--active' : ''}`}
      onClick={onClick}
    >
      <span className="map-layer-card__thumb-wrap">
        <img className="map-layer-card__thumb" src={thumb} alt="" loading="lazy" />
      </span>
      <span className="map-layer-card__label">{label}</span>
    </button>
  )
}

export default function MapLayerPanel({
  open,
  onClose,
  activeIdMap,
  onSelectIdMap,
  onExploreMountains,
  exploreActive,
}: Props) {
  const [amphitheaterOpen, setAmphitheaterOpen] = useState(false)

  useEffect(() => {
    if (!open) setAmphitheaterOpen(false)
  }, [open])

  if (!open) return null

  const amphitheaterGroup = MAP_LAYER_OPTIONS.find((o) => o.kind === 'group')
  const mainOptions = MAP_LAYER_OPTIONS.filter((o) => o.kind !== 'wide')
  const wideOption = MAP_LAYER_OPTIONS.find((o) => o.kind === 'wide')

  const amphitheaterActive =
    amphitheaterGroup?.kind === 'group' &&
    amphitheaterGroup.options.some((o) => o.idMap === activeIdMap)

  return (
    <div className="map-layer-panel-backdrop" onClick={onClose} role="presentation">
      <div
        className="map-layer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Карты"
      >
        <div className="map-layer-panel__handle" aria-hidden />
        <div className="map-layer-panel__header">
          {amphitheaterOpen ? (
            <button
              type="button"
              className="map-layer-panel__back"
              onClick={() => setAmphitheaterOpen(false)}
            >
              ← Назад
            </button>
          ) : (
            <span className="map-layer-panel__pill">{labelForIdMap(activeIdMap)}</span>
          )}
          <button type="button" className="map-layer-panel__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="map-layer-panel__body">
          {amphitheaterOpen && amphitheaterGroup?.kind === 'group' ? (
            <>
              <p className="map-layer-panel__subheading">{amphitheaterGroup.label}</p>
              <div className="map-layer-panel__grid">
                {amphitheaterGroup.options.map((sub) => (
                  <LayerCard
                    key={sub.idMap}
                    label={sub.label}
                    thumb={sub.thumb}
                    selected={activeIdMap === sub.idMap}
                    onClick={() => onSelectIdMap(sub.idMap)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="map-layer-panel__grid">
                {mainOptions.map((opt) => {
                  if (opt.kind === 'single') {
                    return (
                      <LayerCard
                        key={opt.idMap}
                        label={opt.label}
                        thumb={opt.thumb}
                        selected={activeIdMap === opt.idMap}
                        onClick={() => onSelectIdMap(opt.idMap)}
                      />
                    )
                  }
                  return (
                    <LayerCard
                      key={opt.label}
                      label={opt.label}
                      thumb={opt.thumb}
                      selected={amphitheaterActive}
                      onClick={() => setAmphitheaterOpen(true)}
                    />
                  )
                })}
              </div>
              {wideOption?.kind === 'wide' ? (
                <LayerCard
                  label={wideOption.label}
                  thumb={wideOption.thumb}
                  wide
                  selected={!!exploreActive}
                  onClick={() => {
                    onExploreMountains?.()
                    onClose()
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
