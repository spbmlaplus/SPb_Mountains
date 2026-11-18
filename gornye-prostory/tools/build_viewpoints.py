# -*- coding: utf-8 -*-
"""Смотровые точки из «Точки и виды/Viewpoints_all.geojson», секторы обзора из Viewshed_arrows.geojson,
зоны видимости по FABDEM с домами и лесом, обрезанные по сектору.

  python3 tools/build_viewpoints.py <папка «Точки и виды»> <папка с FABDEM.tif и FABDEM_building_tree.tif> .

Сектор обзора:
  * стрелки — пары линий, выходящих из точки; угол между ними (меньше 180°) — то, куда смотрит точка;
  * у точки нет своих стрелок, но в радиусе 1 км (или 2 км на той же возвышенности) есть точка со стрелками — берём её сектор;
  * иначе вид на все 360°.
Зона видимости считается лучами только внутри сектора; всё вне сектора на карте затемнено.
Пишет data/views.js (заменяет видовые точки сайта), media/vs/<код>.png, media/vp/g<NN><k>.webp."""
import sys, os, json, math, subprocess
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
PHOTO_DIR = sys.argv[4] if len(sys.argv) > 4 else None                # оригиналы снимков старого набора (архив «Фото»)

UTM = 'EPSG:32636'
CELL = 25.0
RADIUS = 30000
EYE = 1.7
K = 0.13
CURV = (1 - K) / (2 * 6371000)
LANDMARKS = [('lakhta', 30.1777, 59.9871, 462), ('tv', 30.3218, 59.9767, 326), ('isaac', 30.3061, 59.9340, 101.5)]
ISAAC = (30.3061, 59.9340)
TODO = {'ОХРАНЯТЬ': 'охранять', 'ФОРМИРОВАТЬ': 'формировать', 'РАСЧИЩАТЬ': 'расчищать'}
# у точек без возвышенности — названия по месту
GROUP_FIX = {'Ореховая': 'Дудергофские высоты', 'Воронья': 'Дудергофские высоты', '901.jpg': 'Дудергофские высоты',
             'Кирхгоф': 'Кирхгоф', '902.jpg': 'Кирхгоф'}
GROUP_NAME = {'Ропишинские высоты': 'Ропшинские высоты', 'Таммиселька': 'Таммиелька', 'Углово': 'Угловско-Щегловская возвышенность',
              'Воейково': 'Колтушская возвышенность', 'Суоранда': 'Колтушская возвышенность', 'Федоровское': 'Фёдоровский холм', 'Федоровский холм': 'Фёдоровский холм'}

to_utm = Transformer.from_crs('EPSG:4326', UTM, always_xy=True)
to_ll = Transformer.from_crs(UTM, 'EPSG:4326', always_xy=True)
m2ll = Transformer.from_crs('EPSG:3857', 'EPSG:4326', always_xy=True)
ll2m = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)
def km(a, b):
    return math.hypot((a[0] - b[0]) * 111.32 * math.cos(math.radians((a[1] + b[1]) / 2)), (a[1] - b[1]) * 110.54)
def azim(a, b):
    return (math.degrees(math.atan2((b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1])) + 360) % 360

# ---------- данные сайта: доминанты, вершины, старые точки экспедиции (для текстов и фото) ----------
js = r'''global.window={};for(const f of ["base","threats"]) require(process.argv[1]+"/data/"+f+".js");
const D=window.GP_DATA, o={};for(const k of ["mount","dominants","sectors"]) o[k]=D[k];
require(process.argv[1]+"/data/media.js"); o._media=window.GP_MEDIA; process.stdout.write(JSON.stringify(o));'''
D = json.loads(subprocess.check_output(['node', '-e', js, os.path.abspath(SITE)]))
old_js = open(os.path.join(SITE, 'data/views.js'), encoding='utf-8').read()
OLD = json.loads(old_js[old_js.index('{'):old_js.index(';\n(function')])
if 'src' in OLD: OLD = OLD['src']                                          # повторная сборка: исходники экспедиции сохранены
OLD_TO = [dict(code=f['properties']['code'], name=f['properties'].get('name'), about=f['properties'].get('about'),
               photos=f['properties'].get('photos'), c=f['geometry']['coordinates']) for f in (OLD or {}).get('vp_old', [])]
OLD_CAPS = (OLD or {}).get('caps', {})
mounts = [(f['geometry']['coordinates'], f['properties']) for f in D['mount']['features'] if f['properties'].get('name')]
mounts += [(f['geometry']['coordinates'], f['properties']) for f in (OLD or {}).get('mount_add', [])]

