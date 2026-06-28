# Handoff: полировка Фазы 2 — 8 багфиксов

**Дата:** 2026-06-28. **Читать первым:** `agentic_dev/new-legend-TZ.md`, затем `HANDOFF-phase2-continuation.md`, затем этот файл.
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains` (вложенный, не родительский).

---

## Правила

1. Windows: все shell-команды с `required_permissions: ["all"]`.
2. **Не коммитить / не пушить** без явной просьбы пользователя.
3. `src/layerStyles.ts` — строго **augment-only** (приоритет QML → section → base).
4. Между крупными шагами — `npm run build` + dev-preview пользователю.
5. Glob не индексирует png/jpg — проверять через `python` / `dir` / `Read`.
6. Эталон клика/оформления: `примеры_оформления_сайта\4_пример.PNG` (и `1_/2_/3_пример`).

## Контекст

- Фазы 0–1 ✅, Фаза 2 — код есть, идёт полировка по замечаниям заказчика.
- Dev-сервер обычно поднимается на `http://127.0.0.1:5175/` (5173/5174 заняты).
- Deep-link: `#id_map=N` и `#item=<id>` выставляют активный раздел.

---

## Ключевые файлы

| Назначение | Путь |
|------------|------|
| Карта + лонгрид + вся логика | `src/MainMap.tsx` |
| Стили UI/лонгрида | `src/App.css` |
| Панель слоёв (легенда) | `src/OverlayTogglePanel.tsx` |
| Клик-триггеры | `src/clickTrigger.ts` |
| Стили слоёв (augment) | `src/layerStyles.ts` |
| Фото объектов (public) | `src/objectPhotos.ts` + `src/objectPhotoManifest.ts` |
| Вайтлист URL слоёв | `scripts/gen-layer-urls.py` → `src/layerUrls.ts` |
| Данные лонгрида | `scripts/gen-fallback-longread.py` → `src/fallbackLongread.ts` |

---

## Задачи (по приоритету)

### 1. Отступы текста — в 2 раза меньше
Только вертикальный ритм (НЕ размер шрифта), `src/App.css`:
- `.longread-item` `0.4rem 0` → `0.2rem 0` (≈206)
- `.longread-paragraph` `margin 0 0 0.9rem` → `0 0 0.45rem` (≈232)
- `.longread-chapter` `1.5rem 0 0.9rem` → `0.75rem 0 0.45rem` (≈182)
- `.longread-subtitle` `1rem 0 0.5rem` → `0.5rem 0 0.25rem` (≈199)
- `.longread-fact` `margin 1.1rem 0` → `0.55rem 0` (≈280); `.longread-media` margin-bottom вдвое.

### 2. Фото в лонгриде: первое — как есть, остальные на всю ширину по центру ПОД текстом + подписи
Данные уже несут `media.link/side/caption` (`gen-fallback-longread.py:65-73`). Сейчас figure float 45% рендерится **до** абзацев (`MainMap.tsx:1904-1911`).
- В цикле рендера (≈1875-1929) ввести счётчик медиа. **Первое** медиа — оставить как сейчас. Все **последующие** — рендерить `<figure>` ПОСЛЕ `item.paragraphs` (и после факт-панели), класс `longread-media--full`.
- CSS: `.longread-media--full { float:none; width:100%; margin:0.6rem auto; }`; `figcaption` сохранить (центрировать) — именно это даёт «подписанные фотографии».

### 3. Подразделы просто пролистываются (не пиннятся)
`src/App.css:194` `.longread-subtitle` → `position: static`, убрать `top`/`z-index`. Sticky остаётся только у `.longread-chapter`. JS-логику смены главы/подраздела (`MainMap.tsx:1876-1882`) не трогать.

### 4. Горная живопись (id_map 21) — как «Точки обзора», через НОВЫЙ `21_живопись.geojson`
Заказчик добавил слой `new_files/layers/21_живопись.geojson`: точки с `fid` и `name` (название картины); фото = `21/{fid}.png|jpg` через `resolveObjectPhotoUrl('21', fid, 1)`.
- Скопировать паттерн Viewpoints в `MainMap.tsx` (константы 326-328; build-эффект 1377-1436; toggle 1438-1449; click 1451-1477):
  - `PAINTINGS_FILE = '21_живопись.geojson'`, source + symbol-слой, иконки из папки `21` по `fid`.
  - Клик → фото на весь экран (`MountainPhotoFullscreen`/модалка) с `name` как подпись.
  - Показывать только при `activeIdMap === 21`; добавить чекбокс в `OverlayTogglePanel` (как «Точки обзора»).
