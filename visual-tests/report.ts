import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRAMES, allOwners, ownerArgFromArgv } from './frames.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const REPORTS_ROOT = join(REPO_ROOT, '.claude-reports', 'visual')
const OUTPUT_DIR = join(__dirname, 'output')

type Result = {
  frame: number
  hash: string
  taskOwners: string[]
  notes?: string
  figmaPath: string
  capturedPath: string
  diffPath: string
  mismatchedPixels: number
  totalPixels: number
  mismatchPct: number
  status: 'ok' | 'missing-capture' | 'missing-figma' | 'size-mismatch' | 'error'
  errorMessage?: string
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

function copyAssets(results: Result[], assetsDir: string): Record<number, { figma: string; captured: string; diff: string }> {
  mkdirSync(assetsDir, { recursive: true })
  const map: Record<number, { figma: string; captured: string; diff: string }> = {}
  for (const r of results) {
    const figmaName = `Frame-${r.frame}.figma.png`
    const capturedName = `Frame-${r.frame}.captured.png`
    const diffName = `Frame-${r.frame}.diff.png`
    if (existsSync(r.figmaPath)) copyFileSync(r.figmaPath, join(assetsDir, figmaName))
    if (existsSync(r.capturedPath)) copyFileSync(r.capturedPath, join(assetsDir, capturedName))
    if (existsSync(r.diffPath)) copyFileSync(r.diffPath, join(assetsDir, diffName))
    map[r.frame] = { figma: figmaName, captured: capturedName, diff: diffName }
  }
  return map
}

const CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; background: #0e0e10; color: #e6e6e6; }
  header { padding: 24px 32px; border-bottom: 1px solid #2a2a2e; }
  h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  h2 { margin: 0; font-weight: 400; font-size: 14px; color: #9aa0a6; }
  .meta { padding: 8px 32px 16px; color: #9aa0a6; font-size: 13px; }
  .filters { padding: 0 32px 16px; display: flex; gap: 8px; flex-wrap: wrap; }
  .filter { padding: 6px 12px; border: 1px solid #2a2a2e; border-radius: 16px; cursor: pointer; user-select: none; background: #1a1a1d; font-size: 12px; color: #c8c8c8; text-decoration: none; }
  .filter.active { background: #2563eb; border-color: #2563eb; color: white; }
  .row { display: grid; grid-template-columns: 80px 1fr 1fr 1fr 100px; gap: 12px; padding: 16px 32px; border-bottom: 1px solid #1a1a1d; align-items: start; }
  .row.header-row { position: sticky; top: 0; background: #0e0e10; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9aa0a6; padding: 12px 32px; border-bottom: 1px solid #2a2a2e; z-index: 1; }
  .frame-id { font-size: 18px; font-weight: 600; color: #fff; }
  .frame-hash { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #9aa0a6; margin-top: 4px; }
  .frame-owners { font-size: 11px; color: #c8c8c8; margin-top: 6px; }
  .frame-notes { font-size: 12px; color: #9aa0a6; margin-top: 8px; line-height: 1.4; max-width: 320px; }
  .thumb { width: 100%; height: auto; display: block; border: 1px solid #2a2a2e; background: #1a1a1d; }
  .pct { font-size: 18px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  .pct.low { color: #4ade80; }
  .pct.mid { color: #facc15; }
  .pct.high { color: #f87171; }
  .pct.error { color: #f87171; font-size: 12px; }
  .pct-sub { font-size: 11px; color: #9aa0a6; margin-top: 4px; text-align: right; }
  .label { font-size: 11px; color: #9aa0a6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  .status-error { color: #f87171; font-size: 11px; margin-top: 8px; }
`

function pctClass(pct: number, status: string): string {
  if (status !== 'ok') return 'error'
  if (pct < 5) return 'low'
  if (pct < 20) return 'mid'
  return 'high'
}

function renderRow(
  r: Result,
  assets: { figma: string; captured: string; diff: string },
  assetsPrefix: string,
): string {
  return `
    <div class="row">
      <div>
        <div class="frame-id">${r.frame}</div>
        <div class="frame-hash">${esc(r.hash)}</div>
        <div class="frame-owners">${r.taskOwners.map((o) => esc(o)).join(', ')}</div>
        ${r.notes ? `<div class="frame-notes">${esc(r.notes)}</div>` : ''}
      </div>
      <div>
        <div class="label">Figma</div>
        <img class="thumb" src="${esc(assetsPrefix + assets.figma)}" alt="Figma Frame ${r.frame}" loading="lazy">
      </div>
      <div>
        <div class="label">Captured</div>
        <img class="thumb" src="${esc(assetsPrefix + assets.captured)}" alt="Captured Frame ${r.frame}" loading="lazy">
      </div>
      <div>
        <div class="label">Diff (red = mismatch)</div>
        <img class="thumb" src="${esc(assetsPrefix + assets.diff)}" alt="Diff Frame ${r.frame}" loading="lazy">
      </div>
      <div>
        <div class="pct ${pctClass(r.mismatchPct, r.status)}">${r.status === 'ok' ? r.mismatchPct.toFixed(2) + '%' : r.status}</div>
        <div class="pct-sub">${r.mismatchedPixels.toLocaleString()} / ${r.totalPixels.toLocaleString()} px</div>
        ${r.errorMessage ? `<div class="status-error">${esc(r.errorMessage)}</div>` : ''}
      </div>
    </div>`
}

function renderHTML(
  title: string,
  ownerFilter: string | null,
  allOwnerList: string[],
  results: Result[],
  assetsByFrame: Record<number, { figma: string; captured: string; diff: string }>,
  generatedAt: string,
  taskPaths: Record<string, string>,
): string {
  // Top-level index.html lives at <reportDir>/index.html → assets/ is a sibling.
  // Per-task pages live at <reportDir>/task-NN/index.html → assets/ is one up.
  const assetsPrefix = ownerFilter === null ? 'assets/' : '../assets/'
  // Same applies to per-task hrefs: from the top-level they're relative;
  // from inside a task-NN/ subdir we need to go up first.
  const taskHrefPrefix = ownerFilter === null ? '' : '../'
  const allFramesHref = ownerFilter === null ? '#' : '../index.html'

  const filtered = ownerFilter
    ? results.filter((r) => r.taskOwners.includes(ownerFilter))
    : results
  const sorted = [...filtered].sort((a, b) => b.mismatchPct - a.mismatchPct)

  const filterLinks = [
    `<a class="filter ${ownerFilter === null ? 'active' : ''}" href="${allFramesHref}">All frames</a>`,
    ...allOwnerList.map(
      (o) =>
        `<a class="filter ${ownerFilter === o ? 'active' : ''}" href="${ownerFilter === o ? '#' : taskHrefPrefix + (taskPaths[o] ?? '#')}">Task ${esc(o)}</a>`,
    ),
  ].join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>${esc(title)}</h1>
    <h2>Visual-fidelity dashboard — Figma frames vs rendered captures</h2>
  </header>
  <div class="meta">Generated ${esc(generatedAt)} · ${sorted.length} frames · sorted by mismatch % (high → low)</div>
  <div class="filters">${filterLinks}</div>
  <div class="row header-row">
    <div>Frame</div><div>Figma</div><div>Captured</div><div>Diff</div><div style="text-align:right">Mismatch</div>
  </div>
  ${sorted.map((r) => renderRow(r, assetsByFrame[r.frame], assetsPrefix)).join('')}
</body>
</html>`
}

function main() {
  const argv = process.argv.slice(2)
  const taskFilter = ownerArgFromArgv(argv)

  const resultsPath = join(OUTPUT_DIR, 'results.json')
  if (!existsSync(resultsPath)) {
    console.error(`Missing ${resultsPath}. Run diff.ts first.`)
    process.exit(1)
  }
  const results: Result[] = JSON.parse(readFileSync(resultsPath, 'utf8'))

  const ts = timestamp()
  const reportDir = join(REPORTS_ROOT, ts)
  const assetsDir = join(reportDir, 'assets')
  mkdirSync(reportDir, { recursive: true })

  const assetsByFrame = copyAssets(results, assetsDir)
  const owners = allOwners(FRAMES)
  const generatedAt = new Date().toISOString()

  const taskPaths: Record<string, string> = {}
  for (const o of owners) taskPaths[o] = `task-${o}/index.html`

  const taskOwnersToRender = taskFilter ? [taskFilter] : owners
  for (const owner of taskOwnersToRender) {
    const dir = join(reportDir, `task-${owner}`)
    mkdirSync(dir, { recursive: true })
    const html = renderHTML(
      `Task ${owner} — visual verification`,
      owner,
      owners,
      results,
      assetsByFrame,
      generatedAt,
      taskPaths,
    )
    writeFileSync(join(dir, 'index.html'), html)
  }

  if (!taskFilter) {
    const indexHtml = renderHTML(
      'All frames — visual verification',
      null,
      owners,
      results,
      assetsByFrame,
      generatedAt,
      taskPaths,
    )
    writeFileSync(join(reportDir, 'index.html'), indexHtml)
  }

  const printedPath = taskFilter
    ? join(reportDir, `task-${taskFilter}`, 'index.html')
    : join(reportDir, 'index.html')
  console.log(`\nReport: file://${printedPath}`)
}

main()
