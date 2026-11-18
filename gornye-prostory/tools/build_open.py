# -*- coding: utf-8 -*-
"""Открытые экосистемы, которые держат виды: луга, степи, болота, вырубки, открытые земли из LULC (25 м),
только там, где их видно хотя бы с одной смотровой точки (по media/vs/all.png), + доля открытых земель
в секторе каждой точки в радиусе 3 км (передний план).

  python3 tools/build_open.py "<Точки и виды>/LULC_25m.tif" .

Пишет media/open.png и data/open.js (window.GP_OPEN)."""
import sys, os, json, math
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
from pyproj import Transformer
from PIL import Image

LULC, SITE = sys.argv[1], sys.argv[2]
CLASSES = {'луга': ([9, 12], (190, 226, 110)), 'степи': ([7, 8], (232, 214, 120)), 'болота': ([11, 16], (120, 200, 190)),
           'вырубки': ([14], (214, 176, 130)), 'открытые земли': ([18], (235, 232, 222))}
ALPHA = 150                                         # поля — фон, а не главный акцент
js = open(os.path.join(SITE, 'data/views.js'), encoding='utf-8').read()
V = json.loads(js[js.index('{'):js.index(';\n(function')])
co = V['all']['coords']
ll2m = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)
(x0, y1), (x1, y0) = ll2m.transform(*co[0]), ll2m.transform(*co[2])
vis_png = np.array(Image.open(os.path.join(SITE, 'media/vs/all.png')).convert('RGBA'))
H, W = vis_png.shape[:2]
visible = vis_png[..., 3] < 90                      # светлое на картинке — видно хотя бы с одной точки
dst_tr = from_bounds(x0, y0, x1, y1, W, H)
with rasterio.open(LULC) as r:
    L = np.zeros((H, W), np.uint8)
    reproject(rasterio.band(r, 1), L, dst_transform=dst_tr, dst_crs='EPSG:3857', resampling=Resampling.nearest)
    A = r.read(1); TR = r.transform; CRS = r.crs
rgba = np.zeros((H, W, 4), np.uint8); area = {}
px_km2 = (x1 - x0) / W * (y1 - y0) / H * math.cos(math.radians((co[0][1] + co[2][1]) / 2)) ** 2 / 1e6
for name, (vals, col) in CLASSES.items():
    m = np.isin(L, vals) & visible
    rgba[m, :3] = col; rgba[m, 3] = ALPHA; area[name] = round(float(m.sum() * px_km2), 1)
Image.fromarray(rgba, 'RGBA').save(os.path.join(SITE, 'media/open.png'), optimize=True)
# поля, видимые с каждой точки и с каждой возвышенности: та же раскраска, обрезанная её зоной видимости
import base64, io
os.makedirs(os.path.join(SITE, 'media/open'), exist_ok=True)
jobs = [(v.get('img') or c, v['coords']) for c, v in V['views'].items()] + [(g['id'], g['coords']) for g in V['groups']]
for key, cc in jobs:
    src = os.path.join(SITE, 'media/vs', key + '.png')
    if not os.path.exists(src): continue
    a = np.array(Image.open(src).convert('RGBA')); h_, w_ = a.shape[:2]; vis = a[..., 3] < 60
    (ax0, ay1), (ax1, ay0) = ll2m.transform(*cc[0]), ll2m.transform(*cc[2])
    Lk = np.zeros((h_, w_), np.uint8)
    with rasterio.open(LULC) as r:
        reproject(rasterio.band(r, 1), Lk, dst_transform=from_bounds(ax0, ay0, ax1, ay1, w_, h_), dst_crs='EPSG:3857', resampling=Resampling.nearest)
    out = np.zeros((h_, w_, 4), np.uint8)
    for name, (vals, col) in CLASSES.items():
        m = np.isin(Lk, vals) & vis; out[m, :3] = col; out[m, 3] = ALPHA
    buf = io.BytesIO(); Image.fromarray(out, 'RGBA').save(buf, 'PNG', optimize=True); data = buf.getvalue()
    open(os.path.join(SITE, 'media/open', key + '.png'), 'wb').write(data)
    open(os.path.join(SITE, 'media/open', key + '.js'), 'w').write("(window.GP_IMG=window.GP_IMG||{})['open/%s']='data:image/png;base64,%s';\n" % (key, base64.b64encode(data).decode()))
print('поля по точкам и возвышенностям:', len(jobs), flush=True)
# передний план каждой точки: сектор, 3 км
to = Transformer.from_crs('EPSG:4326', CRS, always_xy=True)
stats = {}
for f in V['points']:
    p = f['properties']; lng, lat = f['geometry']['coordinates']; x, y = to.transform(lng, lat)
    c0, r0 = ~TR * (x, y); c0, r0 = int(c0), int(r0); n = int(3000 / TR.a)
    win = A[max(0, r0 - n):r0 + n + 1, max(0, c0 - n):c0 + n + 1]
    yy, xx = np.mgrid[max(0, r0 - n) - r0:min(A.shape[0], r0 + n + 1) - r0, max(0, c0 - n) - c0:min(A.shape[1], c0 + n + 1) - c0]
    inside = xx ** 2 + yy ** 2 <= n * n
    s0, sw = p['sector']
    if sw < 360:
        az = (np.degrees(np.arctan2(xx, -yy)) + 360) % 360
        inside &= ((az - s0) % 360) <= sw
    tot = inside.sum() or 1
    st = {name: round(float((np.isin(win, vals) & inside).sum() / tot * 100)) for name, (vals, _) in CLASSES.items()}
    st['лес'] = round(float((np.isin(win, [1, 2, 3, 13, 21]) & inside).sum() / tot * 100))
    st['застройка'] = round(float((np.isin(win, [5]) & inside).sum() / tot * 100))
    st['вода'] = round(float((np.isin(win, [15]) & inside).sum() / tot * 100))
    stats[p['code']] = st
with open(os.path.join(SITE, 'data/open.js'), 'w', encoding='utf-8') as fh:
    fh.write('/* Открытые экосистемы, которые держат виды (LULC 25 м). Собрано tools/build_open.py */\n')
    fh.write('window.GP_OPEN = ' + json.dumps(dict(coords=co, area=area, stats=stats), ensure_ascii=False, separators=(',', ':')) + ';\n')
print('готово', area)
d = open(os.path.join(SITE, 'media/open.png'), 'rb').read()
open(os.path.join(SITE, 'media/open.js'), 'w').write("(window.GP_IMG=window.GP_IMG||{})['open']='data:image/png;base64,%s';\n" % base64.b64encode(d).decode())
