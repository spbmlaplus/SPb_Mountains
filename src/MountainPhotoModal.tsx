import { resolveObjectPhotoUrl } from './objectPhotos'

type Props = {
  photoFolder: string
  photoKey: string
  slot: 1 | 2
  name: string
  fact?: string
  onClose: () => void
  onGoFullscreen: () => void
}

export default function MountainPhotoModal({
  photoFolder,
  photoKey,
  slot,
  name,
  fact,
  onClose,
  onGoFullscreen,
}: Props) {
  const src = resolveObjectPhotoUrl(photoFolder, photoKey, slot)
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
          {fact ? <span className="mountain-photo-modal__height">{fact}</span> : null}
        </div>
      </div>
    </div>
  )
}
