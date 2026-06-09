import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/mobile-shots';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://localhost:5173/Map-View-Client/';

const profiles = [
  { name: 'iphone-14-pro', device: devices['iPhone 14 Pro'] },
  { name: 'pixel-7',       device: devices['Pixel 7'] },
];

const browser = await chromium.launch();
const consoleLines = [];

for (const { name, device } of profiles) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  page.on('console', m => consoleLines.push(`[${name}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[${name}] pageerror: ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${OUT}/${name}-01-top.png` });

  const steps = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
  let idx = 2;
  for (const frac of steps) {
    await page.evaluate(([f]) => {
      window.scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' });
    }, [frac]);
    await page.waitForTimeout(1200);
    const label = String(idx).padStart(2, '0');
    await page.screenshot({ path: `${OUT}/${name}-${label}-scroll-${Math.round(frac*100)}.png` });
    idx++;
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}-99-fullpage.png`, fullPage: true });

  const probe = await page.evaluate(() => {
    const longread = document.querySelector('.longread');
    const canvas = document.querySelector('canvas.maplibregl-canvas, canvas');
    const mapContainer = document.querySelector('.map-container');
    const wrapper = document.querySelector('.longread-wrapper');
    const wrapperCs = wrapper ? getComputedStyle(wrapper) : null;
    const mapCs = mapContainer ? getComputedStyle(mapContainer) : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      documentScrollHeight: document.documentElement.scrollHeight,
      mapContainer: mapContainer && {
        position: mapCs.position,
        top: mapCs.top,
        height: mapCs.height,
        rect: mapContainer.getBoundingClientRect().toJSON(),
      },
      wrapper: wrapper && {
        position: wrapperCs.position,
        display: wrapperCs.display,
        rect: wrapper.getBoundingClientRect().toJSON(),
      },
      longreadCount: longread?.children.length ?? 0,
      mapCanvas: canvas && {
        w: canvas.width, h: canvas.height,
        cssW: canvas.clientWidth, cssH: canvas.clientHeight,
        rect: canvas.getBoundingClientRect().toJSON(),
      },
    };
  });
  fs.writeFileSync(`${OUT}/${name}-probe.json`, JSON.stringify(probe, null, 2));

  await context.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/console.log`, consoleLines.join('\n'));
console.log('done. screenshots in', OUT);