# ---------- точки ----------
raw = json.load(open(os.path.join(SRC, 'Viewpoints_all.geojson'), encoding='utf-8'))['features']
# имена снимков старого набора по месту: у скопированных в QGIS точек атрибуты остались от первой (1001.JPG)
OLDN = []
for f in json.load(open(os.path.join(SRC, 'Viewpoints_old.geojson'), encoding='utf-8'))['features']:
    if f['properties'].get('Name'): OLDN.append((m2ll.transform(*f['geometry']['coordinates']), f['properties']['Name'], f['properties'].get('Azimuth')))
pts = []
for f in raw:
    p = f['properties']; lng, lat = m2ll.transform(*f['geometry']['coordinates'])
    name = (p.get('name') or '').strip()
    pts.append(dict(src=name, lng=lng, lat=lat, todo=(p.get('todo') or '').strip(), group=(p.get('group') or '').strip(),
                    about=(p.get('description') or '').strip(), files=[x for x in (p.get('photos') or '').split(';') if x],
                    layer=p.get('layer'), copy=(name == '1001.JPG' and (p.get('todo') or '').strip() == 'ОХРАНЯТЬ')))
    P = pts[-1]
    if P['layer'] == 'Viewpoints_old':
        o = min(OLDN, key=lambda o: km(o[0], (lng, lat)))
        if km(o[0], (lng, lat)) < 0.005: P['src'] = o[1]; P['photo_az'] = o[2]
        elif P['src'] == '1001.JPG': P['src'] = ''                        # копия атрибутов без своего снимка
# дубли: та же точка (ближе 5 м) с тем же воздействием
uniq = []
for P in pts:
    if any(km((P['lng'], P['lat']), (Q['lng'], Q['lat'])) < 0.005 and P['todo'] == Q['todo'] for Q in uniq): continue
    uniq.append(P)
pts = uniq
print(len(raw), 'записей,', len(pts), 'точек без дублей', flush=True)

# группа (возвышенность)
for P in pts:
    c = (P['lng'], P['lat'])
    if P['src'] in GROUP_FIX: P['group'] = GROUP_FIX[P['src']]
    elif P['copy']:
        # у скопированных точек атрибуты остались от первой; берём возвышенность у ближайшей «настоящей» точки или вершины
        real = [Q for Q in pts if not Q['copy'] and Q['group'] and Q is not P]
        q = min(real, key=lambda Q: km(c, (Q['lng'], Q['lat'])))
        to = min(OLD_TO, key=lambda o: km(c, o['c'])) if OLD_TO else None
        if to and km(c, to['c']) < 1.2: P['group'] = to['name']; P['to'] = to
        elif km(c, (q['lng'], q['lat'])) < 2.5: P['group'] = q['group']
        else: P['group'] = min(mounts, key=lambda m: km(c, m[0]))[1]['name']
    if not P['group']: P['group'] = min(mounts, key=lambda m: km(c, m[0]))[1]['name']
    P['group'] = GROUP_NAME.get(P['group'], P['group'])
# точка экспедиции на том же месте — тексты и снимки
for P in pts:
    if 'to' in P: continue
    to = min(OLD_TO, key=lambda o: km((P['lng'], P['lat']), o['c'])) if OLD_TO else None
    if to and km((P['lng'], P['lat']), to['c']) < 0.12: P['to'] = to

# ---------- секторы ----------
arrows = json.load(open(os.path.join(SRC, 'Viewshed_arrows.geojson'), encoding='utf-8'))['features']
starts = []
for a in arrows:
    cs = a['geometry']['coordinates']
    if a['geometry']['type'] == 'MultiLineString': cs = cs[0]
    o = m2ll.transform(*cs[0]); e = m2ll.transform(*cs[-1])
    starts.append((o, azim(o, e)))
def wedge(azs):
    """Две стрелки → сектор (начало, ширина) по часовой, меньше 180°. Больше двух — самый широкий охват соседних пар."""
    azs = sorted(set(round(a, 1) for a in azs))
    if len(azs) == 1: return [(azs[0] - 30) % 360, 60.0]
    gaps = [((azs[(i + 1) % len(azs)] - azs[i]) % 360, i) for i in range(len(azs))]
    g, i = max(gaps)                                      # самый большой промежуток — то, куда точка не смотрит
    start = azs[(i + 1) % len(azs)]; width = 360 - g
    return [round(start, 1), round(width, 1)]
own = {}
for k, P in enumerate(pts):
    c = (P['lng'], P['lat'])
    # стрелку относим к ближайшей точке: если рядом стоят две точки, стрелки не делятся между ними
    azs = [a for o, a in starts if km(o, c) < 0.05 and min(range(len(pts)), key=lambda j: km(o, (pts[j]['lng'], pts[j]['lat']))) == k]
    if azs: own[k] = wedge(azs)
