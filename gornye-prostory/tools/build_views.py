# -*- coding: utf-8 -*-
"""Видовые точки: правки из «Точки и виды», зоны видимости, силуэты и профили по FABDEM.

  python3 tools/build_views.py <папка «Точки и виды»> <папка с FABDEM.tif и FABDEM_building_tree.tif> .

Что делает:
  1. применяет правки tools/views_spec.py: удаляет, переносит и добавляет точки, меняет трек БГТ, добавляет горы;
  2. переводит фото (в т. ч. HEIC) в media/vp/<id>.webp и превью .t.webp;
  3. для каждой точки по модели FABDEM с домами и лесом (FABDEM_building_tree) считает:
     - зону видимости в радиусе 30 км (глаз 1,7 м над голой землёй FABDEM, ближние 80 м считаются открытыми) → media/vs/<код>.png;
     - линию горизонта по кругу (силуэт), какие доминанты и ориентиры реально поднимаются над горизонтом;
     - профиль высот от точки до Исаакия (земля и дома/лес);
  4. пишет data/views.js — он подгружается после data/threats.js и заменяет точки в GP_DATA.
Метод: лучи через 0,05°, шаг 25 м, поправка на кривизну Земли и рефракцию k = 0,13."""
import sys, os, json, math, subprocess, re
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, calculate_default_transform
from rasterio.transform import from_origin
from pyproj import Transformer
from scipy import ndimage
from PIL import Image, ImageOps
import pillow_heif
pillow_heif.register_heif_opener()

SRC, RAST, SITE = sys.argv[1], sys.argv[2], sys.argv[3]
DOCX_MEDIA = sys.argv[4] if len(sys.argv) > 4 else None
sys.path.insert(0, os.path.join(SITE, 'tools'))
from views_spec import DELETE, DROP_PHOTOS, EDIT, NEW, MOUNTS

UTM = 'EPSG:32636'
CELL = 25.0
RADIUS = 30000
EYE = 1.7
K = 0.13
CURV = (1 - K) / (2 * 6371000)
LANDMARKS = [('lakhta', 30.1777, 59.9871, 462), ('tv', 30.3218, 59.9767, 326), ('isaac', 30.3061, 59.9340, 101.5)]
ISAAC = (30.3061, 59.9340)

# ---------- данные сайта ----------
js = r'''global.window={};for(const f of ["base","threats"]) require(process.argv[1]+"/data/"+f+".js");
const D=window.GP_DATA, o={};for(const k of ["vp_old","vp_new","mount","dominants","photo_points","sightlines","sectors","trail"]) o[k]=D[k];
require(process.argv[1]+"/data/media.js"); o._media=window.GP_MEDIA; process.stdout.write(JSON.stringify(o));'''
D = json.loads(subprocess.check_output(['node', '-e', js, os.path.abspath(SITE)]))
MEDIA = D.pop('_media')

to_utm = Transformer.from_crs('EPSG:4326', UTM, always_xy=True)
to_ll = Transformer.from_crs(UTM, 'EPSG:4326', always_xy=True)
m2ll = Transformer.from_crs('EPSG:3857', 'EPSG:4326', always_xy=True)
ll2m = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)

# ---------- рельеф в UTM, 25 м ----------
def load(path):
    with rasterio.open(path) as r:
        tr, w, h = calculate_default_transform(r.crs, UTM, r.width, r.height, *r.bounds, resolution=CELL)
        out = np.full((h, w), np.nan, np.float32)
        reproject(rasterio.band(r, 1), out, dst_transform=tr, dst_crs=UTM, resampling=Resampling.bilinear, dst_nodata=np.nan, src_nodata=r.nodata)
    return out, tr
