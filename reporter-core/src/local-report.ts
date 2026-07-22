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

function escapeJs(value: string): string {
  return JSON.stringify(value)
}

const STATUS_LABEL: Record<LocalCaseResult['status'], string> = {
  healed: 'Sanado',
  review: 'A revisar',
  unresolved: 'Sin sugerencia',
}

interface IndexedCase extends LocalCaseResult {
  _id: number
}

/** Casos que necesitan atención: sin sugerencia primero, después "a revisar" de menor a mayor confianza. */
function sortAttention(a: IndexedCase, b: IndexedCase): number {
  if (a.status !== b.status) return a.status === 'unresolved' ? -1 : 1
  return a.confidence - b.confidence
}

function renderAttentionCase(c: IndexedCase): string {
  const pct = Math.round(c.confidence * 100)
  const hasFixed = c.status === 'review' && c.fixedSelector.length > 0

  const suggestionHtml = hasFixed
    ? `<div class="diff-col after">
        <div class="label">Sugerencia (heurística local)</div>
        <code class="copy-source">${escapeHtml(c.fixedSelector)}</code>
      </div>`
    : `<div class="diff-col after empty">
        <div class="label">Sugerencia</div>
        <code>— sin candidato confiable —</code>
      </div>`

  const confidenceHtml =
    c.confidence > 0
      ? `<div class="confidence">
          <span class="pct">${pct}%</span>
          <span class="meter"><span style="width:${pct}%"></span></span>
        </div>`
      : ''

  const copyBtn = hasFixed
    ? `<button class="btn" data-action="copy" aria-label="Copiar sugerencia">Copiar sugerencia</button>`
    : ''

  return `
    <article class="case ${c.status}" data-id="${c._id}">
      <div class="case-top">
        <span class="status-pill">${STATUS_LABEL[c.status]}</span>
        <span class="case-title">
          <span class="name">${escapeHtml(c.testName)}</span>
          ${c.testFile ? `<span class="path">${escapeHtml(c.testFile)}</span>` : ''}
        </span>
        ${confidenceHtml}
      </div>
      <div class="case-body">
        <div class="error">${escapeHtml(c.errorMessage)}</div>
        <div class="diff">
          <div class="diff-col before">
            <div class="label">Selector original</div>
            <code>${escapeHtml(c.selector)}</code>
          </div>
          ${suggestionHtml}
        </div>
        ${c.explanation ? `<p class="engine-note">${escapeHtml(c.explanation)}</p>` : ''}
        <div class="case-actions">
          ${copyBtn}
          <button class="btn" data-action="fix">Marcar como arreglado</button>
        </div>
      </div>
    </article>`
}

function renderHealedCase(c: IndexedCase): string {
  return `
    <div class="mini" data-id="${c._id}">
      <span class="mini-name" title="${escapeHtml(c.testName)}">${escapeHtml(c.testName)}</span>
      <code class="mini-selector before" title="${escapeHtml(c.selector)}">${escapeHtml(c.selector)}</code>
      <span class="mini-arrow">→</span>
      <code class="mini-selector after" title="${escapeHtml(c.fixedSelector)}">${escapeHtml(c.fixedSelector)}</code>
      ${c.testFile ? `<span class="mini-file">${escapeHtml(c.testFile)}</span>` : ''}
    </div>`
}