for k, P in enumerate(pts):
    c = (P['lng'], P['lat'])
    if k in own: P['sector'] = own[k]; P['sector_src'] = 'own'; continue
    cand = [(km(c, (pts[j]['lng'], pts[j]['lat'])), j) for j in own]
    cand = [(d, j) for d, j in cand if d < 1.0 or (d < 2.0 and pts[j]['group'] == P['group'])]
    if cand:
        d, j = min(cand); P['sector'] = own[j]; P['sector_src'] = 'neighbour'
    else:
        P['sector'] = [0.0, 360.0]; P['sector_src'] = 'all'

# порядок: по возвышенностям с севера по часовой вокруг центра, внутри — по воздействию
CEN = (30.3141, 59.9386)
gc = {}
for P in pts: gc.setdefault(P['group'], []).append((P['lng'], P['lat']))
gaz = {g: azim(CEN, (sum(x for x, _ in v) / len(v), sum(y for _, y in v) / len(v))) for g, v in gc.items()}
order = {'ОХРАНЯТЬ': 0, 'ФОРМИРОВАТЬ': 1, 'РАСЧИЩАТЬ': 2}
pts.sort(key=lambda P: (round((gaz[P['group']] - 300) % 360), P['group'], order.get(P['todo'], 3), -P['lat']))
for i, P in enumerate(pts, 1): P['code'] = 'ВП-%02d' % i; P['n'] = i
if os.environ.get('GP_TEST'): pts = pts[:int(os.environ['GP_TEST'])]          # быстрая проверка на нескольких точках

# ---------- фото ----------
os.makedirs(os.path.join(SITE, 'media/vp'), exist_ok=True)
os.makedirs(os.path.join(SITE, 'media/vs'), exist_ok=True)
EXIST_VP = set(D['_media'].get('viewpoints', [])) | set(x for x in (OLD or {}).get('photo_ids', []))
def save_photo(name, out_base):
    if os.path.exists(out_base + '.webp') and os.path.exists(out_base + '.t.webp'): return
    im = ImageOps.exif_transpose(Image.open(name if os.path.isabs(name) else os.path.join(SRC, name))).convert('RGB')
    big = im.copy(); big.thumbnail((1800, 1800), Image.LANCZOS); big.save(out_base + '.webp', 'WEBP', quality=80, method=6)
    t = im.copy(); t.thumbnail((560, 560), Image.LANCZOS); t.save(out_base + '.t.webp', 'WEBP', quality=74, method=6)
Image.MAX_IMAGE_PIXELS = None
PHOTOS, EXTRA = {}, {}
if PHOTO_DIR:
    from PIL.ExifTags import GPSTAGS
    for fn in os.listdir(PHOTO_DIR):
        PHOTOS[fn.lower()] = os.path.join(PHOTO_DIR, fn)
        if fn.upper().startswith('IMG_'):                       # снимки без номера — к точке по GPS снимка
            try:
                g = {GPSTAGS.get(k, k): v for k, v in Image.open(PHOTOS[fn.lower()]).getexif().get_ifd(0x8825).items()}
                dd = lambda x: float(x[0]) + float(x[1]) / 60 + float(x[2]) / 3600
                EXTRA[fn.lower()] = ((dd(g['GPSLongitude']), dd(g['GPSLatitude'])), 'p' + fn.rsplit('.', 1)[0].replace('_', ''))
            except Exception: pass
filemap = {}
caps = {}
for P in pts:
    ids = []
    if P['files']:
        for fn in P['files']:
            if fn.lower().endswith('.heic') and any(x.lower().startswith(fn[:-5].lower()) and not x.lower().endswith('.heic') for x in P['files']): continue
            if fn not in filemap: filemap[fn] = 'g%03d' % (len(filemap) + 1)
            save_photo(fn, os.path.join(SITE, 'media/vp', filemap[fn])); ids.append(filemap[fn])
    elif P['src'] and P['src'].lower() in PHOTOS:
        stem = P['src'].rsplit('.', 1)[0]; save_photo(PHOTOS[P['src'].lower()], os.path.join(SITE, 'media/vp', 'p' + stem)); ids = ['p' + stem]
    for fn, (c, pid) in EXTRA.items():
        if km(c, (P['lng'], P['lat'])) < 0.06 and P['layer'] == 'Viewpoints_old' and not P['src']:
            save_photo(PHOTOS[fn], os.path.join(SITE, 'media/vp', pid)); ids.append(pid)
    if not ids and 'to' in P: ids = [x for x in str(P['to'].get('photos') or '').split(',') if x]
    for x in ids:
        if x in OLD_CAPS: caps[x] = OLD_CAPS[x]
    P['photos'] = ids

