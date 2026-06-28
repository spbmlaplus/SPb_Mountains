# Продолжение работ: перенос на новую легенду — для следующего агента

**Дата handoff:** 2026-06-28. **Читать первым:** `agentic_dev/new-legend-TZ.md` (формальное ТЗ), затем этот файл. Общий план: `agentic_dev/new-legend-rebuild-plan.md`.

---

## Статус (кратко)

| Фаза | Статус | Комментарий |
|------|--------|-------------|
| **0** QML → MapLibre | ✅ ГОТОВО | `qml_to_style.py` → `layer-styles.json`; augment-only в `layerStyles.ts` |
| **1** CSV + лонгрид + база | ✅ ГОТОВО | Генераторы, карта, легенда; сборка зелёная; **ничего не закоммичено** |
| **2** Интерактивы | ❌ НЕ НАЧАТА | Click_trigger, inscription, name_folder, point→polygon, чистка legacy |

**Следующий шаг:** Фаза 2. Перед началом — собрать, поднять dev, показать пользователю итог Фазы 1 (если ещё не показан).

---

## КРИТИЧНО — окружение

- **Песочница Windows ломает shell.** Запускать **все** shell-команды с `required_permissions: ["all"]`.
- **Корень проекта вложенный:** `C:\Work\SPb_Mountains\SPb_Mountains` (не `C:\Work\SPb_Mountains`).
- **Версии:** node v24.16.0, npm 11.13.0, python 3.14.3.
- **Dev-сервер:** только IPv6 по умолчанию → браузер не открывает `localhost`. Запуск:
  ```powershell
  cd C:\Work\SPb_Mountains\SPb_Mountains
  $env:Path += ";C:\Program Files\nodejs"
  $env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
  $env:VITE_BASE_PATH="/"
  npm run dev -- --host 127.0.0.1
  ```
  Открывать: `http://127.0.0.1:5173/`
- **Сборка:**
  ```powershell
  $env:Path += ";C:\Program Files\nodejs"
  $env:VITE_TILE_BASE_URL = "https://spbmlaplus.github.io/spb_mountains_tiles"
  $env:VITE_BASE_PATH = "/SPb_Mountains/"
  npm run build
  ```
