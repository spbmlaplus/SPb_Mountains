# Handoff для следующего агента — завершение Фазы 2 + полировка

**Дата:** 2026-06-28 (после сессии Фазы 2).  
**Читать первым:** `agentic_dev/new-legend-TZ.md`, затем этот файл.  
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains` (не родительский `C:\Work\SPb_Mountains`).

---

## Статус фаз

| Фаза | Статус | Комментарий |
|------|--------|-------------|
| **0** QML → MapLibre | ✅ | `scripts/qml_to_style.py` → `layer-styles.json`; augment-only в `layerStyles.ts` |
| **1** CSV + лонгрид + база | ✅ | Генераторы, карта, легенда, scroll-zoom, base swap 2s |
| **2** Интерактивы | 🟡 **ЧАСТИЧНО** | Код написан, build зелёный; **браузерная приёмка не пройдена**; ряд дыр |
| Git | ❌ | **Ничего не закоммичено** — огромный uncommitted diff |

---

## Что уже сделано (Фаза 2 — код)

### 2.1 Click_trigger
- `src/clickTrigger.ts` — конфиг кликабельных слоёв из `section-overlays.json`, фильтр по категориям (`гора`, `Вилла`…).
- `src/mapHighlight.ts` — розовая подсветка `rgb(225,89,137)` (как explore mode).
- `src/MountainPopup.tsx` — плашка: `name / fact / type / description` + 2 миниатюры.
- `src/MainMap.tsx` — клик → `fitBounds` 700ms + подсветка + popup; работает для mount, estate, routes и др.
- `photoKey` отделён от `objectId` (смотровые точки: `name="1001"` → файл `1001.JPG`).

### 2.2 inscription
- `ensureInscriptionOnMap()` в `MainMap.tsx`: symbol-слой, `name`, `type=1` → 10px bold, `type=2` → 8px regular.
- Inscriptions подключаются в `syncLayers` из `SectionOverlay.inscriptions[]`.

### 2.3 name_folder / фото
- **`new_files/{mount,21,1}/`** — исходники фото (не в `photos/`!).
- `scripts/copy-new-assets.py` копирует в `src/assets/object_photos/{folder}/`.
- `src/objectPhotos.ts` — резолв имён:
  - `mount`: `{fid}_1.jpg`, `{fid}_2.jpg`
  - `21`, `1`: `{id}.jpg` (один файл) **или** `{id}_1/_2`
- После copy: **147 файлов** (mount 43, 21 40, 1 64).

### 2.4 name_folder_vector
- `scripts/gen-layers.py`: `NAME_FIX = {"23_1": "23_1_points", "23_2": "23_2_viewshed"}`.
- Клик по `23_1_points` → подсветка полигона из `23_2_viewshed` по полю `layer`/`id`.
- Полигоны viewshed **не рендерятся** постоянно (только highlight).

### 2.5 Чистка legacy
- `scripts/cleanup-legacy-layers.py` — удалены 60 geojson вне `layerUrls.ts`.
- Удалены `base-composition-1.json`, `base-composition-3.json`.
- Осталось **62** geojson в `src/assets/layers/` (whitelist).

### Новые файлы (untracked)
`src/clickTrigger.ts`, `src/mapHighlight.ts`, `src/objectPhotos.ts`, `scripts/cleanup-legacy-layers.py`, `scripts/gen-layers.py`, `src/assets/object_photos/`, …

---

## Что ОСТАЛОСЬ сделать (приоритет)

### P0 — Браузерная приёмка Фазы 2

Запуск (Windows, **все shell с `required_permissions: ["all"]`**):

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
python scripts/copy-new-assets.py
python scripts/gen-layers.py
python scripts/gen-layer-urls.py
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npm run dev -- --host 127.0.0.1
```

Открыть: `http://127.0.0.1:5173/` (или 5174 если порт занят).  
Эталон клика: `C:\Work\SPb_Mountains\примеры_оформления_сайта\4_пример.PNG`.

| id_map | Проверить |
|--------|-----------|
| **1–2** | inscription `2.geojson`; клик только по **горе** (▲) → popup + фото из `mount/` |
| **15–20** | estate click (Вилла+); фото — когда появится `new_files/estate/` |
| **21** | **ДЫРА:** в CSV только `photo_folders` (folder `21`), **нет geojson-слоя** — кликабельная карта живописи не wired |
| **23** | routes click + popup; `23_1_points` → viewshed polygon; фото folder `1` |

### P1 — id_map 21 «Горная живопись»

`LAYERS.csv` row: `21,1,,21,,,Горная живопись,,1` — только `name_folder`, layers пустой.

**Нужно уточнить у дизайна / CSV:**
- Есть ли geojson с точками картин (аналог `1_photo.geojson`)?
- Или фото показываются иначе (галерея без карты)?

Пока **не реализовано** — следующий агент должен либо добавить слой в CSV+geojson, либо UI галереи по `photo_folders[]`.

### P2 — Размер бандла (критично для деплоя)

`objectPhotos.ts` использует `import.meta.glob(..., { eager: true })` — **все 147+ фото попадают в dist** (сотни MB, файлы folder `1` до 6+ MB каждый).

**Задача:** lazy-load фото (динамический import / `?url` без eager / fetch из `public/`) или вынести object photos из Vite bundle.

Сейчас `npm run build` зелёный, но dist **~1.7 GB JS + assets** — неприемлемо для GitHub Pages.

