# Аудит слоёв и стилей после миграции на `new_files/` + `new_legend/`

Дата: 2026-06-18. Дополняет `agentic_dev/HANDOFF.md` — фиксирует, что реально подключается в рантайме vs что осталось на диске.

---

## Краткий ответ

| Вопрос | Ответ |
|---|---|
| Вчитываются ли **старые слои** в рантайме? | **Нет** — только файлы из `src/layerUrls.ts` (33 geojson по манифестам). |
| Лежат ли старые слои на диске? | **Да** — ~47 legacy-файлов в `src/assets/layers/` (всего ~80); `copy-new-assets.py` копирует поверх, но **не удаляет** лишнее. |
| Вчитываются ли **старые стили** в рантайме? | **Нет** — paint берётся из JSON-манифестов. QML в рантайме не парсятся. |
| Лежат ли старые стили на диске? | **Да** — ~18 legacy QML в `src/assets/styles/sections/`, плюс неиспользуемый `base-composition-3.json`. |
| Можно ли было полностью заменить старое новым? | **Да** — логически приложение уже на новой спеке; физическая очистка `assets/` не выполнена. |
| Стили из `new_files` корректны? | QML **скопированы**; значения в `section-overlays.json` — **ручной упрощённый порт** в `gen-section-overlays.py`, нужен design review. |

---

## Слои: что реально грузится

| Источник | Количество |
|---|---|
| Файлов в `src/assets/layers/` | **80** |
| Подключено в `src/layerUrls.ts` | **33** |
| Geojson в `new_files/layers/` | **31** (+ `Viewpoints.geojson` в `new_files/1/`) |

Генератор: `scripts/gen-layer-urls.py` (пересобирать после изменения манифестов).

Подключённые слои соответствуют новой спеке:

- `new_legend/Порядок_слоев.csv` → `section-overlays.json` (23 `id_map`)
- `new_legend/Базовые_слои.csv` → `base-composition-1.json` (вектора базы)

После перехода с `import.meta.glob('./assets/layers/*.geojson')` на `layerUrls.ts` legacy-файлы **не попадают в бандл**.

### Исключение — один legacy-файл намеренно оставлен

`sector.geojson` — навигация «Исследовать горы» (`navData.ts`, explore mode в `MainMap.tsx`). В `new_files/` отсутствует.

### Legacy geojson на диске (не в манифесте, не грузятся)

Примеры (47 файлов):

- `mountains.geojson` (заменён на `mount.geojson`)
- `01_mask.geojson`, `01_Roshchinsky.geojson`, … маски секторов `01_`–`13_`
- `resettlement_after_stage.geojson`, `resettlement.geojson`, `resettlement_1.geojson`
- `stage.geojson`, `water.geojson`, `parter.geojson`, `balcon.geojson`, `belletazh.geojson`
- `amphitheater.geojson` (оверлей; в базе используется `amphitheater_bound.geojson`)
- `isoline_2m.geojson` (~948 MB) — не в спеке, `copy-new-assets.py` теперь пропускает при копировании
- `hotels.geojson`, `eco-routes.geojson`, `skiing.geojson`, `slope.geojson`, `search_bound*.geojson` и др.

`copy-new-assets.py` только **копирует** из `new_files/layers/` поверх существующих и **не удаляет** старые файлы.

---

## Стили: как вчитываются

### Цепочка в рантайме

```
section-overlays.json  ─┐
base-composition-1.json ─┼→ src/layerStyles.ts → VECTOR_STYLES → MainMap.tsx
                         │
QML в sections/*.qml     ─┘  (не читаются в рантайме — provenance / эталон)
```

1. **Рантайм** читает только JSON (`section-overlays.json`, `base-composition-1.json`).
2. **Генератор** `scripts/gen-section-overlays.py` содержит **захардкоженный** словарь `styles = { ... }` — цвета и opacity прописаны в Python, **не парсятся из QML автоматически**.
3. **QML** из `new_files/style/` копируются в `src/assets/styles/sections/` скриптом `copy-new-assets.py`.
4. Если для слоя нет записи в `VECTOR_STYLES`, срабатывает **legacy fallback** — двухпалитровая схема (оранжевый / mask) в `ensureLayerOnMap` (`MainMap.tsx`). Для актуальных `id_map` 1–23 стили в манифесте заданы; fallback не должен срабатывать.

