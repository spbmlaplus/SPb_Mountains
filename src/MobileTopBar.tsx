import { useMapInteraction } from './MapInteractionContext'

export default function MobileTopBar() {
  const { mobileMenuOpen, setMobileMenuOpen } = useMapInteraction()

  return (
    <header className="mobile-top-bar">
      <button
        type="button"
        className="mobile-top-bar__hamburger"
        aria-label="Открыть меню"
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-menu"
        onClick={() => setMobileMenuOpen(true)}
      >
        <span className="mobile-top-bar__hamburger-bar" />
        <span className="mobile-top-bar__hamburger-bar" />
        <span className="mobile-top-bar__hamburger-bar" />
      </button>
      <span className="mobile-top-bar__brand">МЛА+</span>
    </header>
  )
}