print('рельеф…', flush=True)
DTM, TR = load(os.path.join(RAST, 'FABDEM.tif'))
DSM, TR2 = load(os.path.join(RAST, 'FABDEM_building_tree.tif'))
assert TR == TR2 and DTM.shape == DSM.shape
DTM = np.where(np.isfinite(DTM) & (DTM > -50), DTM, 0).astype(np.float32)
DSM = np.where(np.isfinite(DSM) & (DSM > -50), DSM, DTM).astype(np.float32)
DSM = np.maximum(DSM, DTM)
X0, Y0 = TR.c, TR.f
H, W = DTM.shape
def rc(x, y): return (Y0 - y) / CELL - 0.5, (x - X0) / CELL - 0.5
def sample(A, x, y):
    r, c = rc(np.asarray(x), np.asarray(y))
    return ndimage.map_coordinates(A, [r, c], order=1, mode='constant', cval=0.0)
print('сетка', W, 'x', H, flush=True)

# ---------- фото ----------
os.makedirs(os.path.join(SITE, 'media/vp'), exist_ok=True)
os.makedirs(os.path.join(SITE, 'media/vs'), exist_ok=True)
os.makedirs(os.path.join(SITE, 'media/mount'), exist_ok=True)
def save_photo(name, out_base, thumb=True):
    p = os.path.join(DOCX_MEDIA, name[5:]) if name.startswith('docx:') else os.path.join(SRC, name)
    im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
    big = im.copy(); big.thumbnail((1800, 1800), Image.LANCZOS); big.save(out_base + '.webp', 'WEBP', quality=80, method=6)
    if thumb:
        t = im.copy(); t.thumbnail((560, 560), Image.LANCZOS); t.save(out_base + '.t.webp', 'WEBP', quality=74, method=6)

# ---------- точки ----------
def code_n(code): return int(code[3:])
points = []
for kind, key in (('new', 'vp_new'), ('old', 'vp_old')):
    for f in D[key]['features']:
        p = dict(f['properties']); code = p['code']
        if code in DELETE: continue
        e = EDIT.get(code, {})
        lng, lat = f['geometry']['coordinates']
        if 'll' in e: lat, lng = e['ll']; p['moved'] = 1
        if e.get('name'): p['name'] = e['name']
        if e.get('status'): p['status'] = e['status']
        if e.get('about'): p['about'] = e['about']
        if 'photos' in e:
            ids = []
            for k, fn in enumerate(e['photos']):
                pid = 'n%02d%02d' % (code_n(code), k + 1); save_photo(fn, os.path.join(SITE, 'media/vp', pid)); ids.append(pid)
            p['photos'] = ','.join(ids)
        elif kind == 'old':
            p['photos'] = ','.join(x for x in str(p.get('photos') or '').split(',') if x and x not in DROP_PHOTOS)
        points.append(dict(kind=kind, key=key, code=code, lng=lng, lat=lat, p=p))
caps = {}
for s in NEW:
    p = dict(code=s['code'], n=code_n(s['code']), name=s['name'], status='новая', about=s['about'], ridge=s['ridge'])
    ids = []
    for k, fn in enumerate(s['photos']):
        pid = 'n%02d%02d' % (p['n'], k + 1); save_photo(fn, os.path.join(SITE, 'media/vp', pid)); ids.append(pid)
        if s.get('caps', {}).get(k + 1): caps[pid] = s['caps'][k + 1]
    p['photos'] = ','.join(ids)
    points.append(dict(kind='old', key='vp_old', code=s['code'], lng=s['ll'][1], lat=s['ll'][0], p=p))
print(len(points), 'точек', flush=True)

# ---------- сектор, ближайшая вершина ----------
def in_poly(pt, geom):
    from shapely.geometry import shape, Point
    return shape(geom).contains(Point(pt))
mounts = [(f['geometry']['coordinates'], f['properties']) for f in D['mount']['features']]
def km(a, b):
    dx = (a[0] - b[0]) * 111.32 * math.cos(math.radians((a[1] + b[1]) / 2)); dy = (a[1] - b[1]) * 110.54
    return math.hypot(dx, dy)