# ---------- рельеф ----------
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
TREE, _ = load(os.path.join(RAST, 'FABDEM_tree.tif')); BLD, _ = load(os.path.join(RAST, 'FABDEM_building.tif'))
TREE = np.where(np.isfinite(TREE) & (TREE > -50), TREE, DTM); BLD = np.where(np.isfinite(BLD) & (BLD > -50), BLD, DTM)
TREE_H = np.clip(TREE - DTM, 0, 60).astype(np.float32); BLD_H = np.clip(BLD - DTM, 0, 300).astype(np.float32); del TREE, BLD
X0, Y0 = TR.c, TR.f
def rc(x, y): return (Y0 - y) / CELL - 0.5, (x - X0) / CELL - 0.5
def sample(A, x, y):
    r, c = rc(np.asarray(x), np.asarray(y))
    return ndimage.map_coordinates(A, [r, c], order=1, mode='constant', cval=0.0)

doms = D['dominants']['features']
dx_, dy_ = to_utm.transform([f['geometry']['coordinates'][0] for f in doms], [f['geometry']['coordinates'][1] for f in doms])
dx_, dy_ = np.array(dx_), np.array(dy_)
dh = np.array([float(f['properties'].get('height_m') or 0) for f in doms])
dground = sample(DTM, dx_, dy_)
def los_visible(ox, oy, eye_abs, tx, ty, top_abs, near=80, far_skip=60):
    D_ = math.hypot(tx - ox, ty - oy)
    if D_ < 150: return top_abs - eye_abs
    n = max(2, int(D_ / CELL)); t = np.linspace(0, 1, n + 1)[1:-1]; d = t * D_
    keep = (d > near) & (d < D_ - far_skip)
    if not keep.any(): return top_abs
    xs, ys, d = ox + (tx - ox) * t[keep], oy + (ty - oy) * t[keep], d[keep]
    z = sample(DSM, xs, ys) - d * d * CURV
    S = np.max((z - eye_abs) / d)
    return (top_abs - D_ * D_ * CURV) - (eye_abs + S * D_)

# объединённые зоны видимости (50 м): вся карта и каждая возвышенность
UC = 50.0
_ux, _uy = to_utm.transform([P['lng'] for P in pts], [P['lat'] for P in pts])
UX0, UY1 = min(_ux) - RADIUS - 500, max(_uy) + RADIUS + 500
UW, UH = int((max(_ux) + RADIUS + 500 - UX0) / UC), int((UY1 - (min(_uy) - RADIUS - 500)) / UC)
U_ALL = np.zeros((UH, UW), bool); U_IN = np.zeros((UH, UW), bool)
U_GRP = {}
def paste(dst, grid, ox, oy):
    g2 = grid.reshape(grid.shape[0] // 2, 2, grid.shape[1] // 2, 2).max(axis=(1, 3)) > 0.5
    r0 = int(round((UY1 - (oy + RADIUS)) / UC)); c0 = int(round((ox - RADIUS - UX0) / UC))
    h, w = g2.shape; rr0, cc0 = max(0, r0), max(0, c0); rr1, cc1 = min(UH, r0 + h), min(UW, c0 + w)
    dst[rr0:rr1, cc0:cc1] |= g2[rr0 - r0:rr1 - r0, cc0 - c0:cc1 - c0]
def png_union(vis, inside, name, M=2400):
    rr, cc = np.where(inside); r0, r1, c0, c1 = rr.min(), rr.max() + 1, cc.min(), cc.max() + 1
    vis, inside = vis[r0:r1, c0:c1], inside[r0:r1, c0:c1]; H_, W_ = vis.shape
    X0_, Y1_ = UX0 + c0 * UC, UY1 - r0 * UC
    src_tr = from_origin(X0_, Y1_, UC, UC)
    tr, w, h = calculate_default_transform(UTM, 'EPSG:3857', W_, H_, X0_, Y1_ - H_ * UC, X0_ + W_ * UC, Y1_)
    sc = max(w, h) / M; w2, h2 = int(w / sc), int(h / sc)
    from affine import Affine
    tr2 = tr * Affine.scale(sc)
    def warp(A):
        d = np.zeros((h2, w2), np.float32)
        reproject(ndimage.gaussian_filter(A.astype(np.float32), 0.7), d, src_transform=src_tr, src_crs=UTM, dst_transform=tr2, dst_crs='EPSG:3857', resampling=Resampling.bilinear); return d
    v, ins = warp(vis), warp(inside)
    v = np.clip((v - 0.5) * 2.4 + 0.5, 0, 1); edge = np.clip(1 - np.abs(v - 0.5) * 3, 0, 1) * (ins > 0.3)
    alpha = (1 - v) * 175
    rgba = np.zeros((h2, w2, 4), np.uint8)
    for ch, base in enumerate((6, 11, 16)): rgba[..., ch] = (base + edge * (245 - base)).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * (1 - edge) + edge * 200, 0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(SITE, 'media/vs', name + '.png'), optimize=True)
    w_, n_ = m2ll.transform(tr2.c, tr2.f); e_, s_ = m2ll.transform(tr2.c + tr2.a * w2, tr2.f + tr2.e * h2)
    return [[round(w_, 6), round(n_, 6)], [round(e_, 6), round(n_, 6)], [round(e_, 6), round(s_, 6)], [round(w_, 6), round(s_, 6)]]
