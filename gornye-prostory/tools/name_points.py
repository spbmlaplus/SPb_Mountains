# -*- coding: utf-8 -*-
"""Названия смотровых точек вместо номеров: «<гора или деревня>, вид на <сторону>»,
при совпадении — «… на <главную доминанту>» или «… у <деревни>».
Точки нового набора (с именем горы) сохраняют имя горы. Правит data/views.js на месте.

  python3 tools/name_points.py ."""
import sys, os, json, math, subprocess, re
SITE = sys.argv[1]
js = r'''global.window={};for(const f of ["base","epochs"]) require(process.argv[1]+"/data/"+f+".js");
const D=window.GP_DATA;process.stdout.write(JSON.stringify({mount:D.mount,today:D.finns_today,hist:D.resettlement}));'''
D = json.loads(subprocess.check_output(['node', '-e', js, os.path.abspath(SITE)]))
p = os.path.join(SITE, 'data/views.js'); t = open(p, encoding='utf-8').read()
i0, i1 = t.index('{'), t.index(';\n(function'); V = json.loads(t[i0:i1])
def km(a, b): return math.hypot((a[0] - b[0]) * 111.32 * math.cos(math.radians(a[1])), (a[1] - b[1]) * 110.54)
def cen(g):
    r = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    return [sum(q[0] for q in r) / len(r), sum(q[1] for q in r) / len(r)]
mounts = [(f['geometry']['coordinates'], f['properties']['name']) for f in D['mount']['features'] if f['properties'].get('name')] + \
         [(f['geometry']['coordinates'], f['properties']['name']) for f in V.get('mount_add', [])]
vill = [(f['geometry']['coordinates'], re.sub(r'^(деревня|посёлок|поселок|село|город|городской посёлок|посёлок при железнодорожной станции|местечко)\s+', '', f['properties']['settlement'])) for f in D['today']['features']]
vill += [(cen(f['geometry']), f['properties']['name']) for f in D['hist']['features'] if f['properties'].get('name')]
DIR = ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад']
dname = lambda a: DIR[int(round(((a % 360) + 360) % 360 / 45)) % 8]
FAMOUS = {'Собор Воскресения Христова на Крови': 'Спас на Крови', 'Морской собор Николая Чудотворца': 'Кронштадтский собор',
          'Свято-Троицкий линтульский монастырь': 'Линтульский монастырь'}
def short(n): return FAMOUS.get(n or '')
D16 = ['север', 'север-северо-восток', 'северо-восток', 'восток-северо-восток', 'восток', 'восток-юго-восток', 'юго-восток', 'юг-юго-восток',
       'юг', 'юг-юго-запад', 'юго-запад', 'запад-юго-запад', 'запад', 'запад-северо-запад', 'северо-запад', 'север-северо-запад']
def norm(b):
    b = re.sub(r'^(гора|холм)\s+|\s+(гора)$', '', b.strip()); b = b.replace('Капорская', 'Копорская').replace('Федоровский', 'Фёдоровский')
    return b[0].upper() + b[1:]
def near(lst, c, r):
    best = min(lst, key=lambda x: km(c, x[0])) if lst else None
    return best[1] if best and km(c, best[0]) <= r else None
used = {}
for f in V['points']:
    pr = f['properties']; c = f['geometry']['coordinates']; s = pr['sector']
    if pr.get('layer') == 'new' and (pr.get('mount') or pr.get('name')):
        base = re.sub(r'\s*\(.*?\)', '', pr.get('mount') or pr['name']).strip()
    else:
        base = near(mounts, c, 1.2) or near(vill, c, 2.0) or pr['group']
    base = norm(base)
    side = 'на все стороны' if s[1] >= 360 else 'на ' + dname(s[0] + s[1] / 2)
    prof = V['views'].get(pr['code'], {}).get('prof', {})
    cands = [f'{base}, вид {side}']
    if short(prof.get('name')): cands.insert(0, f'{base}, вид на {short(prof["name"])}')
    v = near(vill, c, 3.0)
    if v and not v.startswith(base) and not base.startswith(v): cands.append(f'{base} у {v}, вид {side}')
    if s[1] < 360: cands.append(f'{base}, вид на {D16[int(round((s[0] + s[1] / 2) % 360 / 22.5)) % 16]}')
    name = next((x for x in cands if x not in used), None)
    if not name:
        k = 2
        while f'{cands[0]} ({k})' in used: k += 1
        name = f'{cands[0]} ({k})'
    used[name] = 1
    if pr.get('layer') == 'new' and not pr.get('mount'): pr['mount'] = pr['name']
    pr['name'] = name; pr['label'] = name
    print(pr['code'], '→', name)
t = t[:i0] + json.dumps(V, ensure_ascii=False, separators=(',', ':')) + t[i1:]
open(p, 'w', encoding='utf-8').write(t)
