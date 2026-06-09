import { photoUrl } from './mountainPhotos'

export type MountainInfo = {
  lng: number
  lat: number
  name: string
  height: number
  photoId: string | null
}

type Props = {
  info: MountainInfo
  pixel: { x: number; y: number }
  onClose: () => void
  onOpenPhoto: (id: string) => void
}

export default function MountainPopup({ info, pixel, onClose, onOpenPhoto }: Props) {
  const thumb = info.photoId ? photoUrl(info.photoId, 'thumb') : null
  const heightLabel = `${info.height.toFixed(1)} м`
  const displayName = info.name.trim() || '—'

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
      <div className="mountain-popup__height">{heightLabel}</div>
      {thumb && info.photoId ? (
        <button
          type="button"
          className="mountain-popup__thumb"
          onClick={() => onOpenPhoto(info.photoId as string)}
          aria-label="Открыть фотографию"
        >
          <img src={thumb} alt={displayName} loading="lazy" />
        </button>
      ) : null}
    </div>
  )
}