- Убрать нижнюю `PaintingGallery` (`MainMap.tsx:1821-1829`) и memo `activePaintingFolder`; удалить `src/PaintingGallery.tsx` (+ его CSS).
- **Вайтлист (важно, Cyrillic):** добавить `"21_живопись.geojson"` в `EXTRA_FILES` (`scripts/gen-layer-urls.py:27`). `copy-new-assets.py` копирует все `new_files/layers/*.geojson`; `cleanup` оставляет только из вайтлиста.

### 5. Точки обзора выключать после первого раздела
`viewpointsOn = useState(true)` (`MainMap.tsx:904`), сейчас не гаснут. Добавить эффект: когда активный элемент покидает первую главу (первое значение в `chapterNumber`, «01») — один раз `setViewpointsOn(false)` (через ref-гард, чтобы пользователь мог снова включить). Если заказчик имел в виду id_map 1 — поправить трактовку.

### 6. Зум строго по столбцу `Zoom`, без «мотания из стороны в сторону»
Причина бага: эффект `MainMap.tsx:1743-1795` на каждом элементе БЕЗ zoom-слоя возвращает карту к home-виду → болтанка между целью и домом.
- Убрать ветку home-return (1760-1766): двигать камеру только если есть `item.zoom.layer`, иначе оставаться на месте.
- Дедуп по **имени zoom-слоя** (не по id элемента), чтобы соседние no-zoom элементы не ретриггерили и повторный тот же слой не рефитился.
- Ожидаемый путь из данных LONGREAD: `amphitheater_bound` → `historical_zones_4` → `historical_zones_1` → `historical_zones_5` → обратно к первому. Только на строках с `Zoom`. Сохранить 3с `fitBounds` и правый паддинг 680 (под лонгрид).

### 7. Легенда белая, чекбоксы чёрные
`src/App.css:315` `.overlay-toggle-panel` → `background:#fff` (убрать кремовый `rgba(255,246,226,.92)`), blur/border/shadow оставить. Чекбоксам `.overlay-toggle-panel input[type="checkbox"]` → `accent-color:#000`.

### 8. Стили как в QGIS (`ensureLayerOnMap`, `MainMap.tsx:662-790`)
Текущие пробелы: маркеры рисуются текст-глифами (▲/●); `label` слоёв не рендерится; `hatch` применяется только к base (стр. 616), не к overlay.
- **Circle-маркеры:** при shape=circle добавлять отдельный `circle`-слой (radius=size_px/2, fill color, stroke) вместо «●»; треугольник оставить `▲`. Данные уже распарсены в `qmlMarkerStyle` (`layerStyles.ts`).
- **Подписи overlay:** при `style.label` добавлять symbol-text слой (по аналогии с `ensureInscriptionOnMap`, 792-834).
- **Hatch overlay:** применять `style.hatch` так же, как base (`ensureHatchImage`, 465).
- Затем визуальный аудит каждого id_map против QGIS; отметить остаточные несоответствия.

---

## Пайплайн после правок

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
python scripts/copy-new-assets.py
python scripts/gen-layers.py
python scripts/gen-layer-urls.py
python scripts/cleanup-legacy-layers.py
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npm run dev -- --host 127.0.0.1
```

## Критерии приёмки

- [ ] Отступы текста вдвое меньше.
- [ ] Первое фото лонгрида — как раньше; остальные на всю ширину по центру ПОД текстом, с подписями.
- [ ] Подразделы прокручиваются (не пиннятся); главы — пиннятся.
- [ ] id_map 21: иконки картин на карте, клик → изображение с названием, тумблер в легенде; нижней галереи нет.
- [ ] Точки обзора гаснут после первого раздела (можно включить вручную).
- [ ] Скролл двигает камеру строго по `Zoom`, без болтанки.
- [ ] Легенда белая, чекбоксы чёрные.
- [ ] Маркеры (circle+stroke) / подписи / штриховка как в QGIS.
- [ ] `npm run build` зелёный; превью показано пользователю.

## Известные нюансы / не трогать без согласования

- `15.geojson` (inscription id_map 15) отсутствует — WARNING в gen-layers, это норма.
- `new_files/estate/` фото пока нет.
- `estate.classify` в CSV = «Типология владения», в geojson атрибут = `type` (есть remap в `layerStyles.ts`).
- CSV-строка id_map 21 (`new_legend/LAYERS.csv:100`) всё ещё `21,1,,21,...` — слой `21_живопись` подключается кодом (как Viewpoints), а не через CSV/section-overlays.
- `isoline_2m` (~948 МБ) — skip в copy.

## План (машиночитаемый)

`.cursor/plans/phase2_polish_fixes_3c8dcb2b.plan.md` — те же 9 todo.
