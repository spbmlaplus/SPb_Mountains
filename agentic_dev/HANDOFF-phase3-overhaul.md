# Handoff: Фаза 3 — лонгрид, стили слоёв, id_map 21/23, Click_trigger

**Дата:** 2026-06-28. **Читать первым:** `agentic_dev/HANDOFF-phase2-polish.md`, затем `agentic_dev/HANDOFF-phase2-continuation.md`, затем этот файл.  
**Продолжение (фаза 4):** [`agentic_dev/HANDOFF-phase4-polish.md`](HANDOFF-phase4-polish.md) — **читать следующим агентам после этого файла.**
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains` (вложенный, не родительский).
**Машиночитаемый план:** `.cursor/plans/layer_styles_and_longread_overhaul_9838bdab.plan.md`

---

## Правила

1. Windows: все shell-команды с `required_permissions: ["all"]`.
2. **Не коммитить / не пушить** без явной просьбы пользователя.
3. `src/layerStyles.ts` — строго **augment-only** (приоритет QML → section → base).
4. `section-overlays.json` → блок `styles` — hand-tuned, сохранять при regen; менять через `scripts/gen-layers.py` или точечно.
5. Не hand-edit `src/assets/styles/layer-styles.json` (regen из QML).
6. Между крупными шагами — `npm run build` + dev-preview на `http://127.0.0.1:5175/`.
7. Glob не индексирует png/jpg — проверять через `python` / `dir` / `Read`.
8. Эталон клика/оформления: `C:\Work\SPb_Mountains\примеры_оформления_сайта\4_пример.PNG`.

---

## Статус реализации (для следующего агента)

| Блок | Статус | Файлы |
|------|--------|-------|
| 1. Данные лонгрида | ✅ | `gen-fallback-longread.py`, `fallbackLongread.ts`, `MainMap.tsx`, `contentTypes.ts` |
| 2. UI лонгрида | ✅ | `App.css` |
| 3. Подписи inscription | ✅ | `MainMap.tsx` |
| 4. Click_trigger estate | ✅ | `gen-layers.py`, `MainMap.tsx` (`layersSyncGen`) |
| 5. Crossfade id_map | ⏪ откат | `setLayerVisibility` — мгновенный toggle |
| 6. id_map 23 | ✅ | `MainMap.tsx`, `mapHighlight.ts`, styles |
| 7. id_map 21 | ✅ | `MainMap.tsx`, `OverlayTogglePanel.tsx`, `gen-layer-urls.py` |
| 8. Стили слоёв | ✅ | `layerStyles.ts`, `section-overlays.json`, `base-composition.json` |

**Откат по просьбе заказчика:** убран opacity crossfade (3.5 s) между id_map. Overlay снова переключаются мгновенно через `visibility`. **Все стили из §8 сохранены.**

**Удалено:** `PaintingGallery.tsx`, `Finns 2021_legend.png` (photos), `ensureOverlayLabelLayer`.

**Не закрыто:** browser QA; Viewpoints auto-off после гл.01 (phase2 §5); имена `landscape_7` в geojson vs fill_categories.

---

## Контекст / что уже сделано (предыдущая сессия)

- ✅ Жирное из xlsx: `gen-fallback-longread.py` читает `new_legend/longread (2).xlsx` с rich text → `<b>` в `fallbackLongread.ts`.
- ✅ Подзаголовки не sticky; главы в `.longread-chapter-group` (sticky до следующей главы).
- ✅ Фото: первое floated, остальные full-width под текстом + caption.
- ✅ Зум: без home-return, dedup по имени zoom-слоя.
- ⚠️ QGIS overlay (частично): circle-маркеры, hatch/labels на overlay — калибровка по ТЗ ниже.

---

## Ключевые файлы

| Назначение | Путь |
|------------|------|
| Карта + лонгрид + клики | `src/MainMap.tsx` |
| Click_trigger логика | `src/clickTrigger.ts` |
| Подсветка клика | `src/mapHighlight.ts` |
| Стили слоёв (augment) | `src/layerStyles.ts` |
| Манифест id_map | `src/assets/sections/section-overlays.json` |
| Генератор манифеста | `scripts/gen-layers.py` |
| Генератор лонгрида | `scripts/gen-fallback-longread.py` |
| Источник лонгрида | `new_legend/longread (2).xlsx` |
| CSV слоёв | `new_legend/LAYERS.csv` |
| Базовые слои | `src/assets/styles/base-composition.json` |
| Панель слоёв | `src/OverlayTogglePanel.tsx` |
| Фото объектов | `src/objectPhotos.ts`, `src/objectPhotoManifest.ts` |
| Вайтлист geojson | `scripts/gen-layer-urls.py` → `src/layerUrls.ts` |
| Живопись geojson | `new_files/layers/21_живопись.geojson` |
| Фото живописи | `public/object_photos/21/{fid}.png\|jpg` |

