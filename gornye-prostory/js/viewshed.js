/* Зона видимости с точки: считается в браузере по открытой модели высот (Terrarium).
   Метод как в ГИС-анализе, но радиус больше (30 км): 1440 лучей, поправка на кривизну Земли и рефракцию k = 0,13.
   Рельеф голый, без домов и леса, поэтому видимость завышена. */
window.GPViewshed = (function(){
  const Z = 10, TS = 256, R_EARTH = 6371000, K = 0.13;
  const URL = (z,x,y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  const cache = new Map();
  const lng2x = (lng, z) => (lng + 180) / 360 * Math.pow(2, z);
  const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };

  function tile(x, y){
    const key = x + '/' + y;
    if(!cache.has(key)) cache.set(key, new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = TS;
        const g = c.getContext('2d', {willReadFrequently:true}); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, TS, TS).data, h = new Float32Array(TS * TS);
        for(let i = 0; i < TS * TS; i++) h[i] = d[i*4] * 256 + d[i*4+1] + d[i*4+2] / 256 - 32768;
        res(h);
      };
      im.onerror = () => { cache.delete(key); rej(new Error('Не удалось загрузить высоты')); };
      im.src = URL(Z, x, y);
    }));
    return cache.get(key);
  }

  /* center [lng, lat]; radius в метрах; eye — высота глаз над землёй. Возвращает {url, coords} для image-источника карты. */
  async function compute(center, radius = 30000, eye = 2){
    const [lng, lat] = center, cos = Math.cos(lat * Math.PI / 180);
    const dLng = radius / (111320 * cos), dLat = radius / 110540;
    const x0 = Math.floor(lng2x(lng - dLng, Z)), x1 = Math.floor(lng2x(lng + dLng, Z));
    const y0 = Math.floor(lat2y(lat + dLat, Z)), y1 = Math.floor(lat2y(lat - dLat, Z));
    const tiles = {}, jobs = [];
    for(let x = x0; x <= x1; x++) for(let y = y0; y <= y1; y++) jobs.push(tile(x, y).then(h => tiles[x + '/' + y] = h));
    await Promise.all(jobs);
    const elev = (lo, la) => {
      const fx = lng2x(lo, Z), fy = lat2y(la, Z), tx = Math.floor(fx), ty = Math.floor(fy), h = tiles[tx + '/' + ty];
      if(!h) return 0;
      const px = Math.min(TS - 1, Math.floor((fx - tx) * TS)), py = Math.min(TS - 1, Math.floor((fy - ty) * TS));
      return Math.max(0, h[py * TS + px]);
    };
    const N = 360, cell = 2 * radius / N;                  // сетка маски
    const vis = new Uint8Array(N * N);
    const h0 = elev(lng, lat) + eye, step = 60, rays = 1440, corr = (1 - K) / (2 * R_EARTH);
    for(let r = 0; r < rays; r++){
      const a = r / rays * 2 * Math.PI, sx = Math.sin(a), sy = Math.cos(a);
      let maxSlope = -Infinity;
      for(let d = step; d <= radius; d += step){
        const ex = sx * d, ny = sy * d;
        const z = elev(lng + ex / (111320 * cos), lat + ny / 110540) - d * d * corr;
        const slope = (z - h0) / d;
        if(slope >= maxSlope){
          maxSlope = slope;
          const cx = Math.floor((ex + radius) / cell), cy = Math.floor((radius - ny) / cell);
          if(cx >= 0 && cy >= 0 && cx < N && cy < N){
            vis[cy * N + cx] = 1;
            if(d > radius * 0.55){ if(cx + 1 < N) vis[cy * N + cx + 1] = 1; if(cy + 1 < N) vis[(cy + 1) * N + cx] = 1; }
          }
        }
      }
    }
    for(let i = -2; i <= 2; i++) for(let j = -2; j <= 2; j++) vis[(N/2 + i) * N + N/2 + j] = 1;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    let seen = 0;
    for(let i = 0; i < N * N; i++){
      const x = i % N - N/2, y = Math.floor(i / N) - N/2, inside = x * x + y * y <= (N/2) * (N/2);
      if(vis[i] && inside) seen++;
      img.data[i*4] = 8; img.data[i*4+1] = 14; img.data[i*4+2] = 20; img.data[i*4+3] = vis[i] && inside ? 0 : 168;
    }
    g.putImageData(img, 0, 0);
    return {url:c.toDataURL('image/png'),
      coords:[[lng - dLng, lat + dLat], [lng + dLng, lat + dLat], [lng + dLng, lat - dLat], [lng - dLng, lat - dLat]],
      areaKm2: seen * cell * cell / 1e6, eyeAbs: h0};
  }
  return {compute};
})();
