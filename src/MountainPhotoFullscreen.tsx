import { photoUrl } from './mountainPhotos'

type Props = {
  photoId: string
  onClose: () => void
}

export default function MountainPhotoFullscreen({ photoId, onClose }: Props) {
  const src = photoUrl(photoId, 'full')
  if (!src) return null

  return (
    <div
      className="mountain-photo-fullscreen"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <img src={src} alt="" className="mountain-photo-fullscreen__image" />
    </div>
  )
}
