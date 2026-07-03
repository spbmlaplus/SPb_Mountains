import layersIcon from './assets/icons/layers.svg'

type Props = {
  onLayers: () => void
  onNorth: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  layersOpen?: boolean
}

export default function MapControls({
  onLayers,
  onNorth,
  onZoomIn,
  onZoomOut,
  layersOpen,
}: Props) {
  return (
    <div
      className={`map-controls${layersOpen ? ' map-controls--panel-open' : ''}`}
      aria-label="Управление картой"
    >
      <button
        type="button"
        className={`map-controls__btn map-controls__btn--layers ${layersOpen ? 'map-controls__btn--active' : ''}`}
        onClick={onLayers}
        aria-label="Слои"
        aria-pressed={layersOpen}
        title="Слои"
      >
        <img className="map-controls__layers-icon" src={layersIcon} alt="" width={28} height={28} />
      </button>
      <button
        type="button"
        className="map-controls__btn map-controls__btn--round"
        onClick={onNorth}
        aria-label="Север"
        title="Север"
      >
        <span className="map-controls__north" aria-hidden>
          ↑
        </span>
      </button>
      <div className="map-controls__zoom">
        <button
          type="button"
          className="map-controls__btn map-controls__btn--round"
          onClick={onZoomIn}
          aria-label="Приблизить"
        >
          +
        </button>
        <button
          type="button"
          className="map-controls__btn map-controls__btn--round"
          onClick={onZoomOut}
          aria-label="Отдалить"
        >
          −
        </button>
      </div>
    </div>
  )
}
