# -*- coding: utf-8 -*-
"""Строгий пересчёт: какие доминанты реально видно с каждой смотровой точки.

Что строже, чем в build_viewpoints.py:
  1. Дома из базы доминант (существующие и строящиеся) вжигаются в модель поверхности со своей высотой:
     в FABDEM высотки почти всегда ниже настоящих и не закрывают вид.
  2. Деревья у самой точки учитываются с 40 м (было 80 м): человек ростом 1,7 м смотрит сквозь просвет,
     а не поверх леса.
  3. Доминанта считается видимой, только если она не дальше 25 км (Лахта-центр, телебашня и другие выше 200 м — в пределах 30 км) и над препятствиями выступает не меньше 15 м
     и не меньше 0,25° по вертикали (≈ 44 м на 10 км, ≈ 87 м на 20 км): меньшее в дымке над городом
     глаз не выделяет как отдельный объём.
  2а. Высота леса в FABDEM занижена, кроны подняты в 1,5 раза (не выше 40 м).
  4. Будущие дома (запроектированные) не закрывают вид и не считаются «видимыми сейчас»: их показываем
     отдельно как «войдут в панораму».
Пересчитывает views[*].doms, lm, prof и поля lakhta_m / tv_m / isaac_m у точек. Правит data/views.js на месте.

  python3 tools/recompute_doms.py . "<папка с FABDEM*.tif>"
"""
import sys, os, json, math, subprocess
import numpy as np, rasterio
from rasterio.warp import reproject, Resampling, calculate_default_transform
from rasterio.features import rasterize
from scipy import ndimage
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as stransform

SITE, RAST = sys.argv[1], sys.argv[2]
CELL, RADIUS, EYE, K = 25.0, 30000, 1.7, 0.13
CURV = (1 - K) / (2 * 6371000)
NEAR, MIN_M, MIN_DEG, MAX_KM, TREE_K = 40.0, 15.0, 0.25, 25.0, 1.5
LANDMARKS = [('lakhta', 30.1777, 59.9871, 462), ('tv', 30.3218, 59.9767, 326), ('isaac', 30.3061, 59.9340, 101.5)]
UTM = 'EPSG:32636'; to_utm = Transformer.from_crs(4326, 32636, always_xy=True)

js = r'''global.window={};for(const f of ["base","epochs","labels","media","threats"]) try{require(process.argv[1]+"/data/"+f+".js")}catch(e){}
const D=window.GP_DATA;process.stdout.write(JSON.stringify({dominants:D.dominants,dom_poly:D.dom_poly,mount:D.mount}));'''
D = json.loads(subprocess.check_output(['node', '-e', js, os.path.abspath(SITE)]))
p = os.path.join(SITE, 'data/views.js'); T = open(p, encoding='utf-8').read()
i0, i1 = T.index('{'), T.index(';\n(function'); V = json.loads(T[i0:i1])

def load(path):
    with rasterio.open(path) as r:
        tr, w, h = calculate_default_transform(r.crs, UTM, r.width, r.height, *r.bounds, resolution=CELL)
        out = np.full((h, w), np.nan, np.float32)
        reproject(rasterio.band(r, 1), out, dst_transform=tr, dst_crs=UTM, resampling=Resampling.bilinear, dst_nodata=np.nan, src_nodata=r.nodata)
    return out, tr
print('рельеф…', flush=True)
DTM, TR = load(os.path.join(RAST, 'FABDEM.tif')); DSM, _ = load(os.path.join(RAST, 'FABDEM_building_tree.tif'))
DTM = np.where(np.isfinite(DTM) & (DTM > -50), DTM, 0).astype(np.float32)
DSM = np.where(np.isfinite(DSM) & (DSM > -50), DSM, DTM).astype(np.float32); DSM = np.maximum(DSM, DTM)
TREE, _ = load(os.path.join(RAST, 'FABDEM_tree.tif')); BLD, _ = load(os.path.join(RAST, 'FABDEM_building.tif'))
TREE = np.where(np.isfinite(TREE) & (TREE > -50), TREE, DTM); BLD = np.where(np.isfinite(BLD) & (BLD > -50), BLD, DTM)
TREE_H = np.clip(TREE - DTM, 0, 60).astype(np.float32); BLD_H = np.clip(BLD - DTM, 0, 300).astype(np.float32); del TREE, BLD
# лес в FABDEM ниже настоящего (в Шуваловском парке ~12 м вместо 20–30): поднимаем кроны в 1,5 раза
TREE_H = (TREE_H * TREE_K).clip(0, 40); DSM = np.maximum(DSM, DTM + TREE_H)
X0, Y0 = TR.c, TR.f
def rc(x, y): return (Y0 - y) / CELL - 0.5, (x - X0) / CELL - 0.5
def sample(A, x, y):
    r, c = rc(np.asarray(x), np.asarray(y)); return ndimage.map_coordinates(A, [r, c], order=1, mode='constant', cval=0.0)

