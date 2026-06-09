import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRAMES, type FrameEntry } from './frames'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const CAPTURE_DIR = join(OUTPUT_DIR, 'captured')

test.beforeAll(async () => {
  await mkdir(CAPTURE_DIR, { recursive: true })
})

for (const entry of FRAMES) {
  test(`capture Frame ${entry.frame} (${entry.hash})`, async ({ page }) => {
    await captureFrame(page, entry)
  })
}

async function captureFrame(page: import('@playwright/test').Page, entry: FrameEntry) {
  const url = `/${entry.hash}`
  await page.goto(url, { waitUntil: 'networkidle' })

  await page.evaluate(async () => {
    const main = document.querySelector('main')
    if (main) main.style.cursor = 'none'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })

  await page
    .waitForFunction(
      () => {
        const canvases = document.querySelectorAll('canvas.maplibregl-canvas')
        if (canvases.length === 0) return false
        return Array.from(canvases).every((c) => (c as HTMLCanvasElement).width > 0)
      },
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {
      // Don't fail capture if map didn't initialize — diff will show it
    })

  await page.waitForTimeout(1500)

  const outPath = join(CAPTURE_DIR, `Frame ${entry.frame}.captured.png`)
  await page.screenshot({
    path: outPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
    animations: 'disabled',
  })

  expect(outPath).toBeTruthy()
}
