# Перенос сайта на новую легенду (new_legend) — план для исполняющего агента

Документ-handoff для запуска по фазам в отдельной сессии. Источник истины — `SPb_Mountains/new_legend/read.txt` + 3 CSV. Все материалы локальны в `C:\Work\SPb_Mountains\SPb_Mountains`. Визуальные эталоны — `C:\Work\SPb_Mountains\примеры_оформления_сайта` (`1_пример.png`, `2_пример.PNG`, `3_пример.PNG`, `4_пример.PNG`).

> Запускать фазы по порядку. Между фазами — собрать локально и показать пользователю на подтверждение. Не коммитить без явной просьбы.

---

## 0. Контекст: что меняется

Новые CSV (разделитель — **запятая**) заменяют старые (`Лонгрид_1.csv`, `Порядок_слоев.csv`, `Базовые_слои.csv`, разделитель `;`):

- `new_legend/LONGREAD.csv` — текст + поведение: `Chapter, Subtitle, id_layer_base, line, Description, Media_Link, Media Link_type, name_Media Link, fact, Zoom, Zoom_view, id _map, Описание что на картах, name_vector_style`
- `new_legend/LAYERS.csv` — слои по id_map: `id_map, id_layer_click, name_layer, name_folder, name_folder_vector, inscription, name_layer_ru, name_layer_ru_style, Click_trigger`
- `new_legend/BASE_MAP.csv` — подложка: `id_map, id_layer_click, name_layer_base, type_layer, raster_style`

Логика fill-forward (read.txt): `Chapter` и `Subtitle` указываются один раз и действуют до следующей непустой ячейки.

Слои — только из `new_files/layers/*.geojson` (EPSG:3857). Стили — `new_files/style/<имя слоя>.qml` (имя стиля = имя слоя). Фото — `new_files/photos/`.

### Текущий код (что переписываем)
- Скрипты: `scripts/gen-fallback-longread.py`, `scripts/gen-section-overlays.py` (paint захардкожен в Python — убрать хардкод), `scripts/gen-layer-urls.py`, `scripts/copy-new-assets.py`
- Рантайм: `src/MainMap.tsx` (заголовок/интро захардкожены ~стр. 1563–1579), `src/contentTypes.ts`, `src/sectionOverlays.ts`, `src/layerStyles.ts`, `src/baseCompositions.ts`, `src/OverlayTogglePanel.tsx`, `src/MountainPopup.tsx`, `src/App.css`

### Эталоны (повторить оформление)
- `1_пример` — закреплённый заголовок главы `01 ...`, подзаголовок, абзацы с **жирным+подчёркиванием**, короткие линии-разделители, нижняя панель «Слои».
- `2_пример` — медиа справа + подпись (`name_Media Link`); на карте `inscription`-подписи + точки-треугольники; легенда из 2 строк.
- `3_пример` — розовая панель `ФАКТ #1` (растёт +1мм при наведении); «выползающая» снизу следующая глава `02 ...`.
- `4_пример` — клик по объекту: зум + подсветка розовым + тёмная плашка (name / fact / type / description + 2 фото).

### Поток данных (цель)
```
new_files/style/*.qml   --qml_to_style.py-->  src/assets/styles/layer-styles.json
new_legend/LONGREAD.csv --gen-longread.py-->  src/fallbackLongread.ts
new_legend/LAYERS.csv   --gen-layers.py----->  src/assets/sections/section-overlays.json
new_legend/BASE_MAP.csv --gen-base-map.py-->  src/assets/styles/base-composition.json
new_files/layers+photos --copy-new-assets.py-> src/assets/*
```

### Сборка / деплой
```powershell
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL = "https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH = "/SPb_Mountains/"
npm run build
# preview: npx vite preview --port 4173  -> http://127.0.0.1:4173/SPb_Mountains/
# деплой (только по просьбе): git push origin main  (GitHub Pages)
```

### Известные риски / расхождения
- `isoline_5m.geojson` (181 МБ) в `.gitignore` → нужен упрощённый <100 МБ или Git LFS.
- read.txt упоминает колонки (`id_layer`), которых нет в фактических CSV — ориентироваться на реальные заголовки.
- Часть `name_layer` в LAYERS.csv — это **значения классификации** (холм/возвышенность/гора у `mount`; Дача/Дом/Вилла/Особняк/Мыза/Усадьба/Дворец у `estate`), а не отдельные файлы.
- В `BASE_MAP.csv` `type_layer` для растров указан как `geojson`/`tif` некорректно — positron и relief_water1 трактовать как растр (тайлы), `raster_style=55` → opacity 0.55.
- Фото объектов для Click_trigger требуют проверки структуры папок (`<id>_1`, `<id>_2`).
- Google Sheets даёт 403 → работает fallback из CSV (это норма).

---

## Фаза 0 — Инструмент переноса стиля QML → MapLibre

**Цель:** убрать ручной хардкод стилей; стили генерируются из QML и максимально близки к QGIS.

**Создать** `scripts/qml_to_style.py` (+ короткий `scripts/qml_style.md` про маппинг). Для каждого `new_files/style/<layer>.qml` эмитить запись в `src/assets/styles/layer-styles.json` (ключ = имя слоя).

Покрыть `renderer-v2`:
- `singleSymbol` → один символ.
- `categorizedSymbol` → `attr` + `categories[]` → MapLibre `match` по значению (заливка/линия/иконка/размер). Пример: `new_files/style/mount.qml` (`attr="type"`, треугольники разного размера для возвышенность/гора/холм).
- `RuleRenderer` → правила фильтра → набор слоёв с `filter` (пример `new_files/style/Finns.qml`).
- `LinePatternFill` / `PointPatternFill` → аппроксимация штриховкой (в `MainMap.tsx` уже есть canvas-hatch) или solid с пометкой `approx`.

