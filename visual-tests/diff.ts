import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { FRAMES, figmaPathFor, type FrameEntry, type MaskRegion } from './frames.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const FIGMA_DIR = join(REPO_ROOT, 'figma_frames')
const OUTPUT_DIR = join(__dirname, 'output')
const CAPTURE_DIR = join(OUTPUT_DIR, 'captured')
const DIFF_DIR = join(OUTPUT_DIR, 'diff')

type Result = {
  frame: number
  hash: string
  taskOwners: string[]
  notes?: string
  figmaPath: string
  capturedPath: string
  diffPath: string
  width: number
  height: number
  mismatchedPixels: number
  totalPixels: number
  mismatchPct: number
  status: 'ok' | 'missing-capture' | 'missing-figma' | 'size-mismatch' | 'error'
  errorMessage?: string
}

function loadPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path))
}

function applyMasks(png: PNG, masks: MaskRegion[] | undefined): PNG {
  if (!masks || masks.length === 0) return png
  const { width, height, data } = png
  for (const m of masks) {
    const x0 = Math.max(0, Math.min(width, Math.round(m.x)))
    const y0 = Math.max(0, Math.min(height, Math.round(m.y)))
    const x1 = Math.max(0, Math.min(width, Math.round(m.x + m.width)))
    const y1 = Math.max(0, Math.min(height, Math.round(m.y + m.height)))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 128
        data[idx + 1] = 128
        data[idx + 2] = 128
        data[idx + 3] = 255
      }
    }
  }
  return png
}

function resizePng(src: PNG, width: number, height: number): PNG {
  const dst = new PNG({ width, height })
  const sw = src.width
  const sh = src.height
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / height))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / width))
      const sIdx = (sy * sw + sx) * 4
      const dIdx = (y * width + x) * 4
      dst.data[dIdx] = src.data[sIdx]
      dst.data[dIdx + 1] = src.data[sIdx + 1]
      dst.data[dIdx + 2] = src.data[sIdx + 2]
      dst.data[dIdx + 3] = src.data[sIdx + 3]
    }
  }
  return dst
}

function diffOne(entry: FrameEntry): Result {
  const figmaPath = join(FIGMA_DIR, figmaPathFor(entry.frame))
  const capturedPath = join(CAPTURE_DIR, `Frame ${entry.frame}.captured.png`)
  const diffPath = join(DIFF_DIR, `Frame ${entry.frame}.diff.png`)

  const base: Result = {
    frame: entry.frame,
    hash: entry.hash,
    taskOwners: entry.taskOwners,
    notes: entry.notes,
    figmaPath,
    capturedPath,
    diffPath,
    width: 1920,
    height: 1080,
    mismatchedPixels: 0,
    totalPixels: 1920 * 1080,
    mismatchPct: 100,
    status: 'error',
  }

  if (!existsSync(figmaPath)) return { ...base, status: 'missing-figma', errorMessage: `Missing ${figmaPath}` }
  if (!existsSync(capturedPath))
    return { ...base, status: 'missing-capture', errorMessage: `Missing ${capturedPath}` }

  try {
    let figma = loadPng(figmaPath)
    let captured = loadPng(capturedPath)

    if (figma.width !== captured.width || figma.height !== captured.height) {
      captured = resizePng(captured, figma.width, figma.height)
    }

    figma = applyMasks(figma, entry.maskRegions)
    captured = applyMasks(captured, entry.maskRegions)

    const { width, height } = figma
    const diff = new PNG({ width, height })
    const mismatchedPixels = pixelmatch(figma.data, captured.data, diff.data, width, height, {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.3,
      diffColor: [255, 0, 0],
    })

    writeFileSync(diffPath, PNG.sync.write(diff))

    const totalPixels = width * height
    return {
      ...base,
      width,
      height,
      mismatchedPixels,
      totalPixels,
      mismatchPct: (mismatchedPixels / totalPixels) * 100,
      status: 'ok',
    }
  } catch (err) {
    return { ...base, status: 'error', errorMessage: err instanceof Error ? err.message : String(err) }
  }
}

function main() {
  mkdirSync(DIFF_DIR, { recursive: true })

  const results: Result[] = []
  for (const entry of FRAMES) {
    const r = diffOne(entry)
    results.push(r)
    const pct = r.mismatchPct.toFixed(2).padStart(6)
    console.log(`Frame ${String(r.frame).padStart(2)}  ${pct}%  ${r.status}  (${r.hash})`)
  }

  writeFileSync(join(OUTPUT_DIR, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} diffs. Results: ${join(OUTPUT_DIR, 'results.json')}`)
}

main()