---

## Задачи (по приоритету)

### 1. Данные лонгрида (`gen-fallback-longread.py`)

- **Fill-forward `id_map` и `id_layer_base`**: пустая ячейка → наследовать предыдущее (как chapter/subtitle). Критично для кликов и слоёв внутри главы «Высочайшие наблюдатели».
- В `MainMap.tsx`: `fillForwardIdMap()` применять и к `fallbackLongreadItems`, не только к Google Sheets.
- **Удалить** все упоминания и файл `new_files/photos/Finns 2021_legend.png` (строки xlsx ~37, ~61; строка ~42 только Belveder — убрать).
- **Belveder.jpg** — только в разделе «Николай I и Бельведер в Низино» (~65–66), после первого абзаца, full-width + подпись «Дворец Бельведер на Бабигонских высотах».
- **Зум** на строке начала главы «Высочайшие наблюдатели» (~62): `Zoom = amphitheater_bound`.

### 2. Лонгрид UI (`src/App.css`)

- **Жирный без подчёркивания**: у `.longread-paragraph b/strong` убрать `text-decoration: underline`.
- **Отступы между абзацами Description в 2× меньше**: `.longread-paragraph` margin `0.9rem` → `0.45rem` (и при необходимости divider margins).

### 3. Подписи: только `inscription`, не `name_layer`

- **Убрать** `ensureOverlayLabelLayer` из `ensureLayerOnMap` — overlay-слои (mount, estate, historical_zones…) **без подписей на карте**.
- Подписи **только** через `ensureInscriptionOnMap` (столбец `inscription` в LAYERS.csv).
- Стиль inscription: **9px, полужирный, Montserrat** (как текст лонгрида), не 10/8px по `type`.

### 4. Click_trigger: усадьбы кликабельны как горы

Категории **Вилла, Особняк, Мыза, Усадьба, Дворец** (`Click_trigger=1` в LAYERS.csv) — клик → popup + подсветка + зум, как `mount`. **Дача, Дом** — не кликабельны.

**Три бага:**

1. Без fill-forward `id_map` → `buildClickConfigsForSection([])` на многих строках главы 04.
2. `classify: "Типология владения"` в манифесте, geojson attr = **`type`** → fix в `gen-layers.py` `GROUP_META["estate"].attr = "type"`, regen + fallback в `clickTrigger.ts` `isFeatureClickable`.
3. Click `useEffect` runs **before** async `syncLayers` → handlers не вешаются. Fix: `layersSyncGen` state после syncLayers в deps click-effect.

Popup: `MountainPopup` (name, fact, type, description), `setClickHighlight`, fitBounds ~700ms. Фото: folder `estate`, ключ `{id}_1`/`{id}_2` (манифест пока пуст — popup без фото OK).

### 5. ~~Плавные переходы между id_map (~3–4 s)~~ — ОТКАТ

~~`setLayerVisibility` → opacity crossfade~~ — **не используется**. Мгновенный toggle как раньше. Стили сохранены.

### 6. id_map 23 (маршруты / viewpoints)

- **`23_1_points`**: чёрные circle, без обводки.
- **Подсветка полигона** (`23_2_viewshed` при клике): заливка `#000` @ 30%, **без контура**.
- **Зум на точку клика** (`easeTo` center), не fitBounds полигона.
- **При скролле лонгрида** (смена `activeItemId`): `closeObjectPopupAll()` + `clearClickHighlight()` — всё выделенное гаснет.

### 7. Горная живопись id_map 21

- Pipeline: `21_живопись.geojson` → `src/assets/layers/`, whitelist в `gen-layer-urls.py` `EXTRA_FILES` (Cyrillic!).
- Паттерн Viewpoints: точки на карте, `fid` → фото `21/{fid}`, клик → fullscreen с `name`.
- Только при `activeIdMap === 21`, чекбокс в легенде.
- **Удалить** нижнюю `PaintingGallery` + `PaintingGallery.tsx` + CSS.

