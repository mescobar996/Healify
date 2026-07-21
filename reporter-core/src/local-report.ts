import type { LocalCaseResult } from './local-mode'

export interface LocalRun {
  project: string
  framework: string
  generatedAt: Date
  cases: LocalCaseResult[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STATUS_LABEL: Record<LocalCaseResult['status'], string> = {
  healed: 'Sanado',
  review: 'A revisar',
  unresolved: 'Sin sugerencia',
}

function renderCase(c: LocalCaseResult, index: number): string {
  const pct = Math.round(c.confidence * 100)
  const hasFixed = c.status !== 'unresolved' && c.fixedSelector

  return `
    <details class="case ${c.status}"${index === 0 ? ' open' : ''}>
      <summary class="case-top">
        <span class="chev">›</span>
        <span class="status-pill">${STATUS_LABEL[c.status]}</span>
        <span class="case-title">
          <span class="name">${escapeHtml(c.testName)}</span>
          ${c.testFile ? `<span class="path">${escapeHtml(c.testFile)}</span>` : ''}
        </span>
        <span class="confidence">
          <span class="pct">${pct}%</span>
          <span class="meter"><span style="width:${pct}%"></span></span>
        </span>
      </summary>
      <div class="case-body">
        <div class="error">${escapeHtml(c.errorMessage)}</div>
        <div class="diff">
          <div class="diff-col before">
            <div class="label">Selector original</div>
            <code>${escapeHtml(c.selector)}</code>
          </div>
          <div class="diff-col after">
            <div class="label">${c.status === 'unresolved' ? 'Sugerencia' : 'Sugerencia (heurística local)'}</div>
            <code>${hasFixed ? escapeHtml(c.fixedSelector) : '— sin candidato confiable —'}</code>
          </div>
        </div>
        ${hasFixed ? `<p class="engine-note">${escapeHtml(c.explanation)}</p>` : ''}
      </div>
    </details>`
}

/** Genera el reporte HTML standalone del modo local — sin red, sin dependencias externas. */
export function renderLocalReportHtml(run: LocalRun): string {
  const total = run.cases.length
  const healed = run.cases.filter((c) => c.status === 'healed').length
  const review = run.cases.filter((c) => c.status === 'review').length
  const unresolved = run.cases.filter((c) => c.status === 'unresolved').length
  const dateStr = run.generatedAt.toLocaleString('es-AR')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Healify — Informe local</title>
<style>
  :root {
    --background: #000000;
    --card: #0A0A0A;
    --card-elevated: #111111;
    --foreground: #EDEDED;
    --muted: #8A8A8A;
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.16);
    --ring: rgba(139,92,246,0.5);
    --ring-soft: rgba(139,92,246,0.12);
    --healed: #34D399;
    --healed-soft: rgba(52,211,153,0.12);
    --review: #E8B94D;
    --review-soft: rgba(232,185,77,0.12);
    --unresolved: #E85C4A;
    --unresolved-soft: rgba(232,92,74,0.12);
  }
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { * { animation-duration: .001ms !important; transition-duration: .001ms !important; } }

  body {
    margin: 0;
    background: var(--background);
    color: var(--foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    padding: clamp(20px, 4vw, 56px);
  }
  .mono { font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
  .sheet { max-width: 900px; margin: 0 auto; }

  h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; font-weight: 600; }

  .masthead {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
    padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px;
  }
  .masthead .id { display: flex; align-items: center; gap: 12px; }
  .masthead .glyph {
    width: 34px; height: 34px; border-radius: 8px;
    background: linear-gradient(180deg,#fff 0%,#d7d7d7 100%);
    color: #0A0A0A; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 15px; flex: none;
  }
  .masthead .sub { color: var(--muted); font-size: 13px; margin-top: 3px; }
  .local-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--ring-soft); color: #C4B5FD;
    border: 1px solid var(--ring); border-radius: 999px; padding: 6px 12px;
    font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .local-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }

  .meta-strip {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    margin-bottom: 26px; overflow-x: auto;
  }
  .meta-cell { padding: 13px 16px; border-right: 1px solid var(--border); }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 4px; }
  .meta-cell .value { font-size: 13.5px; font-weight: 600; }

