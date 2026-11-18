# -*- coding: utf-8 -*-
"""Рисунок «Петербургский амфитеатр» в 3D: ярусы ступенями (сцена → партер → бельэтаж → балкон),
цвета как на плоской схеме, линии и штриховка — в духе рукописных рисунков геологии (тушь по бумаге в точку).

  python3 tools/draw_amphitheater.py layers.json media/story/amphitheater.webp
layers.json — mask_stage / mask_parter / mask_belletazh / mask_balcon из data/epochs.js (GeoJSON, EPSG:4326)."""
import sys, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage
from rasterio.features import rasterize
from rasterio.transform import from_bounds

L = json.load(open(sys.argv[1], encoding='utf-8')); OUT = sys.argv[2]
TIERS = [('mask_stage', 'СЦЕНА', (118, 150, 134)), ('mask_parter', 'ПАРТЕР', (146, 186, 168)),
         ('mask_belletazh', 'БЕЛЬЭТАЖ', (192, 223, 202)), ('mask_balcon', 'БАЛКОН', (251, 232, 185))]
WATER = (220, 231, 245); INK = (35, 38, 40); PAPER = (253, 252, 248)
random.seed(4)

# сетка в «метрах» (равнопромежуточно по широте 60°)
xs, ys = [], []
def walk(c):
    if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
    else: [walk(q) for q in c]
for k, *_ in TIERS: [walk(f['geometry']['coordinates']) for f in L[k]['features']]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
kx = math.cos(math.radians((y0 + y1) / 2))
W = 900; H = int(W * (y1 - y0) / ((x1 - x0) * kx))
tr = from_bounds(x0, y0, x1, y1, W, H)
cls = np.zeros((H, W), np.uint8)
for i, (k, *_r) in enumerate(TIERS, 1):
    m = rasterize([(f['geometry'], 1) for f in L[k]['features']], out_shape=(H, W), transform=tr, fill=0, dtype='uint8')
    cls[(m > 0) & (cls == 0)] = i
