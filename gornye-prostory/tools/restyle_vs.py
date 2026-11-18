# -*- coding: utf-8 -*-
"""Перекраска готовых вьюшедов в стиль «тень на закрытом»: видимое — без заливки (чистый спутник),
закрытое лесом и домами — полутень, закрытое рельефом и вне сектора — тень. Без белых кромок,
крупные пиксели (на карте — nearest). Рядом с каждым PNG пишется .js с data-URL, чтобы
картинки работали и при открытии сайта двойным кликом (file://).

  python3 tools/restyle_vs.py .      (повторный запуск безопасен: исходники в media/vs/src/)"""
import sys, os, glob, io, base64, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
SITE = sys.argv[1]; VS = os.path.join(SITE, 'media/vs'); SRC = os.path.join(VS, 'src'); os.makedirs(SRC, exist_ok=True)
SH, HALF = 150, 96            # альфа тени и полутени
COL = (5, 9, 13)
def js_wrap(key, png_bytes, path):
    b = base64.b64encode(png_bytes).decode()
    open(path, 'w').write("(window.GP_IMG=window.GP_IMG||{})['%s']='data:image/png;base64,%s';\n" % (key, b))
for f in sorted(glob.glob(os.path.join(VS, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    src = os.path.join(SRC, name + '.png')
    if not os.path.exists(src): shutil.copy2(f, src)
    a = np.array(Image.open(src).convert('RGBA')).astype(np.int16)
    al, edge = a[..., 3], a[..., :3].max(-1) > 90
    cls = np.where(al < 50, 0, np.where(al < 130, 1, 2)).astype(np.uint8)
    if edge.any():
        _, (iy, ix) = ndimage.distance_transform_edt(edge, return_indices=True); cls = cls[iy, ix]
    if name.startswith('vp'): cls = ndimage.median_filter(cls, 3)
    else: cls[cls == 1] = 2
    pal = Image.new('P', cls.shape[::-1]); pal.putdata(cls.ravel().tolist())
    pal.putpalette(list(COL) * 3 + [0] * (256 * 3 - 9)); pal.info['transparency'] = bytes([0, HALF, SH] + [255] * 253)
    buf = io.BytesIO(); pal.save(buf, 'PNG', optimize=True, transparency=bytes([0, HALF, SH])); data = buf.getvalue()
    open(f, 'wb').write(data); js_wrap('vs/' + name, data, os.path.join(VS, name + '.js'))
    print(name, len(data) // 1024, 'KB')
# открытые экосистемы — тоже в data-URL
op = os.path.join(SITE, 'media/open.png')
if os.path.exists(op): js_wrap('open', open(op, 'rb').read(), os.path.join(SITE, 'media/open.js'))