### P3 — Стили estate / finns_*

- `estate` в section-overlays имеет fill → перекрывает QML marker → **fallback-кружки**.
- `finns_*` — нет per-file QML в manifest → fallback.
- QML стили **есть** в `layer-styles.json` / `sections/`.  
  **Fix (не ломая augment-only):** убрать fill override для estate в `section-overlays.json` styles **или** добавить point-symbol ветку в `ensureLayerOnMap`.

### P4 — Дополнительная чистка

| Что | Действие |
|-----|----------|
| Legacy QML в `src/assets/styles/sections/` (~18 файлов) | Удалить не из `new_files/style/` |
| Дубликаты geojson с русскими именами в `src/assets/layers/` (`холм.geojson`, `Дача.geojson`…) | Не в `layerUrls.ts` — удалить после `copy-new-assets` |
| `scripts/gen-section-overlays.py` | Устарел — не использовать |
| `1_photo.geojson` | Есть на диске, **не** в section-overlays — нужен ли для id_map 23? |

### P5 — Опционально: CSS лонгрида

Сверка с `1_пример.png`, `2_пример.PNG`, `3_пример.PNG` — шрифты, отступы, sticky-главы.  
`<b>` в Description в CSV нет → bold+underline не видны (CSS готов).

### P6 — Коммит (только по просьбе пользователя)

Перед коммитом: `npm run build`, проверить `.gitignore` для тяжёлых assets, не коммитить `Thumbs.db`.

---

## Известные дыры данных (не чинить без согласования)

| Проблема | Детали |
|----------|--------|
| `15.geojson` отсутствует | inscription id_map 15 — gen-layers WARNING, пропуск |
| `new_files/estate/` | Папки нет — фото усадеб не копируются |
| `mount` photos `_3` | `18_3.jpg` и др. — TZ только `_1/_2` |
| `estate.classify` | CSV: `Типология владения`, geojson attr: `type` — фильтр клика fallback на `type` |
| Google Sheets 403 | Fallback из `fallbackLongread.ts` — норма |
| `isoline_2m` | Skip в copy (~948 MB) |

---

## Пайплайн после правок данных

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains

python scripts/copy-new-assets.py       # layers + object_photos + longread photos
python scripts/qml_to_style.py          # если менялись QML
python scripts/gen-fallback-longread.py
python scripts/gen-layers.py
python scripts/gen-base-map.py
python scripts/gen-layer-urls.py
python scripts/cleanup-legacy-layers.py # после copy, если появились лишние geojson

npm run build
```

---

## Архитектура рантайма (шпаргалка)

```
MainMap.tsx
├── addBaseComposition          ← base-composition.json
├── ensureLayerOnMap            ← overlay vectors + point-symbol (mount)
├── ensureInscriptionOnMap      ← centroid labels (inscriptions[])
├── syncLayers                  ← SECTION_OVERLAYS[id_map] + inscriptions
├── clickTrigger useEffect      ← buildClickConfigsForSection → popup + highlight
├── folder_vector useEffect     ← 23_1_points → 23_2_viewshed highlight
├── MountainPopup               ← name/fact/type/description + 2 photos
└── objectPhotos.ts             ← object_photos/{folder}/…

layerStyles merge (low→high): QML → section-overlays.styles → base-composition
```

**Фото-папки (источник):**

| CSV / слой | Папка | Паттерн имён |
|------------|-------|--------------|
| mount (style) | `new_files/mount/` | `{fid}_1`, `{fid}_2` |
| name_folder=21 | `new_files/21/` | `{n}.jpg/png` |
| name_folder=1 | `new_files/1/` | `{photoId}.JPG` (name attr точки) |
| estate (style) | `new_files/estate/` | *(ожидается)* `{id}_1`, `{id}_2` |

---

## Критерии приёмки (полная Фаза 2)

- [ ] `npm run build` зелёный; **dist разумного размера** (lazy photos)
- [ ] id_map 1: inscription видны; клик по горе → зум + розовый + плашка + 2 фото mount
- [ ] id_map 15–20: estate click + popup (фото когда есть estate/)
- [ ] id_map 21: живопись работает (после уточнения UX)
- [ ] id_map 23: routes popup; точки → viewshed; фото folder `1`
- [ ] Нет geojson вне whitelist (`layerUrls.ts`)
- [ ] Браузерный preview показан пользователю

---

## Ключевые файлы

| Назначение | Путь |
|------------|------|
| Формальное ТЗ | `agentic_dev/new-legend-TZ.md` |
| Этот handoff | `agentic_dev/HANDOFF-phase2-continuation.md` |
| CSV слои | `new_legend/LAYERS.csv` |
| Фото гор | `new_files/mount/` |
| Фото живопись | `new_files/21/` |
| Фото смотровые | `new_files/1/` |
| Runtime photos | `src/assets/object_photos/` |
| Click logic | `src/clickTrigger.ts`, `src/mapHighlight.ts` |
| Copy script | `scripts/copy-new-assets.py` |
| Layer whitelist | `src/layerUrls.ts` |

---

## Правила для агента

1. Shell на Windows — **`required_permissions: ["all"]`**.
2. **Не коммитить и не пушить** без явной просьбы пользователя.
3. **Не ломать augment-only** в `layerStyles.ts`.
4. Между крупными шагами — build + dev preview пользователю.
5. Glob не видит png/jpg — проверять через `python`/`dir`/`Read`.
