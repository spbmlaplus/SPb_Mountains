import { resolveObjectPhotoUrl } from './objectPhotos'

type Props = {
  photoFolder: string
  photoKey: string
  slot: 1 | 2
  onClose: () => void
}

export default function MountainPhotoFullscreen({
  photoFolder,
  photoKey,
  slot,
  onClose,
}: Props) {
  const src = resolveObjectPhotoUrl(photoFolder, photoKey, slot)
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
