type Props = {
  open: boolean
  onClose: () => void
}

export default function SplashModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="splash-backdrop" onClick={onClose} role="presentation">
      <div
        className="splash-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Добро пожаловать"
      >
        <button type="button" className="splash-modal__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="splash-modal__title">Горный Петербург</h2>
        <p className="splash-modal__text">
          Петербург принято считать плоским городом. Но если взглянуть на него вместе с окружающим
          ландшафтом, открывается неожиданная картина: город в окружении возвышенностей напоминает
          гигантский амфитеатр.
        </p>
        <p className="splash-modal__hint splash-modal__hint--desktop">
          Прокрутите лонгрид справа, чтобы начать рассказ.
        </p>
        <p className="splash-modal__hint splash-modal__hint--mobile">
          Потяните панель вверх или нажмите ▴, чтобы читать рассказ.
        </p>
      </div>
    </div>
  )
}