# ---------- доминанты в UTM ----------
doms = D['dominants']['features']
dx_, dy_ = to_utm.transform([f['geometry']['coordinates'][0] for f in doms], [f['geometry']['coordinates'][1] for f in doms])
dx_, dy_ = np.array(dx_), np.array(dy_)
dh = np.array([float(f['properties'].get('height_m') or 0) for f in doms])
dground = sample(DTM, dx_, dy_)

def los_visible(ox, oy, eye_abs, tx, ty, top_abs, near=80, far_skip=60):
    """Сколько метров объекта видно над преградами (в «кажущихся» высотах с кривизной)."""
    D_ = math.hypot(tx - ox, ty - oy)
    if D_ < 150: return top_abs - eye_abs
    n = max(2, int(D_ / CELL))
    t = np.linspace(0, 1, n + 1)[1:-1]; d = t * D_
    keep = (d > near) & (d < D_ - far_skip)
    if not keep.any(): return top_abs
    xs, ys, d = ox + (tx - ox) * t[keep], oy + (ty - oy) * t[keep], d[keep]
    z = sample(DSM, xs, ys) - d * d * CURV
    S = np.max((z - eye_abs) / d)
    seen_from = eye_abs + S * D_
    return (top_abs - D_ * D_ * CURV) - seen_from

NR, NS = 7200, int(RADIUS / CELL)
ang = np.arange(NR) * 2 * np.pi / NR                    # от севера по часовой
dist = (np.arange(1, NS + 1) * CELL).astype(np.float32)
SIN, COS = np.sin(ang).astype(np.float32), np.cos(ang).astype(np.float32)

