export type Chapter = {
  num: string
  title: string
  hasContent: boolean
}

// Chapter titles match the `Chapter` column in new_legend/Лонгрид_1.csv.
export const CHAPTERS: Chapter[] = [
  { num: '01', title: 'Горный Петербург', hasContent: true },
  { num: '02', title: 'Горы Петербурга — геологическая летопись', hasContent: true },
  { num: '03', title: 'История «горных финнов»', hasContent: true },
  { num: '04', title: 'Высочайшие наблюдатели', hasContent: true },
  { num: '05', title: 'Горы сейчас', hasContent: true },
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