DOMP = [f['properties'] for f in doms]
byi = {int(DOMP[k]['i']): k for k in range(len(DOMP))}
groups = []
def flush_group():
    if not U_GRP.get('codes'): return
    gid = 'g%02d' % (len(groups) + 1); g = U_GRP['name']; coords = png_union(U_GRP['vis'], U_GRP['ins'], gid, M=1600)
    gp = [P for P in pts if P['group'] == g]
    groups.append(dict(id=gid, name=g, codes=list(U_GRP['codes']), coords=coords, area=round(float(U_GRP['vis'].sum() * UC * UC / 1e6), 1),
                       c=[round(sum(P['lng'] for P in gp) / len(gp), 5), round(sum(P['lat'] for P in gp) / len(gp), 5)]))
    U_GRP.clear()

NR, NS = 7200, int(RADIUS / CELL)
ang = np.arange(NR) * 2 * np.pi / NR
dist = (np.arange(1, NS + 1) * CELL).astype(np.float32)
SIN, COS = np.sin(ang).astype(np.float32), np.cos(ang).astype(np.float32)
AZD = np.degrees(ang)
def in_sector(az, sec):
    return ((np.asarray(az) - sec[0]) % 360) <= sec[1] + 1e-6

out = {}
for P in pts:
    code = P['code']
    lng, lat, sec = P['lng'], P['lat'], P['sector']
    ox, oy = to_utm.transform(lng, lat)
    # наблюдатель — на самой высокой открытой земле в радиусе 60 м (точки этого набора поставлены по месту)
    r0, c0 = rc(ox, oy); r0, c0 = int(round(r0)), int(round(c0)); RR = 2
    sub_g = DTM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1]; sub_s = DSM[r0 - RR:r0 + RR + 1, c0 - RR:c0 + RR + 1]
    yy0, xx0 = np.mgrid[-RR:RR + 1, -RR:RR + 1]; circ = xx0 ** 2 + yy0 ** 2 <= RR ** 2
    cand = np.where(circ & (sub_s - sub_g < 2.5), sub_g, -1e9)
    g0 = float(sample(DTM, [ox], [oy])[0]); shift = 0.0
    if cand.max() > -1e8:
        bi = np.unravel_index(np.argmax(cand), cand.shape)
        if cand[bi] > g0 + 1.0: ox += xx0[bi] * CELL; oy -= yy0[bi] * CELL; shift = math.hypot(xx0[bi], yy0[bi]) * CELL
    g = float(sample(DTM, [ox], [oy])[0]); eye = g + EYE
    XS = ox + SIN[:, None] * dist[None, :]; YS = oy + COS[:, None] * dist[None, :]
    Z = sample(DSM, XS.ravel(), YS.ravel()).reshape(NR, NS)
    Z[:, :4] = sample(DTM, XS[:, :4].ravel(), YS[:, :4].ravel()).reshape(NR, 4)
    S = (Z - dist[None, :] ** 2 * CURV - eye) / dist[None, :]
    rm = np.maximum.accumulate(S, axis=1)
    pv = np.concatenate([np.full((NR, 1), -np.inf, np.float32), rm[:, :-1]], axis=1)
    VIS = S >= pv                                                     # видно ли каждую клетку луча
    ray_in = in_sector(AZD, sec)
    N = int(2 * RADIUS / CELL)
    ci = ((RADIUS - (YS - oy)) / CELL).astype(int); cj = ((XS - ox + RADIUS) / CELL).astype(int)
    inb = (ci >= 0) & (ci < N) & (cj >= 0) & (cj < N)
    yy, xx = np.mgrid[0:N, 0:N]; inside = (xx - N / 2) ** 2 + (yy - N / 2) ** 2 <= (N / 2) ** 2
    gaz = (np.degrees(np.arctan2(xx - N / 2 + 0.5, N / 2 - yy - 0.5)) + 360) % 360
    secmask = inside & in_sector(gaz, sec) if sec[1] < 360 else inside
    def vis_grid(V, sigma, minc):
        vv = V & inb & ray_in[:, None]
        gr = np.zeros((N, N), np.uint8); gr[ci[vv], cj[vv]] = 1
        gr = ndimage.binary_closing(gr, iterations=1).astype(np.float32)
        gr = ndimage.gaussian_filter(gr, sigma) > 0.3
        lab, nl = ndimage.label(gr); sz = ndimage.sum(gr, lab, range(1, nl + 1)); gr = np.isin(lab, np.where(sz >= minc)[0] + 1)
        lab, nl = ndimage.label(~gr); sz = ndimage.sum(~gr, lab, range(1, nl + 1)); gr = gr | np.isin(lab, np.where(sz < minc)[0] + 1)
        return (gr & secmask).astype(np.float32)
    grid = vis_grid(VIS, 1.5, 40)
    Zt = sample(DTM, XS.ravel(), YS.ravel()).reshape(NR, NS)
    St = (Zt - dist[None, :] ** 2 * CURV - eye) / dist[None, :]
    rmt = np.maximum.accumulate(St, axis=1); pvt = np.concatenate([np.full((NR, 1), -np.inf, np.float32), rmt[:, :-1]], axis=1)
    gridT = np.maximum(vis_grid(St >= pvt, 1.0, 60), grid)
    area = float(grid.sum() * CELL * CELL / 1e6)
    # PNG: видно — прозрачно; закрыто домами и лесом — полутень; закрыто рельефом и вне сектора — тень; белая линия — край
    src_tr = from_origin(ox - RADIUS, oy + RADIUS, CELL, CELL)
    mx, my = ll2m.transform(lng, lat); R3 = RADIUS / math.cos(math.radians(lat))
    M = 1600
    dst_tr = from_origin(mx - R3, my + R3, 2 * R3 / M, 2 * R3 / M)
    def warp(A, sg):
        d = np.zeros((M, M), np.float32)
        reproject(ndimage.gaussian_filter(A, sg) if sg else A, d, src_transform=src_tr, src_crs=UTM, dst_transform=dst_tr, dst_crs='EPSG:3857', resampling=Resampling.bilinear); return d
    dv, dt, ins = warp(grid, 0.6), warp(gridT, 0.9), warp(secmask.astype(np.float32), 0.8)
    inn = np.clip(ins * 2 - 0.5, 0, 1)
    v = np.clip((dv - 0.5) * 2.4 + 0.5, 0, 1); t = np.clip((dt - 0.5) * 2.4 + 0.5, 0, 1)
    edge = np.clip(1 - np.abs(dt - 0.5) * 3.0, 0, 1) * (ins > 0.5)
    sedge = np.clip(1 - np.abs(ins - 0.5) * 4.0, 0, 1) * (sec[1] < 360)          # граница сектора — тонкая линия
    alpha = inn * ((1 - t) * 175 + t * (1 - v) * 95) + (1 - inn) * 185
    e2 = np.maximum(edge, sedge * 0.8)
    rgba = np.zeros((M, M, 4), np.uint8)
    for ch, base in enumerate((8, 14, 20)): rgba[..., ch] = (base + e2 * (250 - base)).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * (1 - e2) + e2 * 210, 0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(SITE, 'media/vs', 'vp%02d.png' % P['n']), optimize=True)
    paste(U_ALL, grid, ox, oy); paste(U_IN, secmask.astype(np.float32), ox, oy)
    if U_GRP.get('name') != P['group']:
        flush_group(); U_GRP.update(name=P['group'], vis=np.zeros((UH, UW), bool), ins=np.zeros((UH, UW), bool), codes=[])
    paste(U_GRP['vis'], grid, ox, oy); paste(U_GRP['ins'], secmask.astype(np.float32), ox, oy); U_GRP['codes'].append(P['code'])
    w_, n_ = m2ll.transform(mx - R3, my + R3); e_, s_ = m2ll.transform(mx + R3, my - R3)
    coords = [[round(w_, 6), round(n_, 6)], [round(e_, 6), round(n_, 6)], [round(e_, 6), round(s_, 6)], [round(w_, 6), round(s_, 6)]]
    # горизонт по 0,5°
    smax = S.max(axis=1); arg = S.argmax(axis=1)
    hz = np.degrees(np.arctan(smax)).reshape(720, 10); hd = dist[arg].reshape(720, 10)
    kk = hz.argmax(axis=1); hz_deg = hz.max(axis=1); hz_km = hd[np.arange(720), kk] / 1000
    # что делает вид интересным — описательно, без оценок «хорошо/плохо»
    rays = np.where(ray_in)[0]
    far = np.array([dist[np.where(VIS[r])[0][-1]] if VIS[r].any() else 0 for r in rays[::10]]) / 1000
    def planes(r):
        v_ = VIS[r, 4:]; runs = np.diff(np.concatenate([[0], v_.astype(np.int8), [0]]))
        st, en = np.where(runs == 1)[0], np.where(runs == -1)[0]
        keep = [(a, b) for a, b in zip(st, en) if b - a >= 4]                 # видимый кусок не короче 100 м
        merged = []
        for a, b in keep:
            if merged and a - merged[-1][1] < 8: merged[-1] = (merged[-1][0], b)   # разрыв меньше 200 м — тот же план
            else: merged.append((a, b))
        return len(merged)
    pl = np.array([planes(r) for r in rays[::20]])
    hz_s = hz_deg[np.where(in_sector(np.arange(720) / 2, sec))[0]]
    peaks = int(np.sum((hz_s[1:-1] > hz_s[:-2]) & (hz_s[1:-1] >= hz_s[2:]) & (hz_s[1:-1] - np.minimum(hz_s[:-2], hz_s[2:]) > 0.02))) if len(hz_s) > 2 else 0
    # доминанты: только в секторе
    dd = np.hypot(dx_ - ox, dy_ - oy)
    daz = (np.degrees(np.arctan2(dx_ - ox, dy_ - oy)) + 360) % 360
    vis_dom = []
    for i in np.where((dd > 250) & (dd < RADIUS) & in_sector(daz, sec))[0]:
        vv_ = los_visible(ox, oy, eye, dx_[i], dy_[i], dground[i] + dh[i])
        if vv_ > 3: vis_dom.append([int(doms[i]['properties']['i']), round(float(min(vv_, dh[i])), 1)])
    lm = {}
    for name, lo, la, h in LANDMARKS:
        tx, ty = to_utm.transform(lo, la); tg = float(sample(DTM, [tx], [ty])[0])
        a_ = (math.degrees(math.atan2(tx - ox, ty - oy)) + 360) % 360
        lm[name] = round(max(0.0, min(h, los_visible(ox, oy, eye, tx, ty, tg + h))), 0) if in_sector(a_, sec) else 0
    # цель разреза: самая заметная историческая доминанта в секторе, иначе инженерная, иначе Лахта-центр, иначе середина сектора на 15 км
    best = None
    for cls in ('Историческая', 'Инженерная'):
        cand = [(m, i) for i, m in vis_dom if DOMP[byi[i]].get('class') == cls and DOMP[byi[i]].get('name')]
        if cand: m, i = max(cand); best = dict(name=DOMP[byi[i]]['name'], h=float(DOMP[byi[i]].get('height_m') or 0), kind=cls.lower(), xy=(dx_[byi[i]], dy_[byi[i]])); break
    if not best and lm.get('lakhta'): x_, y_ = to_utm.transform(30.1777, 59.9871); best = dict(name='Лахта-центр', h=462.0, kind='инженерная', xy=(x_, y_))
    if not best:
        a_ = math.radians(sec[0] + sec[1] / 2) if sec[1] < 360 else math.atan2(*[v - o for v, o in zip(to_utm.transform(*ISAAC), (ox, oy))])
        best = dict(name='', h=0.0, kind='', xy=(ox + 15000 * math.sin(a_), oy + 15000 * math.cos(a_)))
    tx, ty = best['xy']; L = math.hypot(tx - ox, ty - oy)
    t_ = np.linspace(0, 1, 181); px, py = ox + (tx - ox) * t_, oy + (ty - oy) * t_
    prof = dict(km=round(L / 1000, 2), g=[round(float(x), 1) for x in sample(DTM, px, py)],
                t=[int(round(float(x))) for x in sample(TREE_H, px, py)], b=[int(round(float(x))) for x in sample(BLD_H, px, py)],
                name=best['name'], h=round(best['h']), kind=best['kind'], m=[])
    ux, uy = (tx - ox) / L, (ty - oy) / L
    for mc, mp in mounts:
        mx_, my_ = to_utm.transform(*mc); along = (mx_ - ox) * ux + (my_ - oy) * uy; off = abs(-(mx_ - ox) * uy + (my_ - oy) * ux)
        if 300 < along < L - 300 and off < 1200: prof['m'].append([mp['name'], round(along / L, 3), mp.get('type') or ''])
    near = min(mounts, key=lambda m: km(m[0], (lng, lat)))
    out[code] = dict(z=round(g, 1), area=round(area, 1), coords=coords, hz=[int(round(x * 100)) for x in hz_deg], hzkm=[round(float(x), 1) for x in hz_km],
                     doms=vis_dom, lm=lm, prof=prof, near=[near[1].get('name'), round(km(near[0], (lng, lat)), 2), near[1].get('height_value')],
                     shift=round(shift), obs=[round(x, 6) for x in to_ll.transform(ox, oy)],
                     depth=round(float(np.percentile(far, 90)) if len(far) else 0, 1), planes=round(float(np.median(pl)) if len(pl) else 0, 1), peaks=peaks)
    print(code, P['group'], '|', P['src'] or '—', '| сектор', sec, P['sector_src'], '| обзор', round(area), 'км², глубина', out[code]['depth'],
          'км, планов', out[code]['planes'], ', пиков', peaks, ', доминант', len(vis_dom), flush=True)

