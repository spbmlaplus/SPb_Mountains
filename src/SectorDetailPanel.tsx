import { useEffect } from 'react'
import { useMapInteraction } from './MapInteractionContext'

const SECTOR_TITLES: Record<number, string> = {
  1: 'Рощинский сектор',
  2: 'Белоостровский сектор',
  3: 'Лемболовский сектор',
  4: 'Токсовский сектор',
  5: 'Румболовский сектор',
  6: 'Колтушский сектор',
  7: 'Саблинско-Красноборский сектор',
  8: 'Федоровский сектор',
  9: 'Дудергофско-Пулковский сектор',
  10: 'Аннинский сектор',
  11: 'Ропшинский сектор',
  12: 'Гостилицкий сектор',
  13: 'Пеникский сектор',
}

export default function SectorDetailPanel() {
  const { exploreSector, setExploreSector } = useMapInteraction()

  useEffect(() => {
    if (exploreSector == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExploreSector(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exploreSector, setExploreSector])

  if (exploreSector == null) return null

  const title = SECTOR_TITLES[exploreSector] ?? `Сектор ${exploreSector}`
  const num = String(exploreSector).padStart(2, '0')

  return (
    <div className="sector-detail-panel" role="dialog" aria-label={title}>
      <button
        type="button"
        className="sector-detail-panel__close"
        onClick={() => setExploreSector(null)}
        aria-label="Закрыть"
      >
        ×
      </button>
      <div className="sector-detail-panel__num">{num}</div>
      <h2 className="sector-detail-panel__title">{title}</h2>
      <button
        type="button"
        className="sector-detail-panel__back"
        onClick={() => setExploreSector(null)}
      >
        Назад к рассказу
      </button>
    </div>
  )
}