/** Genera el reporte HTML standalone del modo local — sin red, sin dependencias externas. */
export function renderLocalReportHtml(run: LocalRun): string {
  const indexed: IndexedCase[] = run.cases.map((c, i) => ({ ...c, _id: i }))
  const total = indexed.length
  const healedCases = indexed.filter((c) => c.status === 'healed')
  const attentionCases = indexed.filter((c) => c.status !== 'healed').sort(sortAttention)
  const reviewCount = attentionCases.filter((c) => c.status === 'review').length
  const unresolvedCount = attentionCases.filter((c) => c.status === 'unresolved').length
  const dateStr = run.generatedAt.toLocaleString('es-AR')
  const storageKey = `healify-fixed:${run.project}:${run.generatedAt.toISOString()}`

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
  @media (prefers-color-scheme: light) {
    :root {
      --background: #FFFFFF;
      --card: #FAFAFA;
      --card-elevated: #FFFFFF;
      --foreground: #0A0A0A;
      --muted: #6B6B6B;
      --border: rgba(0,0,0,0.08);
      --border-strong: rgba(0,0,0,0.16);
      --healed: #047857;
      --healed-soft: rgba(5,150,105,0.09);
      --review: #B45309;
      --review-soft: rgba(180,83,9,0.09);
      --unresolved: #B91C1C;
      --unresolved-soft: rgba(185,28,28,0.08);
    }
  }
  :root[data-theme="dark"] {
    --background: #000000; --card: #0A0A0A; --card-elevated: #111111; --foreground: #EDEDED; --muted: #8A8A8A;
    --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.16);
    --healed: #34D399; --healed-soft: rgba(52,211,153,0.12);
    --review: #E8B94D; --review-soft: rgba(232,185,77,0.12);
    --unresolved: #E85C4A; --unresolved-soft: rgba(232,92,74,0.12);
  }
  :root[data-theme="light"] {
    --background: #FFFFFF; --card: #FAFAFA; --card-elevated: #FFFFFF; --foreground: #0A0A0A; --muted: #6B6B6B;
    --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.16);
    --healed: #047857; --healed-soft: rgba(5,150,105,0.09);
    --review: #B45309; --review-soft: rgba(180,83,9,0.09);
    --unresolved: #B91C1C; --unresolved-soft: rgba(185,28,28,0.08);
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
  button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
  a { color: var(--ring); }
  .mono { font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
  .sheet { max-width: 900px; margin: 0 auto; }

  h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; font-weight: 600; }

  .masthead {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap;
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
  .masthead-right { display: flex; align-items: center; gap: 8px; }

  .local-badge, .heuristica-btn, .theme-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .local-badge { background: var(--ring-soft); color: #C4B5FD; border: 1px solid var(--ring); padding: 6px 12px; }
  .local-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }
  .heuristica-btn, .theme-btn {
    background: var(--card); border: 1px solid var(--border); color: var(--foreground); padding: 6px 12px;
    transition: border-color 150ms ease;
  }
  .heuristica-btn:hover, .theme-btn:hover { border-color: var(--border-strong); }

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
  section.collapsed .cases-wrap { display: none; }
  .section-head { cursor: pointer; user-select: none; }
  .section-head .chev { color: var(--muted); font-size: 12px; transition: transform .15s ease; margin-left: 8px; }
  section.collapsed .chev { transform: rotate(-90deg); }

  .cases { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
  .empty {
    padding: 28px 18px; text-align: center; color: var(--muted); font-size: 13px;
    background: var(--card); border: 1px dashed var(--border); border-radius: 10px; margin-bottom: 30px;
  }

  .case {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; transition: border-color 150ms ease, opacity 200ms ease;
  }
  .case:hover { border-color: var(--border-strong); }
  .case.review { border-left: 2px solid var(--review); }
  .case.unresolved { border-left: 2px solid var(--unresolved); }
  .case.just-fixed { opacity: 0; }

  .case-top { display: flex; align-items: center; gap: 14px; padding: 13px 16px; flex-wrap: wrap; }
  .status-pill { flex: none; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; }
  .case.review .status-pill { background: var(--review-soft); color: var(--review); }
  .case.unresolved .status-pill { background: var(--unresolved-soft); color: var(--unresolved); }

  .case-title { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 2px; }
  .case-title .name { font-weight: 500; font-size: 13.5px; }
  .case-title .path { font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .confidence { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 100px; }
  .confidence .pct { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .case.review .confidence .pct { color: var(--review); }
  .case.unresolved .confidence .pct { color: var(--unresolved); }
  .meter { width: 100%; height: 3px; border-radius: 2px; background: rgba(128,128,128,.18); overflow: hidden; }
  .meter span { display: block; height: 100%; }
  .case.review .meter span { background: var(--review); }
  .case.unresolved .meter span { background: var(--unresolved); }

  .case-body { padding: 2px 16px 16px 16px; border-top: 1px solid var(--border); }
  .case-body .error {
    font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted);
    background: rgba(128,128,128,.06); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; margin: 14px 0; white-space: pre-wrap; word-break: break-word;
  }
  .diff { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .diff-col .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
  .diff-col code {
    display: block; font-family: "JetBrains Mono", monospace; font-size: 12.5px;
    padding: 10px 12px; border-radius: 8px; word-break: break-all; border: 1px solid var(--border);
  }
  .diff-col.before code { background: var(--unresolved-soft); color: #FCA5A5; }
  .diff-col.after code { background: var(--review-soft); color: #FCD34D; }
  .diff-col.after.empty code { background: rgba(128,128,128,.06); color: var(--muted); font-style: italic; }

  .engine-note { font-size: 12px; color: var(--muted); margin: 10px 0 0 0; }

  .case-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .btn {
    padding: 6px 12px; background: var(--card-elevated); border: 1px solid var(--border); border-radius: 8px;
    font-size: 12px; color: var(--foreground); transition: border-color 150ms ease;
  }
  .btn:hover { border-color: var(--border-strong); }
  .btn.copied { color: var(--healed); border-color: var(--healed-soft); }

  .mini {
    display: flex; align-items: center; gap: 10px; padding: 8px 14px;
    background: var(--card); border: 1px solid var(--border); border-left: 2px solid var(--healed-soft);
    border-radius: 8px; transition: opacity 200ms ease;
  }
  .mini.just-fixed { opacity: 0; }
  .mini-selector {
    font-family: "JetBrains Mono", monospace; font-size: 11.5px; padding: 2px 7px; border-radius: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
  }
  .mini-name { font-size: 12px; color: var(--foreground); flex: none; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini-selector.before { color: var(--muted); text-decoration: line-through; }
  .mini-selector.after { color: var(--healed); background: var(--healed-soft); }
  .mini-arrow { color: var(--muted); flex: none; }
  .mini-file { margin-left: auto; font-family: "JetBrains Mono", monospace; font-size: 10.5px; color: var(--muted); flex: none; }

  .foot {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    padding-top: 18px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted);
  }
  .foot .privacy { display: flex; align-items: center; gap: 8px; }
  .foot .privacy .dot { width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }

  dialog.modal {
    border: none; padding: 0; background: var(--card); color: var(--foreground); border-radius: 12px;
    max-width: 600px; width: calc(100% - 32px); border: 1px solid var(--border-strong);
  }
  dialog.modal::backdrop { background: rgba(0,0,0,0.55); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); }
  .modal-header h2 { font-size: 15.5px; font-weight: 600; margin: 0; }
  .modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--muted); border-radius: 6px; }
  .modal-close:hover { background: var(--card-elevated); color: var(--foreground); }
  .modal-body { padding: 18px 22px 22px; max-height: 68vh; overflow-y: auto; }
  .modal-body p { font-size: 13px; line-height: 1.6; color: var(--muted); margin: 0 0 14px; }
  .modal-body p strong { color: var(--foreground); }
  .modal-body h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin: 18px 0 8px; }
  .rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rules li { padding: 10px 12px; background: var(--card-elevated); border: 1px solid var(--border); border-radius: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.5; }
  .rules li strong { display: block; color: var(--foreground); font-size: 12.5px; margin-bottom: 3px; }
  .rules code, .modal-body code { font-family: "JetBrains Mono", monospace; font-size: 11.5px; padding: 1px 5px; background: rgba(128,128,128,.14); border-radius: 3px; color: var(--foreground); }
  .modal-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 12px; }
  .modal-footer a { font-weight: 500; }

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
    <div class="masthead-right">
      <button class="heuristica-btn" id="heuristica-trigger" type="button">¿Cómo funciona?</button>
      <button class="theme-btn" id="theme-toggle" type="button">Tema</button>
      <span class="local-badge">100% local</span>
    </div>
  </div>

  <div class="meta-strip">
    <div class="meta-cell"><div class="label">Proyecto</div><div class="value">${escapeHtml(run.project)}</div></div>
    <div class="meta-cell"><div class="label">Generado</div><div class="value mono">${escapeHtml(dateStr)}</div></div>
    <div class="meta-cell"><div class="label">Motor</div><div class="value">Heurística local</div></div>
  </div>

  <div class="vitals">
    <div class="vital"><div class="n">${total}</div><div class="l"><span class="dot"></span>Tests con selector roto</div></div>
    <div class="vital healed"><div class="n" id="vital-healed-n">${healedCases.length}</div><div class="l"><span class="dot"></span>Sanados</div></div>
    <div class="vital review"><div class="n" id="vital-review-n">${reviewCount}</div><div class="l"><span class="dot"></span>A revisar</div></div>
    <div class="vital unresolved"><div class="n" id="vital-unresolved-n">${unresolvedCount}</div><div class="l"><span class="dot"></span>Sin sugerencia</div></div>
  </div>

  <section id="section-attention">
    <div class="section-head" data-toggle="attention">
      <h2>Necesita tu atención</h2>
      <span class="count"><span id="attention-count-n">${attentionCases.length} caso${attentionCases.length === 1 ? '' : 's'}</span><span class="chev">▾</span></span>
    </div>
    <div class="cases-wrap" id="attention-wrap">
      ${
        attentionCases.length > 0
          ? `<div class="cases">${attentionCases.map(renderAttentionCase).join('\n')}</div>`
          : `<div class="empty">Todo limpio — no hay selectores que necesiten revisión manual.</div>`
      }
    </div>
  </section>

  <section id="section-healed" class="collapsed">
    <div class="section-head" data-toggle="healed">
      <h2>Sanados automáticamente</h2>
      <span class="count">${healedCases.length} caso${healedCases.length === 1 ? '' : 's'}<span class="chev">▾</span></span>
    </div>
    <div class="cases-wrap">
      ${
        healedCases.length > 0
          ? `<div class="cases">${healedCases.map(renderHealedCase).join('\n')}</div>`
          : `<div class="empty">Aún no hay casos sanados en esta corrida.</div>`
      }
    </div>
  </section>

  <div class="foot">
    <span class="privacy"><span class="dot"></span>Ningún dato de este proyecto salió de esta máquina</span>
    <span>healify-report.json generado junto a este archivo</span>
  </div>

</div>

<dialog class="modal" id="heuristica-modal">
  <div class="modal-header">
    <h2>Heurística local, no IA</h2>
    <button class="modal-close" data-close type="button" aria-label="Cerrar">×</button>
  </div>
  <div class="modal-body">
    <p><strong>Esto no es un modelo de IA.</strong> Es <em>pattern-matching</em> determinístico sobre el texto del selector y del mensaje de error, corriendo 100% en tu máquina. No hay red, no hay servidor, no hay cuenta.</p>
    <p><strong>No analiza el DOM.</strong> El motor no inspecciona el árbol del documento ni verifica que el selector sugerido exista de verdad en la página — decide todo por el texto del selector fallido. Tampoco tiene memoria entre tests ni entre corridas: cada caso se evalúa de forma aislada.</p>
    <h3>Reglas que aplica</h3>
    <ul class="rules">
      <li><strong>IDs dinámicos</strong>Si el selector es un <code>#id</code> con dígitos o un sufijo hexadecimal (ej. <code>#user-a1b2c3</code>), se marca como inestable y se propone una clase derivada del mismo nombre, sin el sufijo dinámico.</li>
      <li><strong>Clases generadas</strong>Patrones de CSS-modules (<code>_boton_x7f2</code>) o styled-components (<code>sc-a1b2c3</code>) se marcan como no confiables.</li>
      <li><strong><code>data-testid</code> / <code>data-cy</code></strong>Si ya existe, se conserva y normaliza — es el candidato de mayor confianza.</li>
      <li><strong>XPath</strong>Se reemplaza siempre por un selector de rol ARIA, por ser el tipo más frágil ante cambios de estructura.</li>
      <li><strong>Tipo de elemento por texto del selector</strong>Detecta patrones como <code>button</code>/<code>btn</code>, <code>input</code>/<code>field</code>, <code>link</code>/<code>nav</code> en el propio selector para sugerir un rol ARIA, texto visible, placeholder o la relación <code>label → input</code>.</li>
      <li><strong>Diccionarios de acciones y campos (ES/EN)</strong>Nombres como <code>login</code>, <code>guardar</code>, <code>email</code>, <code>contraseña</code> se traducen al texto visible esperado en la sugerencia.</li>
      <li><strong>Locators modernos de Playwright</strong>Si el selector ya usa <code>getByRole</code>/<code>getByText</code>/etc., no se toca — se marca para revisión manual, porque sin acceso al DOM real no se puede saber por qué dejó de matchear.</li>
      <li><strong>Confianza</strong>Puntaje base por estrategia + un ajuste determinístico (no aleatorio) derivado del hash del selector, acotado entre 75% y 98%. <strong>≥90%</strong> se marca sanado automático, <strong>80–90%</strong> a revisar, <strong>&lt;80%</strong> sin sugerencia mostrada.</li>
    </ul>
    <h3>Cuándo no hay sugerencia</h3>
    <p>Cuando no se pudo extraer ningún selector del mensaje de error, o cuando la confianza de la mejor estrategia queda por debajo del 80%. La heurística prefiere no mostrar una sugerencia débil a arriesgarse a romper otro test.</p>
    <div class="modal-footer">
      <span>Open source · auditable · 0 telemetría</span>
      <a href="https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts" target="_blank" rel="noopener">Ver el motor en GitHub →</a>
    </div>
  </div>
</dialog>

<script>
(function () {
  'use strict';
  var STORAGE_THEME = 'healify-theme';
  var STORAGE_FIXED = ${escapeJs(storageKey)};

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME, theme);
  }
  var savedTheme = localStorage.getItem(STORAGE_THEME);
  if (savedTheme) applyTheme(savedTheme);

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('heuristica-trigger').addEventListener('click', function () {
    document.getElementById('heuristica-modal').showModal();
  });
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { document.getElementById('heuristica-modal').close(); });
  });
  document.getElementById('heuristica-modal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

  document.querySelectorAll('[data-toggle]').forEach(function (head) {
    head.addEventListener('click', function () {
      document.getElementById('section-' + head.dataset.toggle).classList.toggle('collapsed');
    });
  });

  function loadFixed() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_FIXED) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveFixed(set) {
    localStorage.setItem(STORAGE_FIXED, JSON.stringify(Array.from(set)));
  }

  function updateCounts() {
    var remaining = document.querySelectorAll('#section-attention .case');
    var review = 0, unresolved = 0;
    remaining.forEach(function (c) {
      if (c.classList.contains('review')) review++;
      else if (c.classList.contains('unresolved')) unresolved++;
    });
    var total = review + unresolved;
    var countEl = document.getElementById('attention-count-n');
    if (countEl) countEl.textContent = total + ' caso' + (total === 1 ? '' : 's');
    var reviewEl = document.getElementById('vital-review-n');
    if (reviewEl) reviewEl.textContent = String(review);
    var unresolvedEl = document.getElementById('vital-unresolved-n');
    if (unresolvedEl) unresolvedEl.textContent = String(unresolved);
    if (total === 0) {
      var wrap = document.getElementById('attention-wrap');
      if (wrap) wrap.innerHTML = '<div class="empty">Todo limpio — no hay selectores que necesiten revisión manual.</div>';
    }
  }

  var fixed = loadFixed();
  fixed.forEach(function (id) {
    var el = document.querySelector('.case[data-id="' + id + '"]');
    if (el) el.remove();
  });
  updateCounts();

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-action="copy"]');
    if (copyBtn) {
      var code = copyBtn.closest('.case').querySelector('.copy-source');
      var text = code ? code.textContent : '';
      var done = function () {
        copyBtn.classList.add('copied');
        var original = copyBtn.textContent;
        copyBtn.textContent = 'Copiado';
        setTimeout(function () { copyBtn.classList.remove('copied'); copyBtn.textContent = original; }, 1400);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        document.body.removeChild(ta);
      }
      return;
    }

    var fixBtn = e.target.closest('[data-action="fix"]');
    if (fixBtn) {
      var card = fixBtn.closest('.case');
      var id = card.dataset.id;
      fixed.add(id);
      saveFixed(fixed);
      card.classList.add('just-fixed');
      setTimeout(function () { card.remove(); updateCounts(); }, 220);
    }
  });
})();
</script>
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