# ---------- запись ----------
def disp_name(P):
    if P['layer'] == 'Viewpoints_new': return P['src']
    return P['group']
feats = []
for P in pts:
    about = [x.strip() for x in P['about'].split('\n') if x.strip()] if P['about'] else (P['to'].get('about') if 'to' in P else None)
    p = dict(code=P['code'], n=P['n'], name=disp_name(P), group=P['group'], todo=TODO.get(P['todo'], ''), sector=P['sector'], sector_src=P['sector_src'],
             photos=','.join(P['photos']), z_m=out[P['code']]['z'], src=P['src'] or '', photo_az=round(P['photo_az']) if P.get('photo_az') else None, layer='new' if P['layer'] == 'Viewpoints_new' else 'old')
    if about: p['about'] = about
    if 'to' in P: p['was'] = P['to']['code']
    for nm in ('lakhta', 'tv', 'isaac'): p[nm + '_m'] = out[P['code']]['lm'][nm]
    feats.append({'type': 'Feature', 'properties': p, 'geometry': {'type': 'Point', 'coordinates': [round(P['lng'], 6), round(P['lat'], 6)]}})
views = {c: {k: v[k] for k in ('area', 'coords', 'hz', 'hzkm', 'doms', 'lm', 'prof', 'near', 'z', 'shift', 'obs', 'depth', 'planes', 'peaks')} for c, v in out.items()}
for P in pts: views[P['code']]['img'] = 'vp%02d' % P['n']
print('объединённые зоны…', flush=True)
flush_group()
all_coords = png_union(U_ALL, U_IN, 'all', M=2600)
all_area = round(float(U_ALL.sum() * UC * UC / 1e6))
src_keep = OLD if OLD else {}
src_keep = {k: src_keep[k] for k in ('vp_old', 'caps', 'mount_add', 'mount_media', 'trail', 'photo_ids', 'drop_photos') if k in src_keep}
photo_ids = sorted({x for P in pts for x in P['photos']})
payload = dict(points=feats, views=views, groups=groups, all=dict(coords=all_coords, area=all_area), caps={**OLD_CAPS, **caps}, photo_ids=photo_ids, mount_add=src_keep.get('mount_add', []),
               mount_media=src_keep.get('mount_media', {}), trail=src_keep.get('trail', []), src=src_keep)
