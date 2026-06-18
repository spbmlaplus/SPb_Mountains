# СПб Горы — интерактивная карта и лонгрид

Веб-приложение: карта окрестностей Санкт-Петербурга (MapLibre GL) + лонгрид с привязкой слоёв к секциям (`id_map`).

## Просмотр

| Среда | Ссылка |
|---|---|
| **GitHub Pages (прод)** | [https://spbmlaplus.github.io/SPb_Mountains/](https://spbmlaplus.github.io/SPb_Mountains/) |
| **Локально** | `npm run dev` → [http://localhost:5173/SPb_Mountains/](http://localhost:5173/SPb_Mountains/) |

После `git push` в `main` GitHub Actions автоматически собирает и публикует на Pages (см. `.github/workflows/deploy.yml`).

## Быстрый старт

```bash
npm ci
npm run dev
```

Сборка:

```bash
npm run build
```

Переменные окружения (см. `.env.example`):

- `VITE_TILE_BASE_URL` — базовый URL тайлов (по умолчанию `https://spbmlaplus.github.io/spb_mountains_tiles`)
- `VITE_BASE_PATH` — base path Vite (`/SPb_Mountains/` для GitHub Pages)

## Обновление данных из `new_files/` и `new_legend/`

```bash
# Слои и стили
python scripts/copy-new-assets.py

# Манифест id_map (23 набора)
python scripts/gen-section-overlays.py

# Текст лонгрида (fallback)
python scripts/gen-fallback-longread.py

# URL-карта geojson для бандла (только слои из манифестов)
python scripts/gen-layer-urls.py
```

## Структура

- `src/assets/layers/` — GeoJSON слои
- `src/assets/sections/section-overlays.json` — 23 набора `id_map`
- `src/assets/styles/base-composition-1.json` — базовая композиция (Positron + relief_water1 + векторы)
- `src/fallbackLongread.ts` — контент лонгрида при недоступности Google Sheets
- `new_files/`, `new_legend/` — исходники от дизайн-команды
