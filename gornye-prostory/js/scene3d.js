/* Объёмная сцена поверх карты (three.js как пользовательский слой MapLibre).
   Работает только в режиме 3D.
   1. Доминанты — упрощённые, но узнаваемые модели в реальном размере: Лахта-центр, телебашня, Исаакий,
      Петропавловский и Смольный соборы, Адмиралтейство.
   2. Персонажи — белые фигурки «как макет»: появляются, когда карту приближают к месту,
      у каждого своё поведение:
        парапланерист — кружит над площадкой, покачиваясь на потоках;
        всадник — рысью обходит поле конного клуба;
        лыжник — съезжает по склону и снова поднимается;
        мотоциклист — нарезает круги по трассе и подпрыгивает на кочке;
        гуляющая с зонтиком — неспешно обходит усадьбу, останавливаясь посмотреть на вид;
        пешеход и велосипедист — идут по нашему маршруту, когда он открыт в главе.
   Фигурки увеличены, чтобы их было видно с высоты; доминанты — в настоящую величину. */
(function(){
  'use strict';
  if(!window.THREE || !window.maplibregl) return;
  const T = window.THREE, D = window.GP_DATA || {};
  const W = {white:'#F7F4EE', ink:'#23323C', pink:'#E15989', gold:'#D8A53A', glass:'#8FC0E2', stone:'#A7A196', green:'#5D8C74', blue:'#7FA6D4', hair:'#4A3426', horse:'#8A5A3B'};
  const mat = (c, o = {}) => new T.MeshStandardMaterial({color:c, roughness:o.r ?? 0.75, metalness:o.m ?? 0, side:T.DoubleSide, transparent:!!o.op, opacity:o.op ?? 1, emissive:o.e || '#000000', emissiveIntensity:o.ei ?? 0});
  const M = {white:mat(W.white), ink:mat(W.ink), pink:mat(W.pink), gold:mat(W.gold, {m:0.8, r:0.3, e:'#5a3a00', ei:0.25}), glass:mat(W.glass, {m:0.6, r:0.2, e:'#1d4a6b', ei:0.25}),
    stone:mat(W.stone), green:mat(W.green), blue:mat(W.blue), hair:mat(W.hair), horse:mat(W.horse), shadow:new T.MeshBasicMaterial({color:'#000', transparent:true, opacity:0.22, depthWrite:false})};
  const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
  const cyl = (r1, r2, h, m, seg = 12) => new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg), m);
  const sph = (r, m, seg = 12) => new T.Mesh(new T.SphereGeometry(r, seg, seg), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const pivot = (x, y, z, child) => { const g = new T.Group(); g.position.set(x, y, z); if(child) g.add(child); return g; };

  /* ---------- фигуры (метры, ось Y вверх, «вперёд» — +X) ---------- */
  // человек: таз на высоте 0,95; ноги и руки — на шарнирах, чтобы шагать
  function person(o = {}){
    const g = new T.Group(), body = o.body || M.white;
    const leg = s => { const p = pivot(0, 0.95, s * 0.11); p.add(at(box(0.16, 0.9, 0.16, o.legs || M.ink), 0, -0.45, 0)); g.add(p); return p; };
    const arm = s => { const p = pivot(0, 1.5, s * 0.27); p.add(at(box(0.12, 0.62, 0.12, body), 0, -0.31, 0)); g.add(p); return p; };
    const L = leg(1), R = leg(-1), A = arm(1), B = arm(-1);
    g.add(at(o.dress ? cyl(0.18, 0.42, 0.8, o.dress, 10) : box(0.26, 0.62, 0.44, body), 0, o.dress ? 1.05 : 1.27, 0));
    g.add(at(sph(0.14, M.white), 0, 1.73, 0));
    g.add(at(sph(0.145, o.hairM || M.hair, 8), -0.03, 1.77, 0));
    return {g, L, R, A, B};
  }
  const walkCycle = (P, t, amp = 0.55) => { const a = Math.sin(t) * amp; P.L.rotation.z = a; P.R.rotation.z = -a; P.A.rotation.z = -a * 0.8; P.B.rotation.z = a * 0.8; };
  const seat = (P, legsA = 1.2) => { P.L.rotation.z = legsA; P.R.rotation.z = legsA; P.A.rotation.z = 0.9; P.B.rotation.z = 0.9; };
  function wheel(r){ const w = new T.Mesh(new T.TorusGeometry(r, 0.045, 6, 18), M.ink); return w; }
  function cyclist(){
    const g = new T.Group(), w1 = at(wheel(0.34), 0.55, 0.34, 0), w2 = at(wheel(0.34), -0.55, 0.34, 0);
    g.add(w1, w2);
    const bar = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), m = box(len, 0.05, 0.05, M.pink); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); m.rotation.z = Math.atan2(dy, dx); g.add(m); };
    bar(-0.55, 0.34, -0.05, 0.85); bar(-0.05, 0.85, 0.45, 0.9); bar(0.45, 0.9, 0.55, 0.34); bar(-0.55, 0.34, 0.05, 0.36); bar(0.05, 0.36, -0.05, 0.85); bar(0.45, 0.9, 0.42, 1.05);
    const P = person(); P.g.position.set(-0.12, 0.05, 0); P.g.rotation.z = -0.35; seat(P, 1.0); P.A.rotation.z = 1.25; P.B.rotation.z = 1.25; g.add(P.g);
    return {g, P, w1, w2};
  }
  function horseRider(){
    const g = new T.Group(), h = new T.Group();
    h.add(at(box(1.9, 0.75, 0.6, M.horse), 0, 1.35, 0));
    const neck = at(box(0.45, 0.95, 0.35, M.horse), 0.95, 1.85, 0); neck.rotation.z = -0.5; h.add(neck);
    h.add(at(box(0.62, 0.3, 0.3, M.horse), 1.3, 2.25, 0));
    const tail = at(box(0.12, 0.7, 0.12, M.ink), -1.0, 1.25, 0); tail.rotation.z = 0.4; h.add(tail);
    const legs = [[0.75, 0.2], [0.75, -0.2], [-0.75, 0.2], [-0.75, -0.2]].map(([x, z]) => { const p = pivot(x, 1.05, z); p.add(at(box(0.16, 1.05, 0.16, M.horse), 0, -0.52, 0)); h.add(p); return p; });
    g.add(h);
    const P = person(); P.g.position.set(-0.05, 0.75, 0); seat(P, 0.9); P.L.rotation.x = 0.35; P.R.rotation.x = -0.35; g.add(P.g);
    return {g, h, legs, P};
  }
  function paraglider(){
    const g = new T.Group(), wing = new T.Group();
    for(let k = -6; k <= 6; k++){ const a = k / 6 * 0.95, cell = box(1.2, 0.18, 0.92, k % 3 === 0 ? M.pink : M.white);
      cell.position.set(0, 7 + Math.cos(a) * 1.6, Math.sin(a) * 5.8); cell.rotation.x = -a; wing.add(cell); }
    g.add(wing);
    const lines = new T.BufferGeometry(), pts = [];
    for(let k = -6; k <= 6; k += 2){ const a = k / 6 * 0.95; pts.push(0, 1.6, 0, 0, 6.9 + Math.cos(a) * 1.6, Math.sin(a) * 5.7); }
    lines.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.add(new T.LineSegments(lines, new T.LineBasicMaterial({color:W.ink, transparent:true, opacity:0.55})));
    const P = person(); seat(P, 1.35); P.A.rotation.z = 2.6; P.B.rotation.z = 2.6; g.add(P.g);
    return {g, P};
  }
  function skier(){
    const g = new T.Group(), P = person({body:M.pink}); P.g.rotation.z = -0.25; P.L.rotation.z = 0.35; P.R.rotation.z = 0.35; g.add(P.g);
    [0.12, -0.12].forEach(z => g.add(at(box(1.7, 0.04, 0.09, M.ink), 0.15, 0.03, z)));
    [0.32, -0.32].forEach(z => { const p = at(box(0.03, 1.1, 0.03, M.ink), -0.3, 0.6, z); p.rotation.z = 0.5; g.add(p); });
    return {g, P};
  }
  function moto(){
    const g = new T.Group(), w1 = at(wheel(0.36), 0.7, 0.36, 0), w2 = at(wheel(0.36), -0.65, 0.36, 0);
    g.add(w1, w2, at(box(1.1, 0.35, 0.3, M.pink), 0, 0.75, 0), at(box(0.3, 0.3, 0.6, M.ink), 0.55, 1.05, 0));
    const P = person({body:M.ink}); P.g.position.set(-0.1, 0.1, 0); P.g.rotation.z = -0.4; seat(P, 1.1); P.A.rotation.z = 1.3; P.B.rotation.z = 1.3; g.add(P.g);
    g.add(at(sph(0.17, M.pink), 0.32, 1.83, 0));   // шлем
    return {g, P, w1, w2};
  }
  function stroller(){
    const P = person({dress:M.white, body:M.white}), g = new T.Group(); g.add(P.g);
    const um = new T.Group(); um.add(at(cyl(0.012, 0.012, 1.1, M.ink, 4), 0, 0.55, 0)); um.add(at(new T.Mesh(new T.ConeGeometry(0.75, 0.32, 10, 1, true), M.pink), 0, 1.15, 0));
    um.position.set(0.12, 1.15, -0.3); um.rotation.x = -0.25; g.add(um);
    return {g, P};
  }
  const shadowDisc = r => { const m = new T.Mesh(new T.CircleGeometry(r, 16), M.shadow); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = -1; return m; };

  /* ---------- доминанты (реальные размеры) ---------- */
  function lakhta(){
    const g = new T.Group(), N = 40, H = 400;
    const star = r => { const s = new T.Shape(); for(let k = 0; k <= 10; k++){ const a = k / 10 * Math.PI * 2, rr = k % 2 ? r * 0.78 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; k ? s.lineTo(x, y) : s.moveTo(x, y); } return s; };
    for(let i = 0; i < N; i++){ const t = i / N, r = 42 * Math.pow(1 - t, 0.85) + 3, h = H / N;
      const geo = new T.ExtrudeGeometry(star(r), {depth:h * 1.02, bevelEnabled:false}); geo.rotateX(-Math.PI / 2);
      const m = new T.Mesh(geo, M.glass); m.position.y = i * h; m.rotation.y = t * Math.PI * 0.5; g.add(m); }
    g.add(at(cyl(0.6, 3, 62, M.glass, 8), 0, H + 31, 0));
    return g;
  }
  function tvTower(){
    const g = new T.Group(), lat = new T.MeshStandardMaterial({color:'#B9C0C6', wireframe:true});
    g.add(at(cyl(5, 22, 200, lat, 4), 0, 100, 0));
    [[18, 0], [-18, 0], [0, 18], [0, -18]].forEach(([x, z]) => { const l = box(1.6, 205, 1.6, mat('#9AA3AA')); l.position.set(x * 0.55, 100, z * 0.55); l.rotation.set(-z * 0.0009, 0, x * 0.0009); g.add(l); });
    [[60, 12], [120, 9], [196, 7]].forEach(([y, r]) => g.add(at(cyl(r, r, 4, mat('#D7DCE0')), 0, y, 0)));
    for(let k = 0; k < 8; k++) g.add(at(cyl(2.2 - k * 0.2, 2.2 - k * 0.2, 16, k % 2 ? M.white : mat('#D2443F'), 8), 0, 210 + k * 16, 0));
    return g;
  }
  function isaac(){
    const g = new T.Group();
    g.add(at(box(100, 42, 46, M.stone), 0, 21, 0), at(box(46, 42, 100, M.stone), 0, 21, 0));
    [[45, 0, 4, 40], [-45, 0, 4, 40], [0, 45, 40, 4], [0, -45, 40, 4]].forEach(([x, z, w, d]) => g.add(at(box(w, 30, d, mat('#C9B79A')), x, 15, z)));   // портики
    g.add(at(cyl(18, 18, 22, M.stone, 24), 0, 53, 0));
    for(let k = 0; k < 24; k++){ const a = k / 24 * Math.PI * 2; g.add(at(cyl(0.9, 0.9, 20, M.white, 6), Math.cos(a) * 20, 52, Math.sin(a) * 20)); }
    const dome = new T.Mesh(new T.SphereGeometry(17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.gold); dome.position.y = 64; g.add(dome);
    g.add(at(cyl(3.5, 3.5, 12, M.gold, 12), 0, 87, 0), at(sph(3.6, M.gold), 0, 94, 0), at(box(0.6, 7, 0.6, M.gold), 0, 99, 0));
    [[30, 30], [-30, 30], [30, -30], [-30, -30]].forEach(([x, z]) => { g.add(at(cyl(5, 5, 10, M.stone, 12), x, 47, z)); const d = new T.Mesh(new T.SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.gold); d.position.set(x, 52, z); g.add(d); });
    return g;
  }
  function peterPaul(){
    const g = new T.Group(), wall = mat('#E8D3A8'), roof = mat('#5E8A70');
    g.add(at(box(62, 24, 30, wall), 10, 12, 0), at(box(64, 3, 32, roof), 10, 25, 0));
    g.add(at(box(18, 48, 18, wall), -28, 24, 0), at(box(13, 14, 13, wall), -28, 55, 0), at(box(9, 10, 9, wall), -28, 67, 0));
    g.add(at(new T.Mesh(new T.ConeGeometry(4.5, 50, 8), M.gold), -28, 97, 0), at(box(0.5, 6, 0.5, M.gold), -28, 124, 0), at(box(3, 0.5, 0.5, M.gold), -28, 123, 0));
    g.add(at(cyl(6, 6, 6, wall, 12), 30, 30, 0), at(sph(5.5, roof), 30, 34, 0));
    return g;
  }
  function smolny(){
    const g = new T.Group(), wall = mat(W.blue), trim = M.white;
    g.add(at(box(42, 36, 42, wall), 0, 18, 0), at(box(43, 2, 43, trim), 0, 36, 0));
    g.add(at(cyl(12, 12, 20, wall, 16), 0, 46, 0), at(sph(12, trim, 16), 0, 58, 0), at(cyl(3, 3, 12, wall, 10), 0, 72, 0), at(sph(3.3, M.gold), 0, 80, 0), at(box(0.5, 12, 0.5, M.gold), 0, 88, 0));
    [[16, 16], [-16, 16], [16, -16], [-16, -16]].forEach(([x, z]) => { g.add(at(cyl(4.5, 4.5, 22, wall, 10), x, 45, z), at(sph(4.6, trim, 10), x, 57, z), at(cyl(1.2, 1.2, 6, wall, 6), x, 63, z), at(sph(1.4, M.gold), x, 67, z)); });
    return g;
  }
  function admiralty(){
    const g = new T.Group(), wall = mat('#E9D9A8');
    // само здание рисует OpenStreetMap — модель добавляет только башню со шпилем над главным входом
    g.add(at(box(22, 30, 22, wall), 0, 15, 0), at(box(16, 10, 16, M.white), 0, 35, 0));
    g.add(at(cyl(5, 5, 6, M.gold, 12), 0, 43, 0), at(new T.Mesh(new T.ConeGeometry(2.6, 26, 8), M.gold), 0, 59, 0), at(sph(0.8, M.gold), 0, 72.5, 0));
    return g;
  }
  // [название, модель, долгота, широта, поворот°]
  const LANDMARKS = [['Лахта-центр', lakhta, 30.1772, 59.9871, 0], ['Телебашня', tvTower, 30.3317, 59.9776, 0], ['Исаакиевский собор', isaac, 30.3060, 59.9341, 0],
    ['Петропавловский собор', peterPaul, 30.3166, 59.9502, -5], ['Смольный собор', smolny, 30.3954, 59.9488, 0], ['Адмиралтейство', admiralty, 30.3084, 59.9375, -12]];

  /* ---------- слой ---------- */
  let map, renderer, scene, camera, root, origin, scaleM, enabled = false;
  const marks = [], actors = []; let lastPick = 0, route = null, repaintT = 0;
  const is3d = () => document.body.classList.contains('is3d');
  const lc = (lng, lat) => maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const elev = (lng, lat) => { try{ return map.queryTerrainElevation([lng, lat]) || 0; }catch(e){ return 0; } };
  function place(obj, lng, lat, alt){ const m = lc(lng, lat); obj.position.set((m.x - origin.x) / scaleM, -(m.y - origin.y) / scaleM, alt); }
  // объект в «ось Y вверх» → сцена «ось Z вверх»
  function upright(g){ const w = new T.Group(), y = new T.Group(); g.rotation.x = Math.PI / 2; y.add(g); w.add(y); w.userData.yaw = y; return w; }
  const metersPerPx = () => 40075016.7 * Math.cos(map.getCenter().lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
  const ofs = (lng, lat, dx, dy) => [lng + dx / (111320 * Math.cos(lat * Math.PI / 180)), lat + dy / 110540];

  const KINDS = {
    'Парапланеризм':{make:paraglider, minz:11.5},
    'Конный клуб':{make:horseRider, minz:12.5},
    'Горнолыжный курорт':{make:skier, minz:12.5},
    'Мотокросс':{make:moto, minz:12.5}
  };
  // убрать фигурку и освободить её геометрию в видеопамяти (материалы общие — их не трогаем)
  function drop(w){ root.remove(w); w.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
  function pickActors(){
    const z = map.getZoom(), b = map.getBounds(), c = map.getCenter(), cap = innerWidth < 820 ? 8 : 18;
    // каждый персонаж — только в своей теме: досуг — в «Горах сейчас», гуляющие — у усадеб
    const on = window.GP_SHOWN || [], want = [];
    if(on.includes('leisure')) (D.leisure?.features || []).forEach((f, i) => { const k = KINDS[f.properties.kind]; if(!k || z < k.minz) return; const [x, y] = f.geometry.coordinates; if(b.contains([x, y])) want.push({id:'l' + i, kind:f.properties.kind, x, y}); });
    if(z >= 13.2 && on.includes('estate')) (D.estate?.features || []).forEach((f, i) => { const t = f.properties.type; if(t === 'Дача' || t === 'Дом') return; const [x, y] = f.geometry.coordinates; if(b.contains([x, y])) want.push({id:'e' + i, kind:'усадьба', x, y}); });
    want.sort((a, q) => Math.hypot(a.x - c.lng, a.y - c.lat) - Math.hypot(q.x - c.lng, q.y - c.lat));
    const keep = new Set(want.slice(0, cap).map(w => w.id));
    for(let k = actors.length - 1; k >= 0; k--) if(!actors[k].route && !keep.has(actors[k].id)){ drop(actors[k].w); actors.splice(k, 1); }
    want.slice(0, cap).forEach(w => { if(actors.some(a => a.id === w.id)) return;
      const m = w.kind === 'усадьба' ? stroller() : KINDS[w.kind].make(), wrap = upright(m.g); wrap.userData.yaw.add(shadowDisc(w.kind === 'Парапланеризм' ? 0 : w.kind === 'Конный клуб' ? 1.3 : 0.5));
      root.add(wrap); actors.push({id:w.id, kind:w.kind, x:w.x, y:w.y, m, w:wrap, ph:Math.random() * 100}); });
  }
  function setRoute(f, walk){
    const old = actors.findIndex(a => a.route); if(old >= 0){ drop(actors[old].w); actors.splice(old, 1); }
    route = null; if(!f || !root) return;
    const g = f.geometry, lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates], pts = [];
    lines.forEach(l => l.forEach(q => pts.push(q))); if(pts.length < 2) return;
    const cum = [0]; for(let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot((pts[k][0] - pts[k - 1][0]) * 55.6, (pts[k][1] - pts[k - 1][1]) * 111.2));
    const m = walk ? (() => { const P = person({body:M.white}); const g = new T.Group(); g.add(P.g); return {g, P}; })() : cyclist();
    const wrap = upright(m.g); wrap.userData.yaw.add(shadowDisc(walk ? 0.4 : 0.7)); root.add(wrap);
    route = {pts, cum, L:cum[cum.length - 1], walk};
    actors.push({id:'route', route:true, kind:walk ? 'пешком' : 'велосипед', m, w:wrap, ph:0, t0:performance.now()});
  }

  // поведение: смещение от точки (м), высота над землёй (м, в масштабе фигуры), курс и анимация частей
  function behave(a, t, S){
    const m = a.m, ph = a.ph;
    if(a.route){
      const R = route, dur = Math.max(22, Math.min(45, R.L * 1.4)) * 1000, s = ((t - a.t0) % dur) / dur * R.L; let k = 1; while(k < R.cum.length - 1 && R.cum[k] < s) k++;
      const p = R.pts[k - 1], q = R.pts[k], u = (s - R.cum[k - 1]) / ((R.cum[k] - R.cum[k - 1]) || 1);
      if(R.walk) walkCycle(m.P, t / 140); else { m.w1.rotation.z -= 0.25; m.w2.rotation.z -= 0.25; m.P.L.rotation.z = 1.0 + Math.sin(t / 120) * 0.4; m.P.R.rotation.z = 1.0 - Math.sin(t / 120) * 0.4; }
      return {lng:p[0] + (q[0] - p[0]) * u, lat:p[1] + (q[1] - p[1]) * u, h:0, yaw:Math.atan2((q[1] - p[1]) * 2, q[0] - p[0])};
    }
    if(a.kind === 'Парапланеризм'){ const w = t / 9000 + ph, r = 26 * S;   // крен в вираже + лёгкое покачивание
      return {dx:Math.cos(w) * r, dy:Math.sin(w) * r, h:(14 + Math.sin(t / 2100 + ph) * 2) * S, yaw:w + Math.PI / 2, tilt:-0.22 + Math.sin(t / 1300 + ph) * 0.06}; }
    if(a.kind === 'Конный клуб'){ const w = t / 6500 + ph, r = 9 * S; const g = Math.sin(t / 110 + ph);
      m.legs[0].rotation.z = g * 0.6; m.legs[3].rotation.z = g * 0.6; m.legs[1].rotation.z = -g * 0.6; m.legs[2].rotation.z = -g * 0.6; m.h.position.y = Math.abs(g) * 0.08; m.P.g.position.y = 0.75 + Math.abs(g) * 0.1;
      return {dx:Math.cos(w) * r, dy:Math.sin(w) * 0.6 * r, h:0, yaw:Math.atan2(Math.cos(w) * 0.6, -Math.sin(w))}; }
    if(a.kind === 'Горнолыжный курорт'){ const c = ((t / 7000 + ph) % 1), down = c < 0.7, u = down ? c / 0.7 : 1 - (c - 0.7) / 0.3;
      return {dx:(u - 0.5) * 14 * S, dy:Math.sin(u * 9) * 1.5 * S, h:0, yaw:down ? Math.cos(u * 9) * 0.3 : Math.PI}; }
    if(a.kind === 'Мотокросс'){ const w = t / 3800 + ph, r = 8 * S, j = Math.max(0, Math.sin(w * 2)) ; m.w1.rotation.z -= 0.35; m.w2.rotation.z -= 0.35; m.g.rotation.z = j > 0.85 ? 0.25 : 0;
      return {dx:Math.cos(w) * r * 1.4, dy:Math.sin(w) * r, h:j > 0.85 ? (j - 0.85) * 12 * S * 0.25 : 0, yaw:Math.atan2(Math.cos(w), -Math.sin(w) * 1.4)}; }
    // гуляющая у усадьбы: идёт по кругу, иногда останавливается полюбоваться видом
    const cyc = (t / 1000 + ph * 7) % 26, walking = cyc < 20, w = (Math.min(cyc, 20) / 20) * Math.PI * 2 + ph, r = 7 * S;
    if(walking) walkCycle(m.P, t / 260, 0.35); else walkCycle(m.P, 0, 0);
    return {dx:Math.cos(w) * r, dy:Math.sin(w) * r, h:0, yaw:walking ? w + Math.PI / 2 : w + Math.PI};
  }

  const layer = {id:'scene3d', type:'custom', renderingMode:'3d',
    onAdd(m, gl){
      map = m; camera = new T.Camera(); scene = new T.Scene(); root = new T.Group(); scene.add(root);
      origin = maplibregl.MercatorCoordinate.fromLngLat([30.32, 59.93], 0); scaleM = origin.meterInMercatorCoordinateUnits();
      scene.add(new T.HemisphereLight('#ffffff', '#55606a', 0.95)); const sun = new T.DirectionalLight('#fff4e0', 0.85); sun.position.set(-0.6, -0.8, 1.2); scene.add(sun);
      renderer = new T.WebGLRenderer({canvas:m.getCanvas(), context:gl, antialias:true}); renderer.autoClear = false;
      LANDMARKS.forEach(([name, make, x, y, rot]) => { const w = upright(make()); w.userData.yaw.rotation.z = rot * Math.PI / 180; root.add(w); marks.push({w, x, y}); });
    },
    render(gl, args){
      const on = is3d(); if(!on){ if(enabled){ root.visible = false; enabled = false; } return; }
      enabled = true; root.visible = true;
      const t = performance.now(), mpp = metersPerPx(), S = Math.min(70, Math.max(1, 30 * mpp / 1.8));   // фигурка ≈ 30 px
      if(t - lastPick > 600){ lastPick = t; pickActors(); }
      // высота земли под доминантами меняется только с усилением рельефа — уточняем раз в полсекунды
      marks.forEach(k => { if(k.z == null || t - (k.zt || 0) > 500){ k.z = elev(k.x, k.y); k.zt = t; } place(k.w, k.x, k.y, k.z); });
      // увеличены только кони и парапланеристы — их видно с высоты; остальные фигурки в настоящую величину
      actors.forEach(a => { const big = a.kind === 'Конный клуб' || a.kind === 'Парапланеризм', k = big ? S : 1, s = behave(a, t, k); let lng = s.lng, lat = s.lat; if(lng == null) [lng, lat] = ofs(a.x, a.y, s.dx, s.dy);
        place(a.w, lng, lat, elev(lng, lat) + (s.h || 0)); a.w.scale.setScalar(k);
        const y = a.w.userData.yaw; y.rotation.z = s.yaw || 0; y.rotation.x = s.tilt || 0; });
      const mm = new T.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l = new T.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new T.Vector3(scaleM, -scaleM, scaleM));
      camera.projectionMatrix = mm.multiply(l);
      renderer.resetState(); renderer.render(scene, camera);
      // three.js оставляет свои привязки WebGL — снимаем их и просим MapLibre заново выставить своё состояние
      try{ const g2 = gl; g2.bindVertexArray && g2.bindVertexArray(null); g2.bindBuffer(g2.ARRAY_BUFFER, null); g2.bindBuffer(g2.ELEMENT_ARRAY_BUFFER, null); g2.useProgram(null); }catch(e){}
      try{ map.painter.context.setDirty(); }catch(e){}
      // анимация персонажей — ~30 кадров в секунду и только когда вкладка видна: карту не перерисовываем без нужды
      // (только если хоть одна фигурка в кадре — иначе карта стоит и не грузит видеокарту)
      if(actors.length && !repaintT && document.visibilityState === 'visible' && (() => { const b = map.getBounds(); return actors.some(a => a.route || b.contains([a.x, a.y])); })()) repaintT = setTimeout(() => { repaintT = 0; map.triggerRepaint(); }, 33);
    }};
  window.GP3D = {layer, setRoute:(f, walk) => { if(root) setRoute(f, walk); else window.GP3D._pending = [f, walk]; }};
})();