out = {}
for P in points:
    code = P['code']; lng, lat = P['lng'], P['lat']
    ox, oy = to_utm.transform(lng, lat)
    # наблюдатель встаёт на самую высокую открытую землю в радиусе 120 м (координаты из поля часто у подножия или в стороне от бровки)
    r0, c0 = rc(ox, oy); r0, c0 = int(round(r0)), int(round(c0)); RR = int(120 / CELL)
    sub_g = DTM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1]; sub_s = DSM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1]
    yy0, xx0 = np.mgrid[-RR:RR + 1, -RR:RR + 1]; circ = xx0 ** 2 + yy0 ** 2 <= RR ** 2
    cand = np.where(circ & (sub_s - sub_g < 2.5), sub_g, -1e9)
    if cand.max() < -1e8: cand = np.where(circ, sub_g, -1e9)
    g0 = float(sample(DTM, [ox], [oy])[0]); bi = np.unravel_index(np.argmax(cand), cand.shape)
    shift = 0.0
    if cand[bi] > g0 + 1.5:
        ox += xx0[bi] * CELL; oy -= yy0[bi] * CELL; shift = math.hypot(xx0[bi], yy0[bi]) * CELL
    g = float(sample(DTM, [ox], [oy])[0]); eye = g + EYE
    # лучи
    XS = ox + SIN[:, None] * dist[None, :]; YS = oy + COS[:, None] * dist[None, :]
    Z = sample(DSM, XS.ravel(), YS.ravel()).reshape(NR, NS)
    Zg = sample(DTM, XS[:, :4].ravel(), YS[:, :4].ravel()).reshape(NR, 4)
    Z[:, :4] = Zg                                          # ближние 80–100 м — открытая площадка
    E = Z - dist[None, :] ** 2 * CURV
    S = (E - eye) / dist[None, :]
    N = int(2 * RADIUS / CELL)
    ci = ((RADIUS - (YS - oy)) / CELL).astype(int); cj = ((XS - ox + RADIUS) / CELL).astype(int)
    inb = (ci >= 0) & (ci < N) & (cj >= 0) & (cj < N)
    yy, xx = np.mgrid[0:N, 0:N]; inside = (xx - N / 2) ** 2 + (yy - N / 2) ** 2 <= (N / 2) ** 2
    def vis_grid(SS, sigma, minc):
        rm = np.maximum.accumulate(SS, axis=1)
        pv = np.concatenate([np.full((NR, 1), -np.inf, np.float32), rm[:, :-1]], axis=1)
        vv = (SS >= pv) & inb
        gr = np.zeros((N, N), np.uint8); gr[ci[vv], cj[vv]] = 1
        gr = ndimage.binary_closing(gr, iterations=1).astype(np.float32)
        gr = ndimage.gaussian_filter(gr, sigma) > 0.3
        lab, nl = ndimage.label(gr); sz = ndimage.sum(gr, lab, range(1, nl + 1)); gr = np.isin(lab, np.where(sz >= minc)[0] + 1)
        lab, nl = ndimage.label(~gr); sz = ndimage.sum(~gr, lab, range(1, nl + 1)); gr = gr | np.isin(lab, np.where(sz < minc)[0] + 1)
        return (gr & inside).astype(np.float32)
    # 1) что видно на самом деле (рельеф + дома + лес); 2) что открыто рельефом, если бы не было домов и леса
    grid = vis_grid(S, 1.5, 40)
    Zt = sample(DTM, XS.ravel(), YS.ravel()).reshape(NR, NS)
    St = (Zt - dist[None, :] ** 2 * CURV - eye) / dist[None, :]
    gridT = np.maximum(vis_grid(St, 1.0, 60), grid)
    area = float(grid.sum() * CELL * CELL / 1e6)
    # перевод в Web Mercator: три тона — видно / закрыто домами и лесом / закрыто рельефом; белая линия по краю зоны рельефа
    src_tr = from_origin(ox - RADIUS, oy + RADIUS, CELL, CELL)
    mx, my = ll2m.transform(lng, lat); sc = 1 / math.cos(math.radians(lat)); R3 = RADIUS * sc
    M = 2000
    dst_tr = from_origin(mx - R3, my + R3, 2 * R3 / M, 2 * R3 / M)
    def warp(A, sg):
        d = np.zeros((M, M), np.float32)
        reproject(ndimage.gaussian_filter(A, sg) if sg else A, d, src_transform=src_tr, src_crs=UTM, dst_transform=dst_tr, dst_crs='EPSG:3857', resampling=Resampling.bilinear); return d
    dv, dt, ins = warp(grid, 0.6), warp(gridT, 0.9), warp(inside.astype(np.float32), 0)
    inn = np.clip(ins * 2 - 0.5, 0, 1)
    v = np.clip((dv - 0.5) * 2.4 + 0.5, 0, 1); t = np.clip((dt - 0.5) * 2.4 + 0.5, 0, 1)
    edge = np.clip(1 - np.abs(dt - 0.5) * 3.0, 0, 1) * (ins > 0.5)
    alpha = inn * ((1 - t) * 135 + t * (1 - v) * 62) + (1 - inn) * 135
    rgba = np.zeros((M, M, 4), np.uint8)
    for ch, base in enumerate((8, 14, 20)): rgba[..., ch] = (base + edge * (250 - base)).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * (1 - edge) + edge * 210, 0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(SITE, 'media/vs', code + '.png'), optimize=True)
    w_, n_ = m2ll.transform(mx - R3, my + R3); e_, s_ = m2ll.transform(mx + R3, my - R3)
    coords = [[round(w_, 6), round(n_, 6)], [round(e_, 6), round(n_, 6)], [round(e_, 6), round(s_, 6)], [round(w_, 6), round(s_, 6)]]
    # горизонт: 720 направлений по 0,5°
    smax = S.max(axis=1); arg = S.argmax(axis=1)
    hz = np.degrees(np.arctan(smax)).reshape(720, 10); hd = dist[arg].reshape(720, 10)
    k = hz.argmax(axis=1); hz_deg = hz.max(axis=1); hz_km = hd[np.arange(720), k] / 1000
    # доминанты в радиусе 30 км
    dd = np.hypot(dx_ - ox, dy_ - oy)
    vis_dom = []
    for i in np.where((dd > 250) & (dd < RADIUS))[0]:
        v = los_visible(ox, oy, eye, dx_[i], dy_[i], dground[i] + dh[i])
        if v > 3: vis_dom.append([int(doms[i]['properties']['i']), round(float(min(v, dh[i])), 1)])
    lm = {}
    for name, lo, la, h in LANDMARKS:
        tx, ty = to_utm.transform(lo, la); tg = float(sample(DTM, [tx], [ty])[0])
        lm[name] = round(max(0.0, min(h, los_visible(ox, oy, eye, tx, ty, tg + h))), 0)
    # профиль до Исаакия
    tx, ty = to_utm.transform(*ISAAC); L = math.hypot(tx - ox, ty - oy)
    t = np.linspace(0, 1, 181); px, py = ox + (tx - ox) * t, oy + (ty - oy) * t
    prof = dict(km=round(L / 1000, 2), g=[round(float(v), 1) for v in sample(DTM, px, py)], s=[round(float(v), 1) for v in sample(DSM, px, py)], m=[])
    # вершины рядом с линией разреза (до 1,2 км) — для подписей
    ux, uy = (tx - ox) / L, (ty - oy) / L
    for mc, mp in mounts:
        if not mp.get('name'): continue
        mx_, my_ = to_utm.transform(*mc); along = (mx_ - ox) * ux + (my_ - oy) * uy; off = abs(-(mx_ - ox) * uy + (my_ - oy) * ux)
        if 300 < along < L - 300 and off < 1200: prof['m'].append([mp['name'], round(along / L, 3), mp.get('type') or ''])
    near = min(mounts, key=lambda m: km(m[0], (lng, lat)))
    sec = next((f['properties'] for f in D['sectors']['features'] if in_poly((lng, lat), f['geometry'])), None)
    out[code] = dict(z=round(g, 1), area=round(area, 1), coords=coords, hz=[int(round(v * 100)) for v in hz_deg], hzkm=[round(float(v), 1) for v in hz_km],
                     doms=vis_dom, lm=lm, prof=prof, near=[near[1].get('name'), round(km(near[0], (lng, lat)), 2), near[1].get('height_value')],
                     sector=(sec or {}).get('type_2'), tier=(sec or {}).get('type'), shift=round(shift), obs=[round(v, 6) for v in to_ll.transform(ox, oy)])
    print(code, P['p'].get('name'), 'сдвиг', round(shift), 'м, z', round(g), 'м, обзор', round(area), 'км², доминант', len(vis_dom), lm, flush=True)