### 8. Стили слоёв (калибровка)

Править `section-overlays.json` styles + `layerStyles.ts`. **Не** трогать `layer-styles.json` руками.

#### Изолинии

- `isoline_5m` в `base-composition.json`: color `#b99a87`, width **0.11**.

#### Горы (`mount`)

- Без белой обводки (убрать halo).
- Per-type `match` на `type`: **гора** ×4, **возвышенность** ×2, **холм** — базовый QML.
- Треугольник `▲`, чёрный.

#### Landscape_* — заливка по уникальным `name`

Per-category `fill_categories` + контур **0.2 px** где указано (см. таблицы в плане).

#### Finns (9 слоёв) — `finnsLayerStyle()` в layerStyles.ts

| Паттерн имени | Цвет | Размер |
|---|---|---|
| `0_1` | #149bdc | count_100_plus = как сейчас; count_10_100 = ÷2; count_1_10 = ÷3 |
| `1_5` | #0030cd | то же |
| `5_plus` | #0a2b70 | то же |

#### Estate (усадьбы) — circle, geojson attr `type`

| type | Color | Size |
|---|---|---|
| Дом, Дача | #1dba91 | ×⅓ |
| Вилла | #1dba91 | ×½ |
| Мыза | #3486cf | ×½ |
| Особняк | #0a2b70 | ×½ |
| Усадьба | #19a27e | ×½ |
| Дворец | #ff7f00 | без изменения |

#### Активности (Point, circle + white stroke 0.2)

| Layer | Fill |
|---|---|
| paragliding_clubs | #3a97e9 |
| horse_riding_clubs | #1dba91 |
| golf_clubs | #f25656 |
| ski_resorts | #f34e9d |
| motocross | #ba58e5 |

#### Прочие

| Layer | Стиль |
|---|---|
| walking_routes | #9479bc, width 0.2 |
| routes | #f34e9d, width 0.8 |
| maki_selki | fill #3a97e9 60%, outline 0.2 same color |

#### Легенда (из phase2-polish)

- `.overlay-toggle-panel` → белый фон; чекбоксы `accent-color: #000`.

#### Отступы лонгрида (из phase2-polish)

- Вертикальный ритм в 2× меньше (`.longread-item`, `.longread-chapter`, `.longread-subtitle`, `.longread-fact`, `.longread-media`).

---

## Пайплайн после правок

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
python scripts/gen-fallback-longread.py
python scripts/gen-layers.py
python scripts/copy-new-assets.py
python scripts/gen-layer-urls.py
python scripts/cleanup-legacy-layers.py
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npm run dev -- --host 127.0.0.1
```

---

## Критерии приёмки

- id_map / id_layer_base fill-forward в генераторе и fallback
- Finns 2021_legend.png удалён везде; Belveder только в разделе Николай I, после текста, с подписью
- Жирный без underline; отступы абзацев в 2× меньше
- Подписи только inscription (9px semibold Montserrat); overlay без labels
- Estate (Вилла/Особняк/Мыза/Усадьба/Дворец): клик как горы; Дача/Дом — нет
- ~~Переходы id_map 3–4 s~~ — откат, мгновенный toggle
- id_map 23: чёрные точки, полигон 30% без контура, зум на точку, сброс при скролле
- id_map 21: точки на карте, клик → картина, без нижней галереи
- Стили: isoline, mount, landscape_*, finns, estate, clubs, routes, maki_selki — по таблицам
- Зум amphitheater_bound на «Высочайшие наблюдатели»
- npm run build зелёный; превью показано

---

## Известные нюансы

- `15.geojson` (inscription id_map 15) отсутствует — WARNING в gen-layers, норма.
- `new_files/estate/` фото пока нет — popup работает без фото. Это норма.
- estate.classify в CSV = «Типология владения», geojson = type — remap в gen-layers и clickTrigger.
- `isoline_2m` (~948 МБ) — skip в copy. Можно удалить вообще.
- Landscape: per-category fill + тонкий 0.2 px из таблицы, без общего толстого outline.
- Dev-сервер: `http://127.0.0.1:5175/` (5173/5174 часто заняты).
- Deep-link: `#id_map=N`, `#item=<id>`.