with open(os.path.join(SITE, 'data/views.js'), 'w', encoding='utf-8') as fh:
    fh.write('/* Смотровые точки (Точки и виды/Viewpoints_all.geojson), секторы обзора по стрелкам (Viewshed_arrows.geojson),\n'
             '   зоны видимости по FABDEM с домами и лесом, обрезанные по сектору. Собрано tools/build_viewpoints.py.\n'
             '   GP_VIEWS.src — исходные точки экспедиции прошлой сборки, нужны только для повторной сборки. */\n')
    fh.write('window.GP_VIEWS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    fh.write('''(function(){
  const D = window.GP_DATA, M = window.GP_MEDIA, V = window.GP_VIEWS; if(!D || !V) return;
  const fc = features => ({type:'FeatureCollection', features});
  // одна система смотровых точек вместо «предлагаемых» и «точек экспедиции»
  D.vp_old = fc(V.points); D.vp_new = fc([]); D.sightlines = fc([]);
  if(V.trail.length) D.trail = fc(V.trail);
  if(D.mount) D.mount = fc(D.mount.features.concat(V.mount_add));
  M.viewpoints = Array.from(new Set((M.viewpoints || []).concat(V.photo_ids)));
  Object.assign(M.mount, V.mount_media); M.caps = Object.assign(M.caps || {}, V.caps);
  // секторы обзора для карты
  const R = 0.06, wedge = (c, s) => { if(s[1] >= 360) return null; const k = Math.cos(c[1] * Math.PI / 180), pts = [c];
    for(let a = s[0]; a <= s[0] + s[1] + 0.01; a += Math.max(2, s[1] / 24)){ const r = a * Math.PI / 180; pts.push([c[0] + R * Math.sin(r) / k, c[1] + R * Math.cos(r)]); }
    pts.push(c); return {type:'Polygon', coordinates:[pts]}; };
  D.vp_sector = fc(V.points.map(f => ({type:'Feature', properties:{code:f.properties.code, todo:f.properties.todo}, geometry:wedge(f.geometry.coordinates, f.properties.sector)})).filter(f => f.geometry));
  // доминанты: с какой точки видны — по новому расчёту
  const byI = {}; (D.dominants?.features || []).forEach(f => { f.properties.vt = ''; f.properties.to = ''; byI[f.properties.i] = f; });
  Object.entries(V.views).forEach(([code, v]) => { const n = String(+code.slice(3));
    v.doms.forEach(([i, m]) => { const f = byI[i]; if(!f) return;
      if(m < Math.max(8, 0.2 * (+f.properties.height_m || 0))) return;
      f.properties.to = f.properties.to ? f.properties.to + ',' + n : n; }); });
})();
''')
print('готово: data/views.js', os.path.getsize(os.path.join(SITE, 'data/views.js')) // 1024, 'KB,', len(pts), 'точек')
