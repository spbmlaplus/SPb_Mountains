# Handoff: прозрачность масок vs centroids (сессия 2026-06-28)

**Читать после:** [`HANDOFF-phase5-continuation.md`](HANDOFF-phase5-continuation.md)  
**Актуальный контекст:** [`HANDOFF-current-state.md`](HANDOFF-current-state.md) ← **START HERE** (fix opacity **реализован**, задеплоен в `76c7523`)  
**Корень:** `C:\Work\SPb_Mountains\SPb_Mountains`  
**Не коммитить / не пушить** без явной просьбы.

---

## Что просил заказчик

1. **Маски** `mask_stage`, `mask_parter`, `mask_belletazh`, `mask_balcon`, `mask_amphitheater` — чёрная заливка **35%**, **без контура** (включая stage).
2. **`mount_polygon`** — `#acacac` **50%**.
3. На карте прозрачность **не видна** — маски выглядят непрозрачными.

---

## Что сделано и что откатили

### Остаётся в коде (не трогать без необходимости)

| Изменение | Файлы |
|-----------|--------|
| Стили масок 35%, без контура | [`layerStyles.ts`](../src/layerStyles.ts) `withMaskStyles()` |
| `mount_polygon` 50% | `withMountPolygonStyles()` |
| Манифест | [`section-overlays.json`](../src/assets/sections/section-overlays.json), [`gen-section-overlays.py`](../scripts/gen-section-overlays.py) |
| Paint refresh при HMR | [`MainMap.tsx`](../src/MainMap.tsx) `setLayerPaint()` + `outlineIsVisible()` |
| Факты #5/#6, nav «01 Горный Петербург», fly-out лонгрида | `fallbackLongread.ts`, `navData.ts`, `App.css` |

### Откатано по просьбе заказчика (centroids пропали)

Попытка починить прозрачность масок через **`layerFade.ts` + `registerLayerPaintTargets()`** в `MainMap.tsx`:

- При `fadeLayerVisibility` / `instantLayerVisibility` целевая opacity читалась из paint и **не** сбрасывалась в `1`.
- **Регрессия:** перестали быть видны **centroids** (estate, mount ▲, точки с `click_trigger` и т.п.) — вероятно из‑за того, что `targetOpacityStore` запоминал `0` в момент fade-in или перезаписывал `text-opacity` / `circle-opacity` у symbol/circle слоёв.

**Откат:** `layerFade.ts` и вызовы `registerLayerPaintTargets` в `MainMap.tsx` возвращены к поведению phase 4 (после show opacity → **1**).

---

## Корневая причина (для следующего агента)

Цепочка сейчас:

```
ensureLayerOnMap → fillPaintFromStyle (fill-opacity: 0.35 / 0.5)  ✅ в paint слоя
       ↓
setLayerVisibility → fadeLayerVisibility / instantLayerVisibility
       ↓
targetOpacityStore := 1  →  map.setPaintProperty(..., 1)  ❌ затирает 0.35/0.5
```

Стили в `VECTOR_STYLES` **правильные**, но **fade/instant visibility** после появления слоя принудительно ставит `fill-opacity: 1` для всех fill-слоёв файла.

`mount` / `mount_polygon` в `INSTANT_LAYER_FILES` — для них это как раз нужно (горы должны быть видимы).  
Для **масок** и **mount_polygon** — ломает задуманную прозрачность.

---

## Рекомендуемый подход — **реализован** (вариант A, commit `76c7523`)

См. [`HANDOFF-current-state.md`](HANDOFF-current-state.md) § Visibility и opacity.

<details>
<summary>Исходный план (архив)</summary>

## Рекомендуемый подход (был не реализован на момент написания)

**Не** менять глобально `targetOpacityStore` для всех слоёв файла.

Варианты (выбрать один):

### A. Whitelist файлов с кастомной opacity (минимальный риск)

В `layerFade.ts` или `setLayerVisibility`:

```typescript
const CUSTOM_FILL_OPACITY_FILES = new Set([
  'mask_stage.geojson',
  'mask_parter.geojson',
  // ...
  'mount_polygon.geojson',
])

// В resetLayerOpacities / fade visible: для fillId этих файлов
// восстанавливать opacity из VECTOR_STYLES[styleName], не 1
```

Centroids (estate, mount symbol) **не** в whitelist → по-прежнему opacity 1.

### B. После fade-in вызывать `setLayerPaint` только для fill sub-layer

В `MainMap.tsx` после `fadeLayerVisibility` visible завершён — callback / `map.once('idle')` → `setLayerPaint(fillId, fillPaintFromStyle(style))` для mask/mount_polygon.

### C. Исключить маски из fade

Добавить `mask_*.geojson` в набор instant (как mount) **и** в `resetLayerOpacities` для них не ставить 1, а читать из style.

---

## QA чеклист (следующий агент)

| Проверка | URL |
|----------|-----|
| Centroids видны (estate, mount ▲) | `#id_map=15`, `#id_map=2` |
| Маски 35%, без зелёного контура | `#id_map=3`…`6` |
| mount_polygon 50% | `#id_map=2` |
| Факты #5, #6 | лонгрид: живопись, хайкинг |
| Nav «01 Горный Петербург» | sidebar TOC |
| Hard refresh | Ctrl+F5 после правок |

---

## Команды

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
npm run dev -- --host 127.0.0.1 --port 5175
npm run build
```

---

</details>

## История handoff

```
HANDOFF-phase5-continuation.md
  → HANDOFF-phase5-layer-opacity.md  (проблема + решение)
  → HANDOFF-current-state.md         ← START HERE
```