cls = ndimage.median_filter(cls, 5)
land = cls > 0
holes = ndimage.binary_fill_holes(land) & ~land          # залив и Нева внутри амфитеатра
outside = ~land & ~holes
lab, n = ndimage.label(outside)
edge_ids = set(np.unique(np.r_[lab[:, 0], lab[:H // 2, -1]])) - {0}
# вода залива — та часть «снаружи», что касается левого края в средней полосе (залив открыт на запад)
left = set(np.unique(lab[int(H * .25):int(H * .75), 0])) - {0}
water = holes | np.isin(lab, list(left))

# высоты ярусов: ступени амфитеатра (вода ниже сцены)
LEVEL = np.array([0, 1, 2, 3, 4], np.float32)
hgt = LEVEL[cls].astype(np.float32)
hgt[water] = -0.35
hgt[~land & ~water] = np.nan

# проекция: смотрим с юга-юго-востока сверху, наклон и вертикальная «утрировка»
TILT, STEP = 0.55, 13.0           # сжатие по вертикали и высота ступени, px
PAD_T, PAD_B = 60, 120
S = 1.25
Wo, Ho = int(W * S) + 80, int(H * S * TILT) + int(4 * STEP * S) + PAD_T + PAD_B
img = np.full((Ho, Wo, 3), PAPER, np.uint8)
# бумага в точку
for yy in range(12, Ho, 18):
    for xx in range(10, Wo, 18): img[yy:yy + 2, xx:xx + 2] = (205, 203, 196)
zbuf = np.full((Ho, Wo), -1e9, np.float32)
top_id = np.full((Ho, Wo), -1, np.int32)      # что видно сверху: индекс клетки (для обводок)
cols = np.arange(W)
def shade(c, f): return tuple(int(v * f) for v in c)
base_y = PAD_T + int(4 * STEP * S)
for r in range(H):                             # от севера (дальше) к югу (ближе)
    hr = hgt[r]; ok = ~np.isnan(hr)
    if not ok.any(): continue
    sx = (40 + cols[ok] * S).astype(int)
    ytop = (base_y + r * S * TILT - hr[ok] * STEP * S).astype(int)
    ybot = np.full(len(sx), int(base_y + r * S * TILT + 0.35 * STEP * S + 2))
    cc = cls[r, ok]; ww = water[r, ok]
    for j in range(len(sx)):
        x = sx[j]
        for dx in (0, 1):
            X = x + dx
            if X >= Wo: continue
            t, b = ytop[j], min(ybot[j], Ho - 1)
            if ww[j]: topc = WATER; wallc = shade(WATER, .9)
            else:
                c0 = TIERS[cc[j] - 1][2]; topc = c0; wallc = shade(c0, .78)
            img[t:b, X] = wallc
            img[t:t + 2, X] = topc
            top_id[t:t + 2, X] = r * W + np.flatnonzero(ok)[j]
    # штриховка стенок: вертикальные штрихи тушью
# верхние поверхности заново (чтобы стенки дальних клеток не перекрывали поверхность) — повторный проход только поверхностей
img2 = img.copy()
for r in range(H):
    hr = hgt[r]; ok = ~np.isnan(hr)
    if not ok.any(): continue
    idx = np.flatnonzero(ok)
    sx = (40 + idx * S).astype(int); ytop = (base_y + r * S * TILT - hr[ok] * STEP * S).astype(int)
    hn = hgt[min(r + 1, H - 1), ok]
    for j in range(len(sx)):
        c0 = WATER if water[r, idx[j]] else TIERS[cls[r, idx[j]] - 1][2]
        img2[ytop[j]:ytop[j] + 2, sx[j]:sx[j] + 2] = c0
img = img2

# обводки тушью: границы ярусов и берег — по верху ступеней, с лёгким дрожанием руки
pil = Image.fromarray(img); d = ImageDraw.Draw(pil)
def proj(r, c, h): return (40 + c * S, base_y + r * S * TILT - h * STEP * S)
edges = (cls != np.roll(cls, 1, 0)) | (cls != np.roll(cls, 1, 1)) | (water != np.roll(water, 1, 0)) | (water != np.roll(water, 1, 1))
edges &= ~np.isnan(hgt)
rr, cc_ = np.nonzero(edges)
for r, c in zip(rr[::1], cc_[::1]):
    h = max(hgt[r, c], hgt[r - 1, c] if r else 0, hgt[r, c - 1] if c else 0)
    if np.isnan(h): continue
    X, Y = proj(r, c, h); j = random.uniform(-.4, .4)
    d.point((X + j, Y + j), fill=INK); d.point((X + 1 + j, Y), fill=INK)
# вертикальные штрихи на обрывах между ярусами (как на рисунке уступа)
for r in range(1, H - 1, 1):
    for c in range(0, W, 7):
        h, hs = hgt[r, c], hgt[r + 1, c]
        if np.isnan(h) or np.isnan(hs) or h - hs < 0.9: continue
        X, Yt = proj(r, c, h); _, Yb = proj(r + 1, c, hs)
        d.line([(X + random.uniform(-.5, .5), Yt + 1), (X + random.uniform(-1, 1), Yb)], fill=shade(INK, 1.0), width=1)
# внешний край балкона — обрыв к равнине: штрихи и тень
for r in range(1, H - 1):
    for c in range(0, W, 6):
        if land[r, c] and np.isnan(hgt[r + 1, c]):
            X, Yt = proj(r, c, hgt[r, c]); Yb = base_y + (r + 1) * S * TILT + 0.35 * STEP * S
            d.line([(X, Yt), (X + random.uniform(-1, 1), Yb)], fill=INK, width=1)
# рябь на воде
for r in range(4, H, 9):
    for c in range(0, W, 23):
        if water[r, c] and water[r, min(c + 8, W - 1)]:
            X, Y = proj(r, c, -0.35); d.line([(X, Y), (X + 7, Y - 1), (X + 12, Y)], fill=(150, 170, 200), width=1)
# ёлочки и вершины на бельэтаже и балконе
for _ in range(70):
    r, c = random.randrange(H), random.randrange(W)
    if cls[r, c] in (3, 4) and not water[r, c]:
        X, Y = proj(r, c, hgt[r, c])
        d.line([(X, Y), (X, Y - 9)], fill=INK); d.line([(X - 4, Y - 2), (X, Y - 10), (X + 4, Y - 2)], fill=INK)
pil = pil.filter(ImageFilter.SMOOTH)
d = ImageDraw.Draw(pil)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 22)
Fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 15)
# подписи ярусов — в южной части, где ступени видны лучше всего, с выноской
for i, (k, name, col) in enumerate(TIERS, 1):
    m = (cls == i) & ~water
    rows = np.nonzero(m.any(1))[0]
    r = int(np.percentile(rows, 88)); cs = np.nonzero(m[r])[0]; c = int(np.median(cs))
    X, Y = proj(r, c, hgt[r, c])
    tx, ty = X + 30 + i * 6, Y + 40 + i * 4
    d.line([(X, Y), (tx - 4, ty + 8)], fill=INK, width=1); d.ellipse([X - 2, Y - 2, X + 2, Y + 2], fill=INK)
    d.text((tx, ty), name, fill=INK, font=F)
d.text((40, Ho - 50), 'Петербургский амфитеатр: сцена, партер, бельэтаж, балкон', fill=INK, font=Fs)
pil.save(OUT, 'WEBP', quality=88)
print(OUT, pil.size)
