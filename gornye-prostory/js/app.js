(function(){
'use strict';
const D = window.GP_DATA || {}, M = window.GP_MEDIA || {viewpoints:[], paintings:[], mount:{}, story:[]};
const {C, THEMES, STORIES, FACTS, STEP, ZOOM_SRC, INFO, infoKey, LANDMARKS, CRIT, INTEREST, TODO, ROUTES, LEISURE_PHOTO, num} = window.GP;
const STEPS = window.GP_STEPS || {}, STATS = D._stats || {};
// глава «Сегодня»: после шага «Наши маршруты» — карточка-история для каждого маршрута экспедиции
(function(){ const T = STEPS.today; if(!T) return; const i = T.findIndex(s => s.title === 'Наши маршруты'); if(i < 0) return;
  const R = (D.routes?.features || []).map(f => { const p = f.properties, txt = ROUTES[p.name] || [p.description || ''];
    return {title:p.name, map:T[i].map, route:p.name, text:txt, look:'Розовым — этот маршрут, по нему едет наш велосипедист. Квадратики — наши снимки с маршрута.'}; });
  T.splice(i + 1, 0, ...R); })();
const $ = id => document.getElementById(id);
const body = document.body;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isTouch = matchMedia('(hover: none)').matches;
const isNarrow = () => innerWidth <= 820;
const pad2 = n => String(n).padStart(2, '0');
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const ICON = {
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 4 11l5 5M4 11h11a5 5 0 0 1 0 10h-3"/></svg>',
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>',
  eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};
const TILES = 'https://spbmlaplus.github.io/spb_mountains_tiles';

/* =========================================================
   Карта
   ========================================================= */
const HOME = {center:[30.32, 59.93], zoom:8.6};
// 3D включается кнопкой. Перепад высот всего 0–176 м, поэтому рельеф сильно растягиваем, в городе — меньше
// усиление рельефа: на общем виде сильное, чтобы горы читались; к уровню домов — почти реальное,
// иначе раздутые бугры модели рельефа протыкают здания и насыпи у мостов
const EXAG = 6, EXAG_CITY = 1.15;
const exagAt = z => z <= 10 ? EXAG : z >= 13.5 ? EXAG_CITY : EXAG + (EXAG_CITY - EXAG) * (z - 10) / 3.5;
let base = 'sat', is3D = false;
/* Ключ Mapbox (pk.…) — js/key.js. Если Mapbox отвечает (ключ живой, лимит не исчерпан), спутник берётся у него, иначе Esri.
   Высоты всегда открытые (Terrarium, AWS): они стабильно доступны и работают без ключа. */
const TOKEN = (() => { const qs = new URLSearchParams(location.search).get('key'); let saved = null;
  try{ if(qs && qs.startsWith('pk.')) localStorage.setItem('gp_mapbox_key', qs); saved = localStorage.getItem('gp_mapbox_key'); }catch(e){}
  return [window.MAPBOX_TOKEN, qs, saved].find(k => typeof k === 'string' && k.startsWith('pk.')) || null; })();
const ESRI = n => `https://server.arcgisonline.com/ArcGIS/rest/services/${n}/MapServer/tile/{z}/{y}/{x}`;
const SAT = {tiles:[ESRI('World_Imagery')], tileSize:256, maxzoom:18, attribution:'Снимок © Esri, Maxar, Earthstar Geographics'};
const DEM = {url:'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', encoding:'terrarium', maxzoom:12};
// изолинии 5 м считаются в браузере по той же модели высот (maplibre-contour)
let CONTOURS = null;
try{ if(window.mlcontour){
  const dem = new mlcontour.DemSource({url:DEM.url, encoding:DEM.encoding, maxzoom:DEM.maxzoom, worker:true, cacheSize:120});
  dem.setupMaplibre(maplibregl);
  CONTOURS = dem.contourProtocolUrl({multiplier:1, thresholds:{10:[10,50], 11:[10,50], 12:[5,25], 13:[5,25], 14:[5,25], 15:[5,25]},
    contourLayer:'contours', elevationKey:'ele', levelKey:'level', extent:4096, buffer:1});
} }catch(e){ console.warn('[изолинии]', e); }
const map = new maplibregl.Map({
  container:'map',
  style:{
    version:8,
    glyphs:new URL('fonts/', location.href).href + '{fontstack}/{range}.pbf',
    sources:{
      sat:{type:'raster', ...SAT},
      sat2:{type:'raster', tiles:[ESRI('World_Imagery')], tileSize:256, maxzoom:18, attribution:'Снимок © Esri, Maxar'},
      carto:{type:'raster', tiles:[ESRI('Canvas/World_Light_Gray_Base')], tileSize:256, maxzoom:16, attribution:'Схема © Esri'},
      relief:{type:'raster', tiles:[TILES + '/relief_water1/{z}/{x}/{y}.png'], scheme:'tms', tileSize:256, minzoom:10, maxzoom:14, attribution:'Рельеф © МЛА+'},
      dem:{type:'raster-dem', tiles:[DEM.url], encoding:DEM.encoding, tileSize:256, maxzoom:DEM.maxzoom},
      dem2:{type:'raster-dem', tiles:[DEM.url], encoding:DEM.encoding, tileSize:256, maxzoom:DEM.maxzoom},
      // дома: OpenFreeMap (OpenStreetMap), высоты этажности — без ключа
      omt:{type:'vector', url:'https://tiles.openfreemap.org/planet', attribution:'Дома © OpenStreetMap, OpenFreeMap'},
      ...(CONTOURS ? {contours:{type:'vector', tiles:[CONTOURS], maxzoom:15}} : {})
    },
    layers:[
      {id:'bg', type:'background', paint:{'background-color':'#0d1820'}},
      {id:'sat2', type:'raster', source:'sat2', layout:{visibility:'none'}, paint:{'raster-saturation':-0.35,'raster-brightness-max':0.8,'raster-contrast':0.08}},
      {id:'sat', type:'raster', source:'sat', paint:{'raster-saturation':-0.22,'raster-brightness-max':0.86,'raster-contrast':0.06,'raster-fade-duration':150}},
      {id:'carto', type:'raster', source:'carto', layout:{visibility:'none'}, paint:{'raster-saturation':-0.4}},
      {id:'hill', type:'hillshade', source:'dem2', paint:{'hillshade-exaggeration':0.6,'hillshade-shadow-color':'rgba(8,16,24,0.6)',
        'hillshade-highlight-color':'rgba(255,255,255,0.28)','hillshade-accent-color':'rgba(0,0,0,0)','hillshade-illumination-direction':315}},
      {id:'relief', type:'raster', source:'relief', layout:{visibility:'none'}, paint:{'raster-opacity':0.5}},
    ]
  },
  ...HOME, pitch:0, bearing:0, minZoom:7.5, maxZoom:17.5, maxPitch:75,
  attributionControl:{compact:true},
  // на телефонах с экраном ×3 рисуем в ×2 — разницы не видно, а кадров вдвое больше
  pixelRatio:Math.min(window.devicePixelRatio || 1, 2),
  fadeDuration:150
});
map.on('zoomend', () => { const e = exagAt(map.getZoom()); if(is3D && terrainOk && Math.abs(e - curExag) > 0.05){ curExag = e; try{ map.setTerrain({source:demSrc, exaggeration:e}); }catch(_){} } });   // точное значение — в конце приближения
window.GPMap = map;
if(TOKEN) fetch(`https://api.mapbox.com/v4/mapbox.satellite/9/297/147.jpg90?access_token=${TOKEN}`).then(r => { if(!r.ok) throw r.status;
  map.once('idle', () => { try{ map.getSource('sat').setTiles([`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${TOKEN}`]); }catch(_){} });
}).catch(e => console.info('[Mapbox] недоступен (' + e + '), спутник — Esri'));
// охват карты = охват самого большого слоя: за его краем данных нет, и границы слоёв не торчат
(function(){ const b = [180, 90, -180, -90]; let best = 0, bb = null;
  const walk = (c, x) => { if(typeof c[0] === 'number'){ x[0] = Math.min(x[0], c[0]); x[1] = Math.min(x[1], c[1]); x[2] = Math.max(x[2], c[0]); x[3] = Math.max(x[3], c[1]); } else c.forEach(cc => walk(cc, x)); };
  Object.entries(D).forEach(([k, fc]) => { if(!fc || !fc.features || /^_|dominants|dom_poly|finns_today/.test(k)) return; const x = [180, 90, -180, -90];
    fc.features.forEach(f => f.geometry && walk(f.geometry.coordinates, x)); const a = (x[2] - x[0]) * (x[3] - x[1]); if(a > best && a < 40){ best = a; bb = x; } });
  if(bb){ const dx = (bb[2] - bb[0]) * 0.08, dy = (bb[3] - bb[1]) * 0.08; map.setMaxBounds([[bb[0] - dx, bb[1] - dy], [bb[2] + dx, bb[3] + dy]]); }
})();
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({unit:'metric', maxWidth:110}), 'bottom-left');
let demFails = 0, terrainOk = true, satFails = 0; const demSrc = 'dem';
map.on('error', e => {
  if(e.sourceId === 'sat' && TOKEN && ++satFails === 5){ try{ map.setLayoutProperty('sat2','visibility','visible'); map.setLayoutProperty('sat','visibility','none'); }catch(_){} }
  if((e.sourceId === 'dem' || e.sourceId === 'dem2') && ++demFails === 12){ terrainOk = false; try{ map.setTerrain(null); }catch(_){} toast('Модель высот не загрузилась — 3D недоступно'); }
});

const HOVER = ['boolean',['feature-state','hover'],false];
const hov = (a, b) => ['case', HOVER, b, a];
const GROUPS = {}, CLICK = [], THEMED = [];
/* Новостройки — сами дома (контуры из dom_poly) с данными доминанты: построена, строится или планируется.
   «Топ» — самые заметные: высокие и видные с наибольшего числа смотровых точек. */
const NEWB_TOP = 12;
(() => {
  // уточнённые статусы: в выгрузке ДОМ.РФ дома помечены «потенциальными», но по открытым источникам уже сданы (проверено 20.11.2026)
  const BUILT = [/LEGENDA Комендантского/i, /Ultra City/i];
  (D.dominants?.features || []).forEach(f => { const p = f.properties; if(p.class === 'Новая' && p.status !== 'существующая' && BUILT.some(r => r.test(p.name || ''))){ p.status = 'существующая'; p.status_note = 'сдан, по открытым источникам'; } });
  const byI = {}; (D.dominants?.features || []).forEach(f => byI[f.properties.i] = f);
  const isNew = f => f && f.properties.class === 'Новая';
  const score = p => (p.vis_n || 0) * (p.height_m || 0);
  const ranked = (D.dominants?.features || []).filter(f => isNew(f) && f.properties.name).sort((a, b) => score(b.properties) - score(a.properties));
  const topRank = {}; ranked.slice(0, NEWB_TOP).forEach((f, k) => topRank[f.properties.i] = k + 1);
  (D.dominants?.features || []).forEach(f => { if(topRank[f.properties.i]) f.properties.top_new = topRank[f.properties.i]; });
  D.newb = {type:'FeatureCollection', features:(D.dom_poly?.features || []).filter(f => isNew(byI[f.properties.i]))
    .map(f => ({type:'Feature', properties:{...byI[f.properties.i].properties}, geometry:f.geometry}))};
  D.newb_pt = {type:'FeatureCollection', features:(D.dominants?.features || []).filter(isNew)};
  // самые активные стройки — пузыри по районам: дом относится к ближайшему району в пределах 4 км
  const AREAS = [['Мурино',30.45,60.05],['Новое Девяткино',30.48,60.065],['Кудрово',30.51,59.905],['Янино',30.56,59.95],['Бугры',30.39,60.07],['Парголово',30.27,60.08],
    ['Шушары',30.40,59.80],['Пулково',30.33,59.815],['Купчино',30.38,59.835],['Рыбацкое',30.50,59.835],['Обухово',30.45,59.87],['Колпино',30.59,59.75],['Лахта',30.18,60.0],
    ['Комендантский',30.25,60.01],['Каменка',30.25,60.035],['Юго-Запад',30.18,59.85],['Новоселье',30.10,59.82],['Горелово',30.13,59.77],['Красное Село',30.08,59.73],['Пушкин',30.40,59.72],
    ['Сертолово',30.20,60.14],['Всеволожск',30.64,60.02],['Охта',30.45,59.94],['Стрельна',30.03,59.85],['Петергоф',29.90,59.88],['Сестрорецк',29.97,60.10],['Намыв Васильевского',30.21,59.945],
    ['Кировский',30.26,59.88],['Московский',30.32,59.86],['Полюстрово',30.42,59.98],['Выборгская сторона',30.35,59.99]];
  const km = (a, b) => Math.hypot((a[0] - b[0]) * 55.6, (a[1] - b[1]) * 111.2);
  const grp = {};
  D.newb_pt.features.forEach(f => { const c = f.geometry.coordinates; let best = null, bd = 4;
    AREAS.forEach(([n, x, y]) => { const d = km(c, [x, y]); if(d < bd){ bd = d; best = n; } });
    if(!best) return; const g = grp[best] = grp[best] || {n:0, x:0, y:0, plan:0}; g.n++; g.x += c[0]; g.y += c[1]; if(f.properties.status !== 'существующая') g.plan++; });
  D.newb_cl = {type:'FeatureCollection', features:Object.entries(grp).filter(([, g]) => g.n >= 12).sort((a, b) => b[1].n - a[1].n)
    .map(([name, g]) => ({type:'Feature', properties:{name, n:g.n, plan:g.plan, label:`${name}\n${g.n} ${plural(g.n, 'дом', 'дома', 'домов')}${g.plan ? `, ${g.plan} в планах` : ''}`}, geometry:{type:'Point', coordinates:[g.x / g.n, g.y / g.n]}}))};
})();
const SRC = {dom_threat:'newb', law_lost:'law_views', law_ok:'law_views'};
const srcOf = k => SRC[k] || k;
// значение зависит от подложки: [для схемы, для спутника]
const T = (light, dark) => ({_t:[light, dark]});
const hasT = v => v && typeof v === 'object' && (v._t || (Array.isArray(v) ? v.some(hasT) : Object.values(v).some(hasT)));
const pick = (v, dark) => v && typeof v === 'object' ? (v._t ? v._t[dark ? 1 : 0] : Array.isArray(v) ? v.map(x => pick(x, dark)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pick(x, dark)]))) : v;
function resolve(layer){
  ['paint','layout'].forEach(kind => { const o = layer[kind]; if(!o) return;
    for(const k in o) if(hasT(o[k])){ THEMED.push([layer.id, kind, k, o[k]]); o[k] = pick(o[k], base === 'sat'); } });
  return layer;
}
function addSrc(key){ const s = srcOf(key); if(!map.getSource(s) && D[s]) map.addSource(s, {type:'geojson', data:D[s], generateId:true}); return s; }
function add(key, layers, clickable){
  const s = srcOf(key); if(!D[s]) return;
  addSrc(key); GROUPS[key] = [];
  layers.forEach(l => { map.addLayer(resolve({source:s, ...l, layout:{visibility:'none', ...(l.layout||{})}})); GROUPS[key].push(l.id); });
  if(clickable){ const f = layers.find(l => l.type === 'fill') || layers[layers.length - 1]; CLICK.push([f.id, key]); }
}
const INK = T(C.ink, C.cream), HALO = T('rgba(255,255,255,0.92)', 'rgba(6,12,18,0.82)');
// подписи: один шрифт, два тона — главный (белый/чёрный) и спокойный (серый), мягкий ореол, без плашек
const TXT1 = T('#0d1820', '#ffffff'), TXT2 = T('#55606a', '#c3cbd0');

/* ---------- значки и штриховки рисуются на лету ---------- */
function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function pattern(kind, color){
  const s = 32, [c, g] = canvas(s, s); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.2; g.lineCap = 'square';
  if(kind === 'hatch'){ for(let i = -s; i < s * 2; i += 10){ g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke(); } }
  if(kind === 'strata'){ for(let y = 4; y < s; y += 10){ g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } }
  if(kind === 'dots'){ [[6,6],[22,6],[14,16],[30,16],[6,26],[22,26]].forEach(([x,y]) => { g.beginPath(); g.arc(x % s, y, 2.4, 0, 7); g.fill(); }); }
  if(kind === 'waves'){ g.lineWidth = 2; for(let y = 6; y < s; y += 11){ g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(8, y - 6, 8, y + 6, 16, y); g.bezierCurveTo(24, y - 6, 24, y + 6, 32, y); g.stroke(); } }
  return g.getImageData(0, 0, s, s);
}
const patName = (kind, color) => 'p-' + kind + '-' + color.replace('#','');
function ensurePattern(kind, color){ const n = patName(kind, color); if(!map.hasImage(n)) map.addImage(n, pattern(kind, color), {pixelRatio:2}); return n; }
function icon(name, size, draw){ const [c, g] = canvas(size, size); draw(g, size); map.addImage(name, g.getImageData(0, 0, size, size), {pixelRatio:2}); }
function triIcon(name, fill, stroke){ icon(name, 44, (g, s) => { g.beginPath(); g.moveTo(s/2, 5); g.lineTo(s - 5, s - 7); g.lineTo(5, s - 7); g.closePath();
  g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = stroke; g.stroke(); g.fillStyle = fill; g.fill(); }); }
