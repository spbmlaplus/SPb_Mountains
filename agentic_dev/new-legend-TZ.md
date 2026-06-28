# ТЗ: перенос сайта «Горный Петербург» на новую легенду (для следующего агента)

Техническое задание по фазам 0–2. Сопутствующие документы: общий план
`agentic_dev/new-legend-rebuild-plan.md`, журнал передачи
`agentic_dev/new-legend-continuation.md` (там детали находок и архитектуры).

> Правила: фазы — по порядку; между фазами собрать локально и показать
> пользователю; **не коммитить и не пушить без явной просьбы**; CSV
> транслировать честно (не «лечить» данные в коде, кроме согласованных правок).

---

## 0. Окружение (обязательно к прочтению)

- **Песочница Windows ломает shell.** Политика `workspace_readwrite` не
  поддерживается → команды отклоняются. **Запускать любые shell-команды вне
  песочницы** (`required_permissions: ["all"]`). Версии: node v24.16.0,
  npm 11.13.0, python 3.14.3.
- **Корень проекта вложенный:** `C:\Work\SPb_Mountains\SPb_Mountains`. Делать
  `cd` сюда перед скриптами/сборкой.
- **Сборка:**
  ```powershell
  $env:Path += ";C:\Program Files\nodejs"
  $env:VITE_TILE_BASE_URL = "https://spbmlaplus.github.io/spb_mountains_tiles"
  $env:VITE_BASE_PATH = "/SPb_Mountains/"
  npm run build
  ```
- **Dev-сервер слушает только IPv6**, браузер резолвит `localhost`→IPv4 →
  `chrome-error`. Запускать с биндом IPv4 и открывать `http://127.0.0.1:5173/`:
  ```powershell
  $env:Path += ";C:\Program Files\nodejs"; $env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"; $env:VITE_BASE_PATH="/"; npm run dev -- --host 127.0.0.1
  ```
- Картинки (png/jpg/webp) не индексируются Glob — открывать `Read` по точному
  пути (эталоны `…\примеры_оформления_сайта\*` — у 2–4 расширение `.PNG`).

## Источники данных

- `new_legend/LONGREAD.csv` — текст лонгрида (запятая, fill-forward Chapter/Subtitle).
- `new_legend/LAYERS.csv` — слои по `id_map`.
- `new_legend/BASE_MAP.csv` — базовая подложка (id_map=1).
- `new_files/style/*.qml` — стили QGIS (имя стиля = имя слоя).
- `new_files/layers/*.geojson` — слои (EPSG:3857). **Брать слои только отсюда.**
- `new_files/photos/*` — фото лонгрида и объектов.

Поток: `qml→layer-styles.json`, `LONGREAD→fallbackLongread.ts`,
`LAYERS→section-overlays.json`, `BASE_MAP→base-composition.json`,
`layers+photos→src/assets/*`.

---

## Статус на момент handoff (2026-06-28)

- **Фаза 0 — ГОТОВО.**
- **Фаза 1 — ГОТОВО** (генераторы, база, скролл-зум, легенда; опц. полировка CSS/estate-маркеры — см. ниже).
- **Фаза 2 — не начата.**
- Сборка зелёная. `dist/assets/isoline_5m-*.geojson` ≈ 20.6 МБ. **Ничего не закоммичено.**

Журнал передачи и пошаговый план Фазы 2: `agentic_dev/new-legend-continuation.md`.

### Фаза 1 — что сделано (2026-06-27/28)
- `scripts/gen-layers.py` → `section-overlays.json` из `LAYERS.csv` (классиф.-строки
  холм/гора/Дача/… сворачиваются в один слой `mount`/`estate` + категории легенды;
  `classify==name` для landscape/routes — уникальные значения `name` запекаются как
  категории; finns_* — 10 слоёв; inscription/photo_folders/folder_vectors вынесены в
  отдельные массивы для Фазы 2; блок `styles` сохранён без изменений).
- `scripts/gen-base-map.py` → `base-composition.json` из `BASE_MAP.csv` (positron с
  подписями = CARTO light_all; relief_water1 @0.55; isoline_5m/sectors_level/
  amphitheater_bound — вектор). `baseCompositions.ts` и `layerStyles.ts` переключены
  на новый файл (augment-only из Фазы 0 сохранён: QML→section→base).
