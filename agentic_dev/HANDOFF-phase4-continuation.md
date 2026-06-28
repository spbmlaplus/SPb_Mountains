# Handoff: Фаза 4 — продолжение (сессия 2026-06-28, вторая волна)

**Читать первым:** [`HANDOFF-phase4-polish.md`](HANDOFF-phase4-polish.md) → этот файл.  
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains`  
**Не коммитить / не пушить** без явной просьбы.

---

## Контекст от заказчика (вторая волна)

1. Вернуть надпись **«Исследовать горы»** на прежнее место (вертикальный sidebar, как `<li>`, не `<button>`).
2. Обновить подписи слоёв **id_map 13–20** (inscription geojson) — пользователь обновила данные.
3. При клике на centroid-слои с информацией — **×3 размер** маркера (только Point).
4. При переключении **id_map 13 и 14** — **без fade-in** (мгновенное появление).
5. **Тогглы категорий** в панели «Слои»: estate (Дача/Усадьба/…), routes (маршруты по name), mount (холм/гора/…) и аналоги с `classify` + `categories`.
6. **ФАКТ #5** после абзаца про аристократов/живопись; **ФАКТ #6** после абзаца про хайкинг.
7. **«Всё ещё не вижу гор»** — вернуть mount и первые слои как были (без fade, opacity=1).

---

## Что сделано в коде (эта сессия)

| Задача | Статус | Файлы |
|--------|--------|-------|
| Phase 4 QA + build | ✅ (ранее) | `layerFade.ts` TS-fix, build зелёный |
| Painting assets 39 webp | ✅ (ранее) | `copy-new-assets.py`, `prep-painting-images.py` |
| Belveder dedup (дубль full-width media) | ✅ | `MainMap.tsx` — `!isFullMedia` в втором рендере figure |
| «Исследовать горы» — вертикальный `<li>` | ✅ | `Sidebar.tsx`, `layout.css` (`li[role=button]`) |
| Горы без fade | ✅ | `layerFade.ts` → `instantLayerVisibility`; `MainMap.tsx` `INSTANT_LAYER_FILES` = mount/mount_polygon |
| id_map 13/14 без fade | ✅ | `NO_FADE_ID_MAPS = {13, 14}` в `setLayerVisibility` |
| Centroid ×3 при клике | ✅ (код) | `promoteId: 'fid'`, `feature-state selected`, `scaleSizeForSelection` / `scaleRadiusForSelection` |
| Тогглы категорий | ✅ (код) | `OverlayTogglePanel.tsx`, `userDisabledCategories`, `applyCategoryFilterToFile` |
| ФАКТ #5 (longread-69) | ✅ | `fallbackLongread.ts` |
| ФАКТ #6 (longread-72) | ✅ | `fallbackLongread.ts` |
| Inscription 13–20 sync | ⚠️ | `copy-new-assets.py` — байты совпали с `new_files/layers/`; **browser QA не закрыт** |
| `npm run build` после всех правок | ❓ | **Прервано** — обязательно прогнать первым делом |

---

## Ключевые изменения (для ориентации)

### 1. Fade vs instant visibility

[`layerFade.ts`](../src/layerFade.ts):
- `instantLayerVisibility` — visibility toggle + сброс opacity в 1.
- `fadeLayerVisibility` — при show сначала пишет target opacity=1 в store (fix «горы исчезают»).

[`MainMap.tsx`](../src/MainMap.tsx):
```typescript
const INSTANT_LAYER_FILES = new Set(['mount.geojson', 'mount_polygon.geojson'])
const NO_FADE_ID_MAPS = new Set([13, 14])
```

### 2. Centroid ×3 при выборе

- GeoJSON sources: `promoteId: 'fid'` в `ensureLayerOnMap` / `ensureInscriptionOnMap`.
- `selectPointFeature()` → `map.setFeatureState({ selected: true })`.
- Symbol: `text-size` через `scaleSizeForSelection`; circle: `circle-radius` через `scaleRadiusForSelection`.
- Сброс при смене activeItem / close popup: `clearSelectedFeature()`.

**QA:** клик mount ▲ / estate centroid / 23_1 point → маркер должен стать в 3 раза больше.

### 3. Тогглы категорий

[`OverlayTogglePanel.tsx`](../src/OverlayTogglePanel.tsx):
- Props: `disabledCategories`, `onToggleCategory`.
- Под каждым classified-слоем — чекбоксы категорий (только если родительский слой включён).

[`MainMap.tsx`](../src/MainMap.tsx):
- State: `userDisabledCategories[idMap][layerName] → Set<categoryValue>`.
- `applyCategoryFilterToFile()` — MapLibre filter `['in', ['get', classify], ['literal', enabled]]`.

**QA id_map 15–20:** снять «Дача» → дачи скрыты, «Усадьба»/«Дворец» остаются.  
**QA id_map 23:** снять «Дудергофские высоты» → соответствующие линии routes скрыты.

### 4. Лонгрид — новые факты

| Item | ФАКТ |
|------|------|
| `longread-69-горная-живопись` | «Мы собрали для вас искуссно отображенные горные фасады Петербурга…» |
| `longread-72-горные-активности` | «Исследуйте горы! Проходите маршруты…» |

Нумерация автоматическая через `buildLongreadMeta` (глобальный счётчик `fact`).

**Примечание:** правки только в `fallbackLongread.ts`. Если Sheets загружается — нужен regen `gen-fallback-longread.py` или правка xlsx.

### 5. Inscription слои 13–20

| id_map | Файл | features (new_files) | props |
|--------|------|----------------------|-------|
| 13 | `13.geojson` | 120 | `name` |
| 14 | `14.geojson` | 29 | `name` |
| 16–20 | `{n}.geojson` | 5–16 | `name`, `layer_2` |

`15.geojson` — **нет** в `new_files/layers/` (id_map 15 без inscription — норма).

Подписи рендерятся через `ensureInscriptionOnMap`: `coalesce(inscription, name)`, 12px Montserrat Bold.

После обновления пользователем: `python scripts/copy-new-assets.py` → проверить `#id_map=13`…`20`.