### Корректность относительно новых QML

Частичная. В JSON есть ссылки на новые QML (`"qml": "src/assets/styles/sections/…"`), но paint-значения — **упрощённый ручной порт**, не полный `<renderer-v2>`:

| Слой / группа | Статус |
|---|---|
| `mask_*`, `landscape_*`, `estate`, `vomitoria` | В целом соответствуют |
| `landscape_12` | `fill_categories` из QML (категории по полю «Ландшафт») |
| `Finns` | Упрощён (в QGIS — сложный RuleRenderer) |
| `historical_zones_*` | Только outline, без fill |
| Активности (`paragliding_clubs`, `horse_riding_clubs`, …) | Placeholder-заливки |
| `walking_routes` | QML: `walking_routes.gpk_-_walking_routes.qml` |

### Legacy QML на диске (не в манифесте)

18 файлов только в `sections/`, отсутствуют в `new_files/style/`:

`amphitheater.qml`, `amphitheater_bound_1.qml`, `elements.qml`, `isoline_5m_1.qml`, `mask.qml`, `mountains.qml`, `relief_transparent.qml`, `resettlement_after_stage.qml`, `resettlement.qmd.qml`, `resettlement_after_stage.qmd.qml`, `search_bound.qml`, `search_bound_one_step.qml`, `sector.qml`, `stage.qml`, `stage_1.qml`, `stage_barier.qml`, `stage_isolated_urban_areas.qml`, `water.qml`

Также не используется в рантайме, но импортируется в коде:

- `src/assets/styles/base-composition-3.json` — старая база для главы 2; `DEFAULT_BASE_ID = 1`, swap снят.

В корне `src/assets/styles/` остались legacy QML базы: `stage.qml`, `water.qml` (в новой `Базовые_слои.csv` их нет).

---

## Растровый слой `relief_water1` (справка)

Отдельная проблема, исправленная 2026-06-18:

- Тайлы на `spb_mountains_tiles` именуются **TMS**-рядами (`…/12/2393/2904.png`).
- MapLibre по умолчанию запрашивал **XYZ** (`y≈1190` для СПб) → 404 → видны только Positron @40% и розовые `isoline_5m`.
- **Fix:** `"scheme": "tms"` в `base-composition-1.json`, начальный `zoom: 10` (пирамида z10–14).

Подробности: секция «2026-06-18 (raster fix)» в `agentic_dev/HANDOFF.md`.

---

## Рекомендуемая полная замена (ещё не сделана)

1. **Удалить legacy geojson** из `src/assets/layers/` — всё, что не перечислено в `layerUrls.ts` (+ решить судьбу `sector.geojson` для explore mode).
2. **Удалить legacy QML** из `sections/` — оставить только файлы из `new_files/style/`.
3. **Удалить** `base-composition-3.json`, импорт из `baseCompositions.ts` / `layerStyles.ts`, если база #3 больше не нужна.
4. **Улучшить генератор** — парсить `<renderer-v2>` из QML в `gen-section-overlays.py` вместо захардкоженного словаря (отдельная задача, design review).

### Скрипты синхронизации (актуальный порядок)

```bash
python scripts/copy-new-assets.py      # geojson + qml + longread photos (skips isoline_2m)
python scripts/gen-section-overlays.py
python scripts/gen-fallback-longread.py
python scripts/gen-layer-urls.py
```

---

## Связанные файлы

| Файл | Роль |
|---|---|
| `src/layerUrls.ts` | Белый список geojson для бандла |
| `src/assets/sections/section-overlays.json` | 23 `id_map` + блок `styles` |
| `src/assets/styles/base-composition-1.json` | База: Positron + relief_water1 + вектора |
| `scripts/gen-section-overlays.py` | Генератор манифеста + ручные стили |
| `scripts/copy-new-assets.py` | Копирование из `new_files/` (без удаления legacy) |
| `new_files/`, `new_legend/` | Исходники дизайн-команды (не удалять) |
