# План исправления багов (2026-07-03)

Связано с [`PREVIEW-2026-07-03.md`](PREVIEW-2026-07-03.md) и [`PLAN-QA-2026-07.md`](PLAN-QA-2026-07.md).

---

## Статус реализации

| # | Проблема | Статус | Файлы |
|---|----------|--------|-------|
| 1 | Картинки переключения слоёв на desktop | ✅ | `LongreadLayerStrip.tsx`, `App.css` |
| 2 | Подписи к превью-картам | ✅ | `LongreadLayerStrip.tsx`, `MapLayerPanel.tsx` (уже были) |
| 3 | Старт листания/слоёв с начала лонгрида | ✅ | полоса слоёв sticky вверху `.longread`, `scrollTop=0` |
| 4 | Стили подписей к фото (caption) | ✅ | убраны из scroll-spy, `App.css` |
| 5 | «Исследовать горы» — только первая карта | ✅ | `id_map=1`, пустой манифест 23, viewpoints OFF |
| 6 | Подписи maki_selki из слоя | ✅ код есть | `nameLabels.ts`, `DYNAMIC_NAME_LABEL_ID_MAPS` |
| 7 | Дёрганье текста на последних словах | ✅ | гистерезис 28px в `pickActiveEl` |

---

## Блок 1 — Панель карт на desktop

### Сделано

- **`LongreadLayerStrip`** — горизонтальная лента превью с подписями вверху лонгрида (только `≥769px`), sticky под скроллом.
- **`MapLayerPanel`** на desktop — панель слева на карте (не full-width bottom sheet), без handle.
- Выбор карты → `manualIdMap` + скролл к первому item с этим `id_map`.

### Проверить в браузере

- [ ] Лента видна сразу над первым абзацем (`longread-0`).
- [ ] Подписи под миниатюрами читаемы (2 строки max).
- [ ] Кнопка «Слои» на карте открывает ту же сетку с подписями.
- [ ] «Исследуйте горы» в ленте и в bottom sheet ведёт в финальный блок без лишних слоёв.

---

## Блок 2 — «Исследовать горы»

### Сделано

- Финальный item лонгрида: **`id_map: 1`** (Горы Петербурга), не 23.
- **`section-overlays.json` id_map 23** — пустой стек (как id_map 21).
- **`exploreMountains` handler** — `setViewpointsOn(false)`, без маршрутов/точек.
- **`OverlayTogglePanel`** скрыт на финальном блоке.
- **`syncLayers`** — viewpoints не добавляются при `id_map=23` или explore-блоке.

### Проверить

- [ ] Sidebar / меню «Исследовать горы» → последний абзац, карта как при старте (mount, без routes/viewpoints).
- [ ] Нет чекбокса «Точки обзора» в этом разделе.
- [ ] Карточка «Исследуйте горы» в панели слоёв подсвечивается на финальном блоке.

---

## Блок 3 — Подписи «Мяки и Сельки» (id_map 13)

### Сделано в коде

- `maki_selki.geojson` → centroids → `dynamic-names-13.geojson` → symbol layer с `text-field: ['get', 'name']`.
- Trim пробелов в `name` (`nameLabels.ts`).

### Осталось проверить / возможные доработки

- [ ] `#id_map=13` или скролл к «Мяки и Сельки» — подписи Кеземяки, Сювемяки и т.д. на карте.
- [ ] Zoom ≥ 11 — размер шрифта 10–12px, halo белый.
- ⚠️ Если подписи не видны: geojson в EPSG:3857 — проверить reprojection в `loadGeoJson` / источник данных.

**План B (если QA провалится):** перепроецировать `maki_selki.geojson` в WGS84 или добавить `inscription: "13"` как fallback.

---

## Блок 4 — Дёрганье текста (scroll spy)

### Причина

`IntersectionObserver` + `pickActiveEl` переключали активный `<p>` при малом смещении центра — особенно на последних абзацах item.

### Сделано

- Гистерезис **28px**: новый элемент активируется только если заметно ближе к центру viewport.
- Подписи фото **исключены** из spy (`data-el-key` убран с `figcaption`).

### Дополнительно (если дёрганье останется)

1. Увеличить `HYSTERESIS_PX` до 40.
2. Внутри одного item — монотонный порядок: при равных dist предпочитать более ранний абзац при скролле вверх.
3. Debounce `setActiveLongreadElKey` на 80ms.
4. Отключить autoscroll на последнем item (`longread-56`).

---

## Блок 5 — Стили подписей к фото

### Сделано

Восстановлены статичные стили:

- `font-size: 0.8rem`, italic, `#6f6f6f`
- `opacity: 1` всегда (не участвуют в `longread-el` dimming)

---

## Чеклист перед push

```text
npm run build
preview: http://localhost:4173/
```

- [ ] Desktop: лента слоёв + панель на карте
- [ ] Mobile: только кнопка «Слои» (лента скрыта)
- [ ] Старт с longread-0, id_map=1
- [ ] Гл.3: 12 → 13 (maki подписи) → 14
- [ ] Финал: id_map=1, без viewpoints/routes
- [ ] Скролл финального абзаца — текст не мигает между `<p>`

---

## Связанные файлы

| Файл | Изменение |
|------|-----------|
| `src/LongreadLayerStrip.tsx` | новый — desktop лента |
| `src/MapLayerPanel.tsx` | explore без id_map 23 |
| `src/MainMap.tsx` | hysteresis, explore, strip |
| `src/App.css` | strip + desktop panel + captions |
| `src/fallbackLongread.ts` | финал id_map 1 |
| `section-overlays.json` | id_map 23 пустой |
| `scripts/gen-fallback-longread.py` | override «Исследуйте горы» → 1 |