# ---------- горы ----------
newm = json.load(open(os.path.join(SRC, 'Новые горы.geojson'), encoding='utf-8'))
mount_add, mmedia = [], {}
for k, f in enumerate(newm['features']):
    nm = f['properties']['Имя']; spec = MOUNTS.get(nm, {})
    lo, la = m2ll.transform(*f['geometry']['coordinates'])
    fid = 9001 + k
    ph = []
    for j, fn in enumerate(spec.get('photos', [])):
        base = '%d_%d' % (fid, j + 1); save_photo(fn, os.path.join(SITE, 'media/mount', base), thumb=False); ph.append(base)
    if ph: mmedia[str(fid)] = ph
    mount_add.append({'type': 'Feature', 'properties': {'fid': fid, 'type': spec.get('type', 'гора'), 'name': nm, 'height_value': f['properties']['height'], 'about': spec.get('about', ''), 'added': 1},
                      'geometry': {'type': 'Point', 'coordinates': [round(lo, 6), round(la, 6)]}})

# ---------- трек БГТ ----------
bgt = json.load(open(os.path.join(SRC, 'БГТ 161126.geojson'), encoding='utf-8'))
trail = []
for f in bgt['features']:
    g = f['geometry']; parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in parts:
        xs, ys = m2ll.transform([c[0] for c in line], [c[1] for c in line])
        trail.append({'type': 'Feature', 'properties': {}, 'geometry': {'type': 'LineString', 'coordinates': [[round(a, 6), round(b, 6)] for a, b in zip(xs, ys)]}})