- `gen-layer-urls.py` берёт имена из section-overlays + base + `Zoom` из LONGREAD
  (для скролл-зума) и оставляет только существующие файлы. `copy-new-assets.py`
  авто-копирует `new_files/photos`→`src/assets/photos` и слои→`src/assets/layers`.
- Поведение карты: скролл-зум `fitBounds` к слою `item.zoom.layer` за 3с (паддинг
  справа под лонгрид; «исходный вид» при пустом zoom; зум по геометрии — цель не
  рендерится, т.е. hidden по умолчанию); raster-opacity-transition 2с для base.
- Легенда (`OverlayTogglePanel`): строка-чекбокс из `legend_label` + под ней
  категории классификации (`overlay-toggle-panel__category`).
- Сборка зелёная; `dist/assets/isoline_5m-*.geojson` = 20.6 МБ. Ничего не коммитил.
- **ОСТАЛОСЬ (опц. полировка Фазы 1):** estate рендерится fallback-кружками (section-
  стиль `estate` = fill перекрывает QML categorized marker — не трогал, augment-only);
  finns_* без спец-стиля → fallback. Визуальная тонкая сверка лонгрида с эталонами.

---

## Фаза 0 — QML → MapLibre (СДЕЛАНО, для справки)

- `scripts/qml_to_style.py` → `src/assets/styles/layer-styles.json` (33 слоя).
- `src/layerStyles.ts` читает манифест через `styleFromQml` **augment-only**
  (QML добавлен с низшим приоритетом; section/base стили перекрывают). Поддержано:
  single/categorized/rule, fill/line/outline/dasharray/hatch, маркеры
  triangle→`▲`/circle→`●` с `match`-выражениями цвета и размера, `label`.

**Возможная доработка (если потребуется):** корректные circle-маркеры (отдельный
circle-слой: radius=size_px/2, color, stroke) и рендер `label` —
требует правки `ensureLayerOnMap` в `MainMap.tsx`.

---

## Фаза 1 — пайплайн CSV + лонгрид + база

### 1.1 Лонгрид (СДЕЛАНО)
- `src/contentTypes.ts` — модель `ContentItem`: `chapter, subtitle, line(0|1),
  paragraphs[], media{link,side,caption}, fact, zoom{layer,hidden},
  id_layer_base, id_map, base_id` (+ legacy `title/description/fileList/mediaLink`).
- `scripts/gen-fallback-longread.py` → `src/fallbackLongread.ts` (69 айтемов):
  fill-forward Chapter/Subtitle (новая глава сбрасывает подзаголовок),
  абзацы, line 1/0, media side+caption, fact, zoom, id_map.
  **Применена правка:** глава `«Как устроен амфитеатр»` переименована в
  `«Горный Петербург»` (см. `CHAPTER_RENAME`) — главы больше не чередуются.
- UI (`MainMap.tsx`+`App.css`): sticky-главы с номером, sticky-подзаголовки,
  разделители 1/0, абзацы (`<b>`→bold+underline), медиа left/right + подпись,
  розовая `ФАКТ #N` (+hover-scale). Фото скопированы в `src/assets/photos`.

**Осталось по лонгриду:** визуально сверить с `1_/2_/3_пример` и подогнать CSS
(размеры/шрифты подбирались без браузера). Проверить дефолт стороны медиа (сейчас
`left` при пустом `Media Link_type`).

### 1.2 Генераторы слоёв и базы (СДЕЛАНО)

**`scripts/gen-layers.py` → `src/assets/sections/section-overlays.json`** из
`LAYERS.csv`:
- На каждый `id_map` — упорядоченный по `id_layer_click` список слоёв.
- Поля слоя: `name` (=`name_layer`), `style` (=name, стиль из layer-styles.json),
  `legend_label` (`name_layer_ru`), `classify` (`name_layer_ru_style` — атрибут
  классификации), `click_trigger` (`Click_trigger==1`), `inscription`,
  `folder` (`name_folder`), `folder_vector` (`name_folder_vector`).
- **Учесть:** `name_layer` бывает **значением классификации** (холм/возвышенность/
  гора у `mount`; Дача/Дом/Вилла/Особняк/Мыза/Усадьба/Дворец у `estate`) — это не
  файл; `finns_*_count_*` — 10 отдельных geojson; пустой `name_layer` + `inscription`
  = слой-центроид с подписью.
