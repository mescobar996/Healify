import type { HistoryEntry } from './repertoire'

/**
 * Dashboard/histórico de healings: la vista consolidada de `.healify/history.jsonl` que
 * `healify history` solo muestra en texto plano. Cero dependencias, cero red: es HTML
 * autocontenido con la misma paleta visual que `renderLocalReportHtml`.
 *
 * `computeTopRecurrent` / `computeRebroken` viven acá (ubicación canónica) y `cli/history.ts`
 * los re-exporta — una sola implementación, igual que `parseHistoryLines`.
 */

export interface RecurrentSelector {
  selector: string
  count: number
}

export interface RebrokenSelector {
  selector: string
  /** Apariciones totales en el historial, no re-roturas confirmadas — ver el comentario de computeRebroken(). */
  count: number
  firstHealedAt: string
}

/** Agrupa por selector exacto, cuenta apariciones en todo el historial, top N desc. */
export function computeTopRecurrent(entries: HistoryEntry[], limit: number = 10): RecurrentSelector[] {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.selector, (counts.get(e.selector) ?? 0) + 1)
  return [...counts.entries()]
    .map(([selector, count]) => ({ selector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Aproximación, no medición exacta: el historial no sabe si fix() realmente aplicó el
 * selector al archivo (pudo saltarse por ambiguous/dirty-git/not-substitutable) — solo
 * sabe que el motor lo curó con confianza suficiente (status 'healed') la primera vez que
 * apareció, y que el mismo selector volvió a aparecer roto después.
 */
export function computeRebroken(entries: HistoryEntry[]): RebrokenSelector[] {
  const bySelector = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const list = bySelector.get(e.selector) ?? []
    list.push(e)
    bySelector.set(e.selector, list)
  }

  const result: RebrokenSelector[] = []
  for (const [selector, list] of bySelector) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    if (sorted[0].status !== 'healed') continue
    // Debe haber vuelto a aparecer roto (no-healed) después de la primera curación —
    // dos apariciones 'healed' seguidas no son un re-roto, son dos curaciones.
    const rebrokeAgain = sorted.slice(1).some((e) => e.status !== 'healed')
    if (!rebrokeAgain) continue
    result.push({ selector, count: list.length, firstHealedAt: sorted[0].timestamp })
  }
  return result.sort((a, b) => b.count - a.count)
}

export interface TimelinePoint {
  /** Fecha UTC `YYYY-MM-DD` — determinista, no depende del locale de la máquina. */
  date: string
  healed: number
  review: number
  unresolved: number
}

export interface DashboardStats {
  total: number
  healed: number
  review: number
  unresolved: number
  /** healed/total, 0..1 — 0 si no hay entradas. */
  healedRate: number
  firstSeen: string | null
  lastSeen: string | null
  topRecurrent: RecurrentSelector[]
  rebroken: RebrokenSelector[]
  timeline: TimelinePoint[]
}

function countByStatus(entries: HistoryEntry[]): { healed: number; review: number; unresolved: number } {
  const counts = { healed: 0, review: 0, unresolved: 0 }
  for (const e of entries) {
    if (e.status === 'healed') counts.healed += 1
    else if (e.status === 'review') counts.review += 1
    else counts.unresolved += 1
  }
  return counts
}

/** Líneas corruptas (timestamp que no parsea) se ignoran — nunca rompen la timeline. */
function buildTimeline(entries: HistoryEntry[]): TimelinePoint[] {
  const byDate = new Map<string, TimelinePoint>()
  for (const e of entries) {
    const parsed = new Date(e.timestamp)
    if (Number.isNaN(parsed.getTime())) continue
    const date = parsed.toISOString().slice(0, 10)
    let point = byDate.get(date)
    if (!point) {
      point = { date, healed: 0, review: 0, unresolved: 0 }
      byDate.set(date, point)
    }
    if (e.status === 'healed') point.healed += 1
    else if (e.status === 'review') point.review += 1
    else point.unresolved += 1
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildDashboardStats(entries: HistoryEntry[]): DashboardStats {
  const { healed, review, unresolved } = countByStatus(entries)
  const total = entries.length

  let firstSeen: string | null = null
  let lastSeen: string | null = null
  for (const e of entries) {
    if (firstSeen === null || e.timestamp < firstSeen) firstSeen = e.timestamp
    if (lastSeen === null || e.timestamp > lastSeen) lastSeen = e.timestamp
  }

  return {
    total,
    healed,
    review,
    unresolved,
    healedRate: total === 0 ? 0 : healed / total,
    firstSeen,
    lastSeen,
    topRecurrent: computeTopRecurrent(entries),
    rebroken: computeRebroken(entries),
    timeline: buildTimeline(entries),
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function renderSummaryCards(stats: DashboardStats): string {
  const cards = [
    { label: 'Curaciones totales', value: String(stats.total) },
    { label: 'Curadas', value: pct(stats.healedRate) },
    { label: 'En revisión', value: String(stats.review) },
    { label: 'Sin resolver', value: String(stats.unresolved) },
    { label: 'Re-rotos', value: String(stats.rebroken.length) },
  ]
  return cards
    .map(
      (c) => `<div class="meta-cell"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`
    )
    .join('')
}

function renderTimeline(timeline: TimelinePoint[]): string {
  if (timeline.length === 0) {
    return '<p class="empty">Todavía no hay curaciones que graficar — corré healify fix (sin --dry-run) al menos una vez.</p>'
  }
  const max = Math.max(1, ...timeline.map((p) => Math.max(p.healed, p.review, p.unresolved)))
  const bars = timeline
    .map((p) => {
      const segments =
        p.healed + p.review + p.unresolved === 0
          ? '<div class="seg seg-empty"></div>'
          : [
              p.healed > 0 ? `<div class="seg seg-healed" style="height:${pct(p.healed / max)}"></div>` : '',
              p.review > 0 ? `<div class="seg seg-review" style="height:${pct(p.review / max)}"></div>` : '',
              p.unresolved > 0 ? `<div class="seg seg-unresolved" style="height:${pct(p.unresolved / max)}"></div>` : '',
            ].join('')
      return `<div class="bar-col" title="${p.date}">${segments}<div class="bar-date">${p.date.slice(5)}</div></div>`
    })
    .join('')
  return `<div class="legend"><span class="lg lg-healed">Curadas</span><span class="lg lg-review">En revisión</span><span class="lg lg-unresolved">Sin resolver</span></div><div class="bars">${bars}</div>`
}

function renderRecurrentList(stats: DashboardStats): string {
  if (stats.topRecurrent.length === 0) return '<p class="empty">Sin selectores recurrentes todavía.</p>'
  return `<ul>${stats.topRecurrent
    .map((r) => `<li><span class="count">${r.count}x</span> <code>${escapeHtml(r.selector)}</code></li>`)
    .join('')}</ul>`
}

function renderRebrokenList(stats: DashboardStats): string {
  if (stats.rebroken.length === 0) return '<p class="empty">Ninguno todavía — los selectores curados se mantienen curados.</p>'
  return `<ul>${stats.rebroken
    .map(
      (r) =>
        `<li><span class="count">${r.count}x</span> <code>${escapeHtml(r.selector)}</code> <span class="meta">curado por primera vez ${escapeHtml(
          r.firstHealedAt
        )}</span></li>`
    )
    .join('')}</ul>`
}

/**
 * HTML autocontenido, 100% offline, con la misma paleta (dark/light + toggle) que
 * `healify-report.html`. No hay servidor: abrir el archivo alcanza.
 */
export function renderDashboardHtml(stats: DashboardStats): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Healify — Dashboard de curaciones</title>
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
  :root[data-theme="dark"] { --background:#000; --card:#0A0A0A; --card-elevated:#111; --foreground:#EDEDED; --muted:#8A8A8A; --border:rgba(255,255,255,0.08); --border-strong:rgba(255,255,255,0.16); --healed:#34D399; --healed-soft:rgba(52,211,153,0.12); --review:#E8B94D; --review-soft:rgba(232,185,77,0.12); --unresolved:#E85C4A; --unresolved-soft:rgba(232,92,74,0.12); }
  :root[data-theme="light"] { --background:#FFF; --card:#FAFAFA; --card-elevated:#FFF; --foreground:#0A0A0A; --muted:#6B6B6B; --border:rgba(0,0,0,0.08); --border-strong:rgba(0,0,0,0.16); --healed:#047857; --healed-soft:rgba(5,150,105,0.09); --review:#B45309; --review-soft:rgba(180,83,9,0.09); --unresolved:#B91C1C; --unresolved-soft:rgba(185,28,28,0.08); }

  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; transition-duration:.001ms !important; } }

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
  code { font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace; font-size: 13px; background: var(--card-elevated); border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; }
  .sheet { max-width: 900px; margin: 0 auto; }

  .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
  .masthead .id { display: flex; align-items: center; gap: 12px; }
  .masthead .glyph { width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(180deg,#fff 0%,#d7d7d7 100%); color: #0A0A0A; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex: none; }
  .masthead .sub { color: var(--muted); font-size: 13px; margin-top: 3px; }
  .masthead-right { display: flex; align-items: center; gap: 8px; }
  .local-badge, .theme-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .local-badge { background: var(--ring-soft); color: #C4B5FD; border: 1px solid var(--ring); padding: 6px 12px; }
  .local-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }
  .theme-btn { background: var(--card); border: 1px solid var(--border); color: var(--foreground); padding: 6px 12px; transition: border-color 150ms ease; }
  .theme-btn:hover { border-color: var(--border-strong); }

  h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; font-weight: 600; }

  .meta-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 26px; overflow-x: auto; }
  .meta-cell { padding: 13px 16px; border-right: 1px solid var(--border); }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 4px; }
  .meta-cell .value { font-size: 20px; font-weight: 600; }

  section { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 26px; }
  section h2 { margin: 0 0 14px; font-size: 15px; letter-spacing: -0.01em; }

  .legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 12px; color: var(--muted); }
  .lg { display: inline-flex; align-items: center; gap: 6px; }
  .lg::before { content: ""; width: 10px; height: 10px; border-radius: 3px; }
  .lg-healed::before { background: var(--healed); }
  .lg-review::before { background: var(--review); }
  .lg-unresolved::before { background: var(--unresolved); }

  .bars { display: flex; align-items: flex-end; gap: 4px; height: 180px; padding-top: 8px; overflow-x: auto; }
  .bar-col { display: flex; flex-direction: column-reverse; justify-content: flex-end; width: 100%; min-width: 24px; height: 100%; gap: 1px; }
  .seg { width: 100%; border-radius: 2px; }
  .seg-healed { background: var(--healed); }
  .seg-review { background: var(--review); }
  .seg-unresolved { background: var(--unresolved); }
  .seg-empty { height: 2px; background: var(--border); }
  .bar-date { margin-top: 6px; text-align: center; font-size: 10px; color: var(--muted); }

  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: none; }
  .count { font-weight: 600; min-width: 44px; }
  .meta { color: var(--muted); font-size: 12px; margin-left: auto; white-space: nowrap; }
  .empty { color: var(--muted); margin: 0; }
</style>
</head>
<body>
<div class="sheet">
  <div class="masthead">
    <div class="id">
      <div class="glyph">H</div>
      <div>
        <h1>Healify — Dashboard de curaciones</h1>
        <div class="sub">${stats.total} entradas · de ${stats.firstSeen ?? '—'} a ${stats.lastSeen ?? '—'}</div>
      </div>
    </div>
    <div class="masthead-right">
      <span class="local-badge">100% local</span>
      <button class="theme-btn" id="theme-toggle">Tema</button>
    </div>
  </div>

  <div class="meta-strip">${renderSummaryCards(stats)}</div>

  <section>
    <h2>Curaciones por día</h2>
    ${renderTimeline(stats.timeline)}
  </section>

  <section>
    <h2>Selectores más recurrentes</h2>
    ${renderRecurrentList(stats)}
  </section>

  <section>
    <h2>Selectores re-rotos</h2>
    ${renderRebrokenList(stats)}
  </section>
</div>
<script>
(function(){
  var root = document.documentElement;
  var saved = localStorage.getItem('healify-theme');
  if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
  document.getElementById('theme-toggle').addEventListener('click', function () {
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    localStorage.setItem('healify-theme', next);
  });
})();
</script>
</body>
</html>
`
}
