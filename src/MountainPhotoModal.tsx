import { photoUrl } from './mountainPhotos'

type Props = {
  photoId: string
  name: string
  height: number
  onClose: () => void
  onGoFullscreen: () => void
}

export default function MountainPhotoModal({
  photoId,
  name,
  height,
  onClose,
  onGoFullscreen,
}: Props) {
  const src = photoUrl(photoId, 'full')
  if (!src) return null

  const displayName = name.trim() || '—'

  return (
    <div className="mountain-photo-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="mountain-photo-modal__inner"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="mountain-photo-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <img
          src={src}
          alt={displayName}
          className="mountain-photo-modal__image"
          onClick={onGoFullscreen}
        />
        <div className="mountain-photo-modal__caption">
          <span className="mountain-photo-modal__name">{displayName}</span>
          <span className="mountain-photo-modal__height">{height.toFixed(1)} м</span>
        </div>
      </div>
    </div>
  )
}