// ярусы амфитеатра — в цветах рисунка амфитеатра: зелёные сцена, партер, бельэтаж и песочный балкон
const TIERC = ['#769686', '#92BAA8', '#C0DFCA', '#FBE8B9'];   // сцена, партер, бельэтаж, балкон — как на рисунке амфитеатра
/* Классы по уникальным значениям: [значение, цвет, знак, множитель размера] */
const CLS = {
  // типы усадеб — разными оттенками, чтобы их легко различать на карте и в легенде
  estate:{field:'type', list:[['Дворец','#E8B400','diamond',1.3],['Усадьба','#E8742A','diamond',1.1],['Мыза','#B5523B','square',1],['Вилла','#2FA39A','dot',0.95],
    ['Особняк','#8A6FD8','square',0.95],['Дом','#4F8FD0','square',0.8],['Дача','#F4E3A8','dot',0.5]]},
  leisure:{field:'kind', list:[['Горнолыжный курорт','#4F8FD0','tri',1.15],['Парапланеризм','#8E6FD8','tri',1],['Конный клуб','#E15989','dot',0.85],
    ['Мотокросс','#E5383B','square',0.9],['Гольф-клуб','#2F8F5B','dot',0.9]]},
  sectors:{field:'type', list:[['сцена',TIERC[0],'fill',1],['партер',TIERC[1],'fill',1],['бельэтаж',TIERC[2],'fill',1],['балкон',TIERC[3],'fill',1]]},
  mount:{field:'type', list:[['гора','#1E2B36','tri',1.35],['возвышенность','#4E6B7E','tri',0.95],['холм','#8FA9B8','tri',0.62]]},
  vp_old:{field:'todo', list:[['охранять','#E5383B','none',1],['формировать','#E8A317','none',1],['расчищать','#4F8FD0','none',1]]},
  dom_threat:{field:'status', list:[['существующая','#E5383B','fill',1],['строящаяся','#F08A24','fill',1],['потенциальная (дом.рф)','#B04FD6','fill',1]]},
  oopt:{field:'kind', list:[['заказник','#2F8F5B','fill',1],['памятник природы','#6DBB8A','fill',1],['Охраняемый природный ландшафт','#9CCFAE','fill',1],['природный парк','#1F6B43','fill',1]]}
};
const clsOff = {}; Object.keys(CLS).forEach(k => clsOff[k] = new Set());
const BASEF = {'lab-estate':['!=',['get','type'],'Дача'], 'lab-estate-d':['==',['get','type'],'Дача']};
const clsName = (k, v) => k === 'dom_threat' ? ({'существующая':'Построены','строящаяся':'Строятся','потенциальная (дом.рф)':'Планируются'})[v] || v : k === 'sectors' || k === 'mount' || k === 'vp_old' ? cap(v) : v;
/* Иконка-«рябь»: мягкие концентрические круги и ядро со знаком (как в инфографике-референсе) */
function ripple(name, color, glyph = 'dot', ring = 1){
  if(map.hasImage(name)) return name;
  const S = 176, [c, g] = canvas(S, S), R = S / 2 - 2, cx = S / 2;
  const rings = ring ? 5 : 1;
  for(let k = 0; k < rings; k++){ const r = R * (1 - k * 0.15) * (ring ? 1 : 0.35);
    g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fillStyle = color; g.globalAlpha = ring ? 0.13 + k * 0.08 : 1; g.fill();
    g.globalAlpha = ring ? 0.35 : 0; g.lineWidth = 1.2; g.strokeStyle = '#ffffff'; g.stroke(); }
  g.globalAlpha = 1; const cr = R * 0.27;
  g.beginPath(); g.arc(cx, cx, cr, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 4; const q = cr * 0.55;
  if(glyph === 'tri'){ g.beginPath(); g.moveTo(cx, cx - q); g.lineTo(cx + q, cx + q * 0.75); g.lineTo(cx - q, cx + q * 0.75); g.closePath(); g.fill(); }
  else if(glyph === 'diamond'){ g.beginPath(); g.moveTo(cx, cx - q); g.lineTo(cx + q, cx); g.lineTo(cx, cx + q); g.lineTo(cx - q, cx); g.closePath(); g.fill(); }
  else if(glyph === 'square'){ g.fillRect(cx - q * 0.8, cx - q * 0.65, q * 1.6, q * 1.3); }
  else if(glyph === 'x'){ g.beginPath(); g.moveTo(cx - q, cx - q); g.lineTo(cx + q, cx + q); g.moveTo(cx + q, cx - q); g.lineTo(cx - q, cx + q); g.stroke(); }
  else if(glyph === 'dot'){ g.beginPath(); g.arc(cx, cx, q * 0.45, 0, Math.PI * 2); g.fill(); }
  map.addImage(name, g.getImageData(0, 0, S, S), {pixelRatio:2});
  return name;
}
function vpIcon(name, color, style, full){
  if(map.hasImage(name)) return name;
  const S = 120, [c, g] = canvas(S, S), cx = S / 2, R = S / 2 - 6, a = Math.PI / 3.2;
  g.lineJoin = 'round';
  const shape = () => { g.beginPath(); if(full) g.arc(cx, cx, R * 0.72, 0, Math.PI * 2); else { g.moveTo(cx, cx); g.arc(cx, cx, R, -Math.PI / 2 - a, -Math.PI / 2 + a); g.closePath(); } };
  shape(); g.lineWidth = 9; g.strokeStyle = 'rgba(13,24,32,.55)'; g.stroke();
  if(style === 'fill'){ shape(); g.fillStyle = color; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(); }
  else { shape(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); if(style === 'dash') g.setLineDash([9, 6]); g.lineWidth = 7; g.strokeStyle = color; g.stroke(); g.setLineDash([]); }
  g.beginPath(); g.arc(cx, cx, 9, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = color; g.stroke();
  map.addImage(name, g.getImageData(0, 0, S, S), {pixelRatio:2});
  return name;
}
function plaque(name, fill){ const [c, g] = canvas(16, 16); g.fillStyle = fill; g.fillRect(0, 0, 16, 16);
  map.addImage(name, g.getImageData(0, 0, 16, 16), {pixelRatio:2, stretchX:[[4,12]], stretchY:[[4,12]], content:[4,4,12,12]}); }

let ready = false; const queue = [];
const whenReady = fn => ready ? fn() : queue.push(fn);
const FONT_B = ['Geologica SemiBold'], FONT_R = ['Geologica Regular'];
const DOMC = {h:'#F6E7B0', e:'#8FD3E8', n:'#A9B2B7'};   // доминанты: историческая — светлое золото, инженерная — голубая, новая — серая

map.once('style.load', () => {
  triIcon('tri-l', C.ink, C.cream); triIcon('tri-d', C.cream, C.ink); triIcon('tri-g', C.green, C.cream);
  [['гора','#13232F','#F7F4EC'],['возвышенность','#4E6B7E','#C9D6DD'],['холм','#8FA9B8','#93A9B6']].forEach(([t, l, d]) => { triIcon('m-' + t + '-l', l, '#F3EFE6'); triIcon('m-' + t + '-d', d, '#0d1820'); });
  icon('diamond', 40, (g, s) => { g.translate(s/2, s/2); g.rotate(Math.PI/4); g.fillStyle = C.yellow; g.strokeStyle = C.ink; g.lineWidth = 4; g.fillRect(-10, -10, 20, 20); g.strokeRect(-10, -10, 20, 20); });
  icon('frame', 40, (g, s) => { g.fillStyle = C.ink; g.fillRect(5, 8, 30, 24); g.fillStyle = C.cream; g.fillRect(9, 12, 22, 16); g.fillStyle = C.pink; g.beginPath(); g.moveTo(11, 26); g.lineTo(18, 17); g.lineTo(23, 22); g.lineTo(26, 19); g.lineTo(29, 26); g.fill(); });
  icon('lost', 44, (g, s) => { g.beginPath(); g.moveTo(s/2, 6); g.lineTo(s - 6, s - 8); g.lineTo(6, s - 8); g.closePath(); g.lineWidth = 3; g.setLineDash([5,4]); g.strokeStyle = C.cream; g.stroke();
    g.setLineDash([]); g.lineWidth = 9; g.strokeStyle = C.cream; g.beginPath(); g.moveTo(9, 9); g.lineTo(s - 9, s - 9); g.moveTo(s - 9, 9); g.lineTo(9, s - 9); g.stroke();
    g.lineWidth = 5; g.strokeStyle = C.red; g.stroke(); });
  const pInk = ensurePattern('hatch', C.ink), pCream = ensurePattern('hatch', C.cream);

  /* --- основа --- */
  add('mask', [{id:'mask', type:'fill', paint:{'fill-color':T('#ffffff', '#060d13'), 'fill-opacity':T(0.6, 0.5)}}]);
  // дома в 3D: коробки по высоте из OpenStreetMap, проявляются с 13-го масштаба
  // дома OSM выше 250 м (Лахта-центр) не рисуем — вместо них подробная модель из scene3d.js
  map.addLayer(resolve({id:'bld', type:'fill-extrusion', source:'omt', 'source-layer':'building', minzoom:13,
    // под объёмными моделями (scene3d.js) дома OSM не рисуем, чтобы не было двойных зданий; радиус — по размеру модели
    // (Адмиралтейство — исключение: здание рисует OSM, модель — только башня со шпилем)
    filter:['all',['<',['coalesce',['get','render_height'],0],250],
      ...[[30.17814,59.98703,45],[30.32083,59.97667,30],[30.30611,59.93395,45],[30.3166,59.9502,25],[30.3954,59.9488,25],[30.2205,59.9730,140]]
        .map(([x, y, r]) => ['>',['distance',{type:'Point',coordinates:[x, y]}],r])],
    paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],9],3,'#d8d0c2',20,'#e6dccb',45,'#f0c9cf',90,'#e98fac'],
      'fill-extrusion-height':['interpolate',['linear'],['zoom'],13,0,14.2,['coalesce',['get','render_height'],9]],
      'fill-extrusion-base':['interpolate',['linear'],['zoom'],13,0,14.2,['coalesce',['get','render_min_height'],0]],
      'fill-extrusion-opacity':T(0.8, 0.88), 'fill-extrusion-vertical-gradient':true}}));
  add('isolines', [
    {id:'iso', type:'line', minzoom:8, ...(CONTOURS ? {maxzoom:11} : {}), filter:['!=',['%',['to-number',['get','ELEV'],1],25],0], paint:{'line-color':T('#8d6f5c', C.cream),'line-width':['interpolate',['linear'],['zoom'],8,0.5,11,0.9],'line-opacity':['interpolate',['linear'],['zoom'],8,T(0.45, 0.35),10.5,T(0.75, 0.55)]}},
    {id:'iso-i', type:'line', ...(CONTOURS ? {maxzoom:11} : {}), filter:['==',['%',['to-number',['get','ELEV'],1],25],0], paint:{'line-color':T('#7d5e4b', C.cream),'line-width':['interpolate',['linear'],['zoom'],8,1.2,13,2],'line-opacity':T(0.95, 0.85)}}]);   // изолинии заметнее уже на общем виде
  // изолинии 5 м поверх спутника (с 11-го масштаба; утолщённые — каждые 25 м)
  if(CONTOURS){
    [{id:'c5', type:'line', source:'contours', 'source-layer':'contours', minzoom:11, filter:['==',['get','level'],0],
      paint:{'line-color':T('#8d6f5c', '#f3efe6'),'line-width':['interpolate',['linear'],['zoom'],11,0.5,15,1],'line-opacity':T(0.65, 0.5)}},
     {id:'c25', type:'line', source:'contours', 'source-layer':'contours', minzoom:11, filter:['>',['get','level'],0],
      paint:{'line-color':T('#7d5e4b', '#f3efe6'),'line-width':['interpolate',['linear'],['zoom'],11,1,15,1.9],'line-opacity':T(0.9, 0.75)}}]
    .forEach(l => { map.addLayer(resolve({...l, layout:{'line-join':'round', visibility:'none'}})); GROUPS.isolines.push(l.id); });
  }

  /* --- приглушение фона: тема на карте — ярче, остальное темнее --- */
  map.addLayer({id:'dim', type:'background', layout:{visibility:'none'}, paint:{'background-color':'#05090d','background-opacity':0.45}});
  /* --- площади --- */
  add('mount_polygon', [{id:'mount_polygon-f', type:'fill', paint:{'fill-pattern':T(pInk, pCream),'fill-opacity':['interpolate',['linear'],['zoom'],12,T(0.35, 0.4),13.5,0]}},
                        {id:'mount_polygon-l', type:'line', paint:{'line-color':INK,'line-opacity':0.6,'line-width':0.9}}]);
  // ярус: маска (всё, кроме яруса) темнеет, сам ярус — цветной с контуром. Маска в данных — прямоугольник с дырами-ярусами.
  [['mask_stage',TIERC[0]],['mask_parter',TIERC[1]],['mask_belletazh',TIERC[2]],['mask_balcon',TIERC[3]]].forEach(([k, col]) => {
    const g = D[k]?.features?.[0]?.geometry; if(!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const tier = 'tier_' + k.slice(5);
    D[tier] = {type:'FeatureCollection', features:polys.flatMap(p => p.slice(1)).map(r => ({type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[r]}}))};
    map.addSource(tier, {type:'geojson', data:D[tier]});
    addSrc(k); GROUPS[k] = [k + '-dim', k, k + '-l'];
    map.addLayer({id:k + '-dim', type:'fill', source:k, layout:{visibility:'none'}, paint:{'fill-color':'#05090d','fill-opacity':0}});
    map.addLayer({id:k, type:'fill', source:tier, layout:{visibility:'none'}, paint:{'fill-color':col,'fill-opacity':0.3}});
    map.addLayer({id:k + '-l', type:'line', source:tier, layout:{visibility:'none'}, paint:{'line-color':col,'line-width':2.4}});
  });
  [['landscape_450',C.blue1,'strata'],['landscape_25',C.blue2,'dots'],['landscape_12',C.blue3,'hatch'],['landscape_7',C.blue4,'waves']].forEach(([k, col, pat]) => add(k, [
    {id:k+'-f', type:'fill', paint:{'fill-color':col,'fill-opacity':hov(0.5, 0.68)}},
    {id:k+'-p', type:'fill', paint:{'fill-pattern':ensurePattern(pat, '#ffffff'),'fill-opacity':0.45}},
    {id:k+'-l', type:'line', paint:{'line-color':col,'line-width':1.6}}], true));
  add('resettlement', [{id:'resettlement-f', type:'fill', paint:{'fill-color':C.sand,'fill-opacity':hov(0.5, 0.75)}},
                       {id:'resettlement-l', type:'line', paint:{'line-color':T(C.brown, C.cream),'line-width':0.8,'line-opacity':0.8}}], true);
  // мяки и сельки — розовая заливка; подпись — финское имя и русское значение
  add('maki_selki', [{id:'maki_selki-f', type:'fill', paint:{'fill-color':'#E86FA0','fill-opacity':hov(0.42, 0.62)}},
                     {id:'maki_selki-l', type:'line', paint:{'line-color':'#FFB3D1','line-width':1.2}}], true);
  if(D.maki_selki){
    const MK = window.GP.MAKI || {};
    map.addSource('maki-pts', {type:'geojson', data:{type:'FeatureCollection', features:D.maki_selki.features.filter(f => f.properties.name).map(f => {
      const nm = String(f.properties.name).trim(), ru = (MK[nm] || '').replace(/\s*\(.*$/, '');
      return {type:'Feature', properties:{name:nm, ru:ru ? ru[0].toUpperCase() + ru.slice(1) : ''}, geometry:{type:'Point', coordinates:centroid(f.geometry)}}; })}});
    map.addLayer(resolve({id:'lab-maki', type:'symbol', source:'maki-pts', minzoom:9.5, layout:{visibility:'none',
      'text-field':['format',['get','name'],{'text-font':['literal',FONT_B]},'\n',{},['get','ru'],{'font-scale':0.82}],
      'text-font':FONT_R,'text-size':['interpolate',['linear'],['zoom'],9.5,11,13,13.5],'text-max-width':11,'text-line-height':1.15,'text-padding':3},
      paint:{'text-color':T('#7a1f48','#FFD3E6'),'text-halo-color':T('rgba(255,255,255,0.95)','rgba(6,12,18,0.85)'),'text-halo-width':1.4}}));
    GROUPS.maki_selki.push('lab-maki');
  }
  add('bubbles', [{id:'bubbles-f', type:'fill', paint:{'fill-color':C.red,'fill-opacity':hov(0.6, 0.85)}}], true);
  add('oopt', [{id:'oopt-f', type:'fill', paint:{'fill-color':C.green,'fill-opacity':hov(0.36, 0.55)}}, {id:'oopt-l', type:'line', paint:{'line-color':C.green,'line-width':1.6}}], true);
  add('zol', [{id:'zol-f', type:'fill', paint:{'fill-color':'#8CC9A2','fill-opacity':hov(0.3, 0.5)}}, {id:'zol-l', type:'line', paint:{'line-color':'#8CC9A2','line-width':1,'line-dasharray':[3,2]}}], true);
  add('law_relief', [{id:'law_relief-f', type:'fill', paint:{'fill-color':C.green,'fill-opacity':hov(0.12, 0.3)}},
                     {id:'law_relief-p', type:'fill', paint:{'fill-pattern':ensurePattern('hatch', C.green),'fill-opacity':0.9}},
                     {id:'law_relief-l', type:'line', paint:{'line-color':C.green,'line-width':1.4}}], true);
  // открытые пространства под угрозой — лёгкая полупрозрачная зелень без штриховки
  add('reserve', [{id:'reserve-f', type:'fill', paint:{'fill-color':'#7BC86C','fill-opacity':hov(0.22, 0.42)}},
                  {id:'reserve-l', type:'line', paint:{'line-color':'#9BE08A','line-opacity':0.75,'line-width':['interpolate',['linear'],['zoom'],8,0.3,12,1.1]}}], true);
  if(D._loss_bounds){
    map.addSource('loss', {type:'image', url:'media/loss.png', coordinates:D._loss_bounds});
    map.addLayer({id:'loss', type:'raster', source:'loss', layout:{visibility:'none'}, paint:{'raster-opacity':0.9,'raster-fade-duration':0}});
    GROUPS.loss = ['loss'];
  }

  // открытые экосистемы в зоне видимости смотровых точек
  if(window.GP_OPEN){ map.addSource('open_eco', {type:'image', url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', coordinates:window.GP_OPEN.coords});
    imgData('media/open.png').then(u => map.getSource('open_eco').updateImage({url:u, coordinates:window.GP_OPEN.coords}));
    map.addLayer({id:'open_eco', type:'raster', source:'open_eco', layout:{visibility:'none'}, paint:{'raster-opacity':0.6,'raster-fade-duration':0,'raster-resampling':'nearest'}}); GROUPS.open_eco = ['open_eco']; }
  /* --- линии --- */
  const secCol = ['match',['get','type'], ...CLS.sectors.list.flatMap(([v, c]) => [v, c]), '#ccc'];
  add('sectors', [{id:'sectors-f', type:'fill', paint:{'fill-color':secCol,'fill-opacity':hov(0.5, 0.7)}},
                  {id:'sectors-l', type:'line', paint:{'line-color':'#ffffff','line-opacity':0.85,'line-width':['interpolate',['linear'],['zoom'],8,0.8,12,1.8]}}], true);
  // точки подписей секторов — в «центре» самого большого кольца
  D.sector_pts = {type:'FeatureCollection', features:(D.sectors?.features || []).map(f => { const g = f.geometry, P = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const ring = P.map(p => p[0]).sort((a, b) => b.length - a.length)[0]; const c = ring.reduce((a, q) => [a[0] + q[0] / ring.length, a[1] + q[1] / ring.length], [0, 0]);
    return {type:'Feature', properties:{name:f.properties.type_2, type:f.properties.type}, geometry:{type:'Point', coordinates:c}}; })};
  add('vomitoria', [{id:'vom-c', type:'line', layout:{'line-cap':'round'}, paint:{'line-color':T('#fff', C.ink),'line-width':6}},
                    {id:'vomitoria', type:'line', layout:{'line-cap':'round'}, paint:{'line-color':C.blue2,'line-width':3}}]);
  add('law_zone', [{id:'law_zone-c', type:'line', paint:{'line-color':T('#fff', C.ink),'line-width':5}},
                   {id:'law_zone', type:'line', paint:{'line-color':INK,'line-width':2.2,'line-dasharray':[3,2]}}], true);
  add('law_ok', [{id:'law_ok', type:'line', filter:['!=',['get','state'],'Утр.'], layout:{'line-cap':'round'}, paint:{'line-color':C.green,'line-width':hov(2.2, 4)}}], true);
  add('law_lost', [{id:'law_lost-c', type:'line', filter:['==',['get','state'],'Утр.'], paint:{'line-color':T('#fff', C.ink),'line-width':5}},
                   {id:'law_lost', type:'line', filter:['==',['get','state'],'Утр.'], paint:{'line-color':C.red,'line-width':hov(2.6, 4.4),'line-dasharray':[2,1.5]}}], true);
  add('walking', [{id:'walking-glow', type:'line', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':T('#FC5200','#FF7A2E'),'line-width':['interpolate',['linear'],['zoom'],8,3,13,7],'line-blur':['interpolate',['linear'],['zoom'],8,2,13,5],'line-opacity':T(0.12, 0.16)}},
                  {id:'walking', type:'line', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':T('#E84A00','#FFB27A'),'line-width':['interpolate',['linear'],['zoom'],8,0.7,13,1.6],'line-opacity':hov(0.38, 0.9)}}], true);
  // плотность троп и наших треков: издалека — тепловое пятно (точки через каждые ~400 м линии), вблизи — сами линии.
  // Источник пустой, точки считаются только при первом заходе в «Маршруты» (см. buildTrackHeat)
  map.addSource('track-pts', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  {
    map.addLayer({id:'track-heat', type:'heatmap', source:'track-pts', maxzoom:12.5, layout:{visibility:'none'},
      paint:{'heatmap-weight':['get','w'],'heatmap-radius':['interpolate',['linear'],['zoom'],8,6,12,18],'heatmap-intensity':['interpolate',['linear'],['zoom'],8,0.6,12,1.4],
        'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',0.15,'rgba(232,74,0,0.25)',0.4,'rgba(252,82,0,0.55)',0.7,'#FF9A3D',1,'#FFE3B0'],
        'heatmap-opacity':['interpolate',['linear'],['zoom'],10.5,0.95,12.5,0]}});
    GROUPS.track_heat = ['track-heat']; }
  add('routes', [{id:'routes-c', type:'line', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':T('#fff', C.ink),'line-width':6}},
                 {id:'routes', type:'line', layout:{'line-join':'round'}, paint:{'line-color':C.pink,'line-width':hov(3, 4.5),'line-dasharray':[2.5,1.5]}}], true);
  add('trail', [{id:'trail-c', type:'line', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':T('#fff', C.ink),'line-width':8}},
                {id:'trail', type:'line', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':C.pink,'line-width':hov(4, 5.5)}}], true);
  add('sightlines', [{id:'sightlines', type:'line', paint:{'line-color':C.pink,'line-width':1.2,'line-opacity':0.8}}]);
  add('bound', [{id:'bound-c', type:'line', paint:{'line-color':T('#fff', C.ink),'line-width':4.5,'line-opacity':0.7}},
                {id:'bound', type:'line', paint:{'line-color':INK,'line-width':2}}]);
  add('stage', [{id:'stage', type:'line', paint:{'line-color':INK,'line-width':1.2,'line-dasharray':[2,2]}}]);
  // сцена и секторы амфитеатра (стиль QGIS sectors_level): секторы — тонкий пунктир, сцена (type_gis = 1) — косая штриховка
  if(D.sectors){ map.addSource('seclev', {type:'geojson', data:D.sectors}); GROUPS.seclev = ['seclev-scene','seclev-l'];
    map.addLayer(resolve({id:'seclev-scene', type:'fill', source:'seclev', filter:['==',['get','type_gis'],1], layout:{visibility:'none'},
      paint:{'fill-pattern':T(ensurePattern('hatch', '#327E69'), ensurePattern('hatch', '#ffffff')),
        'fill-opacity':['interpolate',['linear'],['zoom'],12,T(0.6, 0.45),13.5,0]}}));   // вблизи штриховка ложится поверх домов мелкой рябью — гасим
    map.addLayer(resolve({id:'seclev-scene-l', type:'line', source:'seclev', filter:['==',['get','type_gis'],1], layout:{visibility:'none'},
      paint:{'line-color':T('#327E69', '#ffffff'),'line-opacity':0.8,'line-width':1.4}}));
    map.addLayer(resolve({id:'seclev-l', type:'line', source:'seclev', layout:{visibility:'none'},
      paint:{'line-color':T('#000000', '#ffffff'),'line-opacity':T(0.55, 0.6),'line-width':['interpolate',['linear'],['zoom'],8,0.5,12,1],'line-dasharray':[4,3]}})); }

  /* --- затемнение вне зоны видимости --- */
  map.addSource('vs-out', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'vs-out', type:'fill', source:'vs-out', paint:{'fill-color':'#05090d','fill-opacity':0.42}});   // невидимое с точки притушено, но остаётся различимым
  map.addSource('vs-ray', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'vs-ray', type:'line', source:'vs-ray', paint:{'line-color':C.pink,'line-width':2,'line-dasharray':[1,1.5]}});
  map.addSource('cone', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addSource('domrays', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'domrays', type:'line', source:'domrays', paint:{'line-color':'#F6E7B0','line-width':1,'line-opacity':0.55,'line-dasharray':[3,2]}});
  map.addLayer({id:'cone', type:'fill', source:'cone', paint:{'fill-color':C.pink,'fill-opacity':0.28}});
  map.addLayer({id:'cone-l', type:'line', source:'cone', paint:{'line-color':C.pink,'line-width':1.6}});

  /* --- застройка в зоне видимости --- */
  map.addSource('dom_poly', {type:'geojson', data:D.dom_poly || {type:'FeatureCollection', features:[]}});
  map.addLayer({id:'dom_poly', type:'fill', source:'dom_poly', minzoom:11, filter:['in',['get','i'],['literal',[]]], paint:{'fill-color':C.cream,'fill-opacity':0.95,'fill-outline-color':C.ink}});
  // наведение на смотровую точку: контуры домов, которые с неё видно
  map.addLayer({id:'vphov-f', type:'fill', source:'dom_poly', filter:['in',['get','i'],['literal',[]]], paint:{'fill-color':'#FFE27A','fill-opacity':0.85}});
  map.addLayer({id:'vphov-l', type:'line', source:'dom_poly', filter:['in',['get','i'],['literal',[]]], paint:{'line-color':['step',['zoom'],'#FFE27A',12,'#13232F'],'line-width':['interpolate',['linear'],['zoom'],8,2,12,1.2,15,1.4]}});   // издалека дома крошечные — обводка толще
  // полигоны доминант в зоне видимости: исторические — розовые, инженерные — жёлтые, новые ЖК — серые и тихие
  map.addSource('domsel', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'domsel-f', type:'fill', source:'domsel', paint:{'fill-color':['match',['get','class'],'Историческая',DOMC.h,'Инженерная',DOMC.e,DOMC.n],
    'fill-opacity':['match',['get','class'],'Новая',0.22,0.9]}});
  map.addLayer({id:'domsel-l', type:'line', source:'domsel', filter:['!=',['get','class'],'Новая'], paint:{'line-color':'#ffffff','line-width':1.2}});
  map.addSource('domvis', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'domvis-new', type:'circle', source:'domvis', filter:['==',['get','class'],'Новая'], paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,1.6,13,3.2],'circle-color':'#B8C0C4','circle-opacity':0.55}});
  map.addLayer({id:'domvis', type:'symbol', source:'domvis', filter:['!=',['get','class'],'Новая'], layout:{'icon-image':['case',
      ['==',['get','class'],'Историческая'],ripple('r-hist', DOMC.h, 'dot'),ripple('r-eng', DOMC.e, 'dot')],
    'icon-size':['*',['case',['==',['get','top'],1],1,0.6],['interpolate',['linear'],['coalesce',['get','height_m'],30],20,0.16,100,0.26,460,0.5]],'icon-allow-overlap':true,
    'symbol-sort-key':['-',0,['coalesce',['get','height_m'],0]]}});
  CLICK.push(['domvis', 'dom_vis']);

  /* --- точки --- */
  const RIP = (id, key, img, size, extra = {}) => add(key, [{id, type:'symbol', layout:{'icon-image':img, 'icon-size':size, 'icon-allow-overlap':true, 'icon-ignore-placement':true, ...extra}, paint:{'icon-opacity':hov(0.92, 1)}}], true);
  const zs = (lo, hi) => ['interpolate',['linear'],['zoom'],8,lo,13,hi];
  // горные финны сегодня (перепись 2021): цвет — доля финского населения, размер — численность
  const FINC = ['step',['get','pct'],'#E3E8F4',1,'#6F8FE0',5.0001,'#1F44C4'];
  const FINR = n => ['step',['get','finns'],n * 0.55,10.5,n,100.5,n * 1.6];
  add('finns_today', [{id:'finns_today', type:'circle', paint:{'circle-color':FINC,'circle-radius':['interpolate',['linear'],['zoom'],8,FINR(3.2),13,FINR(7)],
    'circle-stroke-color':'#13232F','circle-stroke-width':0.8,'circle-opacity':hov(0.95, 1)}}], true);
  map.addLayer({id:'lab-finns_today', type:'symbol', source:'finns_today', minzoom:8.5, layout:{visibility:'none','text-field':['get','name'],'text-font':FONT_B,'text-size':11,
      'text-offset':[0,0.9],'text-anchor':'top','text-padding':3},
    filter:['any',['all',['>',['get','pct'],5],['>',['get','finns'],10]],['all',['>=',['get','pct'],1],['>',['get','finns'],100]]],
    paint:{'text-color':'#C9D6FF','text-halo-color':'rgba(6,12,18,.85)','text-halo-width':1.3}});
  GROUPS.finns_today = (GROUPS.finns_today || ['finns_today']).concat('lab-finns_today');
  const clsIcon = k => ['match',['get',CLS[k].field], ...CLS[k].list.flatMap(([v, col, gl]) => [v, ripple('c-' + k + '-' + v, col, gl)]), ripple('r-pink', C.pink, 'dot')];
  // zoom можно использовать только на верхнем уровне interpolate — множитель класса кладём внутрь каждой ступени
  const clsMul = k => ['match',['get',CLS[k].field], ...CLS[k].list.flatMap(([v, , , m]) => [v, m]), 1];
  const clsSize = (k, lo, hi) => ['interpolate',['linear'],['zoom'],8,['*',clsMul(k),lo],10,['*',clsMul(k),lo * 1.7],13,['*',clsMul(k),hi],15.5,['*',clsMul(k),hi * 1.45]];
  RIP('leisure', 'leisure', clsIcon('leisure'), clsSize('leisure', 0.2, 0.62));
  RIP('photo_points', 'photo_points', ripple('r-photo', '#F08DB0', 'dot'), zs(0.28, 0.55));
  // новостройки — контуры домов: построенные, строящиеся и планируемые разным цветом; издалека — точки, вблизи — дома
  const NBC = ['match',['get','status'], ...CLS.dom_threat.list.flatMap(([v, c]) => [v, c]), C.red];
  add('dom_threat', [
    {id:'dom_threat-f', type:'fill', minzoom:11, paint:{'fill-color':NBC,'fill-opacity':['interpolate',['linear'],['zoom'],11,0,12,hov(0.55, 0.85)]}},
    {id:'dom_threat-l', type:'line', minzoom:11, filter:['==',['get','status'],'существующая'], paint:{'line-color':NBC,'line-width':['interpolate',['linear'],['zoom'],11,0.5,15,1.6]}},
    // ещё не построенные — пунктирный контур
    {id:'dom_threat-d', type:'line', minzoom:11, filter:['!=',['get','status'],'существующая'], paint:{'line-color':NBC,'line-width':['interpolate',['linear'],['zoom'],11,0.8,15,2],'line-dasharray':[2,1.2]}}], true);
  BASEF['dom_threat-l'] = ['==',['get','status'],'существующая']; BASEF['dom_threat-d'] = ['!=',['get','status'],'существующая'];
  map.addSource('newb_pt', {type:'geojson', data:D.newb_pt});
  // общий вид: пузыри районов, где строят больше всего; при приближении распадаются на дома
  map.addSource('newb_cl', {type:'geojson', data:D.newb_cl});
  map.addLayer({id:'newb-cl', type:'circle', source:'newb_cl', maxzoom:11, layout:{visibility:'none'},
    paint:{'circle-color':'#E5383B','circle-opacity':['interpolate',['linear'],['zoom'],10,0.32,11,0],'circle-blur':0.15,
      'circle-radius':['*',['interpolate',['linear'],['zoom'],8,1,10.5,1.7],['sqrt',['get','n']],1.6],
      'circle-stroke-color':'#FF8A8D','circle-stroke-width':1.2,'circle-stroke-opacity':['interpolate',['linear'],['zoom'],10,0.9,11,0]}});
  map.addLayer(resolve({id:'newb-cl-lab', type:'symbol', source:'newb_cl', maxzoom:11, layout:{visibility:'none','text-field':['get','label'],'text-font':FONT_B,
      'text-size':['interpolate',['linear'],['zoom'],8,11,10.5,13],'text-max-width':10,'text-line-height':1.15,'symbol-sort-key':['-',0,['get','n']],'text-padding':2},
    paint:{'text-color':T('#9e1f22','#FFD0D1'),'text-halo-color':T('rgba(255,255,255,0.95)','rgba(6,12,18,0.85)'),'text-halo-width':1.4,'text-opacity':['interpolate',['linear'],['zoom'],10.3,1,11,0]}}));
  map.addLayer({id:'dom_threat-c', type:'circle', source:'newb_pt', minzoom:10, maxzoom:12.5, layout:{visibility:'none'},
    paint:{'circle-color':NBC,'circle-radius':['interpolate',['linear'],['zoom'],8,['interpolate',['linear'],['coalesce',['get','height_m'],40],20,1.4,90,3.2],12,['interpolate',['linear'],['coalesce',['get','height_m'],40],20,3,90,6]],
      'circle-stroke-color':'#fff','circle-stroke-width':['case',['has','top_new'],1.5,0],'circle-opacity':['interpolate',['linear'],['zoom'],11.5,0.9,12.5,0]}});
  map.addLayer(resolve({id:'lab-newtop', type:'symbol', source:'newb_pt', filter:['has','top_new'], layout:{visibility:'none','text-field':['format',['get','name'],{},'\n',{},['concat',['to-string',['round',['get','height_m']]],' м'],{'font-scale':0.8}],
    'text-font':FONT_R,'text-size':12,'text-anchor':'left','text-offset':[0.9,0],'text-max-width':12,'text-padding':4,'symbol-sort-key':['get','top_new']},
    paint:{'text-color':T(['match',['get','status'],'существующая','#B3191D','строящаяся','#B85E0C','#7B2C9C'],['match',['get','status'],'существующая','#FF8A8D','строящаяся','#FFB36B','#D9A2F2']),'text-halo-color':T('rgba(255,255,255,0.95)','rgba(6,12,18,0.85)'),'text-halo-width':1.4}}));
  GROUPS.dom_threat.push('newb-cl', 'newb-cl-lab', 'dom_threat-c', 'lab-newtop');
  BASEF['newb-cl'] = 'skip'; BASEF['newb-cl-lab'] = 'skip';   // у пузырей нет статуса — фильтр классов их не трогает CLICK.push(['dom_threat-c', 'dom_vis']);
  BASEF['lab-newtop'] = ['has','top_new'];
  add('estate', [{id:'estate', type:'symbol', layout:{'icon-image':clsIcon('estate'),'icon-size':clsSize('estate', 0.18, 0.6),'icon-allow-overlap':true,
    'symbol-sort-key':['match',['get','type'],'Дача',0,'Дом',1,'Вилла',2,'Особняк',2,'Мыза',3,'Усадьба',4,5]}, paint:{'icon-opacity':['case',['==',['get','type'],'Дача'],0.8,hov(0.95, 1)]}}], true);   // дачи мельче и рисуются под остальными
  RIP('paintings', 'paintings', ripple('r-cream', '#B7A68C', 'square'), zs(0.35, 0.65), {}); map.setPaintProperty('paintings', 'icon-opacity', ['case',['in',['to-string',['get','fid']],['literal',(M.paintings || []).map(String)]],0,0.9]);
  RIP('mount_lost', 'mount_lost', ripple('r-lost', C.red, 'x'), zs(0.45, 0.7));
  RIP('law_heights', 'law_heights', ripple('r-green', C.green, 'tri'), zs(0.45, 0.7));
  // вершины — треугольники по классу: гора крупно, возвышенность средне, холм мелко (как на карте-плакате)
  add('mount', [{id:'mount', type:'symbol', layout:{'icon-image':['match',['get','type'],'гора',T('m-гора-l','m-гора-d'),'возвышенность',T('m-возвышенность-l','m-возвышенность-d'),T('m-холм-l','m-холм-d')],'icon-size':clsSize('mount', 0.32, 0.62),
    'icon-allow-overlap':true,'symbol-sort-key':['-',0,['to-number',['get','height_value'],0]]}, paint:{'icon-opacity':hov(0.92, 1)}}], true);
  // смотровые точки: веер взгляда, повёрнутый по сектору обзора; стиль — по типу воздействия
  // охранять — сплошной веер, формировать — контурный, расчищать — пунктирный; круговой обзор — кольцо
  const VPS = {охранять:['#E5383B','fill'], формировать:['#E8A317','line'], расчищать:['#4F8FD0','dash']};
  Object.entries(VPS).forEach(([k, [col, st]]) => { vpIcon('vp-' + k, col, st, 0); vpIcon('vp-' + k + '-o', col, st, 1); });
  const vpImg = ['concat','vp-',['get','todo'],['case',['==',['get','full'],1],'-o','']];
  add('vp_old', [{id:'vp_old', type:'symbol', layout:{'icon-image':vpImg,'icon-size':zs(0.34, 0.62),'icon-allow-overlap':true,'icon-ignore-placement':true,
    'icon-rotate':['get','az'],'icon-rotation-alignment':'map'}, paint:{'icon-opacity':hov(0.95, 1)}}], true);
  add('vp_new', [{id:'vp_new', type:'symbol', layout:{'icon-image':['case',['==',['get','value_class'],'А'],ripple('r-vpa', C.red, 'none'),ripple('r-vpb', '#EE7FA4', 'none')],
    'icon-size':zs(0.5, 0.82),'icon-allow-overlap':true,'icon-ignore-placement':true,
    'text-field':['slice',['get','code'],3],'text-font':FONT_B,'text-size':zs(8, 11),'text-allow-overlap':true,'text-ignore-placement':true}, paint:{'icon-opacity':hov(0.95, 1),'text-color':'#ffffff'}}], true);

  /* --- выделение --- */
  map.addSource('sel', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'sel-l', type:'line', source:'sel', filter:['!=',['geometry-type'],'Point'], paint:{'line-color':C.cream,'line-width':3.5}});
  map.addLayer({id:'sel', type:'circle', source:'sel', filter:['==',['geometry-type'],'Point'], paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':17,'circle-stroke-color':C.cream,'circle-stroke-width':3}});
  map.addLayer({id:'sel-2', type:'circle', source:'sel', filter:['==',['geometry-type'],'Point'], paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':20,'circle-stroke-color':C.ink,'circle-stroke-width':1.5}});

  /* --- подписи --- */
  // инфраструктура: города, посёлки, станции — только по-русски (OpenStreetMap через OpenFreeMap)
  const ruName = ['coalesce',['get','name:ru'],['get','name']];
  map.addLayer(resolve({id:'infra-place', type:'symbol', source:'omt', 'source-layer':'place', minzoom:8,
    filter:['match',['get','class'],['city','town'],true,['village','suburb','hamlet'],['>=',['zoom'],11.5],false],
    layout:{'text-field':ruName,'text-font':FONT_R,'text-size':['match',['get','class'],'city',13,'town',11.5,10.5],'text-padding':6,'text-max-width':8,
      'symbol-sort-key':['match',['get','class'],'city',0,'town',1,2]},
    paint:{'text-color':T('#5d6870','#d6dde1'),'text-halo-color':T('rgba(255,255,255,0.85)','rgba(6,12,18,0.75)'),'text-halo-width':1.2,'text-opacity':0.9}}));
  // железная дорога: рельсы — классическая «шпальная» линия (тёмная подложка + светлый пунктир), станции — значок поезда
  const RAIL = ['all',['==',['get','class'],'rail'],['!',['match',['get','subclass'],['tram','subway','light_rail','monorail','funicular','narrow_gauge','preserved'],true,false]],
    ['!',['has','service']]];
  map.addLayer(resolve({id:'rail-base', type:'line', source:'omt', 'source-layer':'transportation', minzoom:8, filter:RAIL,
    paint:{'line-color':T('#2a2f33','#0d1114'),'line-width':['interpolate',['linear'],['zoom'],8,1,12,2,15,3.2],'line-opacity':0.85}}));   // железная дорога: тонкая, серо-чёрная
  map.addLayer(resolve({id:'rail-dash', type:'line', source:'omt', 'source-layer':'transportation', minzoom:8, filter:RAIL,
    paint:{'line-color':T('#8b9399','#6f777c'),'line-width':['interpolate',['linear'],['zoom'],8,0.5,12,1,15,1.8],'line-dasharray':[3,3]}}));
  const trainIcon = (() => { const S = 64, [c, g] = canvas(S, S);
    g.fillStyle = '#13232F'; g.beginPath(); g.roundRect(4, 4, 56, 56, 12); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(18, 12, 28, 32, 7); g.fill();
    g.fillStyle = '#13232F'; g.fillRect(22, 17, 20, 11); g.beginPath(); g.arc(25, 36, 3, 0, 7); g.arc(39, 36, 3, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, 46); g.lineTo(16, 54); g.moveTo(42, 46); g.lineTo(48, 54); g.stroke();
    map.addImage('train', g.getImageData(0, 0, S, S), {pixelRatio:2}); return 'train'; })();
  map.addLayer(resolve({id:'infra-station', type:'symbol', source:'omt', 'source-layer':'poi', minzoom:9.5,
    filter:['all',['==',['get','class'],'railway'],['match',['get','subclass'],['station','halt'],true,false]],
    layout:{'icon-image':trainIcon,'icon-size':['interpolate',['linear'],['zoom'],9.5,0.42,13,0.62],'icon-allow-overlap':false,'icon-padding':2,
      'text-field':['step',['zoom'],'',11,ruName],'text-font':FONT_R,'text-size':10,'text-anchor':'top','text-offset':[0,1.1],'text-padding':4,'text-optional':true},
    paint:{'text-color':T('#5d6870','#c3cbd0'),'text-halo-color':T('rgba(255,255,255,0.85)','rgba(6,12,18,0.75)'),'text-halo-width':1.1}}));
  const halo = {'text-color':TXT1,'text-halo-color':HALO,'text-halo-width':1.4,'text-halo-blur':1};
  const calm = {...halo, 'text-color':TXT2};
  const lab = (id, source, layout, paint, extra = {}) => map.addLayer(resolve({id, type:'symbol', source, ...extra, layout:{'text-font':FONT_R,'text-padding':4, ...layout}, paint:{...halo, ...paint}}));
  const caps = {'text-transform':'uppercase','text-letter-spacing':0.12,'text-font':FONT_R};
  addSrc('labels'); map.addSource('mount-names', {type:'geojson', data:D.mount});
  map.addSource('sector_pts', {type:'geojson', data:D.sector_pts});
  map.addLayer(resolve({id:'lab-sector', type:'symbol', source:'sector_pts', minzoom:8.8, layout:{visibility:'none','text-field':['get','name'],'text-font':FONT_R,'text-size':['interpolate',['linear'],['zoom'],9,10,12,13],
    'text-transform':'uppercase','text-letter-spacing':0.08,'text-max-width':8,'text-padding':6}, paint:{...halo,'text-color':TXT1}}));
  GROUPS.sectors.push('lab-sector');
  // изолинии — самое тихое
  if(CONTOURS){ lab('c-lab', 'contours', {'symbol-placement':'line','text-field':['concat',['to-string',['get','ele']],' м'],'text-size':10,'symbol-spacing':380}, calm,
    {'source-layer':'contours', minzoom:12.5, filter:['>',['get','level'],0]}); GROUPS.isolines.push('c-lab'); }
  lab('iso-lab', 'isolines', {'symbol-placement':'line','text-field':['concat',['to-string',['get','ELEV']],' м'],'text-size':10,'symbol-spacing':420}, calm, {minzoom:12, filter:['==',['%',['to-number',['get','ELEV'],1],25],0]});
  // горные массивы — крупно, разреженными прописными, спокойным тоном
  lab('lab-massif', 'labels', {...caps,'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],8,11,12,15],'text-max-width':10,'text-line-height':1.25}, calm, {filter:['==',['get','kind'],'massif'], maxzoom:12.5});
  GROUPS.mount_polygon.push('lab-massif');
  // ярусы амфитеатра — самые крупные
  lab('lab-tier', 'labels', {...caps,'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],8,15,12,20],'text-letter-spacing':0.2}, {}, {filter:['==',['get','kind'],'none']});
  // эпохи и вомитории — средний размер, главный тон
  // эпохи: геология — оранжевым, исторические финские поселения — песочным, усадьбы — жёлтым (в цвет слоёв)
  lab('lab-epoch', 'labels', {'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],8,12,12,15],'text-max-width':9,'text-line-height':1.2},
    {'text-color':['match',['get','epoch'],['e450','e25','e12','e7'],'#F29A3F','finns',C.sand,'estates',C.yellow,TXT1]}, {filter:['==',['get','kind'],'none']});
  // названия исторических поселений из самого слоя
  if(D.resettlement){ map.addSource('resettle-pts', {type:'geojson', data:{type:'FeatureCollection', features:D.resettlement.features.filter(f => f.properties.name).map(f => ({type:'Feature', properties:{name:f.properties.name}, geometry:{type:'Point', coordinates:centroid(f.geometry)}}))}});
    lab('lab-resettlement', 'resettle-pts', {visibility:'none','text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],9,10.5,13,13],'text-font':['Geologica SemiBold'],'text-padding':3}, {'text-color':'#F2C08A'}, {minzoom:9.5});
    (GROUPS.resettlement = GROUPS.resettlement || []).push('lab-resettlement'); }
  lab('lab-vom', 'labels', {'text-field':['slice',['get','name'],10],'text-size':['interpolate',['linear'],['zoom'],8,11.5,12,14],'text-max-width':9,'text-font':['Geologica SemiBold']},
    {'text-color':C.blue3}, {filter:['==',['get','kind'],'vomitoria']});
  GROUPS.vomitoria.push('lab-vom');
  // вершины: имя главным тоном, высота — мельче и спокойнее
  lab('lab-mount', 'mount-names', {'text-field':['format',['get','name'],{},'\n',{},['concat',['to-string',['round',['to-number',['get','height_value'],0]]],' м'],{'font-scale':0.8,'text-color':TXT2}],
      'text-size':['interpolate',['linear'],['zoom'],8,['match',['get','type'],'гора',13,11.5],13,['match',['get','type'],'гора',16,14]],
      'text-offset':[0,0.8],'text-anchor':'top','text-line-height':1.15,'text-max-width':8,'symbol-sort-key':['-',0,['to-number',['get','height_value'],0]]},
    {'text-opacity':['step',['zoom'],['case',['==',['get','type'],'гора'],1,0],10.6,1]}, {filter:['has','name']});
  GROUPS.mount.push('lab-mount');
  // подписи тематических точек: та же схема, код — спокойным тоном
  const labFor = (id, key, field, minzoom, extra = {}, paint = {}) => { if(!D[srcOf(key)]) return;
    lab(id, srcOf(key), {visibility:'none','text-field':field,'text-size':12.5,'text-anchor':'left','text-offset':[1.1,0],'text-max-width':12, ...extra}, paint, {minzoom});
    (GROUPS[key] = GROUPS[key] || []).push(id); };
  const coded = (code, name) => ['format',['get',code],{'text-color':TXT2,'font-scale':0.85},'  ',{},name,{}];
  labFor('lab-vp_new', 'vp_new', coded('code', ['get','name']), 8.5, {'symbol-sort-key':['-',0,['get','k_sum']]});
  labFor('lab-vp_old', 'vp_old', ['get','label'], 9, {'text-size':['interpolate',['linear'],['zoom'],9,10.5,13,13],'symbol-sort-key':['get','n']});
  labFor('lab-mount_lost', 'mount_lost', ['format',['get','name'],{},'\n',{},'утрачена',{'font-scale':0.8,'text-color':TXT2}], 8);
  labFor('lab-law_heights', 'law_heights', ['get','name'], 8);
  labFor('lab-oopt', 'oopt', ['get','name'], 10, {'text-anchor':'center','text-offset':[0,0],'text-size':11.5}, calm);
  labFor('lab-leisure', 'leisure', ['get','name'], 9, {'text-size':['interpolate',['linear'],['zoom'],9,10.5,13,12.5]}, {'text-color':'#F6B8CC'});
  // усадьбы, дворцы, мызы и др. подписаны сразу; дачи (их сотни) — только при приближении
  if(D.estate){
    lab('lab-estate', 'estate', {visibility:'none','text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],9,11,13,13],'text-anchor':'left','text-offset':[1.1,0],'text-max-width':11,
      'symbol-sort-key':['match',['get','type'],'Дворец',0,'Усадьба',1,'Мыза',2,3]}, {'text-color':T('#0d1820', '#F7F3EA'), 'text-halo-color':T('rgba(255,255,255,0.95)', 'rgba(6,12,18,0.85)')}, {minzoom:9, filter:['!=',['get','type'],'Дача']});
    lab('lab-estate-d', 'estate', {visibility:'none','text-field':['get','name'],'text-size':11.5,'text-anchor':'left','text-offset':[1,0],'text-max-width':10,'text-optional':true},
      {'text-color':T('#55606a', '#F4E3A8')}, {minzoom:12, filter:['==',['get','type'],'Дача']});
    (GROUPS.estate = GROUPS.estate || []).push('lab-estate', 'lab-estate-d');
  }
  // доминанты в зоне видимости
  lab('lab-dom', 'domvis', {'text-field':['format',['get','label'],{},'\n',{},['concat',['to-string',['round',['get','height_m']]],' м'],{'font-scale':0.8,'text-color':TXT2}],
      'text-size':12,'text-anchor':'bottom','text-offset':[0,-0.9],'text-line-height':1.15,'text-max-width':10,'symbol-sort-key':['-',0,['get','height_m']]}, {'text-color':['match',['get','class'],'Историческая',DOMC.h,'Инженерная',DOMC.e,'#D9DEE1']}, {filter:['==',['get','top'],1]});   // подпись — в цвет светящейся точки

  ['mask','isolines','bound','stage','seclev'].forEach(k => show(k, true));
  // объёмные доминанты и персонажи — под подписями, поверх остального
  // three.js и сцена подгружаются только при первом включении 3D (см. load3D) — плоской карте они не нужны
  applyBase(false);
  ready = true; queue.splice(0).forEach(fn => fn());
});

function show(key, on){ (GROUPS[key]||[]).forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')); if(key === 'routes') showRouteShots(on); if(key === 'paintings') showPaintings(on); }
const ALWAYS = ['mask','isolines','bound','stage','seclev'];
let shown = [], lgOff = new Set(), lgSolo = null;
function setShown(keys){
  shown = keys.slice(); lgOff = new Set(); lgSolo = null; clsSolo = null;
  window.GP_SHOWN = shown;   // 3D-персонажи появляются только у слоёв, которые сейчас на карте
  // в разделе «Маршруты» тонкие тропы проявляются только вблизи, издалека их заменяет плотность
  if(map.getLayer('walking')){ const heat = keys.includes('track_heat');
    map.setPaintProperty('walking', 'line-opacity', heat ? ['interpolate',['linear'],['zoom'],10.5,0,12,0.9] : hov(0.38, 0.9));
    map.setPaintProperty('walking-glow', 'line-opacity', heat ? ['interpolate',['linear'],['zoom'],10.5,0,12,0.16] : (base === 'sat' ? 0.16 : 0.12)); }
  Object.keys(GROUPS).forEach(k => { if(!ALWAYS.includes(k)) show(k, keys.includes(k)); });
  const tiers = keys.filter(k => k.startsWith('mask_')).map(k => k.slice(5));
  map.setFilter('lab-tier', ['all',['==',['get','kind'],'tier'],['in',['get','tier'],['literal',tiers]]]);
  const ep = []; ({landscape_450:'e450', landscape_25:'e25', landscape_12:'e12', landscape_7:'e7'});
  [['landscape_450','e450'],['landscape_25','e25'],['landscape_12','e12'],['landscape_7','e7'],['resettlement','finns'],['maki_selki','finns'],['estate','estates']].forEach(([k, e]) => keys.includes(k) && ep.push(e));
  map.setFilter('lab-epoch', ['all',['==',['get','kind'],'epoch'],['in',['get','epoch'],['literal',ep]]]);
  // на тематических картах подписи массивов убираем, чтобы не спорили со слоями

  // когда на карте тематический слой-площадь, фон приглушаем — выделено то, о чём речь
  map.setLayoutProperty('dim', 'visibility', keys.some(k => /^(mask_|sectors|landscape|resettlement|maki_selki|reserve|bubbles|oopt|zol|law_relief|loss)/.test(k)) ? 'visible' : 'none');
  tierFocus();
  Object.keys(CLS).forEach(k => clsApply(k));
  clearCone();
}

/* ---------- подложка ---------- */
let curExag = EXAG;
// подстраиваем усиление прямо во время приближения, а не только в конце — так дома не «тонут» в рельефе
// (не чаще 4 раз в секунду: пересчёт рельефа дорогой)
let exagT = 0;
map.on('zoom', () => { if(!is3D || !terrainOk) return; const now = performance.now(); if(now - exagT < 250) return; const e = exagAt(map.getZoom());
  if(Math.abs(e - curExag) > 0.3 || (e === EXAG_CITY && curExag !== e)){ exagT = now; curExag = e; try{ map.setTerrain({source:demSrc, exaggeration:e}); }catch(_){} } });
function applyBase(animate = true){
  const sat = base === 'sat';
  body.dataset.base = base;
  [['sat', sat && satFails < 5], ['carto', !sat], ['relief', !sat]].forEach(([id, on]) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
  map.setPaintProperty('bg', 'background-color', sat ? '#0d1820' : '#e9ecea');
  map.setPaintProperty('hill', 'hillshade-exaggeration', sat ? 0.6 : 0.4);
  THEMED.forEach(([id, kind, prop, v]) => { if(!map.getLayer(id)) return; const val = pick(v, sat);
    kind === 'paint' ? map.setPaintProperty(id, prop, val) : map.setLayoutProperty(id, prop, val); });
  try{ map.setTerrain(is3D && terrainOk ? {source:demSrc, exaggeration:(curExag = exagAt(map.getZoom()))} : null); }catch(e){}
  try{ map.setSky && map.setSky(sat ? {'sky-color':'#8fb9e3','horizon-color':'#d6e4ef','fog-color':'#d6e4ef','sky-horizon-blend':0.35,'horizon-fog-blend':0.05,'fog-ground-blend':0.97,'atmosphere-blend':0} : undefined); }catch(e){}   // дымка только у самого горизонта — всё остальное чётко
  if(animate) map.easeTo({pitch: is3D ? 60 : 0, bearing: is3D ? map.getBearing() : 0, duration:900});
  document.querySelectorAll('.seg [data-base]').forEach(b => b.setAttribute('aria-pressed', b.dataset.base === base));
}
/* 3D включается сам, когда карту приближают (с 12,5 масштаба); кнопка оставляет плоскую карту тем, кому так удобнее */
const AUTO3D = 12.5;
let force2D = false;
// объёмная сцена (three.js, ~600 КБ) — качаем один раз, когда 3D включают впервые
let scene3dState = 0;   // 0 — не грузили, 1 — грузится, 2 — готово
function load3D(){
  if(scene3dState) return; scene3dState = 1;
  const add = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(src); document.body.appendChild(s); });
  add('vendor/three.min.js').then(() => add('js/scene3d.js?v=20261123m')).then(() => whenReady(() => {
    scene3dState = 2;
    if(window.GP3D && !map.getLayer('scene3d')) try{ map.addLayer(GP3D.layer, map.getLayer('infra-place') ? 'infra-place' : undefined); if(GP3D._pending) GP3D.setRoute(...GP3D._pending); map.triggerRepaint(); }catch(e){ console.warn('[3D]', e); }
  })).catch(e => console.warn('[3D] не загрузилось:', e));
}
function set3D(on, soft){
  if(on === is3D) return; is3D = on;
  if(on) load3D();
  $('btn3d').setAttribute('aria-pressed', on); $('btn2d').setAttribute('aria-pressed', !on);
  body.classList.toggle('is3d', on);
  whenReady(() => { applyBase(false); map.easeTo({pitch: on ? (soft ? 50 : 62) : 0, bearing: on ? map.getBearing() || -12 : 0, duration: soft ? 900 : 1400}); });
}
$('btn3d').onclick = () => { force2D = false; set3D(true); };
$('btn2d').onclick = () => { force2D = true; set3D(false); };
map.on('zoomend', () => { if(!force2D && map.getZoom() >= AUTO3D && !is3D) set3D(true, true); else if(!force2D && map.getZoom() < AUTO3D - 2 && is3D) set3D(false, true); });
document.querySelectorAll('.seg [data-base]').forEach(b => b.onclick = () => { if(base === b.dataset.base) return; base = b.dataset.base; whenReady(() => applyBase()); });
$('btnHome').onclick = () => fitTo('bound', 9.6);
// кнопка «карта на весь экран»: прячет и возвращает текстовую колонку
function setPanelOff(off){
  body.classList.toggle('panel-off', off);
  const b = $('btnPanel'); b.setAttribute('aria-pressed', off);
  b.querySelector('span').textContent = off ? 'Показать текст' : 'Карта на весь экран';
  b.title = off ? 'Вернуть текстовую колонку' : 'Развернуть карту на весь экран';
  setTimeout(() => map.resize(), 260);
}
$('btnPanel').onclick = () => setPanelOff(!body.classList.contains('panel-off'));
// подписи источников: свёрнуты в значок «i», чтобы не закрывать карту
// MapLibre раскрывает подпись заново, когда догружаются источники, — сворачиваем, пока человек сам её не открыл
let attribTouched = false;
document.addEventListener('click', e => { if(e.target.closest('.maplibregl-ctrl-attrib-button')) attribTouched = true; }, true);
const foldAttrib = () => { if(attribTouched) return; document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach(el => { el.classList.remove('maplibregl-compact-show'); el.removeAttribute('open'); }); };
map.on('load', foldAttrib); map.on('idle', foldAttrib);

/* ---------- камера ---------- */
function bboxOf(fc){
  const b = [180,90,-180,-90];
  const walk = c => { if(typeof c[0] === 'number'){ b[0]=Math.min(b[0],c[0]); b[1]=Math.min(b[1],c[1]); b[2]=Math.max(b[2],c[0]); b[3]=Math.max(b[3],c[1]); } else c.forEach(walk); };
  (fc.features||[]).forEach(f => f.geometry && walk(f.geometry.coordinates));
  return [[b[0],b[1]],[b[2],b[3]]];
}
const camPitch = () => is3D ? 60 : 0;
function viewPad(){
  if(isNarrow()) return {top:20, bottom:20, left:16, right:16};
  return {top:70, bottom:50, left:50, right:50};
}
function fitTo(key, maxZoom = 11){
  const fc = D[key]; if(!fc || !fc.features.length) return;
  map.fitBounds(bboxOf(fc), {padding:viewPad(), maxZoom, duration:1800, pitch:camPitch(), essential:true});
}
function flyTo(center, zoom = 13){ map.flyTo({center, zoom:Math.max(map.getZoom(), zoom), pitch:camPitch(), duration:1600, essential:true}); }
function centerOf(f){
  const g = f.geometry; if(!g) return HOME.center;
  if(g.type === 'Point') return g.coordinates;
  const b = bboxOf({features:[f]}); return [(b[0][0]+b[1][0])/2, (b[0][1]+b[1][1])/2];
}
const kmBetween = (a, b) => Math.hypot((a[0]-b[0]) * Math.cos(a[1]*Math.PI/180) * 111.32, (a[1]-b[1]) * 110.54);
function bearing(a, b){
  const f1 = a[1]*Math.PI/180, f2 = b[1]*Math.PI/180, dl = (b[0]-a[0])*Math.PI/180;
  return (Math.atan2(Math.sin(dl)*Math.cos(f2), Math.cos(f1)*Math.sin(f2) - Math.sin(f1)*Math.cos(f2)*Math.cos(dl)) * 180/Math.PI + 360) % 360;
}

/* =========================================================
   Фото, названия
   ========================================================= */
// статья Википедии про объект (усадьбы — по номеру в слое, новостройки — по номеру доминанты)
const WIKI = window.GP_WIKI || {estate:{}, dominants:{}};
function wikiOf(key, p){
  if(key === 'estate'){ const k = (D.estate?.features || []).findIndex(x => x.properties === p); return k >= 0 ? WIKI.estate[String(k)] : null; }
  if(p && p.i != null && (key === 'dom_threat' || key === 'dom_vis' || key === 'dominants')) return WIKI.dominants[String(p.i)] || null;
  return null;
}
// отдельный рассказ о самых заметных новостройках
function topStory(key, p){
  if(!p || !p.top_new) return '';
  const nVp = (D.vp_old?.features || []).length, fl = p.height_m ? Math.round(p.height_m / 3) : 0;
  const st = {'существующая':'Дом уже построен', 'строящаяся':'Дом сейчас строится', 'потенциальная (дом.рф)':'Дом пока только запланирован (по данным ДОМ.РФ)'}[p.status] || '';
  const seen = String(p.vt || '').split(',').filter(Boolean).length;
  return `<aside class="fact top-new"><b>Новостройка № ${p.top_new} по заметности</b>
    <p>${esc(p.name)} — одна из ${NEWB_TOP} новостроек, сильнее всего меняющих горные панорамы Петербурга.</p>
    <p>Высота около ${num(Math.round(p.height_m))} м${fl ? `, это примерно ${fl} ${plural(fl, 'этаж','этажа','этажей')}` : ''}. ${st}. Её видно с ${p.vis_n || seen} ${plural(p.vis_n || seen, 'смотровой точки','смотровых точек','смотровых точек')} из ${nVp}: в этих видах она поднимается над горизонтом и спорит с историческими доминантами.</p></aside>`;
}
function photosOf(key, p){
  const out = [];
  const w = wikiOf(key, p); if(w && w.img) out.push(w.img);
  if(key === 'mount' && M.mount[String(p.fid)]) M.mount[String(p.fid)].forEach(n => out.push(`media/mount/${n}.webp`));
  if(key === 'paintings' && M.paintings.includes(String(p.fid))) out.push(`media/paint/${p.fid}.webp`);
  if(key === 'photo_points' && M.viewpoints.includes(String(p.id))) out.push(`media/vp/${p.id}.webp`);
  if(key === 'routes'){ const f = (D.routes?.features || []).find(x => x.properties === p); if(f) routeShots(f).slice(0, 6).forEach(x => out.push(`media/vp/${x.id}.webp`)); }
  if(key === 'leisure'){ if(LEISURE_PHOTO[p.name]) out.push(LEISURE_PHOTO[p.name].src);
    const f = (D.leisure?.features || []).find(x => x.properties === p);
    if(f){ const v = VIEWS.map(v => ({v, d:kmBetween(f.geometry.coordinates, v.f.geometry.coordinates)})).filter(x => x.d < 1.5 && viewPhotos(x.v).length).sort((a, b) => a.d - b.d)[0];
      if(v) viewPhotos(v.v).slice(0, 2).forEach(id => out.push(`media/vp/${id}.webp`)); } }
  return out;
}
/* снимки экспедиции вдоль маршрута: смотровые точки не дальше 1,2 км от линии, по одному кадру */
const segDist = (p, a, b) => { const k = Math.cos(p[1] * Math.PI / 180), ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(ax + t * dx, ay + t * dy) * 111; };
const routeShotsCache = new Map();
function routeShots(f){
  if(routeShotsCache.has(f)) return routeShotsCache.get(f);
  const g = f.geometry, lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates], out = [];
  (typeof VIEWS !== 'undefined' ? VIEWS : []).forEach(v => { const c = v.f.geometry.coordinates, ph = viewPhotos(v); if(!ph.length) return;
    let d = 1e9; lines.forEach(l => { for(let i = 1; i < l.length; i++) d = Math.min(d, segDist(c, l[i - 1], l[i])); });
    if(d < 1.2) out.push({id:ph[0], v, c}); });
  routeShotsCache.set(f, out); return out;
}
/* кружки-снимки на карте: чёрно-белые, при наведении — в цвете */
let shotMarkers = [];
/* картины на карте — миниатюрами в рамке, а не точками */
let paintMarkers = [];
function showPaintings(on){
  paintMarkers.forEach(m => m.remove()); paintMarkers = []; if(!on) return;
  (D.paintings?.features || []).forEach((f, i) => { const fid = String(f.properties.fid); if(!(M.paintings || []).map(String).includes(fid)) return;
    const el = document.createElement('button'); el.type = 'button'; el.className = 'paint-mk'; el.title = f.properties.name || 'Картина';
    el.innerHTML = `<span style="background-image:url(media/paint/${fid}.t.webp)"></span>`; el.onclick = e => { e.stopPropagation(); openObject('paintings', i, true); };
    paintMarkers.push(new maplibregl.Marker({element:el}).setLngLat(f.geometry.coordinates).addTo(map)); });
}
function showRouteShots(on){
  shotMarkers.forEach(m => m.remove()); shotMarkers = [];
  if(!on) return;
  const seen = new Map();
  (D.routes?.features || []).forEach(f => routeShots(f).forEach(x => { if(seen.has(x.id)){ const el = seen.get(x.id); el.dataset.routes += '|' + f.properties.name; return; }
    const el = document.createElement('a'); el.className = 'shot-mk'; el.href = '#/view/' + x.v.p.code; el.title = x.v.p.name || ''; el.dataset.routes = f.properties.name; seen.set(x.id, el);
    el.style.backgroundImage = `url(media/vp/${x.id}.t.webp)`;
    shotMarkers.push(new maplibregl.Marker({element:el}).setLngLat(x.c).addTo(map)); }));
}
const thumbOf = u => u && /\/(vp|paint)\//.test(u) ? u.replace(/\.webp$/, '.t.webp') : u;
const mountNear = (() => {
  const ms = (D.mount?.features||[]).filter(f => f.properties.name);
  return c => { let best = null, bd = 1e9; ms.forEach(f => { const d = kmBetween(c, f.geometry.coordinates); if(d < bd){ bd = d; best = f; } }); return best && bd < 4 ? best.properties : null; };
})();
function titleOf(key, p, f){
  if(key === 'photo_points' && f){ const m = mountNear(f.geometry.coordinates); if(m) return /высот|возвышен|гряд|плато|холм/i.test(m.name) ? `Вид: ${m.name}` : `Вид у ${m.type === 'гора' ? 'горы' : m.type === 'холм' ? 'холма' : 'высоты'} ${m.name}`; }
  const I = INFO[infoKey(key)]; return I.title(p) || I.name;
}

/* =========================================================
   Панель: общий каркас
   ========================================================= */
const pTop = $('pTop'), pBody = $('pBody'), pFoot = $('pFoot');
const panelEl = $('panel'), panelGrab = $('pGrab'), stage = panelEl.parentElement;
const mobilePanel = matchMedia('(max-width: 820px)');
// на телефоне колонка текста — выдвижная шторка снизу во всех разделах с картой
const mountPanelActive = () => mobilePanel.matches && body.dataset.view !== 'gallery' && !body.classList.contains('intro') && !body.classList.contains('panel-off');
let panelCollapsed = false, panelTouch = null;

function setPanelCollapsed(collapsed){
  panelCollapsed = collapsed;
  if(collapsed && panelEl.contains(document.activeElement)) panelGrab.focus({preventScroll:true});
  body.classList.toggle('panel-collapsed', collapsed);
  panelGrab.setAttribute('aria-expanded', String(!collapsed));
  panelGrab.setAttribute('aria-label', collapsed ? 'Показать описание' : 'Свернуть описание');
}
function endPanelTouch(){
  panelTouch = null;
  body.classList.remove('panel-dragging');
  stage.style.removeProperty('--panel-drag');
}
panelGrab.addEventListener('click', () => setPanelCollapsed(!panelCollapsed));
panelEl.addEventListener('touchstart', e => {
  if(!mountPanelActive()) return;
  if(e.touches.length !== 1){ endPanelTouch(); return; }
  // Жест из текста начинается только у верхней границы прокрутки.
  if(pBody.contains(e.target) && pBody.scrollTop > 1) return;
  const touch = e.touches[0];
  panelTouch = {x:touch.clientX, y:touch.clientY, id:touch.identifier, dragging:false};
}, {passive:true});
panelEl.addEventListener('touchmove', e => {
  if(!panelTouch) return;
  if(e.touches.length !== 1 || !e.cancelable){ endPanelTouch(); return; }
  const touch = e.touches[0];
  if(touch.identifier !== panelTouch.id) return;
  const dx = touch.clientX - panelTouch.x, dy = touch.clientY - panelTouch.y;
  if(!panelTouch.dragging){
    if(Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
    if(Math.abs(dx) >= Math.abs(dy) || (panelCollapsed ? dy >= 0 : dy <= 0)){ endPanelTouch(); return; }
    panelTouch.dragging = true;
    body.classList.add('panel-dragging');
  }
  e.preventDefault();
  stage.style.setProperty('--panel-drag', `${dy}px`);
}, {passive:false});
panelEl.addEventListener('touchend', e => {
  if(!panelTouch) return;
  const touch = Array.from(e.changedTouches).find(t => t.identifier === panelTouch.id);
  if(!touch) return;
  const dy = touch.clientY - panelTouch.y;
  const commit = panelTouch.dragging && (panelCollapsed ? dy <= -48 : dy >= 48);
  // Сначала возвращаем переход, чтобы панель плавно дошла до конечного положения.
  endPanelTouch();
  if(commit) setPanelCollapsed(!panelCollapsed);
});
panelEl.addEventListener('touchcancel', endPanelTouch);
mobilePanel.addEventListener('change', () => { endPanelTouch(); setPanelCollapsed(false); });
new ResizeObserver(() => { if(mountPanelActive()) map.resize(); }).observe($('map'));

function panel(top, html, foot){
  pTop.innerHTML = top; pBody.innerHTML = html; pBody.scrollTop = 0;
  pFoot.hidden = !foot; pFoot.innerHTML = foot || '';
}
const topLabel = (icon, text) => `<span class="p-label">${icon}${esc(text)}</span>`;
const topBack = (href, text = 'Назад') => `<a class="p-label p-back" href="${href}">${ICON.back}${esc(text)}</a>`;
const table = rows => { const r = rows.filter(([, v]) => v !== '' && v != null); return r.length ? `<dl class="kv">${r.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''; };

/* ---------- легенда ---------- */
const fanSw = (c, st) => `<svg class="sym" viewBox="0 0 28 20"><path d="M14 17 6.6 5.2A10 10 0 0 1 21.4 5.2Z" fill="${st === 'fill' ? c : 'rgba(255,255,255,.15)'}" stroke="${st === 'fill' ? '#fff' : c}" stroke-width="${st === 'fill' ? 1 : 1.8}" ${st === 'dash' ? 'stroke-dasharray="3 2"' : ''} stroke-linejoin="round"/><circle cx="14" cy="17" r="2" fill="#fff" stroke="${c}"/></svg>`;
function swatch(it){
  const c = it.color, s = it.sym;
  if(s === 'fan') return fanSw(c, it.st || 'fill');
  // точечные знаки — та же «рябь», что и на карте
  const core = {tri:'<path d="M14 6.6 16.8 12H11.2Z" fill="#fff"/>', diamond:'<path d="M14 6.8 17 10 14 13.2 11 10Z" fill="#fff"/>',
    square:'<rect x="11.4" y="8" width="5.2" height="4" fill="#fff"/>', cross:'<path d="M11.6 7.6 16.4 12.4M16.4 7.6 11.6 12.4" stroke="#fff" stroke-width="1.6"/>'}[s] || '<circle cx="14" cy="10" r="1.4" fill="#fff"/>';
  if(['tri','cross','dot','ring','glow','square','diamond'].includes(s)) return `<svg class="sym" viewBox="0 0 28 20">${[10,8.5,7,5.6].map((r, k) => `<circle cx="14" cy="10" r="${r}" fill="${c}" opacity="${(0.12 + k * 0.08).toFixed(2)}" stroke="#fff" stroke-opacity=".4" stroke-width=".5"/>`).join('')}<circle cx="14" cy="10" r="4" fill="${c}" stroke="#fff" stroke-width="1"/>${core}</svg>`;
  if(s === 'line') return `<svg class="sym" viewBox="0 0 28 20"><path d="M2 10H26" stroke="${c}" stroke-width="${it.thin ? 1.6 : 4}"/></svg>`;
  if(s === 'dash') return `<svg class="sym" viewBox="0 0 28 20"><path d="M2 10H26" stroke="${c}" stroke-width="3" stroke-dasharray="6 3"/></svg>`;
  if(s === 'dots') return `<svg class="sym" viewBox="0 0 28 20"><path d="M3 10H26" stroke="${c}" stroke-width="3" stroke-dasharray="0.1 5" stroke-linecap="round"/></svg>`;
  if(s === 'grad') return `<span class="sym sym-grad" style="--c:${c}"></span>`;
  if(s === 'hatch') return `<span class="sym sym-hatch" style="--c:${c}"></span>`;
  return `<span class="sym sym-fill sym-${it.pat || 'plain'}" style="--c:${c}"></span>`;
}
const ITEM = {}; THEMES.forEach(t => t.items.forEach(i => ITEM[i.key] = ITEM[i.key] || i));
['stage','parter','belletazh','balcon'].forEach((k, i) => ITEM['mask_' + k] = {key:'mask_' + k, sym:'fill', color:TIERC[i], name:['Сцена','Партер','Бельэтаж','Балкон'][i], hint:'ярус амфитеатра'});
function clsRows(k){
  const c = CLS[k]; if(!c) return '';
  const fc = D[srcOf(k)]; const cnt = v => fc ? fc.features.filter(f => f.properties[c.field] === v).length : 0;
  return `<ul class="cls">${c.list.filter(([v]) => cnt(v)).map(([v, col, gl]) => `<li><button data-cls="${k}" data-v="${esc(v)}" aria-pressed="${!clsOff[k].has(v)}">${k === 'vp_old' ? fanSw(col, {охранять:'fill', формировать:'line', расчищать:'dash'}[v]) : gl === 'fill' ? `<span class="sym sym-fill" style="--c:${col}"></span>` : swatch({sym:gl === 'tri' ? 'tri' : gl === 'diamond' ? 'diamond' : gl === 'square' ? 'square' : gl === 'none' ? 'glow' : 'dot', color:col})}<span>${esc(clsName(k, v))}</span><em>${cnt(v)}</em></button></li>`).join('')}</ul>`;
}
let clsSolo = null;
function clsApply(k){
  const c = CLS[k]; if(!c || !GROUPS[k]) return;
  const f = clsSolo && clsSolo[0] === k ? ['==',['get',c.field],clsSolo[1]] : clsOff[k].size ? ['!',['in',['get',c.field],['literal',[...clsOff[k]]]]] : null;
  // у некоторых слоёв есть свой постоянный фильтр (например, подписи дач) — классы добавляются к нему
  GROUPS[k].forEach(id => { if(!map.getLayer(id)) return; const b = BASEF[id]; if(b === 'skip') return; map.setFilter(id, b && f ? ['all', b, f] : (b || f)); });
  if(k === 'sectors') sectorFocus();
}
// ярус в фокусе: если виден один ярус секторов — всё вокруг него темнеет
const TIER_MASK = {'сцена':'mask_stage','партер':'mask_parter','бельэтаж':'mask_belletazh','балкон':'mask_balcon'};
function sectorFocus(){
  const on = !shown.includes('sectors') ? [] : clsSolo && clsSolo[0] === 'sectors' ? [clsSolo[1]] : CLS.sectors.list.map(x => x[0]).filter(v => !clsOff.sectors.has(v));
  Object.entries(TIER_MASK).forEach(([v, m]) => { const id = m + '-dim'; if(!map.getLayer(id) || shown.includes(m)) return;
    const one = on.length === 1 && on[0] === v; map.setLayoutProperty(id, 'visibility', one ? 'visible' : 'none'); map.setPaintProperty(id, 'fill-opacity', one ? 0.55 : 0); });
  if(shown.includes('sectors')) map.setLayoutProperty('dim', 'visibility', on.length === 1 ? 'none' : 'visible');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-cls]'); if(!b) return; const k = b.dataset.cls, v = b.dataset.v;
  clsOff[k].has(v) ? clsOff[k].delete(v) : clsOff[k].add(v); b.setAttribute('aria-pressed', !clsOff[k].has(v)); clsSolo = null; whenReady(() => clsApply(k)); });
document.addEventListener('mouseover', e => { const b = e.target.closest('[data-cls]'); if(!b || isTouch) return; clsSolo = [b.dataset.cls, b.dataset.v]; whenReady(() => clsApply(b.dataset.cls)); });
document.addEventListener('mouseout', e => { const b = e.target.closest('[data-cls]'); if(!b || isTouch || (e.relatedTarget && b.contains(e.relatedTarget))) return; const k = b.dataset.cls; clsSolo = null; whenReady(() => clsApply(k)); });
function legendStatic(keys){
  const rows = keys.map(k => ITEM[k]).filter(Boolean);
  const cnt = k => { const fc = D[srcOf(k)]; return fc && fc.features ? fc.features.length : 0; };
  const many = rows.length > 1;
  return `<ul class="legend legend-live${many ? ' legend-toggle' : ''}">${rows.map(i => `<li><button data-lg="${i.key}" aria-pressed="true"${many ? '' : ' disabled'}>${swatch(i)}<span class="lg-text"><b>${esc(i.name)}</b>${i.hint ? `<small>${esc(i.hint)}</small>` : ''}</span>${many ? '<span class="box" aria-hidden="true"></span>' : `<em>${cnt(i.key) > 1 ? cnt(i.key) : ''}</em>`}</button>${clsRows(i.key)}</li>`).join('')}</ul>`;
}
// живая легенда: наведение — показать только этот слой, клик — выключить/включить
function lgApply(){ shown.forEach(k => { if(!(GROUPS[k])) return; show(k, lgSolo ? k === lgSolo : !lgOff.has(k)); }); tierFocus(); }
function tierFocus(){
  const on = shown.filter(k => k.startsWith('mask_') && (lgSolo ? k === lgSolo : !lgOff.has(k)));
  ['mask_stage','mask_parter','mask_belletazh','mask_balcon'].forEach(k => map.getLayer(k + '-dim') && map.setPaintProperty(k + '-dim', 'fill-opacity', on.length === 1 && on[0] === k ? 0.55 : 0));
  if(on.length === 1) map.setLayoutProperty('dim', 'visibility', 'none');
  else if(on.length > 1) map.setLayoutProperty('dim', 'visibility', 'visible');
}
document.addEventListener('mouseover', e => { const b = e.target.closest('[data-lg]'); if(!b || isTouch) return; lgSolo = b.dataset.lg; whenReady(lgApply); });
document.addEventListener('mouseout', e => { const b = e.target.closest('[data-lg]'); if(!b || isTouch || (e.relatedTarget && b.contains(e.relatedTarget))) return; lgSolo = null; whenReady(lgApply); });
document.addEventListener('click', e => { const b = e.target.closest('[data-lg]'); if(!b) return; const k = b.dataset.lg;
  lgOff.has(k) ? lgOff.delete(k) : lgOff.add(k); b.setAttribute('aria-pressed', !lgOff.has(k)); lgSolo = null; whenReady(lgApply); });

/* =========================================================
   Главная
   ========================================================= */
function renderHome(){
  const chapters = STORIES.map((s, k) => `<a class="row" href="#/story/${s.id}/1"><span class="row-n">${k + 1}</span><span class="row-main"><b>${esc(s.title)}</b><small>${esc(s.lead)}</small></span></a>`).join('');
  panel(topLabel(ICON.map, 'Исследование МЛА+'), `
    <h1>Горные просторы</h1>
    <p class="lead">Петербург принято считать плоским городом. Но его окружает целый амфитеатр из холмов, гребней и древних уступов.</p>
    <details class="about"><summary>Об исследовании</summary>
      <p>От древних морей и ледников до первых финских поселений, дворянских усадеб и дворцов, возведённых ради захватывающих панорам. Горы служили источником строительных материалов, местом научных открытий, а во времена опасности — естественными рубежами защиты города.</p>
      <p>В поисках этих историй пришлось объехать весь Петербургский амфитеатр, подняться на вершины, отыскать исторические панорамы и поговорить с местными жителями. Результатом стал маршрут, соединяющий ключевые видовые точки.</p>
    </details>
    <div class="choice">
      <a href="#/map"><b>Исследовать самому</b><small>Карта: восемь тем, слои включаются и выключаются</small></a>
      <a href="#/story/amph/1"><b>Пройти с нами</b><small>Девять глав по порядку, карта меняется вместе с текстом</small></a>
    </div>
    <h2>Главы</h2>
    <div class="rows">${chapters}</div>
    <h2>Ещё</h2>
    <div class="rows">
      <a class="row" href="#/views"><span class="row-main"><b>Видовые точки</b><small>${VIEWS.length} паспортов: что видно, чем ценно, что угрожает</small></span></a>
      <a class="row" href="#/gallery"><span class="row-main"><b>Галерея</b><small>Вершины, виды экспедиции и картины</small></span></a>
    </div>`);
  whenReady(() => { setShown(body.classList.contains('intro') ? [] : ['mount_polygon','vp_old']); clearViewshed(); });
}

/* =========================================================
   Главы по шагам
   ========================================================= */
let lastZoomKey = null;
/* Глава — одна прокручиваемая история: шаги идут подряд, карта меняется, когда шаг доходит до середины панели.
   Кнопки внизу и стрелки ←/→ переключают главы; Backspace прячет панель. */
let storyObs = null;
function stepLayers(st){ const [theme, layers] = STEP[st.map] || ['relief', []]; return theme === 'relief' || theme === 'geo' ? ['mount'].concat(layers.filter(k => k !== 'mount')) : layers; }
/* велосипедисты на маршрутах — объёмные модели из scene3d.js (three.js подгружается, как только они понадобились).
   window.GP_RIDE: '*' — все маршруты (вкладка «Маршруты»), [имя] — один маршрут (шаг главы), null — никого. */
function setRide(v){ window.GP_RIDE = v; window.GP3D?.setRoute(null); if(v) load3D(); whenReady(() => map.triggerRepaint()); }
function stopRider(){ if(window.GP_RIDE) setRide(null); }
function startRider(f){ setRide(f && f.properties?.name ? [f.properties.name] : null); }
function startAllRiders(){ setRide('*'); }
function routeFocus(name){
  if(!name) stopRider();
  const f = name ? ['==',['get','name'],name] : null;
  ['routes','routes-c'].forEach(id => map.getLayer(id) && map.setFilter(id, f));
  document.querySelectorAll('.shot-mk').forEach(el => el.hidden = !!name && el.dataset.routes && !el.dataset.routes.split('|').includes(name));
}
// приглушить все смотровые точки, кроме выбранных (кодов); null — вернуть как было
function focusVp(codes){
  if(!map.getLayer('vp_old')) return;
  const on = codes ? ['in',['get','code'],['literal',codes]] : null;
  map.setPaintProperty('vp_old', 'icon-opacity', on ? ['case', on, 1, 0.22] : hov(0.95, 1));
  if(map.getLayer('lab-vp_old')) map.setPaintProperty('lab-vp_old', 'text-opacity', on ? ['case', on, 1, 0] : 1);
  // сцена при просмотре точек — только контуром, без штриховки
  if(map.getLayer('seclev-scene')) map.setPaintProperty('seclev-scene', 'fill-opacity', codes ? 0 : ['interpolate',['linear'],['zoom'],12,base === 'sat' ? 0.45 : 0.6,13.5,0]);
  if(map.getLayer('seclev-scene-l')) map.setLayoutProperty('seclev-scene-l', 'visibility', codes && map.getLayoutProperty('seclev-l', 'visibility') === 'visible' ? 'visible' : 'none');
}
// поля, которые видно: со всех точек, с возвышенности или с одной точки
function setOpen(key, coords){
  const src = map.getSource('open_eco'); if(!src) return;
  imgData('media/' + key + '.png').then(u => src.updateImage({url:u, coordinates:coords || window.GP_OPEN.coords}));
}
function applyStep(id, st){
  whenReady(() => {
    setShown(stepLayers(st)); clearViewshed(); setOpen('open'); routeFocus(st.route || null);
    if(st.route){ const f = (D.routes?.features || []).find(x => x.properties.name === st.route);
      if(f) startRider(f);
      if(f){ lastZoomKey = id + ':route:' + st.route; map.fitBounds(bboxOf({features:[f]}), {padding:viewPad(), maxZoom:13, duration:1600, pitch:camPitch(), essential:true}); }
      return; }
    const z = st.zoom || 'amphitheater_bound', key = id + ':' + z;
    if(key !== lastZoomKey){ lastZoomKey = key; fitTo(ZOOM_SRC[z] || 'bound', z === 'amphitheater_bound' ? 9.6 : z === 'city' ? 9.8 : 11.5); }
  });
}
// трек маршрута в GPX — для навигатора или приложения вроде OsmAnd / Strava
const TRAIL_NAME = 'Большая горная тропа';
function routeGpx(name){
  // Большая горная тропа хранится отрезками (слой trail) — в GPX каждый отрезок идёт своим сегментом трека
  const fs = name === TRAIL_NAME ? (D.trail?.features || []) : [(D.routes?.features || []).find(x => x.properties.name === name)].filter(Boolean); if(!fs.length) return;
  const lines = fs.flatMap(f => { const g = f.geometry; return !g ? [] : g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]; });
  const x = s => String(s).replace(/[<&>"]/g, c => ({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'})[c]);
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Горные просторы" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x(name)}</name></metadata>\n<trk><name>${x(name)}</name>\n` +
    lines.map(l => `<trkseg>${l.map(c => `<trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}"/>`).join('')}</trkseg>`).join('\n') + `\n</trk>\n</gpx>\n`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx], {type:'application/gpx+xml'}));
  a.download = name.replace(/[\\/:*?"<>|«»]/g, '').trim() + '.gpx'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-gpx]'); if(b){ e.preventDefault(); routeGpx(b.dataset.gpx); } });
function routeStrip(name){
  const f = (D.routes?.features || []).find(x => x.properties.name === name); if(!f) return '';
  const p = f.properties, sh = routeShots(f).slice(0, 8);
  return `${p.length ? `<p class="small"><b>${esc(p.length)}</b>${p.description ? ' · ' + esc(p.description) : ''}</p>` : ''}
    <p><button type="button" class="btn btn-gpx" data-gpx="${esc(name)}">Скачать трек для GPS (.gpx)</button></p>
    ${sh.length ? `<div class="photos photos-round">${sh.map(x => `<a class="fig" href="#/view/${x.v.p.code}" title="${esc(x.v.p.name)}"><img src="media/vp/${x.id}.t.webp" alt="${esc(x.v.p.name)}" loading="lazy"></a>`).join('')}</div>` : ''}`;
}
function renderStory(id, n){
  const steps = STEPS[id] || [], s = STORIES.find(x => x.id === id);
  if(!s || !steps.length){ location.replace('#/'); return; }
  n = Math.min(Math.max(1, n || 1), steps.length);
  const si = STORIES.indexOf(s), pv = STORIES[si - 1], nx = STORIES[si + 1];
  const sections = steps.map((st, k) => {
    const fi = FACTS.findIndex(f => f.at[0] === id && f.at[1] === k);
    const msrc = st.media ? (st.media.includes('/') ? st.media : `media/story/${st.media}.webp`) : '';
    const media = msrc ? `<figure class="fig" data-zoom="${msrc}" data-cap="${esc(st.title)}"><img src="${msrc}" alt="${esc(st.title)}" loading="lazy"></figure>` : '';
    return `<section class="st" data-n="${k + 1}">
      <p class="st-n">${pad2(k + 1)} / ${pad2(steps.length)}</p>
      <h2 class="st-h">${esc(st.title)}</h2>
      ${media}
      <div class="prose">${(st.text || []).map(p => `<p>${p}</p>`).join('')}</div>
      ${st.route ? routeStrip(st.route) : ''}
      ${fi >= 0 ? `<aside class="fact"><b>Факт</b><p>${esc(FACTS[fi].text)}</p></aside>` : ''}
    </section>`; }).join('');
  panel(topBack('#/', 'Все главы'), `
    <p class="over">Глава ${si + 1} из ${STORIES.length}</p>
    <h1 class="h-step">${esc(s.title)}</h1>
    ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}
    ${id === 'trail' ? `<p><button type="button" class="btn btn-gpx" data-gpx="${TRAIL_NAME}">Скачать всю тропу для GPS (.gpx)</button></p>` : ''}
    ${sections}`,
    `<a class="btn" ${pv ? `href="#/story/${pv.id}/1"` : 'aria-disabled="true"'} id="stPrev">← Глава</a>
     <span class="count">Глава ${si + 1} / ${STORIES.length}</span>
     <a class="btn btn-dark" ${nx ? `href="#/story/${nx.id}/1"` : 'href="#/map"'} id="stNext">${nx ? 'Глава →' : 'Карта'}</a>`);
  if(storyObs) storyObs.disconnect();
  let cur = 0;
  // легенда шага — одна, поверх карты, а не в конце каждого шага
  const showKey = st => { const mk = $('mapKey'); $('mapKeyBody').innerHTML = `${st.look ? `<p>${esc(st.look)}</p>` : ''}${legendStatic(stepLayers(st))}`;
    if(isNarrow() && !mk.dataset.seen){ mk.open = false; mk.dataset.seen = 1; } mk.hidden = false; };   // на телефоне легенда свёрнута, чтобы не закрывать карту
  const activate = k => { if(k === cur) return; cur = k; applyStep(id, steps[k - 1]); showKey(steps[k - 1]);
    pBody.querySelectorAll('.st').forEach(el => el.classList.toggle('on', +el.dataset.n === k));
    try{ history.replaceState(null, '', `#/story/${id}/${k}`); }catch(e){} };
  // пока панель докручивается до нужного шага по ссылке, наблюдатель не должен сбивать его на первый
  let settled = n <= 1;
  storyObs = new IntersectionObserver(es => { if(!settled) return; const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if(vis.length) activate(+vis[0].target.dataset.n); }, {root:pBody, rootMargin:'-30% 0px -60% 0px', threshold:0});
  pBody.querySelectorAll('.st').forEach(el => storyObs.observe(el));
  activate(n);
  if(n > 1){ const go = () => { const el = pBody.querySelector(`.st[data-n="${n}"]`); if(el) pBody.scrollTop += el.getBoundingClientRect().top - pBody.getBoundingClientRect().top - 12; };
    requestAnimationFrame(go); setTimeout(go, 350); setTimeout(() => { go(); settled = true; }, 900); }
}

/* =========================================================
   Карта: темы, легенда с переключателями, список объектов, поиск
   ========================================================= */
let activeTheme = 'relief';
const OFF = {}; THEMES.forEach(t => OFF[t.id] = new Set(t.items.filter(i => i.off).map(i => i.key)));
const LISTS = {
  relief:[['mount', f => f.properties.name, (a, b) => (b.properties.height_value||0) - (a.properties.height_value||0), p => [p.type, p.height_value ? num(p.height_value) + ' м' : ''].filter(Boolean).join(', ')]],
  geo:[['landscape_450'],['landscape_25'],['landscape_12'],['landscape_7']],
  finns:[['maki_selki', f => f.properties.name, null, p => p.name_ru ? 'сейчас ' + p.name_ru : 'урочище']],
  estates:[['estate', f => f.properties.name, (a, b) => (a.properties.type === 'Дача') - (b.properties.type === 'Дача'), p => p.type || 'усадьба'], ['paintings', f => f.properties.name, null, () => 'картина']],
  today:[['routes', f => f.properties.name, null, () => 'пеший маршрут'], ['leisure', f => f.properties.name, null, p => p.kind || 'досуг']],
  threats:[['mount_lost', null, null, () => 'утраченная вершина'], ['reserve', null, (a, b) => b.properties.area_ha - a.properties.area_ha, p => [p.tier, p.sector].filter(Boolean).join(', ')]],
  protect:[['law_heights', null, null, () => 'охраняемая высота'], ['oopt', null, null, p => p.kind]]
};
let listAll = false;
function themeLayers(t){ return t.items.filter(i => !OFF[t.id].has(i.key)).map(i => i.key); }
function renderMap(){
  const t = THEMES.find(x => x.id === activeTheme) || THEMES[0];
  const themes = THEMES.map(x => {
    const on = x.id === t.id;
    const head = `<a class="theme${on ? ' on' : ''}" href="#/map/${x.id}" ${on ? 'aria-current="true"' : ''}><i style="background:${x.color}"></i><b>${esc(x.name)}</b><small>${esc(x.when)}</small></a>`;
    if(!on) return head;
    const items = x.items.map(i => `<li><label><input type="checkbox" data-layer="${i.key}" ${OFF[x.id].has(i.key) ? '' : 'checked'} ${i.fixed ? 'disabled' : ''}><span class="box"></span>${swatch(i)}<span class="lg-text"><b>${esc(i.name)}</b><small>${esc(i.hint || '')}</small></span></label>${clsRows(i.key)}</li>`).join('');
    return head + `<div class="theme-body"><p>${esc(x.text)}</p><ul class="legend">${items}</ul>${x.id === 'views' ? '<a class="more" href="#/views">Открыть паспорта видовых точек</a>' : ''}</div>`;
  }).join('');
  let list = '';
  const defs = LISTS[t.id] || [];
  const rows = [];
  defs.forEach(([key, filt, sort, sub]) => {
    let fs = (D[key]?.features || []).map((f, i) => [f, i]); if(filt) fs = fs.filter(([f]) => filt(f)); if(sort) fs.sort((a, b) => sort(a[0], b[0]));
    fs.forEach(([f, i]) => rows.push(`<a class="row" href="#/map/${t.id}" data-open="${key}:${i}"><span class="row-main"><b>${esc(titleOf(key, f.properties, f))}</b><small>${esc(sub ? sub(f.properties) : INFO[infoKey(key)].kicker(f.properties, key))}</small></span></a>`));
  });
  if(rows.length) list = `<h2>Объекты <span class="h-n">${rows.length}</span></h2><div class="rows">${(listAll ? rows : rows.slice(0, 12)).join('')}</div>${!listAll && rows.length > 12 ? `<button class="more" id="listMore">Показать все ${rows.length}</button>` : ''}`;
  panel(topLabel(ICON.map, 'Карта'), `
    <div class="search" role="search">
      <input id="q" type="search" placeholder="Найти гору, усадьбу, деревню" autocomplete="off" aria-label="Поиск по карте">
      <div class="rows" id="qList" hidden></div>
    </div>
    <h2 class="h-first">Темы</h2>
    <div class="themes">${themes}</div>
    ${list}`);
  bindSearch();
  whenReady(() => setShown(themeLayers(t)));
}
pBody.addEventListener('change', e => {
  const cb = e.target.closest('[data-layer]'); if(!cb) return;
  const off = OFF[activeTheme]; cb.checked ? off.delete(cb.dataset.layer) : off.add(cb.dataset.layer);
  const t = THEMES.find(x => x.id === activeTheme); whenReady(() => setShown(themeLayers(t)));
});

const INDEX = (() => {
  const out = [];
  const addAll = (key, nameFn, subFn) => (D[key]?.features||[]).forEach((f, i) => { const n = nameFn(f.properties); if(n) out.push({key, i, name:String(n), sub:subFn(f.properties), low:String(n).toLowerCase().replace(/ё/g,'е')}); });
  addAll('mount', p => p.name, p => [p.type, p.height_value ? num(p.height_value) + ' м' : ''].filter(Boolean).join(', '));
  addAll('estate', p => p.name, p => p.type || 'усадьба');
  addAll('maki_selki', p => p.name, p => 'финское урочище' + (p.name_ru ? ', сейчас ' + p.name_ru : ''));
  addAll('paintings', p => p.name, () => 'картина');
  addAll('routes', p => p.name, () => 'пеший маршрут');
  addAll('leisure', p => p.name, p => p.kind || 'досуг');
  addAll('resettlement', p => p.name, () => 'историческое поселение');
  addAll('oopt', p => p.name, p => p.kind);
  (D.vp_new?.features||[]).forEach(f => out.push({view:f.properties.code, name:f.properties.code + ' ' + f.properties.name, sub:'предлагаемая видовая точка', low:(f.properties.code + ' ' + f.properties.name).toLowerCase().replace(/ё/g,'е')}));
  (D.vp_old?.features||[]).forEach(f => out.push({view:f.properties.code, name:f.properties.code + (f.properties.name ? ' ' + f.properties.name : ''), sub:'точка экспедиции', low:(f.properties.code + ' ' + (f.properties.name||'')).toLowerCase().replace(/ё/g,'е')}));
  return out;
})();
function bindSearch(){
  const q = $('q'), list = $('qList'); if(!q) return;
  q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase().replace(/ё/g,'е');
    if(s.length < 2){ list.hidden = true; return; }
    const a = [], b = []; INDEX.forEach(x => { const k = x.low.indexOf(s); if(k === 0) a.push(x); else if(k > 0) b.push(x); });
    const res = a.concat(b).slice(0, 8);
    list.innerHTML = res.length ? res.map(x => x.view ? `<a class="row" href="#/view/${x.view}"><span class="row-main"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span></a>`
        : `<a class="row" href="#/map" data-open="${x.key}:${x.i}"><span class="row-main"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span></a>`).join('')
      : '<p class="small">Ничего не нашлось. Попробуйте название горы или деревни.</p>';
    list.hidden = false;
  });
}

/* =========================================================
   Карточка объекта
   ========================================================= */
let card = null, hovered = null;
function setSel(f){ whenReady(() => map.getSource('sel').setData({type:'FeatureCollection', features: f ? [{type:'Feature', properties:{}, geometry:f.geometry}] : []})); }
function openObject(key, i, fly){
  const s = srcOf(key === 'dom_vis' ? 'dominants' : key), f = D[s]?.features[i]; if(!f) return;
  if(key === 'vp_new' || key === 'vp_old'){ location.hash = '#/view/' + f.properties.code; return; }
  if(key === 'mount'){ location.hash = '#/mount/' + f.properties.fid; return; }
  const I = INFO[infoKey(key)], p = f.properties, title = titleOf(infoKey(key) === 'dominants' ? 'dominants' : key, p, f), photos = photosOf(key, p);
  // карточка — отдельный шаг истории: кнопка «назад» браузера или мыши закрывает её и возвращает туда, где читали
  if(!card && !(history.state && history.state.card)) try{ history.pushState({card:1}, '', location.hash); }catch(e){}
  card = {key, i, back:location.hash};
  setSel(f);
  const saved = findIdx(s, i) >= 0, text = I.text(p), ex = I.explain(p, key), wk = wikiOf(key, p);
  panel(`<button class="p-label p-back" id="cardBack">${ICON.back}${card.back.startsWith('#/story/') ? 'К главе' : 'Назад'}</button>`, `
    <p class="over"><i class="dotc" style="background:${I.color}"></i>${esc(I.kicker(p, key))}</p>
    <h1 class="h-step">${esc(title)}</h1>
    ${photos.length ? `<div class="photos${key === 'routes' ? ' photos-round' : ''}">${photos.map((u, k) => `<figure class="fig" data-zoom="${u}" data-cap="${esc(title)}"><img src="${key === 'routes' ? thumbOf(u) : u}" alt="${esc(title)}, фото ${k + 1}" referrerpolicy="no-referrer"></figure>`).join('')}</div>` : ''}
    ${key === 'leisure' && LEISURE_PHOTO[p.name] ? `<p class="small">Фото: <a href="${LEISURE_PHOTO[p.name].link}" target="_blank" rel="noopener">${LEISURE_PHOTO[p.name].site}</a>${photos.length > 1 ? '; остальные — снимки нашей экспедиции рядом' : ''}.</p>` : key === 'leisure' && photos.length ? '<p class="small">Снимок нашей экспедиции рядом с этим местом.</p>' : ''}
    ${wk && wk.img ? `<p class="small credit">Фото: <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(wk.f || '')}" target="_blank" rel="noopener">Викисклад</a></p>` : ''}
    ${topStory(key, p)}
    ${text ? `<div class="prose">${text.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('')}</div>` : ''}
    ${wk && wk.x ? `<aside class="wiki"><p>${esc(wk.x)}</p><a href="${esc(wk.u)}" target="_blank" rel="noopener">Википедия: ${esc(wk.t)} ↗</a></aside>` : ''}
    ${table(I.rows(p, key))}
    ${infoKey(key) === 'dominants' ? domSeenBlock(f) : ''}
    ${key === 'routes' && p.name ? `<p><button type="button" class="btn btn-gpx" data-gpx="${esc(p.name)}">Скачать трек для GPS (.gpx)</button></p>` : ''}
    ${key === 'trail' ? `<p><button type="button" class="btn btn-gpx" data-gpx="${TRAIL_NAME}">Скачать всю тропу для GPS (.gpx)</button></p>` : ''}
    ${ex ? `<p class="note">${esc(ex)}</p>` : ''}`,
    `<button class="btn" id="cardZoom">Приблизить</button><span class="count"></span><button class="btn btn-dark" id="cardSave" data-save="${s}:${i}">${saved ? 'Сохранено' : 'Сохранить'}</button>`);
  $('cardBack').onclick = closeCard;
  if(infoKey(key) === 'dominants') whenReady(() => showDomSeen(f)); else whenReady(() => showDomSeen(null));
  $('cardZoom').onclick = () => flyTo(centerOf(f), 13.5);
  if(key === 'photo_points') drawCone(f); else clearCone();
  if(fly) whenReady(() => f.geometry.type === 'Point' ? flyTo(f.geometry.coordinates, 12.5) : map.fitBounds(bboxOf({features:[f]}), {padding:viewPad(), maxZoom:13, pitch:camPitch(), duration:1600}));
  updateReturn();
}
function closeCard(fromPop){ card = null; setSel(null); clearCone(); showDomSeen(null); route();
  if(fromPop !== true && history.state && history.state.card) history.back(); }
addEventListener('popstate', () => { if(card && !(history.state && history.state.card)) closeCard(true); });
function domSeenList(f){
  const c = f.geometry.coordinates;
  return (DOM_SEEN[f.properties.i] || []).map(([code, m]) => { const v = VIEWS.find(x => x.p.code === code); return v ? {v, m, d:kmBetween(v.f.geometry.coordinates, c)} : null; })
    .filter(Boolean).sort((a, b) => b.m / b.d - a.m / a.d);
}
function domSeenBlock(f){
  const L = domSeenList(f);
  if(!L.length) return `<h3>Откуда видна</h3><p class="small">${String(f.properties.status || '').startsWith('потенц') ? 'Дома ещё нет — он не закрывает и не виден ни с одной точки.' : 'Ни с одной смотровой точки её не видно: закрывают рельеф, лес или дома, либо она слишком далеко и мала для глаза.'}</p>`;
  return `<h3>Откуда видна · ${L.length} ${plural(L.length, 'точка','точки','точек')}</h3>
    <p class="small">Сверху — точки, откуда она заметнее всего: выше поднимается над тем, что её загораживает. На карте пунктир — линия взгляда.</p>
    <ul class="recs seen-list">${L.map(({v, m, d}) => `<li><a href="#/view/${v.p.code}">${esc(v.p.name)}</a> <small>· ${num(Math.round(d * 10) / 10)} км, видна верхняя часть ${num(Math.round(m))} м</small></li>`).join('')}</ul>`;
}
function showDomSeen(f){
  const src = map.getSource('domrays'); if(!src) return;
  if(!f){ src.setData(EMPTY); if(!vsCur) focusVp(null); return; }
  const L = domSeenList(f), c = f.geometry.type === 'Point' ? f.geometry.coordinates : centerOf(f);
  src.setData({type:'FeatureCollection', features:L.map(({v}) => ({type:'Feature', properties:{}, geometry:{type:'LineString', coordinates:[v.f.geometry.coordinates, c]}}))});
  if(L.length){ setShown(['vp_old']); focusVp(L.map(x => x.v.p.code)); map.fitBounds(bboxOf({features:[f, ...L.map(x => x.v.f)]}), {padding:viewPad(), maxZoom:12, pitch:camPitch(), duration:1400}); }
}
function drawCone(f){
  const az = +f.properties.azimuth; if(isNaN(az)) return;
  const [lng, lat] = f.geometry.coordinates, R = 2500, fov = 32, pts = [[lng, lat]];
  for(let a = az - fov; a <= az + fov; a += 4){ const r = a * Math.PI/180; pts.push([lng + R*Math.sin(r)/(111320*Math.cos(lat*Math.PI/180)), lat + R*Math.cos(r)/110540]); }
  pts.push([lng, lat]);
  whenReady(() => map.getSource('cone').setData({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[pts]}}]}));
}
function clearCone(){ map.getSource('cone')?.setData({type:'FeatureCollection', features:[]}); }

/* ---------- наведение и клик по карте ---------- */
const tip = $('tip');
function pickAt(point){
  const ids = CLICK.map(c => c[0]).filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
  if(!ids.length) return null;
  const r = isTouch ? 16 : 6;   // палец толще курсора — на телефоне ловим объекты в большем радиусе
  const fs = map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], {layers:ids});
  if(!fs.length) return null;
  const rank = f => f.layer.type === 'fill' ? 3 : f.layer.type === 'line' ? 2 : /^vp_/.test(f.layer.id) ? 0 : 1;
  fs.sort((a, b) => rank(a) - rank(b));
  const key = CLICK.find(c => c[0] === fs[0].layer.id)[1];
  if(key === 'dom_vis' && typeof fs[0].properties.i === 'string') return null;   // Лахта-центр и Исаакий — ориентиры без карточки
  return {f:fs[0], key, idx: key === 'dom_vis' ? fs[0].properties.i : fs[0].id};
}
let vpHov = null;
function vpHover(code){
  if(code === vpHov || !map.getLayer('vphov-f')) return; vpHov = code;
  const ids = code ? (((window.GP_VIEWS || {}).views || {})[code]?.doms || []).map(d => d[0]) : [];
  const f = ['in',['get','i'],['literal',ids]];
  map.setFilter('vphov-f', f); map.setFilter('vphov-l', f);
}
// наведение: поиск объекта под курсором — не чаще раза за кадр
let mmEvt = null, mmRaf = 0;
map.on('mousemove', e => { if(isTouch) return; mmEvt = e; if(!mmRaf) mmRaf = requestAnimationFrame(() => { mmRaf = 0; onHover(mmEvt); }); });
function onHover(e){
  if(map.isMoving()) return;   // во время перетаскивания карту не опрашиваем
  const p = pickAt(e.point);
  vpHover(p && p.key === 'vp_old' ? D.vp_old.features[p.idx]?.properties.code : null);
  map.getCanvas().style.cursor = p ? 'pointer' : '';
  const ref = p && p.key !== 'dom_vis' ? {source:srcOf(p.key), id:p.f.id} : null;
  if(hovered && (!ref || hovered.source !== ref.source || hovered.id !== ref.id)){ try{ map.setFeatureState(hovered, {hover:false}); }catch(_){} hovered = null; }
  if(!p){ tip.hidden = true; return; }
  if(ref){ hovered = ref; try{ map.setFeatureState(ref, {hover:true}); }catch(_){} }
  const src = p.key === 'dom_vis' ? 'dominants' : srcOf(p.key), f = D[src].features[p.idx], I = INFO[infoKey(p.key)];
  const isVp = p.key === 'vp_new' || p.key === 'vp_old';
  tip.innerHTML = isVp ? `<b>${esc(f.properties.name || '')}</b><span>${esc(TODO[f.properties.todo] ? TODO[f.properties.todo].name + ' · ' : '')}открыть паспорт вида</span>`
    : `<b>${esc(titleOf(infoKey(p.key) === 'dominants' ? 'dominants' : p.key, f.properties, f))}</b><span>${esc(I.kicker(f.properties, p.key))}</span>`;
  tip.hidden = false; tip.style.left = (e.point.x + 14) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
}
map.on('mouseout', () => { tip.hidden = true; vpHover(null); });
// то же при наведении на строку смотровой точки в списке
document.addEventListener('mouseover', e => { if(isTouch) return; const a = e.target.closest('a[href^="#/view/"]'); whenReady(() => vpHover(a ? decodeURIComponent(a.getAttribute('href').slice(7)) : (body.dataset.view === 'view' ? vpHov : null))); });
map.on('click', e => { const p = pickAt(e.point); if(p) openObject(p.key, p.idx); else if(card) closeCard(); });   // клик мимо объектов закрывает карточку

/* =========================================================
   Видовые точки: список и паспорт
   ========================================================= */
// подпись смотровой точки на карте: имя горы или номер снимка экспедиции
(D.vp_old?.features || []).forEach(f => { const p = f.properties, s = p.sector || [0, 360]; p.label = p.name; p.full = s[1] >= 360 ? 1 : 0; p.az = ((s[0] + s[1] / 2) % 360 + 360) % 360; });
const VIEWS = (D.vp_new?.features||[]).map((f, i) => ({kind:'new', key:'vp_new', i, f, p:f.properties, n:+f.properties.code.slice(3)}))
  .concat((D.vp_old?.features||[]).map((f, i) => ({kind:'old', key:'vp_old', i, f, p:f.properties, n:f.properties.n})));
const AZ = {'С':'север','СВ':'северо-восток','В':'восток','ЮВ':'юго-восток','Ю':'юг','ЮЗ':'юго-запад','З':'запад','СЗ':'северо-запад'};
// выбранные типы воздействия: пусто — все; можно выбрать один, два или три
const vfSel = new Set();
const TODO_KEYS = ['охранять','формировать','расчищать'];
const vMatch = v => !vfSel.size || vfSel.has(v.p.todo);
const todoBadge = p => { const t = TODO[p.todo]; return t ? `<span class="todo" style="--c:${t.color}">${t.name}</span>` : ''; };
const secText = s => !s || s[1] >= 360 ? 'обзор на 360°' : `обзор ${num(Math.round(s[1]))}°, ${window.GP.dir(s[0])} — ${window.GP.dir((s[0] + s[1]) % 360)}`;
const shotName = p => '';
function viewPhotos(v){ return String(v.p.photos || '').split(',').filter(Boolean); }
function interestBlock(open){
  return `<details class="interest"${open ? ' open' : ''}><summary>Шкала интересности</summary>
    <p>${esc(INTEREST.lead)}</p>${INTEREST.parts.map(([h, t]) => `<p><b>${esc(h)}.</b> ${esc(t)}</p>`).join('')}<p>${esc(INTEREST.tail)}</p></details>`;
}
function todoCards(){
  return `<div class="todo-cards">${TODO_KEYS.map((k, i) => { const t = TODO[k], n = VIEWS.filter(v => v.p.todo === k).length;
    return `<button class="todo-card${vfSel.has(k) ? ' on' : ''}" data-vf="${k}" style="--c:${t.color}" aria-pressed="${vfSel.has(k)}"><span class="tc-check" aria-hidden="true"></span><b>${t.name}</b><em>${n}</em><small>${esc(t.text)}</small></button>`; }).join('')}</div>`;
}
function applyTodoFilter(){
  const f = vfSel.size ? ['in',['get','todo'],['literal',[...vfSel]]] : null;
  ['vp_old','lab-vp_old'].forEach(id => map.getLayer(id) && map.setFilter(id, f));
}
// переключение типа воздействия — без перерисовки панели: ничего не прыгает и не прокручивается
function toggleTodo(k){
  if(k === 'all') vfSel.clear(); else vfSel.has(k) ? vfSel.delete(k) : vfSel.add(k);
  if(vfSel.size === TODO_KEYS.length) vfSel.clear();
  pBody.querySelectorAll('[data-vf]').forEach(b => { const on = b.dataset.vf === 'all' ? !vfSel.size : vfSel.has(b.dataset.vf);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const g = $('gcards'); if(g) g.innerHTML = groupCards();
  whenReady(applyTodoFilter);
}
const VG = (window.GP_VIEWS || {}).groups || [], VALL = (window.GP_VIEWS || {}).all;
const groupViews = g => VIEWS.filter(v => g.codes.includes(v.p.code));
const thumbOfV = v => { const id = viewPhotos(v)[0]; return id ? `media/vp/${id}.t.webp` : ''; };
const lmSeenG = vs => LANDMARKS.filter(l => vs.some(v => +v.p[l.f] > 0)).map(l => l.name);
function todoBar(vs){ return `<span class="tbar">${TODO_KEYS.map(k => { const n = vs.filter(v => v.p.todo === k).length; return n ? `<i style="flex:${n};background:${TODO[k].color}" title="${TODO[k].name}: ${n}"></i>` : ''; }).join('')}</span>`; }
/* Плановость на снимке: дальний план (силуэт), средний, передний — разметка из data/planes.js */
function planesSvg(id, labels = true){
  const P = (window.GP_PLANES || {})[id]; if(!P) return '';
  const X = [0, 25, 50, 75, 100], pts = arr => arr.map((y, k) => `${X[k]},${y}`);
  const band = (top, bot) => pts(top).concat(pts(bot).reverse()).join(' ');
  const far = band(P.s, P.m), mid = band(P.m, P.f), fore = band(P.f, [100, 100, 100, 100, 100]);
  const lab = (arr, arr2, t, cls) => { const y = (arr[4] + arr2[4]) / 2; return arr2[4] - arr[4] > 3 ? `<span class="pl-lab ${cls}" style="top:${y}%">${t}</span>` : ''; };
  return `<svg class="planes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id="ph-${id}" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#fff" stroke-width=".35" opacity=".55"/></pattern></defs>
      <polygon points="${fore}" fill="url(#ph-${id})" class="pl-fore"/>
      <polygon points="${mid}" fill="rgba(13,24,32,.18)" class="pl-mid"/>
      <polygon points="${far}" fill="rgba(232,163,23,.22)" stroke="#E8A317" stroke-width="1.6" vector-effect="non-scaling-stroke" class="pl-far"/>
      <polyline points="${pts(P.f).join(' ')}" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
    </svg>${labels ? `${lab(P.s, P.m, 'дальний план', 'l-far')}${lab(P.m, P.f, 'средний план', 'l-mid')}${lab(P.f, [100, 100, 100, 100, 100], 'передний план', 'l-fore')}` : ''}`;
}
function planesFig(id, src, cap){
  return `<figure class="fig plw" data-zoom="media/vp/${id}.webp" data-cap="${esc(cap)}"><span class="plbox"><img src="${src}" alt="${esc(cap)}" loading="lazy" decoding="async">${planesSvg(id)}</span>
    <button type="button" class="pl-tog" aria-pressed="true" title="Показать или скрыть разметку планов">Планы</button></figure>`;
}
function planesIntro(){
  const ex = ['p303', 'p1201', 'g039'].find(id => (window.GP_PLANES || {})[id]);
  return `<h3>Как читать вид: плановость</h3>
    <p>Хороший вид с горы читается в глубину — как театральная сцена с кулисами. Мы разметили на каждом снимке три плана:</p>
    <ul class="recs">
      <li><b>Передний план</b> (штриховка) — то, что у ног: склон, поле, опушка, забор. Он задаёт, откуда мы смотрим, и чаще всего закрывает вид, когда зарастает или застраивается.</li>
      <li><b>Средний план</b> (лёгкое затемнение) — леса, деревни, парки, долины рек и новые кварталы на подступах к городу. Он даёт масштаб: по нему понятно, как далеко до горизонта.</li>
      <li><b>Дальний план</b> (оранжевая обводка) — силуэт города на горизонте: доминанты, высотки, трубы, залив. Это то, ради чего поднимаются на гору.</li></ul>
    <p>Чем больше планов и чем яснее граница между ними, тем вид глубже и интереснее — это и есть «многоплановый пейзаж». Если передний план сливается со средним (лес до самого горизонта), вид становится плоским. Если дальний план пропадает (город закрыт), остаются горные просторы — тоже ценность, но другая.</p>
    ${ex ? planesFig(ex, `media/vp/${ex}.webp`, 'Пример разметки планов') : ''}`;
}
document.addEventListener('click', e => { const b = e.target.closest('.pl-tog'); if(!b) return; e.preventDefault(); e.stopPropagation();
  const f = b.closest('.plw'), on = !f.classList.toggle('pl-off'); b.setAttribute('aria-pressed', on); }, true);
function groupCards(){
  const cards = VG.map(g => { const vs = groupViews(g).filter(vMatch); if(!vs.length) return '';
    const cover = vs.map(thumbOfV).find(Boolean) || groupViews(g).map(thumbOfV).find(Boolean), lm = lmSeenG(vs);
    return `<a class="gcard" href="#/views/${g.id}">${cover ? `<img src="${cover}" alt="" loading="lazy">` : '<span class="gnone"></span>'}
      <span class="gtxt"><b>${esc(g.name)}</b><small>${vs.length} ${plural(vs.length, 'точка','точки','точек')} · видно ${num(Math.round(g.area))} км²</small>${todoBar(vs)}
      ${lm.length ? `<small>в кадре: ${esc(lm.join(', '))}</small>` : '<small>вид на ландшафт</small>'}</span></a>`; }).join('');
  return cards || '<p class="small">Нет возвышенностей с точками выбранного типа.</p>';
}
function renderViews(){
  panel(topLabel(ICON.eye, 'Видовые точки'), `
    <h1>Откуда смотреть на город</h1>
    <p class="lead">Мы объехали ${VG.length} ${plural(VG.length, 'возвышенность','возвышенности','возвышенностей')} амфитеатра и отметили ${VIEWS.length} смотровых ${plural(VIEWS.length, 'точку','точки','точек')}. Вместе они открывают около ${num(VALL ? VALL.area : 0)} км² города и пригородов.</p>
    <p>На карте затемнено всё, чего не видно ни с одной точки. Светлое — общий вид со всех гор сразу: где в «плоском» Петербурге можно поймать взгляд с высоты. Выберите возвышенность, чтобы увидеть её точки и что открывается именно с неё.</p>
    <div class="nums"><div><b>${VIEWS.length}</b><small>смотровых точек</small></div><div><b>${VG.length}</b><small>возвышенностей</small></div><div><b>${num(VALL ? VALL.area : 0)}</b><small>км² видно</small></div></div>
    ${planesIntro()}
    ${interestBlock(false)}
    <h3>Три типа воздействия</h3>
    ${todoCards()}
    <h3 class="grp">Возвышенности <button type="button" class="link-btn${vfSel.size ? '' : ' on'}" data-vf="all">Показать все типы</button></h3>
    <div class="gcards" id="gcards">${groupCards()}</div>`);
  pBody.querySelectorAll('[data-vf]').forEach(b => b.onclick = () => toggleTodo(b.dataset.vf));
  whenReady(() => { setShown(['vp_old']); applyTodoFilter(); clearViewshed(); focusVp(VIEWS.map(v => v.p.code)); setOpen('open'); if(VALL) setVsImage('media/vs/all.png', VALL.coords);
    if(lastView !== 'views' && lastView !== 'view') fitTo('bound', 9.6); });
}
function renderCluster(gid){
  const g = VG.find(x => x.id === gid); if(!g){ location.replace('#/views'); return; }
  const vs = groupViews(g), gi = VG.indexOf(g), pv = VG[gi - 1], nx = VG[gi + 1];
  const photos = vs.flatMap(v => viewPhotos(v).slice(0, 1).map(id => ({id, v}))).slice(0, 6);
  const allDoms = new Map(); vs.forEach(v => domsOf(v).forEach(f => allDoms.set(f.properties.i, f)));
  const doms = [...allDoms.values()], hist = doms.filter(f => f.properties.class === 'Историческая'), eng = doms.filter(f => f.properties.class === 'Инженерная');
  const topNames = hist.concat(eng).filter(f => f.properties.name).sort((a, b) => (b.properties.height_m||0) - (a.properties.height_m||0)).slice(0, 8).map(f => f.properties.name);
  const about = '';
  const rows = vs.map(v => { const t = TODO[v.p.todo] || {color:C.pink, name:''}, ph = viewPhotos(v).length;
    return `<a class="row" href="#/view/${v.p.code}">${thumbOfV(v) ? `<img class="row-img" src="${thumbOfV(v)}" alt="" loading="lazy">` : `<span class="row-img"></span>`}<span class="row-main"><b>${esc(v.p.name)}</b><small><i class="dotc" style="background:${t.color}"></i>${t.name} · ${esc(secText(v.p.sector))}${ph ? ' · ' + ph + ' ' + plural(ph, 'снимок','снимка','снимков') : ''}</small></span></a>`; }).join('');
  panel(topBack('#/views', 'Все возвышенности'), `
    <p class="over">Возвышенность ${gi + 1} из ${VG.length}</p>
    <h1 class="h-step">${esc(g.name)}</h1>
    ${photos.length ? `<div class="photos photos-grid">${photos.map(({id, v}) => `<figure class="fig" data-zoom="media/vp/${id}.webp" data-cap="${esc(g.name)}"><img src="media/vp/${id}.t.webp" alt="${esc(g.name)}" loading="lazy"></figure>`).join('')}</div>` : ''}
    ${about ? `<div class="prose"><p>${esc(about)}</p></div>` : ''}
    <div class="nums"><div><b>${vs.length}</b><small>${plural(vs.length, 'точка','точки','точек')}</small></div><div><b>${num(Math.round(g.area))}</b><small>км² видно</small></div><div><b>${hist.length + eng.length}</b><small>доминант</small></div></div>
    ${todoBar(vs)}
    <h3>Что видно с этой возвышенности</h3>
    <p>${topNames.length ? `Главные доминанты в кадре: ${esc(topNames.join(', '))}.` : 'Высотных доминант не видно — это вид на леса, поля и холмы.'} ${lmSeenG(vs).length ? `С отдельных точек видны ${esc(lmSeenG(vs).join(', '))}.` : ''}</p>
    <p class="small">На карте светлое — то, что видно хотя бы с одной точки этой возвышенности. Исторические доминанты — розовые, инженерные — голубые, новые дома — серые.</p>
    <h3>Смотровые точки</h3>
    <div class="rows">${rows}</div>`,
    `<a class="btn" ${pv ? `href="#/views/${pv.id}"` : 'aria-disabled="true"'}>Назад</a><span class="count">${pad2(gi + 1)} / ${VG.length}</span><a class="btn btn-dark" ${nx ? `href="#/views/${nx.id}"` : 'aria-disabled="true"'}>Дальше</a>`);
  whenReady(() => { setShown(['vp_old']); applyTodoFilter(); clearViewshed(); focusVp(g.codes); setOpen('open/' + g.id, g.coords); setVsImage(`media/vs/${g.id}.png`, g.coords); showDoms(doms);
    const q = g.coords; map.fitBounds([[q[0][0], q[2][1]], [q[2][0], q[0][1]]], {padding:viewPad(), maxZoom:11, pitch:camPitch(), duration:1400}); });
}

/* ---------- Горы: отдельный раздел, как видовые точки ---------- */
const MOUNTS = (D.mount?.features||[]).map((f, i) => ({f, i, p:f.properties})).sort((a, b) => (b.p.height_value||0) - (a.p.height_value||0));
const MT = [['all','Все'],['гора','Горы'],['возвышенность','Возвышенности'],['холм','Холмы']];
let mountFilter = 'all';
const inRing = (pt, r) => { let c = false; for(let i = 0, j = r.length - 1; i < r.length; j = i++){ const [xi, yi] = r[i], [xj, yj] = r[j]; if((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inGeom = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
const mountPhotos = m => (M.mount[String(m.p.fid)] || []);
function renderMounts(){
  const n = t => MOUNTS.filter(m => m.p.type === t).length;
  const tabs = MT.map(([id, l]) => `<button class="tab${id === mountFilter ? ' on' : ''}" data-mf="${id}" aria-pressed="${id === mountFilter}">${l}${id !== 'all' ? ' ' + n(id) : ''}</button>`).join('');
  const list = MOUNTS.filter(m => mountFilter === 'all' || m.p.type === mountFilter);
  const rows = list.map(m => { const ph = mountPhotos(m).length;
    return `<a class="row" href="#/mount/${m.p.fid}"><span class="row-n row-code">${m.p.height_value ? num(m.p.height_value) + ' м' : '—'}</span><span class="row-main"><b>${esc(m.p.name)}</b><small>${esc(cap(m.p.type))}${ph ? ', ' + ph + ' ' + plural(ph, 'снимок','снимка','снимков') : ''}</small></span></a>`; }).join('');
  panel(topLabel(ICON.map, 'Горы'), `
    <h1>Горы Петербурга</h1>
    <p class="lead">${MOUNTS.length} ${plural(MOUNTS.length,'вершина','вершины','вершин')} амфитеатра: ${n('гора')} гор, ${n('возвышенность')} возвышенностей и ${n('холм')} холмов.</p>
    <p>Гора — самые высокие и заметные с равнины вершины. Возвышенность — пологий гребень или плато. Холм — невысокая округлая вершина, их больше всего. Откройте любую, и карта покажет, где она стоит.</p>
    ${clsRows('mount')}
    <div class="tabs">${tabs}</div>
    <div class="rows">${rows}</div>`);
  pBody.querySelectorAll('[data-mf]').forEach(b => b.onclick = () => { mountFilter = b.dataset.mf; renderMounts(); });
  whenReady(() => { setShown(['mount','mount_polygon']); setSel(null); clearViewshed(); if(lastView !== 'mounts' && lastView !== 'mount') fitTo('bound', 9.6); });
}
/* место вершины среди всех — зиновая «линейка» высот */
function mountRuler(m){
  const W = 400, H = 96, hs = MOUNTS.map(x => x.p.height_value || 0), max = Math.max(...hs), k = MOUNTS.indexOf(m);
  const X = i => 8 + i / (MOUNTS.length - 1) * (W - 16), Y = h => 74 - h / max * 58;
  const ticks = MOUNTS.map((x, i) => `<path d="M${X(i).toFixed(1)} 74V${Y(hs[i]).toFixed(1)}" stroke-width="${i === k ? 2.2 : 0.6}"${i === k ? '' : ' opacity=".55"'}/>`).join('');
  const tx = Math.min(W - 70, Math.max(70, X(k) + (k < MOUNTS.length / 2 ? 60 : -60)));
  return `<figure class="sky paper"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Высота вершины среди всех вершин амфитеатра">${arrowDef}
    <g stroke="${PEN}" fill="none">${ticks}<path d="M4 74H${W - 4}" stroke-width="1"/></g>
    ${note(X(k), Y(hs[k]) - 2, tx, 12, `${k + 1}-я из ${MOUNTS.length}`)}
    <text x="8" y="${H - 6}">${num(max)} м</text><text x="${W - 8}" y="${H - 6}" text-anchor="end">0 м</text></svg>
    <figcaption>Все вершины амфитеатра по высоте, слева самые высокие. Жирная черта — эта.</figcaption></figure>`;
}
function renderMount(fid){
  const m = MOUNTS.find(x => String(x.p.fid) === String(fid)); if(!m){ location.replace('#/mounts'); return; }
  const p = m.p, c = m.f.geometry.coordinates, ph = mountPhotos(m), I = INFO.mount;
  const sec = (D.sectors?.features||[]).find(f => inGeom(c, f.geometry));
  const views = VIEWS.map(v => ({v, d:kmBetween(c, v.f.geometry.coordinates)})).sort((a, b) => a.d - b.d).slice(0, 3);
  const same = MOUNTS.filter(x => x !== m).map(x => ({x, d:kmBetween(c, x.f.geometry.coordinates)})).sort((a, b) => a.d - b.d).slice(0, 4);
  const text = I.text(p);
  const idx = MOUNTS.indexOf(m), prev = MOUNTS[idx - 1], next = MOUNTS[idx + 1];
  const gallery = ph.length ? `<div class="photos${ph.length > 1 ? ' photos-grid' : ''}">${ph.map(n => `<figure class="fig" data-zoom="media/mount/${n}.webp" data-cap="${esc(p.name)}"><img src="media/mount/${n}.webp" alt="${esc(p.name)}" loading="lazy" decoding="async"></figure>`).join('')}</div>`
    : `<div class="nophoto">Снимка этой вершины пока нет</div>`;
  panel(topBack('#/mounts', 'Все горы'), `
    <p class="over">${esc(cap(p.type))}${p.height_value ? ' · ' + num(p.height_value) + ' м над уровнем моря' : ''}</p>
    <h1 class="h-step">${esc(p.name)}</h1>
    ${gallery}
    <p class="small coords">Координаты: ${c[1].toFixed(5)}, ${c[0].toFixed(5)}</p>
    <h3>Описание</h3><div class="prose">${text ? `<p>${esc(text)}</p>` : ''}<p>${esc(I.explain(p))}${sec ? ` Вершина стоит в секторе «${esc(sec.properties.type_2 || sec.properties.name || '')}», ярус — ${esc(sec.properties.type)}.` : ''}</p></div>
    <h3>Высота</h3>${mountRuler(m)}
    <h3>Откуда смотреть</h3>
    <ul class="recs">${views.map(({v, d}) => `<li><a href="#/view/${v.p.code}">${esc(v.p.name || '')}</a>, ${num(Math.round(d * 10) / 10)} км</li>`).join('')}</ul>
    <h3>Соседние вершины</h3>
    <ul class="recs">${same.map(({x, d}) => `<li><a href="#/mount/${x.p.fid}">${esc(x.p.name)}</a> — ${esc(x.p.type)}${x.p.height_value ? ', ' + num(x.p.height_value) + ' м' : ''}, ${num(Math.round(d * 10) / 10)} км</li>`).join('')}</ul>`,
    `<a class="btn" ${prev ? `href="#/mount/${prev.p.fid}"` : 'aria-disabled="true"'}>Выше</a><span class="count">${idx + 1} / ${MOUNTS.length}</span><a class="btn btn-dark" ${next ? `href="#/mount/${next.p.fid}"` : 'aria-disabled="true"'}>Ниже</a>`);
  whenReady(() => { setShown(['mount','mount_polygon','vp_old']); setSel(m.f); clearViewshed(); flyTo(c, 12.5); });
}

const DOM_BY_I = {}; (D.dominants?.features || []).forEach(f => DOM_BY_I[f.properties.i] = f);
// с каких точек видна каждая доминанта (по строгому расчёту) — для карточки доминанты
const DOM_SEEN = {};
Object.entries(((window.GP_VIEWS || {}).views) || {}).forEach(([code, v]) => (v.doms || []).forEach(([i, m]) => (DOM_SEEN[i] = DOM_SEEN[i] || []).push([code, m])));
(D.dominants?.features || []).forEach(f => f.properties.vis_n = (DOM_SEEN[f.properties.i] || []).length);
// видимые с точки доминанты: [i, сколько метров выступает над препятствиями] → признак _ang (угол, °) для ранжирования
function domsOf(v){
  const pre = ((window.GP_VIEWS || {}).views || {})[v.p.code], c = v.f.geometry.coordinates;
  if(pre && pre.doms){
    const out = pre.doms.map(([i, m]) => { const f = DOM_BY_I[i]; if(!f) return null;
      const d = kmBetween(c, f.geometry.coordinates) * 1000; return {...f, properties:{...f.properties, _vis:m, _km:d / 1000, _ang:Math.atan(m / d) * 180 / Math.PI}}; }).filter(Boolean);
    // Лахта-центра и Исаакия нет в базе доминант — добавляем из отдельного расчёта ориентиров
    LANDMARKS.filter(l => l.id !== 'tv' && +v.p[l.f] > 0).forEach(l => { const d = kmBetween(c, l.c) * 1000, m = +v.p[l.f];
      out.push({type:'Feature', geometry:{type:'Point', coordinates:l.c}, properties:{i:'lm-' + l.id, name:l.name === 'Исаакий' ? 'Исаакиевский собор' : l.name, class:l.id === 'isaac' ? 'Историческая' : 'Инженерная',
        status:'существующая', height_m:l.h, _vis:m, _km:d / 1000, _ang:Math.atan(m / d) * 180 / Math.PI}}); });
    return out;
  }
  const tag = String(v.n), field = v.kind === 'new' ? 'vt' : 'to';
  return (D.dominants?.features||[]).filter(f => (',' + (f.properties[field] || '') + ',').includes(',' + tag + ','));
}
const VV = (window.GP_VIEWS || {}).views || {};
/* Рисунки паспорта — в стиле полевого зина: чёрная линия на бумаге в точку, машинописные подписи со стрелками. */
const PEN = '#161616';
const arrowDef = '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8" fill="none" stroke="#161616" stroke-width="1.2"/></marker></defs>';
const note = (x, y, tx, ty, text, anchor = 'middle') => `<path d="M${tx.toFixed(1)} ${(ty + 3).toFixed(1)}Q${((tx + x) / 2 + 8).toFixed(1)} ${((ty + y) / 2).toFixed(1)} ${x.toFixed(1)} ${(y - 3).toFixed(1)}" fill="none" stroke="${PEN}" stroke-width=".7" marker-end="url(#ar)"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(text)}</text>`;
const spruce = (x, y, h) => { const w = Math.max(2, h * 0.38); return `<path d="M${x.toFixed(1)} ${(y - h).toFixed(1)}L${(x + w).toFixed(1)} ${y.toFixed(1)}M${x.toFixed(1)} ${(y - h).toFixed(1)}L${(x - w).toFixed(1)} ${y.toFixed(1)}M${(x - w * 0.6).toFixed(1)} ${(y - h * 0.45).toFixed(1)}L${(x + w * 0.6).toFixed(1)} ${(y - h * 0.45).toFixed(1)}"/>`; };
const house = (x, y, h) => { const w = Math.max(2.4, Math.min(6, h * 0.5)); return `<path d="M${(x - w / 2).toFixed(1)} ${y.toFixed(1)}V${(y - h).toFixed(1)}H${(x + w / 2).toFixed(1)}V${y.toFixed(1)}"/>`; };
const churchH = (x, y, h) => { const w = Math.min(7, Math.max(4, h * 0.1)), b = y - h * 0.45, d = y - h * 0.82; return `<path d="M${(x - w).toFixed(1)} ${y.toFixed(1)}V${b.toFixed(1)}H${(x + w).toFixed(1)}V${y.toFixed(1)}M${(x - w * 0.6).toFixed(1)} ${b.toFixed(1)}Q${x.toFixed(1)} ${(d - h * 0.08).toFixed(1)} ${(x + w * 0.6).toFixed(1)} ${b.toFixed(1)}M${x.toFixed(1)} ${d.toFixed(1)}V${(y - h).toFixed(1)}" fill="#fff" stroke="${PEN}" stroke-width="1"/>`; };
const church = (x, y) => `<path d="M${x - 4} ${y}V${y - 12}H${x + 4}V${y}M${x - 3} ${y - 12}Q${x} ${y - 19} ${x + 3} ${y - 12}M${x} ${y - 18}V${y - 23}M${x - 2} ${y - 21}H${x + 2}" fill="none" stroke="${PEN}" stroke-width="1"/>`;

/* Силуэт: линия горизонта с точки (рельеф, дома, лес) в секторе обзора и подписанные доминанты над ней.
   Рисуем только исторические и инженерные доминанты — новая жилая застройка не отвлекает. */
function skyline(v, doms){
  const V = VV[v.p.code]; if(!V || !V.hz) return '';
  const o = V.obs || v.f.geometry.coordinates, W = 400, H = 190, top = 62, bot = 150;
  const sec = v.p.sector || [0, 360], full = sec[1] >= 360;
  const city = full ? bearing(o, LANDMARKS[2].c) : (sec[0] + sec[1] / 2) % 360, span = full ? 75 : Math.max(20, Math.min(90, sec[1] / 2 + 4));
  const hzAt = az => V.hz[Math.floor(((az % 360) + 360) % 360 * 2) % 720] / 100;
  const rel = az => ((az - city + 540) % 360) - 180, X = r => (r + span) / (2 * span) * W;
  const vis = new Map(V.doms.map(([i, m]) => [i, m]));
  const pts = doms.filter(f => vis.has(f.properties.i) && f.properties.class !== 'Новая' && f.properties.name).map(f => { const c = f.geometry.coordinates, az = bearing(o, c), r = rel(az), d = kmBetween(o, c) * 1000;
    const h0 = hzAt(az), m = vis.get(f.properties.i); return {r, h0, h1:h0 + Math.atan2(m, d) * 180 / Math.PI, m, p:f.properties, d}; }).filter(x => Math.abs(x.r) <= span)
    .sort((a, b) => b.m - a.m).slice(0, 9);
  const prof = []; for(let r = -span; r <= span; r += 0.5) prof.push([r, hzAt(city + r)]);
  const q = (arr, t) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(t * a.length))]; };
  const marks = LANDMARKS.map(l => { const az = bearing(o, l.c), r = rel(az), m = (V.lm || {})[l.id] || 0; if(Math.abs(r) > span || m <= 0) return null;
    const d = kmBetween(o, l.c) * 1000, h0 = hzAt(az); return {r, h0, h1:h0 + Math.atan2(m, d) * 180 / Math.PI, name:l.name, d}; }).filter(Boolean);
  const all = pts.map(x => ({r:x.r, h0:x.h0, h1:x.h1, name:x.p.name.replace(/^(Церковь|Собор|Храм)\s+/,'$1 '), d:x.d, hist:x.p.class === 'Историческая'}))
    .concat(marks.map(m => ({...m, land:true}))).filter((x, k, arr) => !x.land || !arr.some(y => !y.land && Math.abs(y.r - x.r) < 0.6));
  const hzs = prof.map(x => x[1]); let lo = q(hzs, 0.03), hi = Math.max(q(hzs, 0.95), ...all.map(x => x.h1)); if(hi - lo < 0.4) hi = lo + 0.4;
  const Y = a => Math.max(top - 8, Math.min(bot + 6, bot - (a - lo) / (hi - lo) * (bot - top)));
  const ridge = prof.map(([r, a], k) => `${k ? 'L' : 'M'}${X(r).toFixed(1)} ${Y(a).toFixed(1)}`).join('');
  const ground = ridge + `L${W} ${bot + 14}L0 ${bot + 14}Z`;
  // подписи в три строки сверху, слева направо, без наложений
  const rows = [[], [], []], placed = all.sort((a, b) => a.r - b.r).map(x => { const tx = X(x.r), w = Math.min(150, x.name.length * 5.4 + 30);
    let row = rows.findIndex(rw => !rw.some(([a, b]) => tx - w / 2 < b && tx + w / 2 > a)); if(row < 0) return null; rows[row].push([tx - w / 2, tx + w / 2]); return {...x, tx, ty:12 + row * 14}; }).filter(Boolean);
  const f1 = n => n.toFixed(1);
  const sticks = placed.map(x => `<path d="M${f1(X(x.r))} ${f1(Y(x.h0))}V${f1(Math.min(Y(x.h0) - 3, Y(x.h1)))}" stroke-width="${x.land ? 2 : 1.4}"/>`).join('');
  const labels = placed.map(x => `<path d="M${f1(x.tx)} ${x.ty + 3}L${f1(X(x.r))} ${f1(Math.min(Y(x.h0) - 3, Y(x.h1)) - 3)}" stroke="${PEN}" stroke-width=".5" opacity=".7"/><text x="${f1(Math.min(W - 4, Math.max(4, x.tx)))}" y="${x.ty}" text-anchor="middle">${esc(x.name.length > 26 ? x.name.slice(0, 25) + '…' : x.name)}, ${num(Math.round(x.d / 1000))} км</text>`).join('');
  const dirName = a => window.GP.dir((a + 360) % 360);
  return `<figure class="sky paper"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Силуэт с точки: линия горизонта и доминанты над ней">
    <defs><pattern id="gr" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="${PEN}" stroke-width=".5" opacity=".5"/></pattern></defs>
    <path d="${ground}" fill="url(#gr)"/>
    <g fill="none" stroke="${PEN}" stroke-linecap="round">${sticks}</g>
    <path d="${ridge}" fill="none" stroke="${PEN}" stroke-width="1.5" stroke-linejoin="round"/>
    <g>${labels}</g>
    <text x="0" y="${H - 4}">${dirName(city - span)}</text><text x="${W / 2}" y="${H - 4}" text-anchor="middle">${full ? 'к центру города' : 'середина сектора'}, ${dirName(city)}</text><text x="${W}" y="${H - 4}" text-anchor="end">${dirName(city + span)}</text>
    </svg><figcaption>Так выглядит небесная линия с точки${full ? '' : ' в её секторе обзора'}: рельеф, дома и лес вместе. Палочки — исторические и инженерные доминанты, которые поднимаются над горизонтом, длина палочки — насколько они выше. Высота растянута, иначе силуэт был бы ниткой.</figcaption></figure>`;
}
/* Разрез от точки до главной доминанты в секторе: земля в разрезе, отдельно лес и дома в масштабе, луч взгляда до вершины доминанты. */
function profile(v){
  const V = VV[v.p.code]; if(!V || !V.prof || !V.prof.t) return '';
  const P = V.prof, n = P.g.length, W = 640, H = 260, L = P.km, eye = P.g[0] + 1.7, TOP = P.h || 0;
  const curv = d => d * d * 1e6 * (1 - 0.13) / (2 * 6371000), dist = k => k / (n - 1) * L;
  const cg = P.g, surf = cg.map((g, k) => g + Math.max(P.t[k] || 0, P.b[k] || 0)), target = cg[n - 1] + TOP;
  const hi = Math.max(...surf, eye, target) + 8, lo = Math.min(0, Math.min(...cg)) - 4;
  const L0 = 34, R0 = W - 18, B = 200, T0 = 56;
  const X = k => L0 + k / (n - 1) * (R0 - L0), Y = h => B - (h - lo) / (hi - lo) * (B - T0), f1 = x => x.toFixed(1);
  const exag = Math.round(((B - T0) / (hi - lo)) / ((R0 - L0) / (L * 1000)));
  const gl = cg.map((h, k) => `${k ? 'L' : 'M'}${f1(X(k))} ${f1(Y(h))}`).join('');
  const poche = `${gl}L${f1(X(n - 1))} ${B + 8}L${f1(X(0))} ${B + 8}Z`;
  let trees = '', houses = '';
  for(let k = 1; k < n - 1; k++){
    const x = X(k), y = Y(cg[k]);
    if((P.b[k] || 0) >= 4){ const h = Math.max(2.5, y - Y(cg[k] + P.b[k])); houses += `<path d="M${f1(x - 1.5)} ${f1(y)}V${f1(y - h)}H${f1(x + 1.5)}V${f1(y)}"/>`; }
    else if((P.t[k] || 0) >= 4 && k % 2 === 0) trees += spruce(x, y, Math.min(Math.max(3, y - Y(cg[k] + P.t[k])), 18));
  }
  let water = ''; cg.forEach((h, k) => { if(h < 1.2 && k % 4 === 0) water += `<path d="M${f1(X(k))} ${f1(Y(0) + 3)}q1.75 -2 3.5 0t3.5 0"/>`; });
  const line = k => { const t = k / (n - 1); return eye + (target - eye) * t + curv(dist(k)) - curv(L) * t; };
  const blockK = surf.findIndex((h, k) => k > 2 && k < n - 3 && h > line(k));
  const what = blockK < 0 ? '' : (P.b[blockK] || 0) >= 4 ? 'дома' : (P.t[blockK] || 0) >= 4 ? 'лес' : 'рельеф';
  const occ = [[], []], CW = 5.6, notes = [];
  const place = (x, text) => { const w = text.length * CW + 8; const x0 = Math.min(Math.max(x - w / 2, 2), W - w - 2);
    for(let r = 0; r < 2; r++) if(!occ[r].some(([a, b]) => x0 < b && x0 + w > a)){ occ[r].push([x0, x0 + w]); return {x:x0 + w / 2, y:14 + r * 13}; } return null; };
  const add = (x, y, text) => { const q = place(x, text); if(q) notes.push(`<path d="M${f1(q.x)} ${q.y + 3}L${f1(x)} ${f1(y - 4)}" stroke="${PEN}" stroke-width=".6" marker-end="url(#ar)"/><text x="${f1(q.x)}" y="${q.y}" text-anchor="middle">${esc(text)}</text>`); };
  add(X(0), Y(eye), `точка, ${num(Math.round(cg[0]))} м`);
  if(P.name) add(X(n - 1) - 3, Y(target), `${P.name.length > 30 ? P.name.slice(0, 29) + '…' : P.name}, ${num(TOP)} м`);
  if(blockK > 0) add(X(blockK), Y(surf[blockK]), `взгляд упирается: ${what}`);
  (P.m || []).slice().sort((a, b) => a[1] - b[1]).forEach(([name, t]) => { const k = Math.round(t * (n - 1)); add(X(k), Y(surf[k]), name.length > 22 ? name.slice(0, 21) + '…' : name); });
  const step = [5, 10, 20, 25, 50, 100].find(s => (hi - lo) / s <= 6) || 100;
  let ax = ''; for(let h = Math.ceil(lo / step) * step; h <= hi; h += step) ax += `<path d="M${L0 - 4} ${f1(Y(h))}H${L0}" stroke="${PEN}" stroke-width=".7"/><text x="${L0 - 7}" y="${f1(Y(h) + 3)}" text-anchor="end">${h}</text>`;
  const ks = L > 20 ? 5 : L > 8 ? 2 : 1; let dx = '';
  for(let d = 0; d <= L; d += ks) dx += `<path d="M${f1(L0 + d / L * (R0 - L0))} ${B + 8}v4" stroke="${PEN}" stroke-width=".7"/><text x="${f1(L0 + d / L * (R0 - L0))}" y="${B + 22}" text-anchor="middle">${d}</text>`;
  dx += `<text x="${R0}" y="${B + 36}" text-anchor="end">км · высоты в м · по вертикали ×${num(exag)}</text>`;
  const tgt = TOP > 0 ? (P.kind === 'историческая' ? churchH(X(n - 1) - 2, Y(cg[n - 1]), Y(cg[n - 1]) - Y(target)) : `<path d="M${f1(X(n - 1) - 2)} ${f1(Y(cg[n - 1]))}V${f1(Y(target))}" stroke="${PEN}" stroke-width="2.4"/>`) : '';
  return `<figure class="sky paper prof"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Разрез от точки до ${esc(P.name || 'горизонта')}">${arrowDef}
    <defs><pattern id="poche" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="${PEN}" stroke-width=".7"/></pattern></defs>
    <path d="${poche}" fill="url(#poche)" stroke="none"/>
    <path d="${gl}" fill="none" stroke="${PEN}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M${L0} ${B + 8}H${R0}" stroke="${PEN}" stroke-width=".8"/>
    <g fill="none" stroke="#2F6B4F" stroke-width=".8" stroke-linecap="round">${trees}</g>
    <g fill="#fff" stroke="${PEN}" stroke-width=".8">${houses}</g>
    <g fill="none" stroke="${PEN}" stroke-width=".7">${water}</g>
    ${TOP > 0 ? `<path d="${Array.from({length:n}, (_, k) => `${k ? 'L' : 'M'}${f1(X(k) - (k === n - 1 ? 2 : 0))} ${f1(Y(line(k)))}`).join('')}" stroke="${PEN}" stroke-width="1" stroke-dasharray="6 4" fill="none"/>` : ''}
    ${blockK > 0 && TOP > 0 ? `<path d="M${f1(X(blockK) - 4)} ${f1(Y(line(blockK)) - 4)}l8 8m0 -8l-8 8" stroke="${PEN}" stroke-width="1.6"/>` : ''}
    ${tgt}<circle cx="${f1(X(0))}" cy="${f1(Y(eye))}" r="3" fill="${PEN}"/>
    ${ax}${dx}<g>${notes.join('')}</g>
    </svg><figcaption>Разрез от точки ${P.name ? `до доминанты «${esc(P.name)}»` : 'вдоль середины сектора'}, ${num(L)} км. Штриховка — земля, зелёные ёлочки — лес, белые коробки — дома, всё в масштабе разреза. ${TOP > 0 ? (blockK < 0 ? 'Пунктир — взгляд с высоты глаз на вершину доминанты: он проходит над всеми преградами, вершину видно.' : `Пунктир — взгляд на вершину доминанты: через ${num(Math.round(dist(blockK) * 10) / 10)} км к нему вплотную подходит ${what}.`) : ''}</figcaption></figure>`;
}
const dots = (n, max = 3) => `<span class="dots" aria-label="${n} из ${max}">${Array.from({length:max}, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`;
/* Передний план: что лежит перед точкой в секторе на 3 км (LULC) */
function openBlock(code){
  const st = (window.GP_OPEN?.stats || {})[code]; if(!st) return '';
  const open = ['луга','степи','болота','вырубки','открытые земли'], col = {'луга':'#E8F0C4','степи':'#E2EC80','болота':'#AADECE','вырубки':'#D6BE8C','открытые земли':'#ddd','лес':'#4f8a55','застройка':'#C32E75','вода':'#4968B1'};
  const sum = open.reduce((a, k) => a + (st[k] || 0), 0), parts = open.concat(['лес','застройка','вода']).filter(k => st[k] > 0);
  return `<h3>Передний план</h3>
    <div class="tbar tbar-big">${parts.map(k => `<i style="flex:${st[k]};background:${col[k]}" title="${k}: ${st[k]} %"></i>`).join('')}</div>
    <p class="small">${parts.map(k => `${k} ${st[k]} %`).join(', ')}.</p>
    <p>${sum >= 40 ? `Перед точкой много открытых пространств (${sum} %): луга, поля и болота держат вид открытым — их стоит сохранить незастроенными и не давать зарасти.` : sum >= 15 ? `Открытые пространства занимают ${sum} % переднего плана — вид держится на нескольких полях и лугах.` : `Открытых пространств впереди мало (${sum} %): вид держится на высоте точки, а лес и дома легко его закроют.`}</p>
    <p class="small">Сектор обзора точки в радиусе 3 км, по карте покрова земли.</p>`;
}
/* Финский след вокруг точки (3 км): исторические поселения, урочища «мяки/сельки», нынешние посёлки по переписи 2021 */
const centroid = g => { const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : [g.coordinates]); let x = 0, y = 0; ring.forEach(q => { x += q[0]; y += q[1]; }); return [x / ring.length, y / ring.length]; };
const FIN = {};
['resettlement','maki_selki','finns_today'].forEach(k => FIN[k] = (D[k]?.features || []).map(f => ({p:f.properties, c:centroid(f.geometry)})));
// точка внутри полигона (Polygon / MultiPolygon, внешнее кольцо с дырами)
function nearGeom(pt, g){ // расстояние до ближайшей вершины линии/полигона, км (грубо, для «рядом»)
  let d = 1e9; const walk = c => { if(typeof c[0] === 'number') d = Math.min(d, kmBetween(pt, c)); else c.forEach(walk); }; walk(g.coordinates); return d; }
/* Что вокруг смотровой точки: ярус, древний ландшафт, соседние вершины, усадьбы, охрана природы, досуг, маршруты, картины */
function aroundBlock(c, R = 3){
  const rows = [], dirTo = x => window.GP.dir(bearing(c, x)), km1 = d => num(Math.round(d * 10) / 10) + ' км';
  const sec = (D.sectors?.features || []).find(f => inGeom(c, f.geometry));
  if(sec) rows.push(['Место в амфитеатре', `${cap(sec.properties.type)}${sec.properties.type_2 ? ' — ' + sec.properties.type_2 : ''}. ${{сцена:'Самый нижний ярус: низина у воды, с которой на горы смотрят снизу.', партер:'Нижний ярус у подножия: отсюда город близко и почти на одном уровне.', бельэтаж:'Средний ярус: город виден целиком, но уже сверху.', балкон:'Верхний ярус: самые дальние и высокие точки, город лежит внизу полосой на горизонте.'}[sec.properties.type] || ''}`]);
  const ERA = {landscape_450:'известняковое плато — дно моря 450 млн лет назад', landscape_25:'морена — камни и глина, оставленные ледником', landscape_12:'камы и озы — песчаные холмы из-под тающего ледника, около 12 тыс. лет назад', landscape_7:'литориновый уступ — берег древнего моря 7 тыс. лет назад'};
  const geo = Object.keys(ERA).map(k => { const f = (D[k]?.features || []).find(x => inGeom(c, x.geometry)); return f ? `${f.properties.name || ''}: ${ERA[k]}` : ''; }).filter(Boolean);
  if(geo.length) rows.push(['Под ногами', cap(geo.join('; '))]);
  const ms = (D.mount?.features || []).filter(f => f.properties.name).map(f => ({f, d:kmBetween(c, f.geometry.coordinates)})).filter(x => x.d <= R).sort((a, b) => a.d - b.d).slice(0, 5);
  if(ms.length) rows.push(['Вершины рядом', ms.map(({f, d}) => `${f.properties.type} ${f.properties.name}${f.properties.height_value ? ', ' + num(f.properties.height_value) + ' м' : ''} — ${d < 0.15 ? 'точка на ней' : km1(d) + ' на ' + dirTo(f.geometry.coordinates)}`).join('; ')]);
  const es = (D.estate?.features || []).map(f => ({f, d:kmBetween(c, f.geometry.coordinates)})).filter(x => x.d <= R).sort((a, b) => a.d - b.d).slice(0, 5);
  if(es.length) rows.push(['Усадьбы и дачи', es.map(({f, d}) => `${f.properties.name} (${String(f.properties.type || '').toLowerCase()}, ${km1(d)})`).join('; ')]);
  const nat = [...(D.oopt?.features || []).filter(f => inGeom(c, f.geometry) || nearGeom(c, f.geometry) < 1).map(f => `${f.properties.kind || 'ООПТ'} «${f.properties.name}»`),
    ...(D.law_relief?.features || []).filter(f => inGeom(c, f.geometry)).map(f => f.properties.name)];
  if(nat.length) rows.push(['Под охраной', [...new Set(nat)].join('; ')]);
  const vo = (D.vomitoria?.features || []).filter(f => nearGeom(c, f.geometry) <= 1.5);
  if(vo.length) rows.push(['Речные долины', `рядом ${vo.length > 1 ? vo.length + ' долины' : 'долина'}-вомиторий — естественный вход в амфитеатр, по ней удобно подниматься к точке`]);
  const le = (D.leisure?.features || []).map(f => ({f, d:kmBetween(c, f.geometry.coordinates)})).filter(x => x.d <= R).sort((a, b) => a.d - b.d).slice(0, 4);
  if(le.length) rows.push(['Чем заняться', le.map(({f, d}) => `${f.properties.name} — ${String(f.properties.kind || '').toLowerCase()}, ${km1(d)}`).join('; ')]);
  const ro = (D.routes?.features || []).filter(f => nearGeom(c, f.geometry) <= 1.2);
  if(ro.length) rows.push(['Наши маршруты', ro.map(f => `«${f.properties.name}» (${f.properties.length || ''})`).join('; ')]);
  const wa = (D.walking?.features || []).filter(f => nearGeom(c, f.geometry) <= 1).length;
  if(wa) rows.push(['Тропы', `${wa} ${plural(wa, 'популярная тропа','популярные тропы','популярных троп')} пешеходов и велосипедистов проходят ближе километра`]);
  const pa = (D.paintings?.features || []).map(f => ({f, d:kmBetween(c, f.geometry.coordinates)})).filter(x => x.d <= R);
  if(pa.length) rows.push(['На картинах', pa.slice(0, 3).map(({f}) => f.properties.name).join('; ')]);
  if(!rows.length) return '';
  return `<h3>Что вокруг точки</h3><dl class="kv kv-meas kv-around">${rows.map(([k, x]) => `<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>
    <p class="small">В радиусе ${R} км от точки.</p>`;
}
function finnsBlock(c, R = 3){
  const near = k => FIN[k].filter(x => kmBetween(c, x.c) <= R);
  const hist = near('resettlement'), maki = near('maki_selki'), today = near('finns_today');
  const pop = today.reduce((a, x) => a + (+x.p.population || 0), 0), fin = today.reduce((a, x) => a + (+x.p.finns || 0), 0);
  const top = today.slice().sort((a, b) => (b.p.finns || 0) - (a.p.finns || 0)).slice(0, 4);
  if(!hist.length && !maki.length && !today.length) return `<p class="small">В радиусе ${R} км финских поселений и названий мы не нашли.</p>`;
  const names = arr => [...new Set(arr.map(x => x.p.name).filter(Boolean))];
  const hn = names(hist), mn = maki.map(x => x.p.name + (x.p.name_ru ? ` (${x.p.name_ru})` : ''));
  const share = FIN.resettlement.length ? hist.length / FIN.resettlement.length * 100 : 0;
  return `<dl class="kv kv-meas">
    <div><dt>Исторические поселения</dt><dd>${hist.length ? `${hist.length} — ${esc(hn.slice(0, 8).join(', '))}${hn.length > 8 ? '…' : ''}` : 'нет'}</dd></div>
    <div><dt>«Горные» названия</dt><dd>${maki.length ? esc(mn.slice(0, 6).join(', ')) : 'нет'}</dd></div>
    <div><dt>Горные финны сегодня</dt><dd>${today.length ? `${num(fin)} ${plural(fin, 'человек','человека','человек')} в ${today.length} ${plural(today.length, 'населённом пункте','населённых пунктах','населённых пунктах')} — ${num(Math.round(fin / Math.max(pop, 1) * 1000) / 10)} % жителей. Больше всего: ${esc(top.map(x => `${x.p.name} ${x.p.finns} (${num(x.p.pct)} %)`).join(', '))}` : 'по переписи финского населения рядом нет'}</dd></div></dl>
    <p class="small">В радиусе ${R} км от точки. Здесь ${num(Math.round(share * 10) / 10)} % всех исторических финских поселений амфитеатра. Горные финны — финны, ингерманландцы, вепсы, водь, ижорцы и карелы, по переписи 2021 года.</p>`;
}
function renderPassport(code){
  const v = VIEWS.find(x => x.p.code === code); if(!v){ location.replace('#/views'); return; }
  const p = v.p, c = v.f.geometry.coordinates, doms = domsOf(v), photos = viewPhotos(v), VVp = VV[p.code] || {};
  const hist = doms.filter(f => f.properties.class === 'Историческая'), fut = doms.filter(f => String(f.properties.status || '').startsWith('потенц'));
  const eng = doms.filter(f => f.properties.class === 'Инженерная' && f.properties.status === 'существующая');
  const now = doms.filter(f => !String(f.properties.status || '').startsWith('потенц'));
  const top = now.filter(f => f.properties.name && f.properties.class !== 'Новая').sort((a, b) => (b.properties._ang || 0) - (a.properties._ang || 0)).slice(0, 10);
  const newNow = now.filter(f => f.properties.class === 'Новая').length, newFut = doms.length - now.length;
  const distC = kmBetween(c, LANDMARKS[2].c), near = mountNear(c), t = TODO[p.todo] || {name:'', color:C.pink, text:''};
  const sec = p.sector || [0, 360], full = sec[1] >= 360;
  const inSec = az => full || ((az - sec[0] + 720) % 360) <= sec[1];
  const isaacIn = inSec(bearing(c, LANDMARKS[2].c));
  const about = '';
  const lmSeen = LANDMARKS.filter(l => +p[l.f] > 0);
  const descr = `${about}<p>Возвышенность — ${esc(p.group)}.${near ? ` Ближайшая вершина — ${esc(near.name)}${near.height_value ? ', ' + num(near.height_value) + ' м' : ''}.` : ''} Высота точки ${num(Math.round(p.z_m || 0))} м, до центра города ${num(Math.round(distC * 10) / 10)} км.</p>
    <p>${full ? 'Вид на все 360°: стрелок обзора у точки нет, отсюда видно во все стороны.' : `Точка смотрит в секторе ${num(Math.round(sec[1]))}° — от направления на ${esc(window.GP.dir(sec[0]))} до направления на ${esc(window.GP.dir((sec[0] + sec[1]) % 360))}.${p.sector_src === 'neighbour' ? ' Сектор взят у соседней точки: обе смотрят в одну сторону.' : ''}`}</p>`;
  // что делает вид интересным — описательно, без оценок
  const meas = [
    ['Глубина', VVp.depth ? `взгляд уходит на ${num(Math.round(VVp.depth))} км` : '—'],
    ['Плановость', VVp.planes ? `${num(VVp.planes)} ${plural(Math.round(VVp.planes), 'план','плана','планов')} вдоль луча` : 'один план'],
    ['Силуэт', VVp.peaks != null ? `${num(VVp.peaks)} ${plural(VVp.peaks, 'перелом','перелома','переломов')} небесной линии в секторе` : '—'],
    ['Узнавание', hist.length + eng.length ? `${hist.length} ${plural(hist.length, 'историческая','исторические','исторических')} и ${eng.length} ${plural(eng.length, 'инженерная','инженерные','инженерных')} ${plural(eng.length, 'доминанта','доминанты','доминант')}` + (lmSeen.length ? `; видны ${lmSeen.map(l => l.name).join(', ')}` : '') : 'город не виден — вид на горные просторы']];
  const value = `<h3>Чем интересен вид</h3>
    <dl class="kv kv-meas">${meas.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>
    <p class="small">Числа описывают вид, а не оценивают его. Глубина — докуда взгляд достаёт в девяти направлениях из десяти; планы — сколько раз открытые участки сменяются закрытыми вдоль луча; переломы — сколько раз меняется направление небесной линии.</p>
    ${interestBlock(false)}`;
  const recs = [];
  if(p.todo === 'охранять'){
    if(hist.length) recs.push(`Не перекрывать исторические доминанты в секторе: ${hist.filter(f => f.properties.name).slice(0, 4).map(f => esc(f.properties.name)).join(', ') || hist.length + ' шт.'}.`);
    recs.push('Высотный регламент в секторе обзора по модели закона Санкт-Петербурга № 820-7.');
  }
  if(p.todo === 'формировать'){
    recs.push('Зонирование с учётом точки: высоты новой застройки задавать так, чтобы добавить планов и силуэтности.');
    if(fut.length) recs.push(`В секторе ${fut.length} ${plural(fut.length, 'новый жилой дом','новых жилых дома','новых жилых домов')} — силуэт новой застройки стоит обсуждать через архитектурный конкурс.`);
  }
  if(p.todo === 'расчищать') recs.push('Регламент на застройку фона не нужен. Следить, чтобы саму точку не закрыли деревья, забор или постройка.');
  const gallery = photos.length ? `<div class="photos${photos.length > 1 ? ' photos-grid' : ''}">${photos.map((id, k) => { const cp = (M.caps || {})[id];
      if(!k && (window.GP_PLANES || {})[id]) return planesFig(id, `media/vp/${id}.webp`, cp || p.name);
      return `<figure class="fig" data-zoom="media/vp/${id}.webp" data-cap="${esc(cp || (p.name + (shotName(p) ? ', ' + shotName(p) : '')))}"><img src="media/vp/${id}${k ? '.t' : ''}.webp" alt="${esc(cp || 'Вид с точки ' + p.name)}" loading="lazy" decoding="async">${cp ? `<figcaption>${esc(cp)}</figcaption>` : ''}</figure>`; }).join('')}</div>`
    : `<div class="nophoto">Снимка с этой точки пока нет</div>`;
  const idx = VIEWS.indexOf(v), prev = VIEWS[idx - 1], next = VIEWS[idx + 1];
  const G = (window.GP_VIEWS.groups || []).find(g => g.codes.includes(p.code));
  panel(topBack(G ? '#/views/' + G.id : '#/views', G ? G.name : 'Все точки'), `
    <p class="over">${fanSw(t.color, {охранять:'fill', формировать:'line', расчищать:'dash'}[p.todo] || 'fill')}${todoBadge(p)} · ${esc(secText(sec))}</p>
    <h1 class="h-step">${esc(p.name || 'Без названия')}</h1>
    ${shotName(p) ? `<p class="small">${esc(cap(shotName(p)))}${p.photo_az != null ? ', камера смотрела на ' + esc(window.GP.dir(p.photo_az)) : ''}</p>` : ''}
    ${gallery}
    <p class="small coords">Координаты: ${c[1].toFixed(5)}, ${c[0].toFixed(5)}</p>
    <h3>Описание</h3><div class="prose">${descr}</div>
    ${aroundBlock(c)}
    <h3>Финский след</h3>${finnsBlock(c)}
    ${openBlock(p.code)}
    <h3>Что нужно виду: ${esc(t.name.toLowerCase())}</h3>
    <p>${esc(t.text)}</p>
    ${recs.length ? `<ul class="recs">${recs.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
    <h3>Зона видимости</h3>
    <p class="small" id="vsInfo">Считаю, что видно с точки…</p>
    <h3>Что видно с точки</h3>
    <div class="domkey-p">
      <span><i class="k-s"></i>тень на карте — отсюда не видно: закрывают рельеф, лес или дома; без тени — видно</span>
      <span><i class="k-h"></i>историческая доминанта — храм, колокольня, усадьба</span>
      <span><i class="k-e"></i>инженерная — телебашня, Лахта-центр, трубы, мачты</span>
      <span><i class="k-n"></i>новый жилой дом выше 50 м</span>
      <small>На карте подписаны самые заметные — те, что выше других поднимаются над горизонтом.</small></div>
    <h3>Объекты наблюдения</h3>
    ${top.length ? `
      <ul class="obs">${top.map(f => `<li><i style="background:${f.properties.class === 'Историческая' ? DOMC.h : DOMC.e}"></i><b>${esc(f.properties.name)}</b><small>${num(Math.round(f.properties.height_m))} м · ${num(Math.round(f.properties._km * 10) / 10)} км · над горизонтом ${num(Math.round(f.properties._vis))} м</small></li>`).join('')}</ul>
      <p class="small">Над горизонтом поднимается ${hist.length ? `${hist.length} ${plural(hist.length, 'историческая доминанта','исторические доминанты','исторических доминант')}` : 'ни одной исторической доминанты'}, ${eng.length} ${plural(eng.length, 'инженерная','инженерные','инженерных')}${newNow ? ` и ${newNow} ${plural(newNow, 'новый жилой дом','новых жилых дома','новых жилых домов')}` : ''}. ${newFut ? `Ещё ${newFut} ${plural(newFut, 'запроектированный дом','запроектированных дома','запроектированных домов')} войдут в панораму, когда их построят.` : ''} Цвета — как на карте: светло-золотые исторические, голубые инженерные, серые новые дома.</p>`
      : `<p class="note">Город отсюда не виден — это вид на горные просторы: поля, лес и соседние гряды.${now.length ? ` Над горизонтом поднимаются только ${now.length} ${plural(now.length, 'постройка','постройки','построек')} без исторического значения.` : ''}</p>`}
    ${profile(v)}
    ${value}`,
    `<a class="btn" ${prev ? `href="#/view/${prev.p.code}"` : 'aria-disabled="true"'}>Назад</a><span class="count">${pad2(idx + 1)} / ${VIEWS.length}</span><a class="btn btn-dark" ${next ? `href="#/view/${next.p.code}"` : 'aria-disabled="true"'}>Дальше</a>`);
  whenReady(() => { setShown(['vp_old']); applyTodoFilter(); setSel(v.f); showViewshed(v, doms); });
}

/* ---------- зона видимости на карте ---------- */
let vsOn = true, vsCur = null, vsJob = 0;
const EMPTY = {type:'FeatureCollection', features:[]};
function clearViewshed(){
  vsCur = null; vsJob++; focusVp(null); if($('domkey')) $('domkey').hidden = true;
  if(map.getLayer('vs-img')) map.removeLayer('vs-img'); if(map.getSource('vs-img')) map.removeSource('vs-img');
  vsTok++; routeFocus(null); map.getSource('vs-out')?.setData(EMPTY); map.getSource('vs-ray')?.setData(EMPTY); map.getSource('domvis')?.setData(EMPTY); map.getSource('domsel')?.setData(EMPTY);
  map.getLayer('dom_poly') && map.setFilter('dom_poly', ['in',['get','i'],['literal',[]]]);
  $('vsbar').hidden = true; if(!card) setSel(null);
}
// картинки вьюшедов грузим через <script> с data-URL: так они работают и с сервера, и при открытии файла (file://)
const IMGV = '20261118d';
function imgData(url){
  const m = url.match(/^media\/(.+)\.png$/); if(!m) return Promise.resolve(url);
  const k = m[1], G = window.GP_IMG || {}; if(G[k]) return Promise.resolve(G[k]);
  return new Promise(res => { const s = document.createElement('script'); s.src = 'media/' + k + '.js?v=' + IMGV;
    s.onload = () => res((window.GP_IMG || {})[k] || url + '?v=' + IMGV); s.onerror = () => res(url + '?v=' + IMGV); document.head.appendChild(s); });
}
let vsTok = 0;
function setVsImage(url0, coords){ const tok = ++vsTok; imgData(url0).then(url => { if(tok === vsTok) putVsImage(url, coords); }); }
function putVsImage(url, coords){
  if(map.getLayer('vs-img')) map.removeLayer('vs-img'); if(map.getSource('vs-img')) map.removeSource('vs-img');
  map.addSource('vs-img', {type:'image', url, coordinates:coords});
  map.addLayer({id:'vs-img', type:'raster', source:'vs-img', paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'nearest'}}, 'vs-ray');
  const q = coords, hole = [q[0], q[3], q[2], q[1], q[0]];
  map.getSource('vs-out').setData({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]], hole]}}]});
}
function showDoms(doms){
  // будущие дома сейчас не видны; подписываем 10 самых заметных исторических и инженерных — по углу над горизонтом
  doms = doms.filter(f => !String(f.properties.status || '').startsWith('потенц'));
  const named = doms.filter(f => f.properties.name && f.properties.class !== 'Новая').sort((a, b) => (b.properties._ang || b.properties.height_m || 0) - (a.properties._ang || a.properties.height_m || 0));
  const topSet = new Set(named.slice(0, 10).map(f => f.properties.i));
  const key = $('domkey'); if(key) key.hidden = !doms.length;
  map.getSource('domvis').setData({type:'FeatureCollection', features:doms.map(f => ({type:'Feature', geometry:f.geometry,
    properties:{...f.properties, top: topSet.has(f.properties.i) ? 1 : 0, label:String(f.properties.name || '').replace(/^(Церковь|Собор|Храм)\s+/,'$1 ').slice(0, 34)}}))});
  const cls = {}; doms.forEach(f => cls[f.properties.i] = f.properties.class);
  map.getSource('domsel').setData({type:'FeatureCollection', features:(D.dom_poly?.features || []).filter(f => cls[f.properties.i]).map(f => ({type:'Feature', geometry:f.geometry, properties:{i:f.properties.i, class:cls[f.properties.i]}}))});
}
async function showViewshed(v, doms){
    const job = ++vsJob, c = v.f.geometry.coordinates; vsCur = {v, doms};
  $('vsbar').hidden = false; $('vsName').textContent = v.p.name || ''; $('vsToggle').checked = vsOn;
  showDoms(doms);
  const sec = v.p.sector || [0, 360], k0 = Math.cos(c[1] * Math.PI / 180), end = a => [c[0] + 0.27 * Math.sin(a * Math.PI / 180) / k0, c[1] + 0.27 * Math.cos(a * Math.PI / 180)];
  map.getSource('vs-ray').setData({type:'FeatureCollection', features: sec[1] >= 360 ? [] : [sec[0], sec[0] + sec[1]].map(a => ({type:'Feature', properties:{}, geometry:{type:'LineString', coordinates:[c, end(a)]}}))});
  const far = doms.length ? bboxOf({features:doms.concat([v.f])}) : null;
  if(far) map.fitBounds(far, {padding:viewPad(), maxZoom:11.5, pitch:camPitch(), duration:1600}); else flyTo(c, 11);
  const info = $('vsInfo');
  if(!vsOn){ if(info) info.textContent = 'Зона видимости выключена. Включите её переключателем над картой.'; return; }
  try{
    const pre = VV[v.p.code];
    const r = pre ? {url:`media/vs/${pre.img || v.p.code}.png`, coords:pre.coords, areaKm2:pre.area, pre:true} : await window.GPViewshed.compute(c, 30000, 2);
    if(job !== vsJob) return;
    setVsImage(r.url, r.coords); focusVp([v.p.code]); if(pre) setOpen('open/' + (pre.img || v.p.code), pre.coords);
    if(info) info.textContent = r.pre ? `С высоты глаз ${(v.p.sector || [0,360])[1] >= 360 ? '' : 'в секторе обзора '}видно около ${num(Math.round(r.areaKm2))} км² в радиусе 30 км. Всё, что ${(v.p.sector || [0,360])[1] >= 360 ? '' : 'вне сектора или '}закрыто рельефом, домами и лесом, на карте затемнено; полутень — закрыто только домами и лесом.`
      : `С высоты глаз видно около ${num(Math.round(r.areaKm2))} км² в радиусе 30 км. Всё, что не видно, на карте затемнено. Расчёт по рельефу без домов и леса, поэтому в натуре видно меньше.`;
  }catch(e){
    if(job !== vsJob) return;
    if(info) info.textContent = 'Не удалось загрузить модель высот, поэтому зона видимости не построена. Проверьте интернет и откройте паспорт ещё раз.';
  }
}
$('vsToggle').onchange = e => { vsOn = e.target.checked; if(!vsCur) return;
  if(vsOn) showViewshed(vsCur.v, vsCur.doms);
  else { vsJob++; vsTok++; if(map.getLayer('vs-img')) map.removeLayer('vs-img'); if(map.getSource('vs-img')) map.removeSource('vs-img'); map.getSource('vs-out').setData(EMPTY);
    const info = $('vsInfo'); if(info) info.textContent = 'Зона видимости выключена. Включите её переключателем над картой.'; } };
$('vsClose').onclick = () => { location.hash = '#/views'; };

/* =========================================================
   Сохранённое, галерея, лайтбокс
   ========================================================= */
let finds = []; try{ finds = JSON.parse(localStorage.getItem('gp_finds3') || '[]'); }catch(e){}
const persist = () => { try{ localStorage.setItem('gp_finds3', JSON.stringify(finds)); }catch(e){} };
const findIdx = (key, i) => finds.findIndex(x => x.key === key && x.i === i);
function toggleFind(key, i){
  const at = findIdx(key, i);
  if(at >= 0){ finds.splice(at, 1); persist(); toast('Убрано из сохранённого'); return false; }
  finds.unshift({key, i}); persist(); toast('Сохранено', '#/gallery/saved', 'Открыть'); return true;
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-save]');
  if(s){ e.preventDefault(); const [k, i] = s.dataset.save.split(':'); const on = toggleFind(k, +i); s.textContent = on ? 'Сохранено' : 'Сохранить'; if(galleryTab === 'saved' && body.dataset.view === 'gallery') renderGallery(); return; }
  const o = e.target.closest('[data-open]');
  if(o){ e.preventDefault(); const [k, i] = o.dataset.open.split(':'); focusObject(k, +i); return; }
  const z = e.target.closest('[data-zoom]');
  if(z){ lightbox(z.dataset.zoom, z.dataset.cap); return; }
  if(e.target.id === 'listMore'){ listAll = true; renderMap(); }
});
let toastT = 0;
function toast(text, href, label){ const t = $('toast'); t.innerHTML = esc(text) + (href ? ` <a href="${href}">${esc(label)}</a>` : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

const GALLERY = (() => {
  const items = [];
  (D.mount?.features||[]).forEach((f, i) => { const ph = M.mount[String(f.properties.fid)]; if(ph) items.push({kind:'mount', key:'mount', i, src:`media/mount/${ph[0]}.webp`}); });
  (D.photo_points?.features||[]).forEach((f, i) => { if(M.viewpoints.includes(String(f.properties.id))) items.push({kind:'vp', key:'photo_points', i, src:`media/vp/${f.properties.id}.t.webp`}); });
  (D.paintings?.features||[]).forEach((f, i) => { if(M.paintings.includes(String(f.properties.fid))) items.push({kind:'paint', key:'paintings', i, src:`media/paint/${f.properties.fid}.t.webp`}); });
  return items;
})();
let galleryTab = 'vp';
function renderGallery(){
  const tabs = [['vp','Виды экспедиции'],['mount','Вершины'],['paint','Картины'],['saved',`Сохранённое ${finds.length}`]];
  $('gTabs').innerHTML = tabs.map(([id, l]) => `<a class="tab${id === galleryTab ? ' on' : ''}" href="#/gallery/${id}">${l}</a>`).join('');
  let items = galleryTab === 'saved' ? finds.filter(x => D[x.key]?.features[x.i]).map(x => ({key:x.key, i:x.i, src:thumbOf(photosOf(x.key, D[x.key].features[x.i].properties)[0])})) : GALLERY.filter(x => x.kind === galleryTab);
  $('gGrid').innerHTML = items.map(x => { const f = D[x.key].features[x.i], I = INFO[infoKey(x.key)], t = titleOf(x.key, f.properties, f);
    const sub = x.key === 'mount' ? (f.properties.height_value ? num(f.properties.height_value) + ' м' : f.properties.type) : x.key === 'photo_points' ? 'снимок ' + f.properties.id : I.kicker(f.properties, x.key);
    return `<article class="tile"><a href="#/map" data-open="${x.key}:${x.i}">${x.src ? `<img src="${x.src}" alt="${esc(t)}" loading="lazy" decoding="async">` : `<div class="tile-none">${esc(I.name)}</div>`}</a>
      <div class="tile-cap"><span><b>${esc(t)}</b><small>${esc(sub)}</small></span><button data-save="${x.key}:${x.i}">${findIdx(x.key, x.i) >= 0 ? 'Сохранено' : 'Сохранить'}</button></div></article>`; }).join('');
  $('gEmpty').hidden = items.length > 0;
  $('gEmpty').innerHTML = 'Здесь будут места, которые вы сохраните на <a href="#/map">карте</a> или в галерее.';
  $('gallery').scrollTop = 0;
}
/* Маршруты: Большая горная тропа и наши треки. Издалека — плотность всех троп, вблизи — линии. */
let trackHeatBuilt = false;
function buildTrackHeat(){
  if(trackHeatBuilt) return; trackHeatBuilt = true;
  const pts = [], step = 0.004;
  ['walking','routes','trail'].forEach(k => (D[k]?.features || []).forEach(f => { const g = f.geometry; if(!g) return;
    (g.type === 'MultiLineString' ? g.coordinates : g.type === 'LineString' ? [g.coordinates] : []).forEach(l => { for(let i = 1; i < l.length; i++){
      const a = l[i - 1], b = l[i], n = Math.max(1, Math.round(Math.hypot((b[0] - a[0]) * 0.5, b[1] - a[1]) / step));
      for(let s = 0; s < n; s++) pts.push({type:'Feature', properties:{w:k === 'walking' ? 1 : 2}, geometry:{type:'Point', coordinates:[a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]}}); } }); }));
  map.getSource('track-pts').setData({type:'FeatureCollection', features:pts});
}
function renderRoutes(){
  const R = (D.routes?.features || []).map((f, i) => ({f, i, p:f.properties, name:String(f.properties.name || '').trim()})).filter(r => r.name);
  const walk = r => /^Пешком/.test((ROUTES[r.name] || [''])[0]);
  const rows = R.map(r => { const sh = routeShots(r.f), th = sh.length ? `media/vp/${sh[0].id}.t.webp` : '';
    return `<div class="route-row"><a class="row" href="#/routes" data-open="routes:${r.i}">${th ? `<img class="row-img" src="${th}" alt="" loading="lazy">` : '<span class="row-img"></span>'}
      <span class="row-main"><b>${esc(r.name)}</b><small>${walk(r) ? 'пешком' : 'на велосипеде'}${r.p.length ? ' · ' + esc(r.p.length) : ''}${sh.length ? ` · ${sh.length} ${plural(sh.length, 'снимок','снимка','снимков')}` : ''}</small></span></a>
      <button type="button" class="btn btn-gpx" data-gpx="${esc(r.name)}" title="Скачать трек для навигатора">GPX</button></div>`; }).join('');
  panel(topLabel(ICON.map, 'Маршруты'), `
    <h1>Маршруты</h1>
    <p class="lead">Большая горная тропа и девять наших треков по высотам вокруг города.</p>
    <p>Оранжевые линии — тропы и веломаршруты: где их гуще, туда ходят и ездят чаще. Розовым выделены наши маршруты.</p>
    <div class="route-row"><a class="row" href="#/story/trail/1"><span class="row-main"><b>Большая горная тропа</b><small>Как команда МЛА+ нашла эти виды и как их связать в один путь</small></span></a>
      <button type="button" class="btn btn-gpx" data-gpx="${TRAIL_NAME}" title="Скачать всю тропу для навигатора">GPX</button></div>
    <h2>Наши треки <span class="h-n">${R.length}</span></h2>
    <div class="rows">${rows}</div>`);
  // треки — тонкими бледными линиями, без тепловой карты (она слишком ярко «горела» поверх спутника)
  whenReady(() => { setShown(['walking','routes','trail']); clearViewshed(); startAllRiders(); if(lastView !== 'routes') fitTo('bound', 9.6); });
}
function focusObject(key, i){
  const t = THEMES.find(x => x.items.some(it => it.key === key || (key.startsWith('landscape') && it.key === key)));
  const theme = key === 'mount' ? 'relief' : key === 'photo_points' ? 'views' : t ? t.id : activeTheme;
  if(t && key !== 'mount') OFF[theme].delete(key);
  pending = {key, i};
  if(location.hash === '#/map/' + theme) route(); else location.hash = '#/map/' + theme;
}
let pending = null;
function lightbox(src, capt){ $('lbImg').src = src; $('lbImg').alt = capt || ''; $('lbCap').textContent = capt || ''; $('lightbox').hidden = false; $('lbX').focus(); }
const closeLightbox = () => { $('lightbox').hidden = true; };
$('lbX').onclick = closeLightbox;
$('lightbox').onclick = e => { if(e.target.id === 'lightbox') closeLightbox(); };

addEventListener('keydown', e => {
  if(e.target.closest('input, textarea, [contenteditable]')) return;
  if(e.key === 'Escape'){ if(!$('lightbox').hidden) return closeLightbox(); if(card) return closeCard(); }
  if((body.dataset.view === 'story' || body.dataset.view === 'view' || body.dataset.view === 'mount') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){
    const b = pFoot.querySelectorAll('a.btn')[e.key === 'ArrowRight' ? 1 : 0];
    if(b && b.getAttribute('href')){ e.preventDefault(); location.hash = b.getAttribute('href'); }
  }
});

/* =========================================================
   Адреса: #/ · #/story/<глава>/<шаг> · #/map/<тема> · #/views · #/view/<код> · #/gallery/<вкладка>
   ========================================================= */
let lastView = null;
/* Возврат в главу: если из главы ушли в паспорт точки, гору или карточку — над картой висит кнопка «Вернуться к главе».
   Пропадает, когда человек сам выбирает раздел в меню или возвращается в главу. */
let storyReturn = null, navJump = false;
document.addEventListener('click', e => { if(e.target.closest('[data-nav], .logo')) navJump = true; }, true);
function updateReturn(){
  const chip = $('retChip'), inStory = body.dataset.view === 'story' && !card;
  const ret = card && card.back && card.back.startsWith('#/story/') ? card.back : (!inStory && storyReturn);
  if(!ret){ chip.hidden = true; return; }
  const s = STORIES.find(x => x.id === ret.split('/')[2]);
  if(!s){ chip.hidden = true; return; }
  chip.innerHTML = `${ICON.back}<span>Вернуться к главе <b>«${esc(s ? s.title : '')}»</b></span>`;
  chip.href = ret; chip.hidden = false;
}
$('retChip').addEventListener('click', e => { if(card && card.back && $('retChip').getAttribute('href') === location.hash){ e.preventDefault(); closeCard(); } });
function route(e){
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean), v = parts[0] || 'home';
  const view = ['story','map','views','view','mounts','mount','gallery','routes'].includes(v) ? v : 'home';
  const oldHash = e && e.oldURL ? '#' + (e.oldURL.split('#')[1] || '') : '';
  if(view === 'story' || navJump) storyReturn = null;
  else if(lastView === 'story' && oldHash.startsWith('#/story/')) storyReturn = oldHash;
  navJump = false;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === view || (a.dataset.nav === 'home' && view === 'story') || (a.dataset.nav === 'views' && view === 'view') || (a.dataset.nav === 'mounts' && view === 'mount')));
  endPanelTouch(); setPanelCollapsed(false);
  body.dataset.view = view; card = null; tip.hidden = true;
  // любой переход стирает следы прошлой карточки: лучи от доминанты, сектор снимка, выделение
  whenReady(() => { map.getSource('domrays')?.setData(EMPTY); clearCone(); setSel(null); });
  if(view !== 'story') $('mapKey').hidden = true;
  $('gallery').hidden = view !== 'gallery';
  if(view !== 'view') whenReady(clearViewshed);
  if(view !== 'story') lastZoomKey = null;
  if(view === 'home') renderHome();
  else if(view === 'story') renderStory(parts[1], +parts[2]);
  else if(view === 'views') parts[1] ? renderCluster(parts[1]) : renderViews();
  else if(view === 'view') renderPassport(parts[1]);
  else if(view === 'mounts') renderMounts();
  else if(view === 'mount') renderMount(parts[1]);
  else if(view === 'gallery'){ galleryTab = parts[1] || galleryTab; renderGallery(); }
  else if(view === 'routes') renderRoutes();
  else {
    if(parts[1] && parts[1] !== activeTheme){ activeTheme = parts[1]; listAll = false; }
    renderMap();
    if(pending){ const {key, i} = pending; pending = null; whenReady(() => openObject(key, i, true)); }
    else if(lastView && lastView !== 'map') whenReady(() => { setSel(null); });
  }
  lastView = view;
  updateReturn();
  requestAnimationFrame(() => map.resize());
}
addEventListener('hashchange', route);
addEventListener('resize', () => map.resize());
route();
})();