  .vitals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 32px; }
  .vital {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 15px 16px; transition: border-color 150ms ease;
  }
  .vital:hover { border-color: var(--border-strong); }
  .vital .n { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
  .vital .l { margin-top: 6px; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .vital .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--muted); }
  .vital.healed .n { color: var(--healed); } .vital.healed .dot { background: var(--healed); }
  .vital.review .n { color: var(--review); } .vital.review .dot { background: var(--review); }
  .vital.unresolved .n { color: var(--unresolved); } .vital.unresolved .dot { background: var(--unresolved); }

  .section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .section-head h2 { font-size: 16px; margin: 0; font-weight: 600; }
  .section-head .count { font-size: 12.5px; color: var(--muted); }

  .cases { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
  .case {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; transition: border-color 150ms ease;
  }
  .case:hover { border-color: var(--border-strong); }
  .case.healed { border-left: 2px solid var(--healed); }
  .case.review { border-left: 2px solid var(--review); }
  .case.unresolved { border-left: 2px solid var(--unresolved); }

  .case-top { display: flex; align-items: center; gap: 14px; padding: 13px 16px; cursor: pointer; list-style: none; }
  .case-top::-webkit-details-marker { display: none; }
  .case-top:focus-visible { outline: 1px solid var(--ring); outline-offset: -1px; }
  .chev { color: var(--muted); font-size: 16px; transition: transform .15s ease; flex: none; }
  details[open] .chev { transform: rotate(90deg); }

  .status-pill { flex: none; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; }
  .case.healed .status-pill { background: var(--healed-soft); color: var(--healed); }
  .case.review .status-pill { background: var(--review-soft); color: var(--review); }
  .case.unresolved .status-pill { background: var(--unresolved-soft); color: var(--unresolved); }

  .case-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .case-title .name { font-weight: 500; font-size: 13.5px; }
  .case-title .path { font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .confidence { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 100px; }
  .confidence .pct { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .case.healed .confidence .pct { color: var(--healed); }
  .case.review .confidence .pct { color: var(--review); }
  .case.unresolved .confidence .pct { color: var(--unresolved); }
  .meter { width: 100%; height: 3px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; }
  .meter span { display: block; height: 100%; }
  .case.healed .meter span { background: var(--healed); }
  .case.review .meter span { background: var(--review); }
  .case.unresolved .meter span { background: var(--unresolved); }

  .case-body { padding: 2px 16px 18px 16px; border-top: 1px solid var(--border); }
  .case-body .error {
    font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted);
    background: rgba(255,255,255,.03); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; margin: 14px 0; white-space: pre-wrap; word-break: break-word;
  }
  .diff { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .diff-col .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
  .diff-col code {
    display: block; font-family: "JetBrains Mono", monospace; font-size: 12.5px;
    padding: 10px 12px; border-radius: 8px; word-break: break-all; border: 1px solid var(--border);
  }
  .diff-col.before code { background: var(--unresolved-soft); color: #FCA5A5; }
  .diff-col.after code { background: var(--healed-soft); color: #6EE7B7; }
  .case.review .diff-col.after code { background: var(--review-soft); color: #FCD34D; }
  .case.unresolved .diff-col.after code { background: rgba(255,255,255,.03); color: var(--muted); font-style: italic; }

  .engine-note { font-size: 12px; color: var(--muted); margin: 10px 0 0 0; }

  .foot {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    padding-top: 18px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted);
  }
  .foot .privacy { display: flex; align-items: center; gap: 8px; }
  .foot .privacy .dot { width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }

  @media (max-width: 600px) {
    .vitals { grid-template-columns: repeat(2, 1fr); }
    .diff { grid-template-columns: 1fr; }
    .masthead { flex-direction: column; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="masthead">
    <div class="id">
      <div class="glyph">H</div>
      <div>
        <h1>Informe de sanado — local</h1>
        <div class="sub">${escapeHtml(run.framework)} · sin conexión a la nube</div>
      </div>
    </div>
    <span class="local-badge">100% local</span>
  </div>

  <div class="meta-strip">
    <div class="meta-cell"><div class="label">Proyecto</div><div class="value">${escapeHtml(run.project)}</div></div>
    <div class="meta-cell"><div class="label">Generado</div><div class="value mono">${escapeHtml(dateStr)}</div></div>
    <div class="meta-cell"><div class="label">Motor</div><div class="value">Heurística local</div></div>
  </div>

  <div class="vitals">
    <div class="vital"><div class="n">${total}</div><div class="l"><span class="dot"></span>Tests con selector roto</div></div>
    <div class="vital healed"><div class="n">${healed}</div><div class="l"><span class="dot"></span>Sanados</div></div>
    <div class="vital review"><div class="n">${review}</div><div class="l"><span class="dot"></span>A revisar</div></div>
    <div class="vital unresolved"><div class="n">${unresolved}</div><div class="l"><span class="dot"></span>Sin sugerencia</div></div>
  </div>

  <div class="section-head">
    <h2>Selectores rotos</h2>
    <span class="count">${total} caso${total === 1 ? '' : 's'}</span>
  </div>

  <div class="cases">
    ${run.cases.map(renderCase).join('\n')}
  </div>

  <div class="foot">
    <span class="privacy"><span class="dot"></span>Ningún dato de este proyecto salió de esta máquina</span>
    <span>healify-report.json generado junto a este archivo</span>
  </div>

</div>
</body>
</html>
`
}

export function renderLocalReportJson(run: LocalRun): string {
  return JSON.stringify(
    {
      project: run.project,
      framework: run.framework,
      generatedAt: run.generatedAt.toISOString(),
      summary: {
        total: run.cases.length,
        healed: run.cases.filter((c) => c.status === 'healed').length,
        review: run.cases.filter((c) => c.status === 'review').length,
        unresolved: run.cases.filter((c) => c.status === 'unresolved').length,
      },
      cases: run.cases,
    },
    null,
    2
  )
}
