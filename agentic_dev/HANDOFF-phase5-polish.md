# Handoff: Фаза 5 — полировка лонгрида, finns, подписи (сессия 2026-06-28)

**Читать первым:** [`HANDOFF-phase4-continuation.md`](HANDOFF-phase4-continuation.md) → этот файл → [`HANDOFF-phase5-continuation.md`](HANDOFF-phase5-continuation.md) (**полный контекст для следующего агента**).  
**Корень проекта:** `C:\Work\SPb_Mountains\SPb_Mountains`  
**Не коммитить / не пушить** без явной просьбы.

---

## Контекст от заказчика (эта сессия)

### 1. Новый тип текста — «геологическая эра»

Строки вида:
- «2,5 млн лет назад — ледники. Силурийский период.»
- «12 тыс. лет назад — конец ледникового периода. Девонский период.»
- «7 тыс. лет назад — послеледниковое время. Четвертичный период.»
- «450 млн лет назад — древнее море. Конец Ордовикского, начало Силурийского периода.»

**Требования:**
- Размер **чуть меньше подзаголовков** (`.longread-subtitle` = 1.15rem) → `.longread-era` = **1.05rem**
- **Полужирный + курсив** (`font-weight: 600`, `font-style: italic`)
- **Подсветка как у обычного текста** — при активном блоке opacity 1, при неактивном 0.55 (раньше весь `.longread-item` имел opacity 0.55, из‑за чего era-строки «затухали» вместе с медиа)

**Данные:** `fallbackLongread.ts` / `new_legend/LONGREAD.csv` — те же `paragraphs`, без новой колонки. Детект по regex в `isEraCaption()` (`src/contentTypes.ts`).

### 2. Finns — увеличить точки в 2×

`finnsLayerStyle()` в `src/layerStyles.ts`:

| Bucket | Было | Стало |
|--------|------|-------|
| `count_100_plus` | 8.5 | **17** |
| `count_10_100` | 4.25 | **8.5** |
| `count_1_10` | 2.83 | **5.66** |

id_map **12** и **13** — по 9 слоёв finns.

### 3. Inscription id_map 12–20 — подписи

Ранее (план mobile QA): **8px** Regular через `COMPACT_INSCRIPTION_FILES`.

**Новые требования:**
- **10px** Regular (больше 8px, но **≤ 12px** у «первых» подписей — `2.geojson`, `23.geojson`, Bold)
- **Выше над точкой:** `text-offset: [0, -1.5]` (compact), `[0, -1.2]` (default 12px)
- Чёрный текст, без halo (как было)

---

## Что сделано в коде (эта сессия)

| Задача | Статус | Файлы |
|--------|--------|-------|
| Тип `.longread-era` + `isEraCaption()` | ✅ | `contentTypes.ts`, `MainMap.tsx`, `App.css` |
| Opacity на текст, не на весь item | ✅ | `App.css` — `.longread-paragraph`, `.longread-era`, `.longread-fact` |
| Finns ×2 | ✅ | `layerStyles.ts` |
| Mask / historical_resettlement styles | ✅ | `layerStyles.ts` `withMaskStyles` + `withHistoricalResettlementStyles`; `MainMap.tsx` paint refresh |
| Inscription 10px + offset | ✅ | `MainMap.tsx` `ensureInscriptionOnMap` |
| Handoff phase 5 | ✅ | `HANDOFF-phase5-polish.md`, `HANDOFF-phase5-continuation.md` |
| `npm run build` | ✅ | зелёный на конец сессии |
| Browser QA | ❌ | см. чеклист в continuation handoff |

---

## Ключевые изменения (для ориентации)

### 1. Geological era captions

[`contentTypes.ts`](../src/contentTypes.ts):
```typescript
export const isEraCaption = (text: string): boolean =>
  /\d+[,.]?\d*\s*(?:млн|тыс\.)\s+лет\s+назад/i.test(text.replace(/<[^>]+>/g, ''))
```