---

## P0 для следующего агента

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
$env:Path += ";C:\Program Files\nodejs"
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npm run dev -- --host 127.0.0.1 --port 5175
```

---

## Browser QA checklist (приоритет)

- [ ] **#id_map=1,2** — ▲ mount видны сразу, без fade, не opacity 0
- [ ] **#id_map=13,14** — переключение без fade; подписи maki/inscription на месте
- [ ] **#id_map=16–20** — inscription labels (дворцы, усадьбы)
- [ ] **Клик mount ▲** — popup + маркер ×3
- [ ] **Клик estate** (id_map 16) — popup + ×3 (если Point)
- [ ] **Клик 23_1_points** — popup thumb + viewshed
- [ ] **Панель «Слои»** — тогглы Дача/Усадьба, routes по name
- [ ] **longread-69** — ФАКТ #5 после абзаца про аристократов
- [ ] **longread-72** — ФАКТ #6 после абзаца про хайкинг
- [ ] **Belveder** — одно фото (fix `!isFullMedia`)
- [ ] **Sidebar collapsed** — «Исследовать горы» вертикально, клик → последний item + viewpoints ON

Deep-links:
- `#id_map=1` — горы
- `#id_map=13`, `#id_map=14` — finns / maki
- `#id_map=16` — estate + inscription
- `#item=longread-69-горная-живопись`
- `#item=longread-72-горные-активности`

---

## Известные риски

1. **fade + mount (старый баг):** если ▲ снова невидимы — проверить `targetOpacityStore` и что mount идёт через `instantLayerVisibility`, не fade.
2. **×3 только Point:** polygon estate не масштабируется — только centroid/symbol/circle.
3. **`promoteId: 'fid'`:** если fid нет в geojson — feature-state не сработает; mount.geojson имеет `fid`.
4. **Sheets vs fallback:** при успешной загрузке Sheets факты #5/#6 из fallback могут не показаться — синхронизировать xlsx или отключить Sheets для QA.
5. **Browser click QA** в прошлой сессии частично блокировался sandbox — estate/23 popup проверить вручную.

---

## Не в scope (без явного ТЗ)

- Viewpoints auto-off после гл.01 (`HANDOFF-phase2-polish.md` §5)
- Crossfade между id_map (3.5 s) — **не возвращать**
- `gen-fallback-longread.py` regen — только если нужны факты в Sheets-режиме

---

## Карта файлов

| Назначение | Путь |
|------------|------|
| Карта, fade/instant, categories, ×3 | `src/MainMap.tsx` |
| Fade utility | `src/layerFade.ts` |
| Панель слоёв + category toggles | `src/OverlayTogglePanel.tsx` |
| Sidebar «Исследовать горы» | `src/Sidebar.tsx`, `src/layout.css` |
| Факты лонгрида | `src/fallbackLongread.ts` |
| Inscription geojson | `new_files/layers/{13–20}.geojson` → `src/assets/layers/` |
| Phase 4 baseline | `agentic_dev/HANDOFF-phase4-polish.md` |

---

*Следующий агент: `npm run build` → browser QA по checklist → fix только по fail.*