# ---------- запись ----------
def feat(P):
    p = dict(P['p']); v = out[P['code']]
    if P['kind'] == 'new': p['area_km2'] = v['area']
    for nm in ('lakhta', 'tv', 'isaac'): p[nm + '_m'] = v['lm'][nm]
    p['z_m'] = v['z']
    if v['sector'] and not p.get('sector'): p['sector'] = v['sector']; p['tier'] = v['tier']
    return {'type': 'Feature', 'properties': p, 'geometry': {'type': 'Point', 'coordinates': [round(P['lng'], 6), round(P['lat'], 6)]}}
vp_new = [feat(P) for P in points if P['kind'] == 'new']
vp_old = sorted([feat(P) for P in points if P['kind'] == 'old'], key=lambda f: f['properties']['n'])
keep_codes = {P['code'] for P in points}
views = {c: {k: v[k] for k in ('area', 'coords', 'hz', 'hzkm', 'doms', 'lm', 'prof', 'near', 'z', 'shift', 'obs')} for c, v in out.items()}
new_ids = [x for P in points for x in str(P['p'].get('photos') or '').split(',') if x.startswith('n')]
payload = dict(vp_new=vp_new, vp_old=vp_old, keep=sorted(keep_codes), drop_photos=DROP_PHOTOS, mount_add=mount_add, mount_media=mmedia,
               trail=trail, photo_ids=new_ids, caps=caps, views=views)
with open(os.path.join(SITE, 'data/views.js'), 'w', encoding='utf-8') as fh:
    fh.write('/* Видовые точки после экспедиционной сверки (папка «Точки и виды»), зоны видимости и силуэты по FABDEM с домами и лесом.\n'
             '   Собрано tools/build_views.py. Подключается после data/threats.js. */\n')
    fh.write('window.GP_VIEWS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    fh.write('''(function(){
  const D = window.GP_DATA, M = window.GP_MEDIA, V = window.GP_VIEWS; if(!D || !V) return;
  const fc = features => ({type:'FeatureCollection', features});
  D.vp_new = fc(V.vp_new); D.vp_old = fc(V.vp_old); D.trail = fc(V.trail);
  if(D.sightlines) D.sightlines = fc(D.sightlines.features.filter(f => V.keep.includes(f.properties.code)));
  if(D.photo_points) D.photo_points = fc(D.photo_points.features.filter(f => !V.drop_photos.includes(String(f.properties.id))));
  if(D.mount) D.mount = fc(D.mount.features.concat(V.mount_add));
  M.viewpoints = M.viewpoints.filter(id => !V.drop_photos.includes(id)).concat(V.photo_ids);
  Object.assign(M.mount, V.mount_media); M.caps = Object.assign(M.caps || {}, V.caps);
  // доминанты: кто с какой точки виден — по новому расчёту
  const byI = {}; (D.dominants?.features || []).forEach(f => { f.properties.vt = ''; f.properties.to = ''; byI[f.properties.i] = f; });
  Object.entries(V.views).forEach(([code, v]) => { const fld = code.startsWith('ВТ') ? 'vt' : 'to', n = String(+code.slice(3));
    v.doms.forEach(([i, m]) => { const f = byI[i]; if(!f) return;
      // «горит» только то, что заметно поднимается над преградами: не меньше 8 м и не меньше пятой части высоты
      if(m < Math.max(8, 0.2 * (+f.properties.height_m || 0))) return;
      f.properties[fld] = f.properties[fld] ? f.properties[fld] + ',' + n : n; }); });
})();
''')
print('готово: data/views.js', os.path.getsize(os.path.join(SITE, 'data/views.js')) // 1024, 'KB')