[`MainMap.tsx`](../src/MainMap.tsx) — рендер:
```tsx
className={isEraCaption(para) ? 'longread-era' : 'longread-paragraph'}
```

[`App.css`](../src/App.css):
```css
.longread-era {
  font-size: 1.05rem;
  font-weight: 600;
  font-style: italic;
  color: #111;
}
```

Opacity перенесена с `.longread-item` на дочерние текстовые блоки — era и paragraph ведут себя одинаково при scroll-active.

**QA:** глава «Как появились горы…» — прокрутить era-строки; активная строка должна быть яркой (opacity 1), соседние — приглушённые.

### 2. Finns

[`layerStyles.ts`](../src/layerStyles.ts) — `finnsLayerStyle()`.

**QA:** `#id_map=12`, `#id_map=13` — три размера точек, три цвета по FINNS%.

### 3. Inscription compact labels

[`MainMap.tsx`](../src/MainMap.tsx):
```typescript
const COMPACT_INSCRIPTION_FILES = /* id_map 12–20 inscriptions */
'text-size': compact ? 10 : 12,
'text-offset': [0, compact ? -1.5 : -1.2],
```

**QA:** `#id_map=13`…`20` — подписи читаемы, не перекрывают точку, не крупнее чем у id_map 2/23.

---

## Наследие предыдущих сессий (не ломать)

| Тема | Состояние |
|------|-----------|
| Centroid ×3 при клике | **Убрано** по просьбе заказчика — не возвращать |
| id_map 23 «Смотровые точки» | Первый в панели «Слои»; клик через `folder_vector` → `23_2_viewshed` |
| Inscription default (не compact) | 12px **Bold**, чёрный, без halo |
| mount ▲ | холм 6.5 / возвышенность 10 / гора 17; без hover-fade |
| mount_polygon | `#acacac` 50% |
| mask_* (кроме stage) | прозрачный outline; `historical_resettlement` серый |
| longread-21 (vomitorii) | **удалён** — не восстанавливать |
| Nav главы 06–11 | убраны из `navData.ts` |
| Mobile v2 | carousel, 45dvh longread / 55dvh map, bottom-sheet popup |
| id_map 13/14 | без fade-in слоёв |

---

## Browser QA (приоритет)

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
npm run dev -- --host 127.0.0.1 --port 5175
npm run build
```

Deep-links:
- `#id_map=8` — геологическая глава, era-строки в лонгриде
- `#id_map=12` — finns (крупные точки)
- `#id_map=13` — finns + maki_selki + inscription 13
- `#id_map=15` — compact inscription + category toggles
- `#id_map=23` — смотровые точки, клик popup

Чеклист:
- [ ] Era-строки: 1.05rem, semi-bold italic, активная — opacity 1
- [ ] Finns на 12/13: точки заметно крупнее (×2 от прежних)
- [ ] Inscription 12–20: ~10px, подпись выше точки
- [ ] Inscription 2/23: по-прежнему 12px Bold
- [ ] Build зелёный
- [ ] Mobile: era-строки в карусели читаемы

---

## Если нужны доработки

1. **Era regex** — расширить, если появятся строки без «млн/тыс. лет назад»
2. **text-offset** — подкрутить `-1.5` / `-1.2` в browser DevTools
3. **Finns ещё крупнее** — только `finnsLayerStyle()` size constants
4. **Явная колонка CSV** `era=1` — потребует правки `gen-fallback.py` + парсера sheet

---

## Файлы для быстрого старта

| Назначение | Путь |
|------------|------|
| Лонгрид, inscription, рендер | `src/MainMap.tsx` |
| Стили слоёв (finns, mount) | `src/layerStyles.ts` |
| CSS лонгрида | `src/App.css` |
| Типы + isEraCaption | `src/contentTypes.ts` |
| Контент | `src/fallbackLongread.ts`, `new_legend/LONGREAD.csv` |
| Оверлеи | `src/assets/sections/section-overlays.json` |