Парсить символ-слои: `SimpleFill` (color/outline_color/outline_width/style), `SimpleLine` (line_color/line_width/customdash), `SimpleMarker` (name=triangle/circle, color, size, outline), `CentroidFill`.

Парсить `labeling` → `{font_family, size_pt, bold (fontWeight>=75 или forcedBold=1), italic, color, buffer}` (нужно для inscription и подписей).

Утилиты:
- QGIS-цвет `"r,g,b,a,rgb:..."` и `"...,hsv:..."` → `rgba(r,g,b,a)`.
- Единицы: `MM`→px ×2.83, `Point`→px ×1.333.
- `layerOpacity` из конца файла.

**Рантайм:** расширить `src/layerStyles.ts` — читать `layer-styles.json` (приоритет над ручными значениями), поддержать `match`-категории и конфиг подписей. `gen-layers.py` тогда не хардкодит paint, а ссылается на имя слоя.

**Проверка:** сравнить сгенерированные стили со скриншотами `1_/2_/3_пример`.

---

## Фаза 1 — Пайплайн CSV + лонгрид + базовая карта

**Скрипты (переписать под запятую-CSV):**
- `gen-longread.py` → `src/fallbackLongread.ts`. Модель item: `chapter, subtitle` (fill-forward), `lines` (1/0), `paragraphs[]` (одна ячейка `Description` = один абзац; HTML-`<b>` → bold+underline), `media{link, type: left|right, caption}`, `fact`, `zoom{layer, view}`, `id_layer_base`, `id_map`.
- `gen-layers.py` → `src/assets/sections/section-overlays.json` (новая схема). Для каждого `id_map` — список слоёв по `id_layer_click` с `{name, style, legend_label(name_layer_ru), classify(name_layer_ru_style), click_trigger, inscription, folder(name_folder), folder_vector(name_folder_vector)}`. Учесть `name_layer` = значение классификации (не файл).
- `gen-base-map.py` → `src/assets/styles/base-composition.json` из BASE_MAP.csv: positron (XYZ, **с подписями**), `relief_water1` (TMS-тайлы, opacity 0.55), `isoline_5m`/`sectors_level`/`amphitheater_bound` (geojson, стиль из Фазы 0).
- `gen-layer-urls.py`, `copy-new-assets.py` — обновить перечень слоёв + копирование `new_files/photos`.

**Модель данных:** переписать `src/contentTypes.ts` под новые поля.

**Лонгрид-UI** (`src/MainMap.tsx` + `src/App.css`): убрать захардкоженные заголовок/интро. Реализовать:
- Закреплённая панель главы с номером (`01`, `02`...); при подходе следующей главы — «выползающая» вторая плашка (как `3_пример`), затем закрепление.
- Закреплённый подзаголовок (меньше главы, стиль `1_пример`).
- Линии-разделители: `line=1` — линия сверху; `line=0` — линии сверху и снизу; короче линии главы.
- Абзацы с отступами; bold→bold+underline.
- Медиа left/right + подпись `name_Media Link` (стили `1_/2_пример`).
- Розовая панель `fact` — `ФАКТ #N` (N по порядку фактов), +1мм при hover.

**Карта:**
- Переключение базовой подложки по `id_layer_base` плавно 2с (сейчас одно значение id=1; механизм — задел).
- Скролл-зум: непустой `Zoom` (имя слоя) → плавный `fitBounds`/`flyTo` к экстенту слоя 3с; `Zoom_view=1` — слой невидим (зум по копии); пустой `Zoom` — исходный вид.
- Легенда (панель «Слои»): из `name_layer_ru`; для `name_layer_ru_style` — все уникальные значения атрибута классификации как строки легенды. Обновить `src/OverlayTogglePanel.tsx`.

**Проверка:** preview — лонгрид (главы/подзаголовки/линии/факты/медиа) и базовая карта.

---

## Фаза 2 — Продвинутые интерактивы карты

- **Click_trigger=1:** клик по объекту → зум к объекту + подсветка розовым (как `4_пример`) + тёмная плашка (name / fact / type / description) + фото из папки с именем слоя; `id` объекта → файлы `<id>_1`, `<id>_2`. Обобщить `src/MountainPopup.tsx`.
- **name_folder:** фото (горы и др.) читаются по таблице из папок, а не из хардкода — перестроить логику отображения фото.
- **name_folder_vector:** папка-полигоны (`id_layer_click=N`) + точки (`id_layer_click=N+1`); клик по точке зажигает полигон, чьё имя = атрибуту `id` точки; смена точки — смена полигона.
- **inscription:** слой-центроид невидим, но показывает текст из атрибута `name`; `type=1` → Arial 10 bold, `type=2` → Arial 8 regular.
- **Чистка:** удалить legacy-слои/стили вне новых CSV (см. `agentic_dev/migration-legacy-audit.md`).

**Проверка:** preview — клики/попапы/подписи/связки точка→полигон.

---

## Чек-лист запуска (для исполняющего агента)

1. Прочитать `new_legend/read.txt`, 3 CSV, эталоны `примеры_оформления_сайта/*`.
2. Фаза 0 → собрать → показать `layer-styles.json` + сравнение со скриншотами.
3. Фаза 1 → собрать → preview лонгрид + база.
4. Фаза 2 → собрать → preview интерактивы.
5. Не коммитить/не пушить без явной просьбы пользователя.