# дома из базы доминант — в модель поверхности
props = {f['properties']['i']: f['properties'] for f in D['dominants']['features']}
proj = lambda x, y, z=None: to_utm.transform(x, y)
shapes_ = []
for f in D['dom_poly']['features']:
    pr = props.get(f['properties']['i'])
    if not pr or pr.get('status') == 'потенциальная (дом.рф)' or not pr.get('height_m'): continue
    g = stransform(proj, shape(f['geometry']))
    c = g.representative_point(); top = float(sample(DTM, [c.x], [c.y])[0]) + float(pr['height_m'])
    shapes_.append((g, top))
burn = rasterize(shapes_, out_shape=DSM.shape, transform=TR, fill=0, all_touched=True, dtype='float32', merge_alg=rasterio.enums.MergeAlg.replace)
before = DSM.copy(); DSM = np.maximum(DSM, burn); print('вожжено домов:', len(shapes_), 'клеток выше:', int((DSM > before + 1).sum()), flush=True); del before, burn
BLD_H = np.maximum(BLD_H, DSM - DTM - TREE_H).clip(0, 300)

doms = D['dominants']['features']
dx_, dy_ = map(np.array, to_utm.transform([f['geometry']['coordinates'][0] for f in doms], [f['geometry']['coordinates'][1] for f in doms]))
dh = np.array([float(f['properties'].get('height_m') or 0) for f in doms]); dground = sample(DTM, dx_, dy_)
fut = np.array([f['properties'].get('status') == 'потенциальная (дом.рф)' for f in doms])
mounts = [(f['geometry']['coordinates'], f['properties']) for f in D['mount']['features'] if f['properties'].get('name')]

def in_sector(az, sec): return ((np.asarray(az) - sec[0]) % 360) <= sec[1] + 1e-6
def los(ox, oy, eye, tx, ty, top, far_skip=60):
    D_ = math.hypot(tx - ox, ty - oy); n = max(2, int(D_ / CELL)); t = np.linspace(0, 1, n + 1)[1:-1]; d = t * D_
    k = (d > NEAR) & (d < D_ - far_skip)
    if not k.any(): return top - eye
    z = sample(DSM, ox + (tx - ox) * t[k], oy + (ty - oy) * t[k]) - d[k] ** 2 * CURV
    S = np.max((z - eye) / d[k]); return (top - D_ * D_ * CURV) - (eye + S * D_)
def seen(vis, D_, h=0): return vis >= MIN_M and vis / D_ >= math.tan(math.radians(MIN_DEG)) and (D_ <= MAX_KM * 1000 or h >= 200)

