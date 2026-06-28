# Экспорт слоёв из QGIS-проекта (27.06.2026)

## Задача

Из проекта `C:\Work\SPb_Mountains\Горный Петербург_общая сборка_EP.qgz`:

1. Извлечь все слои и переписать их в `SPb_Mountains/new_files/layers`
2. Проверить систему координат **EPSG:3857**
3. Скопировать стили слоёв в `SPb_Mountains/new_files/style` с теми же именами
4. При дубликатах — перезаписывать существующие файлы

## Исходные данные

| Путь | Описание |
|------|----------|
| `Горный Петербург_общая сборка_EP.qgz` | QGIS-проект (zip-архив) |
| `_qgz_extract/Горный Петербург_общая сборка_EP.qgs` | Распакованный XML проекта |
| `layers/` | Локальная копия geojson-слоёв (30 файлов) |
| `C:\Users\MLA-U5\Downloads\Горный Петербург_общая сборка_EP\слои\` | Исходные слои из Downloads |
| `SPb_Mountains/new_files/layers/` | Целевая папка для геометрии |
| `SPb_Mountains/new_files/style/` | Целевая папка для стилей |

В проекте слои ссылаются на относительные пути `../слои/` и `../сайт/`. Оригинальные `.gpkg` из папки `сайт` на диске отсутствовали — использовались уже конвертированные `.geojson` из `new_files/layers` и `src/assets/layers`.

## Скрипт

Создан `C:\Work\SPb_Mountains\export_qgz_to_new_files.py`:

- Парсит дерево слоёв и `maplayer` из `.qgs`
- Ищет исходники по нескольким путям (приоритет `.geojson` над `.gpkg`)
- Перепроецирует векторные слои в **EPSG:3857** через `geopandas`
- Экспортирует векторы как `.geojson`, растр `relief_water1` как `.tif`
- Извлекает стили (`renderer-v2`, `labeling`, opacity и др.) в `.qml`
- Дедуплицирует слои по имени (например, `estate` встречался 6 раз — один файл)

Запуск:

```bash
python C:\Work\SPb_Mountains\export_qgz_to_new_files.py
```

## Экспортированные слои (32)

### Векторные `.geojson` (31)

| Имя файла | Группа в QGIS |
|-----------|---------------|
| `amphitheater_bound.geojson` | 0 |
| `sectors_level.geojson` | 0 |
| `isoline_2m.geojson` | 0 |
| `isoline_5m.geojson` | 0 |
| `mount.geojson` | 0 |
| `mount_polygon.geojson` | 0 |
| `mask_stage.geojson` | 3 |
| `mask_parter.geojson` | 4 |
| `mask_belletazh.geojson` | 5 |
| `mask_balcon.geojson` | 6 |
| `vomitoria.geojson` | 7 |
| `mask_amphitheater.geojson` | 7 |
| `landscape_450.geojson` | 8 |
| `landscape_12.geojson` | 9 |
| `landscape_7.geojson` | 10 |
| `landscape_2,5.geojson` | 11 |
| `Finns.geojson` | 12 |
| `historical_resettlement.geojson` | 12 |
| `maki_selki.geojson` | 13 |
| `estate.geojson` | 15–20 |
| `historical_zones_1.geojson` | 16 |
| `historical_zones_2.geojson` | 17 |
| `historical_zones_3.geojson` | 18 |
| `historical_zones_4.geojson` | 19 |
| `historical_zones_5.geojson` | 20 |
| `paragliding_clubs.geojson` | 22 |
| `horse_riding_clubs.geojson` | 22 |
| `ski_resorts.geojson` | 22 |
| `golf_clubs.geojson` | 22 |
| `motocross.geojson` | 22 |
| `walking_routes.geojson` | 22 |

### Растровый `.tif` (1)

| Имя файла | Группа в QGIS |
|-----------|---------------|
| `relief_water1.tif` | 0 |

## Экспортированные стили (31)

Для каждого векторного слоя создан `.qml` с тем же базовым именем:

`Finns.qml`, `amphitheater_bound.qml`, `estate.qml`, `golf_clubs.qml`, `historical_resettlement.qml`, `historical_zones_1.qml` … `historical_zones_5.qml`, `horse_riding_clubs.qml`, `isoline_2m.qml`, `isoline_5m.qml`, `landscape_12.qml`, `landscape_2,5.qml`, `landscape_450.qml`, `landscape_7.qml`, `maki_selki.qml`, `mask_amphitheater.qml`, `mask_balcon.qml`, `mask_belletazh.qml`, `mask_parter.qml`, `mask_stage.qml`, `motocross.qml`, `mount.qml`, `mount_polygon.qml`, `paragliding_clubs.qml`, `sectors_level.qml`, `ski_resorts.qml`, `vomitoria.qml`, `walking_routes.qml`

У растра `relief_water1` стиля в `new_files/style` нет (в QGIS это gdal-слой без векторного renderer-v2).

## Пропущенные слои

| Слой | Причина |
|------|---------|
| `Positron` | WMS/XYZ-подложка (`providerKey=wms`), не файловый слой |
| `Аннотации` | Пустой datasource, служебный слой QGIS |

## Проверка CRS

После экспорта проверено:

- Все 31 `.geojson` — **EPSG:3857**
- `relief_water1.tif` — **EPSG:3857**

## Дубликаты и замены

| Ситуация | Действие |
|----------|----------|
| `estate` — 6 экземпляров в дереве слоёв | Один `estate.geojson` + один `estate.qml` |
| `walking_routes.gpk_-_walking_routes.qml` | Удалён; заменён на `walking_routes.qml` |
| Существующие файлы в `new_files/` | Перезаписаны при совпадении имён |

## Ошибки при первом прогоне

`historical_resettlement` — не открылся исходный `.gpkg`. Исправлено: в скрипте добавлен fallback на `.geojson` с приоритетом над `.gpkg`. Повторный прогон — успешно.

## Не затронуто

В `new_files/layers` остались файлы **не из этого QGIS-проекта**:

- Нумерованные слои: `2.geojson` … `23.geojson`, `routes.geojson`
- Подслои финнов: `finns_*_count_*.geojson`
- Типы усадеб: `Вилла.geojson`, `Особняк.geojson`, …
- Точки/фото: `1_photo.geojson`, `23_1_points.geojson`, `23_2_viewshed.geojson`
- `.qmd` метаданные QGIS

Они не удалялись — в задаче был экспорт слоёв **из `.qgz`**, а не очистка всей папки.

## Итог

```
Экспортировано слоёв:  32 (31 geojson + 1 tif)
Экспортировано стилей: 31 qml
CRS:                   EPSG:3857 — подтверждён
Ошибок:                0 (после исправления fallback)
```
