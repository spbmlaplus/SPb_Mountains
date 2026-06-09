export type Chapter = {
  num: string
  title: string
  hasContent: boolean
}

// Chapter titles match the `Chapter` column in the longread sheet/CSV verbatim.
// Only chapters 01–02 carry content today; 03–08 are "Скоро".
export const CHAPTERS: Chapter[] = [
  { num: '01', title: 'Как устроен амфитеатр', hasContent: true },
  { num: '02', title: 'Горы Петербурга — геологическая летопись', hasContent: true },
  { num: '03', title: 'Горные дюны', hasContent: false },
  { num: '04', title: 'Имперские наблюдатели', hasContent: false },
  { num: '05', title: 'Наука и горы', hasContent: false },
  { num: '06', title: 'Стратегические высоты', hasContent: false },
  { num: '07', title: 'Современный досуг', hasContent: false },
  // Frame 16 typo: "Угрозы и угрозы". Ship as shown; update when design clarifies.
  { num: '08', title: 'Угрозы и угрозы', hasContent: false },
]

export type Sector = { num: string; title: string }

// Sector names come from `src/assets/layers/sector.geojson`, ordered by id 1–13.
export const SECTORS: Sector[] = [
  { num: '01', title: 'Рощинский сектор' },
  { num: '02', title: 'Белоостровский сектор' },
  { num: '03', title: 'Лемболовский сектор' },
  { num: '04', title: 'Токсовский сектор' },
  { num: '05', title: 'Румболовский сектор' },
  { num: '06', title: 'Колтушский сектор' },
  { num: '07', title: 'Саблинско-Красноборский сектор' },
  { num: '08', title: 'Федоровский сектор' },
  { num: '09', title: 'Дудергофско-Пулковский сектор' },
  { num: '10', title: 'Аннинский сектор' },
  { num: '11', title: 'Ропшинский сектор' },
  { num: '12', title: 'Гостилицкий сектор' },
  { num: '13', title: 'Пеникский сектор' },
]

export const norm = (s: string) => s.trim().toLowerCase()