- **Картинки** (png/jpg/webp) не индексируются Glob — проверять через `Read` или `dir`. Эталоны: `C:\Work\SPb_Mountains\примеры_оформления_сайта\` (`1_пример.png`, `2_/3_/4_пример.PNG`).

---

## Пайплайн генерации (порядок)

После правок в `new_legend/*.csv`, `new_files/layers`, `new_files/style` или `new_files/photos`:

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains

python scripts/copy-new-assets.py       # layers + photos → src/assets/
python scripts/qml_to_style.py          # QML → layer-styles.json (если менялись стили)
python scripts/gen-fallback-longread.py # LONGREAD.csv → fallbackLongread.ts
python scripts/gen-layers.py            # LAYERS.csv → section-overlays.json
python scripts/gen-base-map.py          # BASE_MAP.csv → base-composition.json
python scripts/gen-layer-urls.py        # manifests → layerUrls.ts (только существующие geojson)

npm run build
```

**Устарело (не запускать):** `scripts/gen-section-overlays.py` (старый `Порядок_слоев.csv`).

---

## Что сделано (Фазы 0–1)

### Фаза 0
- `scripts/qml_to_style.py` → `src/assets/styles/layer-styles.json` (33 слоя).
- `src/layerStyles.ts`: QML-манифест **augment-only** (низший приоритет; section/base перекрывают). Маркеры ▲/●, categorized `match`, hatch, label-конфиг (label в рантайме пока не рисуется).

### Фаза 1 — лонгрид
- `src/contentTypes.ts` — `ContentItem` с `chapter/subtitle/line/paragraphs/media/fact/zoom/id_map`.
- `scripts/gen-fallback-longread.py` → `src/fallbackLongread.ts` (69 айтемов). `CHAPTER_RENAME`: «Как устроен амфитеатр»→«Горный Петербург».
- UI: sticky-главы/подзаголовки, разделители, медиа left/right, `ФАКТ #N`, фото из `src/assets/photos`.

### Фаза 1 — генераторы
- **`gen-layers.py`** → `src/assets/sections/section-overlays.json`:
  - Классификационные строки сворачиваются: холм/возвышенность/гора → слой `mount` (attr `type`); Дача…Дворец → `estate` (attr `Типология владения`); категории в `categories[]`.
  - `classify==name` (landscape_*, routes): уникальные значения атрибута `name` из geojson запекаются в `categories`.
  - `finns_*` — 10 отдельных слоёв.
  - Для Фазы 2: `inscriptions[]`, `photo_folders[]`, `folder_vectors[]`.
  - Блок **`styles`** в JSON **сохраняется** из предыдущей версии (ручная калибровка) — не удалять при регенерации.
- **`gen-base-map.py`** → `src/assets/styles/base-composition.json`: Positron+подписи (CARTO `light_all`), `relief_water1` TMS @0.55, векторы isoline_5m/sectors_level/amphitheater_bound.
- **`gen-layer-urls.py`**: overlays + inscriptions + folder_vectors + base + колонка `Zoom` из LONGREAD + Viewpoints/sector; только файлы, существующие в `src/assets/layers`.
- **`copy-new-assets.py`**: `new_files/layers`→`src/assets/layers`, `new_files/photos`→`src/assets/photos` (+ legacy `longread`); skip `isoline_2m.geojson`.

### Фаза 1 — рантайм
- `baseCompositions.ts`, `layerStyles.ts` → импорт **`base-composition.json`** (не `-1`/`-3`). `BASE_COMPOSITIONS[1|2|3]` — одна композиция.
- `sectionOverlays.ts` — расширенные типы (`OverlayCategory`, `InscriptionLayer`, …).
- `OverlayTogglePanel.tsx` — чекбокс + подписи категорий (`.overlay-toggle-panel__category`).
- `MainMap.tsx`:
  - **Скролл-зум:** `fitBounds` к `item.zoom.layer` за 3000 ms; padding right 680 (десктоп); `easeTo` home при пустом zoom; цель зума не рендерится (только bbox).
  - **Base swap:** `raster-opacity-transition: 2000` на raster-слоях.
  - `syncLayers` — видимость по `SECTION_OVERLAYS[id_map]`.

### Проверено
- `npm run build` — зелёный.
- `dist/assets/isoline_5m-*.geojson` ≈ **20.6 МБ** (источник облегчён до ~19.6 МБ).
- Браузер: база (positron+labels, relief, isolines, sectors, amphitheater_bound), легенда для id_map с слоями, лонгрид.

---

## Фаза 2 — что делать (по порядку)

> Полное ТЗ: `new-legend-TZ.md` §Фаза 2. Эталон клика: `4_пример.PNG`.

### 2.1 Click_trigger (обобщить `MountainPopup.tsx`)
- Источник: `OverlayLayer.click_trigger` и `categories[].click_trigger` в `section-overlays.json`.
- Клик по объекту слоя с `click_trigger=1` → зум к объекту + розовая подсветка (как explore/mount сейчас) + тёмная плашка: `name / fact / type / description` (атрибуты geojson; **`id` не показывать**).
- Фото: папка = имя слоя (`mount`, `estate`, …), файлы `<objectId>_1`, `<objectId>_2` (проверить реальную структуру в `new_files/`).
- Сейчас клик работает только для legacy `mount` → `MountainPopup`; нужно обобщить на все click_trigger слои/категории.

### 2.2 inscription
- Источник: `SectionOverlay.inscriptions[]` — файлы `2.geojson`, `3.geojson`, … (центроиды).
- Геометрия **невидима**; виден текст из атрибута `name`.
- `type=1` → Arial 10 bold; `type=2` → Arial 8 regular (см. geojson `2.geojson`: `{name, type}`).
- Рендер: доработать `ensureLayerOnMap` — symbol-слой с `text-field` из `LayerStyle.label` или отдельная ветка inscription; QML label-конфиг уже в `layer-styles.json`.

### 2.3 name_folder (фото по таблице)
- Источник: `photo_folders[]` (напр. id_map 21 → folder `21`, id_map 23 → folder `1`).
- Убрать хардкод путей к фото; читать из папок по CSV.

### 2.4 name_folder_vector (точка → полигон)
- Пример id_map 23: точки `23_1_points.geojson` (слой `23_1_points`), полигоны `23_2_viewshed.geojson`.
- В CSV: `name_folder_vector=23_2`, но файл на диске — **`23_2_viewshed.geojson`**.
- **FIX:** добавить в `gen-layers.py` `NAME_FIX = {"23_2": "23_2_viewshed", ...}` и перегенерировать; обновить `gen-layer-urls.py` / `syncLayers`, чтобы polygon-слой подгружался и подсвечивался по `id` точки.
- Клик по точке → подсветка полигона, чьё `name`/`id` совпадает с атрибутом точки.

### 2.5 Чистка legacy
- См. `agentic_dev/migration-legacy-audit.md`.
- Удалить неиспользуемые geojson из `src/assets/layers` (сейчас ~122 файла, из них много legacy: `01_mask`, `balcon`, `stage`, …).
- Удалить `base-composition-1.json`, `base-composition-3.json` (рантайм уже на `base-composition.json`).
- Удалить/архивировать `gen-section-overlays.py`, старые CSV в `new_legend` (уже удалены в рабочей копии).
- После чистки: `copy-new-assets.py` + `gen-layer-urls.py` + build; убедиться, что dist не тянет лишнее.

### 2.6 Опциональная полировка (можно в Фазе 1 или 2)
- **`estate`**: section-стиль `estate` (fill) перекрывает QML categorized marker → fallback-кружки. Варианты: убрать fill из section `styles.estate` или добавить `point-symbol` override — **не ломая augment-only**.
- **`finns_*`**: нет QML-стиля на файл → fallback; rule-renderer `Finns` в QML для другого слоя.
- **Circle-маркеры + label** из QML: доработка `ensureLayerOnMap` (отдельный circle-слой, `label` из `LayerStyle`).
- **CSS лонгрида**: сверка с `1_/2_/3_пример` (шрифты/отступы).

---

## Архитектура рантайма (шпаргалка)

```
MainMap.tsx
├── addBaseComposition / removeComposition     ← base-composition.json
├── ensureLayerOnMap(fileName, styleName)      ← VECTOR_STYLES[styleName]
├── syncLayers (activeItemId)                  ← SECTION_OVERLAYS[id_map]
├── scroll-zoom useEffect                      ← item.zoom.layer → fitBounds 3s
├── MountainPopup (legacy mount click)         ← обобщить в Фазе 2
└── OverlayTogglePanel                         ← legend_label + categories

layerStyles.ts VECTOR_STYLES merge order (low→high):
  QML layer-styles.json → section-overlays.styles → base-composition vectors
```

**Overlay anchor:** `__overlay_anchor__` — оверлеи вставляются `beforeId=anchor`; point-symbol (mount) — поверх anchor.

**Скролл-трекинг лонгрида:** каждый item → `ref={setItemRef(item.id)}` внутри `.longread-content-items`.

---

## Данные и известные дыры

| Проблема | Детали |
|----------|--------|
| `15.geojson` отсутствует | LAYERS.csv inscription для id_map 15; генератор предупреждает и пропускает |
| `23_2` vs `23_2_viewshed` | CSV `name_folder_vector=23_2`, файл `23_2_viewshed.geojson` — нужен NAME_FIX |
| `Zoom_view=1` | В модели `zoom.hidden`; рантайм зумит по bbox, слой не показывает — OK |
| LONGREAD дубли/черновики | Глава нормализована; остальное править в CSV |
| `<b>` в Description | В CSV нет → bold+underline не видны; CSS готов |
| Media default `left` | При пустом `Media Link_type` |
| Google Sheets 403 | Fallback из CSV — норма |
| `isoline_2m` | ~948 MB, skip в copy; не в bundle |
| Git | **Много uncommitted изменений**; не коммитить без просьбы пользователя |

---

## Критерии приёмки (напоминание)

**Фаза 1** ✅
- build зелёный; isoline_5m в dist ≈ 20 МБ
- база positron+labels + relief@55% + векторы
- скролл-зум по `Zoom`; легенда с категориями

**Фаза 2** (цель)
- Click_trigger: зум + подсветка + плашка + 2 фото
- inscription-подписи видны
- point→polygon (id_map 23)
- нет слоёв вне новых CSV

---

## Ключевые файлы

| Назначение | Путь |
|------------|------|
| ТЗ | `agentic_dev/new-legend-TZ.md` |
| CSV лонгрид | `new_legend/LONGREAD.csv` |
| CSV слои | `new_legend/LAYERS.csv` |
| CSV база | `new_legend/BASE_MAP.csv` |
| Overlay manifest | `src/assets/sections/section-overlays.json` |
| Base manifest | `src/assets/styles/base-composition.json` |
| QML styles | `src/assets/styles/layer-styles.json` |
| Layer URLs | `src/layerUrls.ts` (generated) |
| Fallback content | `src/fallbackLongread.ts` (generated) |
| Legacy audit | `agentic_dev/migration-legacy-audit.md` |

---

## Правила для агента

1. Фазы по порядку; между фазами — build + preview пользователю.
2. **Не коммитить и не пушить** без явной просьбы.
3. CSV транслировать честно; правки данных — только согласованные (как `CHAPTER_RENAME`).
4. **Не ломать augment-only** в `layerStyles.ts` при правках стилей.
5. Shell только с `required_permissions: ["all"]` на Windows.
