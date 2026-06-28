import { resolveObjectPhotoUrl } from './objectPhotos'
import { viewpointIcons } from './viewpointPhotos'

export type ObjectPopupInfo = {
  lng: number
  lat: number
  name: string
  fact?: string
  type?: string
  description?: string
  photoFolder: string
  photoKey: string
  objectId: string | number
}

/** @deprecated Use ObjectPopupInfo */
export type MountainInfo = ObjectPopupInfo

type Props = {
  info: ObjectPopupInfo
  pixel: { x: number; y: number }
  onClose: () => void
  onOpenPhoto: (slot: 1 | 2) => void
}

export default function MountainPopup({ info, pixel, onClose, onOpenPhoto }: Props) {
  const displayName = info.name.trim() || '—'
  const thumb1 =
    info.photoFolder === '1'
      ? (viewpointIcons[info.photoKey] ?? resolveObjectPhotoUrl(info.photoFolder, info.photoKey, 1))
      : resolveObjectPhotoUrl(info.photoFolder, info.photoKey, 1)
  const thumb2 = resolveObjectPhotoUrl(info.photoFolder, info.photoKey, 2)
  const hasThumb1 = thumb1 !== null
  const hasThumb2 = thumb2 !== null

  return (
    <div
      className="mountain-popup"
      style={{ left: `${pixel.x}px`, top: `${pixel.y}px` }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={displayName}
    >
      <button
        type="button"
        className="mountain-popup__close"
        onClick={onClose}
        aria-label="Закрыть"
      >
        ×
      </button>
      <div className="mountain-popup__name">{displayName}</div>
      {info.fact ? <div className="mountain-popup__fact">{info.fact}</div> : null}
      {info.type ? <div className="mountain-popup__type">{info.type}</div> : null}
      {info.description ? (
        <div className="mountain-popup__description">{info.description}</div>
      ) : null}
      {hasThumb1 || hasThumb2 ? (
        <div className="mountain-popup__thumbs">
          {hasThumb1 && thumb1 ? (
            <button
              type="button"
              className="mountain-popup__thumb"
              onClick={() => onOpenPhoto(1)}
              aria-label="Открыть фотографию 1"
            >
              <img src={thumb1} alt={displayName} loading="lazy" />
            </button>
          ) : null}
          {hasThumb2 && thumb2 ? (
            <button
              type="button"
              className="mountain-popup__thumb"
              onClick={() => onOpenPhoto(2)}
              aria-label="Открыть фотографию 2"
            >
              <img src={thumb2} alt={displayName} loading="lazy" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
