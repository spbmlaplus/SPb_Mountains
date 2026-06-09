import { viewpointPhotoUrl } from './viewpointPhotos'

export type ViewpointInfo = {
  fid: number | string
  caption?: string
}

type Props = {
  info: ViewpointInfo
  onClose: () => void
}

export default function ViewpointPhotoModal({ info, onClose }: Props) {
  const src = viewpointPhotoUrl(info.fid)
  if (!src) return null

  return (
    <div className="mountain-photo-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mountain-photo-modal__inner" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="mountain-photo-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <img src={src} alt={info.caption ?? 'Точка обзора'} className="mountain-photo-modal__image" />
        {info.caption ? (
          <div className="mountain-photo-modal__caption">
            <span className="mountain-photo-modal__name">{info.caption}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
