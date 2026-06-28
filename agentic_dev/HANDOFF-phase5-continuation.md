# Handoff: Фаза 5 — продолжение (сессия 2026-06-28)

**Читать первым:** [`HANDOFF-phase4-continuation.md`](HANDOFF-phase4-continuation.md) → [`HANDOFF-phase5-polish.md`](HANDOFF-phase5-polish.md) → **этот файл**.  
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains`  
**Не коммитить / не пушить** без явной просьбы.

---

## Кратко: что просил заказчик и что сделано

| # | Запрос | Статус | Где |
|---|--------|--------|-----|
| 1 | Новый тип текста «геологическая эра» (semi-bold italic, чуть меньше subtitle, подсветка как body) | ✅ код | `contentTypes.ts`, `App.css`, `MainMap.tsx` |
| 2 | Finns — точки ×2 | ✅ | `layerStyles.ts` `finnsLayerStyle()` |
| 3 | Inscription id_map 12–20: ~10px Regular, выше над точкой | ✅ | `MainMap.tsx` `ensureInscriptionOnMap` |
| 4 | Откат стилей `mask_*` + `historical_resettlement` к QGIS | ✅ (2 прохода) | `layerStyles.ts`, `section-overlays.json`, `MainMap.tsx` |
| 5 | Handoff следующему агенту | ✅ | этот файл |
| 6 | Browser QA всего выше | ❌ | см. чеклист |

**Из фазы 4 (план `styles_mount_mobile_qa`) — уже было сделано ранее, не ломать:**

- `mount_polygon` → `#acacac` 50%
- mount ▲: холм 6.5 / возвышенность 10 / гора 17, без hover-fade
- id_map 23: «Смотровые точки» первым в «Слои»; клик через `folder_vector`
- longread-21 (вomitorii) удалён
- Nav: главы 06–11 убраны
- Mobile v2: carousel, 45dvh/55dvh, bottom-sheet popup
- Centroid ×3 при клике — **убрано** по просьбе, не возвращать

---

## 1. Геологическая эра (`.longread-era`)

**Примеры строк** (`fallbackLongread.ts`, `LONGREAD.csv`):
- «450 млн лет назад — древнее море…»
- «2,5 млн лет назад — ледники. Силурийский период.»
- «12 тыс. лет назад — конец ледникового периода…»
- «7 тыс. лет назад — послеледниковое время…»

**Детект:** regex в `isEraCaption()` — `/\d+[,.]?\d*\s*(?:млн|тыс\.)\s+лет\s+назад/i` (`src/contentTypes.ts`).

**CSS** (`App.css`):
- `.longread-era`: **1.05rem** (subtitle = 1.15rem), **600 + italic**, `#111`
- Opacity перенесена с `.longread-item` на `.longread-paragraph` / `.longread-era` / `.longread-fact` — медиа больше не «затухает» вместе с текстом; era и paragraph ведут себя одинаково при scroll-active (0.55 / 1.0)

**QA:** `#id_map=8`, прокрутка геологической главы.

---

## 2. Finns ×2

`finnsLayerStyle()` в [`layerStyles.ts`](../src/layerStyles.ts):

| Bucket | px |
|--------|-----|
| `count_100_plus` | **17** |
| `count_10_100` | **8.5** |
| `count_1_10` | **5.66** |

id_map **12** и **13** — по 9 слоёв `finns_*`.

**QA:** `#id_map=12`, `#id_map=13`.

---

## 3. Inscription id_map 12–20

[`MainMap.tsx`](../src/MainMap.tsx) — `COMPACT_INSCRIPTION_FILES` (все inscription из id_map 12–20):

```typescript
'text-size': compact ? 10 : 12,
'text-font': compact ? 'Montserrat Regular' : 'Montserrat Bold',
'text-offset': [0, compact ? -1.5 : -1.2],
'text-color': '#000000',
'text-halo-width': 0,
```

«Первые» подписи (`2.geojson`, `23.geojson`) — **12px Bold**, без изменений.

**QA:** `#id_map=13`…`20`; сравнить с `#id_map=2`.

---

## 4. Маски и historical_resettlement (важно — 2-й проход)

### Проблема
В phase 3/4 все `mask_*` унифицировали с **зелёной обводкой** `rgb(143,209,187)`; `historical_resettlement` заменили на **чёрный 30%**. Значения в `section-overlays.json` уже правили, но **на карте не менялись**: `ensureLayerOnMap` создавал слои один раз и **не обновлял paint** при смене стилей (HMR / повторный заход).

### Целевые значения (QGIS / `layer-styles.json`)

| Слой | Fill | Outline |
|------|------|---------|
| `mask_stage` | `rgb(0,0,0)` @ **0.698** | **зелёный** `rgb(143,209,187)` width **1.3** |
| `mask_parter`, `mask_belletazh`, `mask_balcon`, `mask_amphitheater` | то же | **прозрачный** `rgba(35,35,35,0)` width 0.736 — line-layer **не рисуется** |
| `historical_resettlement` | **`rgba(89,89,89,0.4784)`** | **нет** (без hatch) |

### Где зафиксировано