- Обновить потребителя `src/sectionOverlays.ts` (тип `OverlayLayer`).
- **ОСТОРОЖНО:** `src/layerStyles.ts` читает `sectionOverlaysManifest.styles`.
  Если меняешь/убираешь блок `styles` — перенеси источник стилей и не сломай
  augment-only слияние Фазы 0.

**`scripts/gen-base-map.py` → `src/assets/styles/base-composition.json`** из
`BASE_MAP.csv`:
- id_map=1: `positron с подписями` (растр XYZ), `relief_water1`
  (растр, `raster_style=55`→opacity 0.55), `isoline_5m`, `sectors_level`,
  `amphitheater_bound` (geojson, стиль из Фазы 0).
- `type_layer` для растров в CSV врёт (tif/geojson) — positron/relief_water1
  трактовать как растр-тайлы. Слои BASE_MAP некликабельны и без легенды.
- Обновить `src/baseCompositions.ts`.

**`scripts/gen-layer-urls.py` + `scripts/copy-new-assets.py`:**
- Обновить перечень слоёв (только из `new_files/layers`).
- **Добавить авто-копирование** `new_files/photos`→`src/assets/photos` и
  `new_files/layers`→`src/assets/layers` (сейчас делалось вручную; `isoline_5m`
  уже облегчён до 19.6 МБ и скопирован — после правки скрипта copy пойдёт сам).

### 1.3 Поведение карты (СДЕЛАНО)
- Переключение базовой подложки — плавно **2 секунды**.
- Скролл-зум: непустой `item.zoom.layer` → плавный `fitBounds`/`flyTo` к экстенту
  слоя **3 секунды**; `zoom.hidden` (`Zoom_view=1`) — целевой слой невидим (зум по
  копии); пустой → исходный вид. (Данные уже в модели `ContentItem.zoom`.)
- Легенда (`src/OverlayTogglePanel.tsx`): строки из `legend_label`; для `classify`
  — все уникальные значения атрибута классификации слоя как отдельные строки.

### Критерии приёмки Фазы 1
- `npm run build` зелёный; `dist/assets/isoline_5m-*.geojson` ≈ 20 МБ (не ~185).
- Превью: лонгрид совпадает с эталонами; базовая карта = positron+подписи+
  relief_water1@55%+вектора; скролл по главам зумит карту; легенда отражает
  `name_layer_ru`/классификацию.

---

## Фаза 2 — продвинутые интерактивы

- **Click_trigger=1:** клик по объекту → зум к нему + подсветка розовым (как
  `4_пример`) + тёмная плашка `name / fact / type / description` + 2 фото из папки
  с именем слоя (по атрибуту `id` объекта → файлы `<id>_1`, `<id>_2`). Обобщить
  `src/MountainPopup.tsx`. Атрибут `id` не показывать.
- **name_folder:** фото (горы/живопись и др.) читать по таблице из папок, а не из
  хардкода.
- **name_folder_vector:** папка-полигоны (`id_layer_click=N`) + слой-точки
  (`N+1`); клик по точке зажигает полигон, чьё имя = атрибуту `id` точки; смена
  точки — смена полигона.
- **inscription:** слой-центроид невидим, виден текст из атрибута `name`;
  `type=1` → Arial 10 bold, `type=2` → Arial 8 regular.
- **Чистка:** удалить legacy-слои/стили вне новых CSV (см.
  `agentic_dev/migration-legacy-audit.md`).

### Критерии приёмки Фазы 2
- Превью: клики по кликабельным слоям дают зум+подсветку+плашку с фото; подписи
  inscription видны; связка точка→полигон работает; в проекте нет слоёв вне CSV.

---

## Известные предупреждения
- `LONGREAD.csv` всё ещё содержит дубли/строки-черновики — глава уже
  нормализована (`Как устроен амфитеатр`→`Горный Петербург`); прочие нестыковки
  порядка править в самой таблице.
- bold+underline сработает только при наличии `<b>` в `Description` (в plain-CSV
  их нет).
- Google Sheets отдаёт 403 → работает fallback из CSV (это норма).
