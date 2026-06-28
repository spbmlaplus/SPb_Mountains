import { useMapInteraction } from './MapInteractionContext'
import { MLA_PLUS_HOME } from './externalLinks'

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
      <a
        className="mobile-top-bar__brand"
        href={MLA_PLUS_HOME}
        target="_blank"
        rel="noopener noreferrer"
      >
        МЛА+
      </a>
    </header>
  )
}
