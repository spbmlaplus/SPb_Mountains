# Handoff для следующего агента (сессия 4, 2026-07-03)

**START HERE** — заказчик дал новое ТЗ (ниже). Код **локально изменён**, **не закоммичен**, на production **не задеплоен**.

| | |
|---|---|
| **Корень** | `C:\Work\SPb_Mountains\SPb_Mountains` |
| **Production** | https://spbmlaplus.github.io/SPb_Mountains/ |
| **Локальный preview** | http://localhost:4173/ (после `npm run build` + `vite preview`) |
| **Телефон (LAN)** | http://192.168.0.102:4173/ |

**Не коммитить / не пушить без явной просьбы заказчика.**

---

## Запуск preview (обязательно с `VITE_BASE_PATH=/`)

Иначе белый экран: сборка с `/SPb_Mountains/`, а preview открывают с корня `/`.

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npx vite preview --host 0.0.0.0 --port 4173
```

Открыть: **http://localhost:4173/** (не `/SPb_Mountains/`).

---

## Документы

| Файл | Назначение |
|------|------------|
| **Этот файл** | Актуальный handoff + **ТЗ заказчика** |
| [`HANDOFF-2026-07-03-session3.md`](HANDOFF-2026-07-03-session3.md) | Панель «Слои», id_map 23, mobile sheet |
| [`HANDOFF-2026-07-03.md`](HANDOFF-2026-07-03.md) | QA фазы 1–4, схема id_map 12/13/14 |
| [`PREVIEW-2026-07-03.md`](PREVIEW-2026-07-03.md) | Чеклист preview |

---

## Что сделано в сессии 4 (перед ТЗ)

| Задача | Статус | Файлы |
|--------|--------|-------|
| Белый экран preview | исправлено | пересборка с `VITE_BASE_PATH=/` |
| Слои финнов 12/13/14 | восстановлена QA-схема | `section-overlays.json`, `gen-layers.py` → `apply_qa_finns_id_map_overrides` |
| Mobile: один скролл в sheet | исправлено | `App.css` |
| Sheet раскрывается при выборе карты / explore / autoscroll | сделано | `MainMap.tsx` |
| Splash: подсказка mobile vs desktop | сделано | `SplashModal.tsx`, `App.css` |
| Escape закрывает splash и панель слоёв | сделано | `MainMap.tsx` |
| Гистерезис scroll-spy на финале 48px | сделано | `MainMap.tsx` → `pickActiveEl` |

### Схема id_map 12/13/14 (актуальная — не ломать)

| id_map | Слои |
|--------|------|
| **12** | только `historical_resettlement` (+ dynamic labels из `name`) |
| **13** | только `maki_selki` (+ dynamic labels) |
| **14** | `historical_resettlement` + все `finns_*` + inscription `12.geojson` |

После `python scripts/gen-layers.py` overrides применяются автоматически.

---

# ТЗ заказчика (следующая итерация)

## 1. Фикс глюка в конце рассказа

**Симптом:** на финальных абзацах (`longread-56-горные-активности`, id_map=23) текст «дёргается», мигает подсветка между `<p>`, фактом и соседними элементами.

**Уже пробовали:** гистерезис 28px → 48px на последнем item в `pickActiveEl` (`MainMap.tsx`).

**Направления доработки:**

- Увеличить `HYSTERESIS_PX` ещё (40–60) или debounce `setActiveLongreadElKey` (~80ms).
- На последнем item — монотонный порядок элементов (при скролле вверх не откатывать на более поздний абзац).
- Отключить autoscroll на `longread-56` / последнем item.
- Проверить, что `figcaption` не участвует в spy (уже исключены).
- Проверить финал: id_map=23, маршруты + viewpoints, без `mount` — см. session3 handoff.

**Файлы:** `src/MainMap.tsx` (`pickActiveEl`, scroll handler, autoscroll effect), `src/App.css` (`.longread-el`).

---

## 2. Подписи на карте — крупнее

**Запрос:** увеличить размер надписей (inscription / dynamic name labels).

**Где править:**

| Тип | Файл | Текущие размеры (zoom 11→13) |
|-----|------|------------------------------|
| Inscription id_map 1–11 | `ensureInscriptionOnMap` в `MainMap.tsx` | bold 10→12px |
| Inscription compact 12–20 | там же | regular 9→11px |
| Dynamic labels 12/13 | `ensureNameLabelsFromLayer` | 11→13px |

**Ориентир:** поднять на 1–2px на zoom ≥11, не ломая `text-allow-overlap: false` / `text-optional: true`.

---

## 3. id_map=7 — начинать с текста про вомитории

**Запрос:** при переключении на карту **id_map=7** (Вомитории) лонгрид и карта должны стартовать с абзаца:

> **Вомитории** — проходы, по которым зрители попадают к своим местам в амфитеатре. В окрестностях Петербурга их роль выполняют долины рек — Тосны, Ижоры, Дудергофки, Сестры и многих других, которые прорезают возвышенности и соединяют разные уровни рельефа.

**Сейчас в `fallbackLongread.ts`:**

| item | id_map | Текст |
|------|--------|-------|
| `longread-16-составляющие-амфитеатра` | **6** | вводка «…речные долины — вомитории» |
| `longread-17-составляющие-амфитеатра` | **6** | **нужный абзац про Вомитории** |
| `longread-18-составляющие-амфитеатра` | **7** | заключение + факт |

**Нужно:**

- Перенести `id_map: 7` на `longread-17` (первый абзац с полным текстом вомиториев).
- `firstItemIdForIdMap(contentItems, 7)` и выбор «Вомитории» в `MapLayerPanel` должны скроллить к `longread-17`, не к `longread-18`.
- При необходимости — override в `scripts/gen-fallback-longread.py` (`ID_MAP_OVERRIDES`), затем `python scripts/gen-fallback-longread.py`.

**Карта id_map 7:** `vomitoria` + `mask_amphitheater` — `section-overlays.json` sets `"7"`.

---

## 4. Вступление «Как работает метафора Амфитеатра?» — подсветка с первого экрана

**Запрос:** блок вступления должен **сразу** подсвечиваться поэлементно, как остальной лонгрид:

- «Как работает метафора Амфитеатра?» (subtitle)
- «Петербург принято считать плоским городом…»
- «Город расположен на Принёвской низине…»
- «Всего вокруг Петербурга…»
- «С этих высот открываются панорамные виды…»

**Сейчас:** items `longread-0` … `longread-4`, все `id_map: 1`, subtitle рендерится только на **первом** item группы (`subtitleChanged`). Scroll-spy (`pickActiveEl`) работает по `.longread-el[data-el-key]` внутри **активного** `activeItemId` — при старте активен `longread-0`, остальные абзацы в других items не подсвечиваются, пока не сменится item.

**Нужно:**

- Убедиться, что при загрузке / splash close активны subtitle + первый абзац `longread-0`.
- Autoscroll (п.5) должен проходить **все** абзацы вступления по очереди с подсветкой, не перескакивая сразу на Назарова (`longread-4`).
- Возможные подходы: autoscroll по `longread-el` (не только по item), или объединить вступительные абзацы в одну цепочку spy.

**Тексты** — в `fallbackLongread.ts` items `longread-0` … `longread-4` (уже соответствуют тексту заказчика).

---

## 5. Автопрокрутка текста 4–10 с по длине

**Запрос:** автоматическая прокрутка лонгрида **4–10 секунд** в зависимости от количества знаков.

**Уже есть:** `src/longreadAutoscroll.ts`:

```ts
MIN_DWELL_MS = 2000      // минимум на элемент
MIN_AUTO_MS = 4000       // минимум для длинного текста
MAX_AUTO_MS = 10000
MS_PER_CHAR = 40
// clamp(4000, charCount * 40, 10000)
```

**Сейчас:** autoscroll в `MainMap.tsx` переключает **`activeItemId`** (целый item), не отдельные `.longread-el` (абзац / subtitle / fact).

**Нужно:**

- Autoscroll по **элементам** внутри item (subtitle → text → media → fact) ИЛИ по item с корректным dwell.
- Формула 4–10 с — сверить с заказчиком; при необходимости убрать дублирование `Math.max(MIN_DWELL_MS, …)` с `MIN_AUTO_MS`.
- Пауза при ручном скролле: `autoscrollPausedRef` уже ставится в `true` на `scroll` — сохранить.

**Файлы:** `longreadAutoscroll.ts`, `MainMap.tsx` (autoscroll `useEffect` ~стр. 2376).

---

## 6. Запрет «пролистывания» — стоп минимум 2 сек

**Запрос:** читатель не должен быстро пролистнуть текст; **минимум ~2 сек** на элемент.

**Сейчас:** `MIN_DWELL_MS = 2000` только для **autoscroll**; ручной скролл **сразу** меняет `activeItemId` и останавливает autoscroll.

**Нужно (на выбор реализации):**

- **Rate-limit ручного скролла:** после смены активного `longread-el` / item блокировать смену следующего N мс (2 с).
- **Scroll snapping + programmatic lock:** временно `pointer-events: none` на list или `scroll-snap` с принудительным `scrollIntoView` обратно.
- **Autoscroll-only mode** с опциональным «ускорить» — обсудить с заказчиком, если жёсткий lock раздражает.

Минимум: ручной скролл не должен перескакивать через 3+ абзаца за один жест.

---

## 7. Вторая панель слоёв снизу (легенда) + кнопка «Слои» как сейчас

**Запрос:**

- **Кнопка «Слои»** (квадрат, справа на карте) — **оставить на месте** → открывает `MapLayerPanel` (сетка **карт** / id_map: Горы Петербурга, амфитеатр, финны…). Это **навигация по картам**.
- **Добавить вторую панель снизу** — как на **production** (https://spbmlaplus.github.io/SPb_Mountains/): чекбоксы **слоёв текущей карты** (легенда). Другой характер, не дублировать `MapLayerPanel`.

**Сейчас:**

| UI | Компонент | Позиция |
|----|-----------|---------|
| Карты (превью) | `MapLayerPanel.tsx` | popup / bottom sheet по кнопке «Слои» |
| Легенда слоёв | `OverlayTogglePanel.tsx` | desktop: `bottom: 16px; right: calc(650px + 16px)`; mobile: top-right под topbar |

**Нужно:**

- Перенести / продублировать **легенду** (`OverlayTogglePanel`) **вниз карты** (desktop и mobile), визуально ближе к production.
- `MapControls` + `MapLayerPanel` **не трогать** по позиции кнопки.
- Стили: `App.css` → `.overlay-toggle-panel`, media queries `@max-width: 768px`.

**Референс:** production site + `примеры_оформления_сайта/слои_телефонная_версия.png` (только для панели **карт**; легенда снизу — с production).

---

## QA-чеклист после реализации ТЗ

- [ ] Финал (`longread-56`, id_map=23): текст не дёргается при медленном скролле
- [ ] Подписи на карте читаемее (zoom 11+)
- [ ] Панель «Вомитории» / id_map=7 → скролл к абзацу про Тосну, Ижору, Дудергофку…
- [ ] Старт: вступление подсвечивается по абзацам, не сразу прыжок к Назарову
- [ ] Autoscroll: 4–10 с на блок, пауза при ручном скролле
- [ ] Ручной скролл: нельзя «пролететь» блок быстрее ~2 с
- [ ] Кнопка «Слои» — карты; снизу — легенда чекбоксов текущей карты
- [ ] Гл.3 финны: 12 → 13 → 14 без регрессии
- [ ] `npm run build` с `VITE_BASE_PATH=/`, preview http://localhost:4173/

---

## Точки входа в коде

| Что | Файл |
|-----|------|
| Scroll spy, autoscroll, финальный глюк | `src/MainMap.tsx` |
| Dwell по символам | `src/longreadAutoscroll.ts` |
| Подписи карты | `MainMap.tsx` → `ensureInscriptionOnMap`, `ensureNameLabelsFromLayer` |
| Лонгрид тексты / id_map | `src/fallbackLongread.ts`, `scripts/gen-fallback-longread.py` |
| Панель карт | `src/MapLayerPanel.tsx`, `src/MapControls.tsx` |
| Легенда слоёв | `src/OverlayTogglePanel.tsx`, `src/App.css` |
| Манифест слоёв | `src/assets/sections/section-overlays.json` |
| Mobile sheet | `src/MobileLongreadSheet.tsx` |

---

## Пайплайн после правок данных

```powershell
cd C:\Work\SPb_Mountains\SPb_Mountains
python scripts/gen-fallback-longread.py   # если менялся xlsx / id_map
python scripts/gen-layers.py              # если менялся LAYERS.csv (finns overrides встроены)
python scripts/copy-new-assets.py
$env:VITE_TILE_BASE_URL="https://spbmlaplus.github.io/spb_mountains_tiles"
$env:VITE_BASE_PATH="/"
npm run build
npx vite preview --host 0.0.0.0 --port 4173
```

---

## Контекст для агента

Заказчик итеративно правит UX лонгрида, карты и панели. Приоритет этой сессии — **ТЗ выше** (7 пунктов). После каждой серии — `npm run build` + визуальный QA.

По запросу: коммит + push в `main` → GitHub Pages (`VITE_BASE_PATH=/SPb_Mountains/` в CI).