tot0 = tot1 = 0
for f in V['points']:
    pr = f['properties']; code = pr['code']; v = V['views'].get(code)
    if not v: continue
    lng, lat = f['geometry']['coordinates']; sec = pr['sector']; ox, oy = to_utm.transform(lng, lat)
    # наблюдатель — на самой высокой открытой земле в радиусе 50 м (как в основном расчёте)
    r0, c0 = map(lambda q: int(round(q)), rc(ox, oy)); RR = 2
    sg, ss = DTM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1], DSM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1]
    yy0, xx0 = np.mgrid[-RR:RR + 1, -RR:RR + 1]; cand = np.where((xx0 ** 2 + yy0 ** 2 <= RR ** 2) & (ss - sg < 2.5), sg, -1e9)
    g0 = float(sample(DTM, [ox], [oy])[0])
    if cand.max() > -1e8:
        bi = np.unravel_index(np.argmax(cand), cand.shape)
        if cand[bi] > g0 + 1.0: ox += xx0[bi] * CELL; oy -= yy0[bi] * CELL
    eye = float(sample(DTM, [ox], [oy])[0]) + EYE
    dd = np.hypot(dx_ - ox, dy_ - oy); daz = (np.degrees(np.arctan2(dx_ - ox, dy_ - oy)) + 360) % 360
    out = []
    for i in np.where((dd > 250) & (dd < RADIUS) & in_sector(daz, sec))[0]:
        vis = los(ox, oy, eye, dx_[i], dy_[i], dground[i] + dh[i])
        if seen(vis, dd[i], dh[i]): out.append([int(doms[i]['properties']['i']), round(float(min(vis, dh[i])), 1)])
    tot0 += len(v['doms']); tot1 += len(out); v['doms'] = out
    lm = {}
    for name, lo, la, h in LANDMARKS:
        tx, ty = to_utm.transform(lo, la); a_ = (math.degrees(math.atan2(tx - ox, ty - oy)) + 360) % 360
        vis = los(ox, oy, eye, tx, ty, float(sample(DTM, [tx], [ty])[0]) + h)
        lm[name] = round(max(0.0, min(h, vis)), 0) if in_sector(a_, sec) and seen(vis, math.hypot(tx - ox, ty - oy), h) else 0
    v['lm'] = lm; pr['lakhta_m'], pr['tv_m'], pr['isaac_m'] = lm['lakhta'], lm['tv'], lm['isaac']
    # разрез — на самую заметную видимую историческую доминанту, иначе инженерную, иначе Лахта-центр, иначе середина сектора
    byi = {int(doms[j]['properties']['i']): j for j in range(len(doms))}
    best = None
    for cls in ('Историческая', 'Инженерная'):
        c_ = [(m / dd[byi[i]], i) for i, m in out if props[i].get('class') == cls and props[i].get('name') and not fut[byi[i]]]
        if c_:
            _, i = max(c_); j = byi[i]; best = dict(name=props[i]['name'], h=float(props[i].get('height_m') or 0), kind=cls.lower(), xy=(dx_[j], dy_[j])); break
    if not best and lm['lakhta']:
        x_, y_ = to_utm.transform(30.1777, 59.9871); best = dict(name='Лахта-центр', h=462.0, kind='инженерная', xy=(x_, y_))
    if not best:
        a_ = math.radians(sec[0] + sec[1] / 2) if sec[1] < 360 else math.atan2(*[q - o for q, o in zip(to_utm.transform(30.3061, 59.9340), (ox, oy))])
        best = dict(name='', h=0.0, kind='', xy=(ox + 15000 * math.sin(a_), oy + 15000 * math.cos(a_)))
    tx, ty = best['xy']; L = math.hypot(tx - ox, ty - oy); t_ = np.linspace(0, 1, 181); px, py = ox + (tx - ox) * t_, oy + (ty - oy) * t_
    prof = dict(km=round(L / 1000, 2), g=[round(float(x), 1) for x in sample(DTM, px, py)],
                t=[int(round(float(x))) for x in sample(TREE_H, px, py)], b=[int(round(float(x))) for x in sample(BLD_H, px, py)],
                name=best['name'], h=round(best['h']), kind=best['kind'], m=[])
    ux, uy = (tx - ox) / L, (ty - oy) / L
    for mc, mp in mounts:
        mx_, my_ = to_utm.transform(*mc); along = (mx_ - ox) * ux + (my_ - oy) * uy; off = abs(-(mx_ - ox) * uy + (my_ - oy) * ux)
        if 300 < along < L - 300 and off < 1200: prof['m'].append([mp['name'], round(along / L, 3), mp.get('type') or ''])
    v['prof'] = prof
    print(code, pr.get('name'), '| доминант', len(out), '| разрез на', best['name'] or '—', '| Лахта', lm['lakhta'], 'ТВ', lm['tv'], 'Исаакий', lm['isaac'], flush=True)
print('всего было', tot0, 'стало', tot1)
T = T[:i0] + json.dumps(V, ensure_ascii=False, separators=(',', ':')) + T[i1:]
T = T.replace("if(m < Math.max(8, 0.2 * (+f.properties.height_m || 0))) return;", "")
open(p, 'w', encoding='utf-8').write(T)