1. **`layerStyles.ts`** — runtime overrides (гарантия поверх manifest):
   - `withMaskStyles()` — константы `MASK_FILL`, `MASK_OUTLINE_NONE`, `MASK_STAGE_OUTLINE`
   - `withHistoricalResettlementStyles()` — серый fill, `outline`/`hatch` = undefined

2. **`section-overlays.json`** — блок `"styles"` (~1480–1630)

3. **`scripts/gen-section-overlays.py`** — исправлены mask/historical (чтобы реген не вернул зелёный контур на все маски)

4. **`MainMap.tsx`** — paint refresh:
   - `setLayerPaint()` — обновляет fill/line paint у существующих слоёв
   - `outlineIsVisible()` — пропускает line-layer при alpha=0
   - при отсутствии видимого outline — `visibility: none` на line-layer

**QA:**
- `#id_map=3`…`6` — только **сцена** (`mask_stage`) с зелёным контуром; parter/belletazh/balcon — без обводки
- `#id_map=12` — `historical_resettlement` серый патч, не чёрный и не оранжевый
- Hard refresh (Ctrl+F5) если dev-сервер был открыт до правок

---

## 5. Архитектура стилей (для отладки)

```
VECTOR_STYLES = withFinnsStyles(
  withHistoricalResettlementStyles(
    withMaskStyles(
      withMountPolygonStyles(
        … augmentFromQml(
          [ qml manifest, section-overlays, base ]  // section wins on collision
        )
```

- **Section manifest** (`section-overlays.json`) перебивает `layer-styles.json` при коллизии имён.
- **with*Styles** в конце цепочки — финальные overrides для mount, mask, finns, historical_resettlement, mount_polygon.
- **ensureLayerOnMap(map, fileName, styleName)** — `styleName` из `overlayStylesByFile`; fallback `isMaskFile` → `#09131a` @ 0.12 только если `VECTOR_STYLES[styleName]` пуст.

---

## Команды

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npm run dev -- --host 127.0.0.1 --port 5175
```

Пайплайн данных (после правок CSV):
```powershell
python scripts/gen-layers.py
python scripts/gen-section-overlays.py   # mask-стили теперь QGIS-correct
python scripts/gen-fallback-longread.py
npm run build
```

---

## Browser QA — чеклист (не закрыт)

Deep-links:

| URL hash | Что проверить |
|----------|----------------|
| `#id_map=3`…`6` | Маски амфitheater: зелёный контур только у stage |
| `#id_map=8` | Era-строки в лонгриде |
| `#id_map=12` | Finns ×2 + historical_resettlement серый |
| `#id_map=13` | finns + maki_selki + inscription 10px |
| `#id_map=15` | estate + category toggles + compact inscription |
| `#id_map=2` | mount ▲ все типы + mount_polygon #acacac 50% |
| `#id_map=23` | Смотровые точки, клик → popup + viewshed |

- [ ] Build зелёный (`npm run build` — был зелёный на конец сессии)
- [ ] Era: 1.05rem, italic semi-bold, active opacity 1
- [ ] Finns: три размера ×2
- [ ] Inscription 12–20: 10px, offset вверх; 2/23 — 12px Bold
- [ ] Masks: QGIS-стили на карте (не только в JSON)
- [ ] Mobile: era в carousel, 45dvh sheet

---

## Файлы — быстрый индекс

| Назначение | Путь |
|------------|------|
| Карта, лонгрид, inscription, ensureLayerOnMap | `src/MainMap.tsx` |
| VECTOR_STYLES, finns, mask, mount overrides | `src/layerStyles.ts` |
| CSS лонгрида (.longread-era, opacity) | `src/App.css` |
| isEraCaption | `src/contentTypes.ts` |
| Контент | `src/fallbackLongread.ts`, `new_legend/LONGREAD.csv` |
| Оверлеи + styles block | `src/assets/sections/section-overlays.json` |
| QML → JSON (reference) | `src/assets/styles/layer-styles.json` |
| Реген оверлеев | `scripts/gen-section-overlays.py` |
| Клик 23_1 | `src/clickTrigger.ts` |
| Nav (01–05 only) | `src/navData.ts` |
| Mobile layout | `src/layout.css`, `src/MobileMenu.tsx` |

---

## Не делать без явной просьбы

- Не возвращать **Centroid ×3** при клике
- Не восстанавливать **longread-21** (vomitorii)
- Не возвращать nav-главы **06–11**
- Не коммитить / не пушить
- Не редактировать plan-файл `styles_mount_mobile_qa_f8345b7d.plan.md`

---

## Возможные следующие задачи

1. **Browser QA** — закрыть чеклист выше
2. **text-offset** inscription — подкрутить `-1.5`/`-1.2` по визуалу
3. **Era regex** — расширить или добавить колонку CSV `era=1`
4. **historical_resettlement hatch** — в QML `dense4`; сейчас намеренно без hatch (плоский серый)
5. **Inscription browser QA id_map 13–20** — из phase 4 handoff, всё ещё ⚠️

---

## История handoff-файлов

```
HANDOFF.md
  → HANDOFF-phase4-polish.md
    → HANDOFF-phase4-continuation.md
      → HANDOFF-phase5-polish.md
        → HANDOFF-phase5-continuation.md  ← START HERE
```
