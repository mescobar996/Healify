/**
 * Formato de reporte de defectos.
 *
 * Traduce el resultado del motor a lo que un QA necesita entregar: un defecto con ID,
 * severidad, resultado esperado vs. obtenido, pasos y evidencia. Nada de esto se inventa —
 * cada campo sale de un dato que el framework ya expuso en el momento del fallo. Si un dato
 * no está disponible (Selenium no tiene concepto de suite, Cypress no expone los pasos), el
 * campo se omite del render en vez de rellenarse con algo que parezca real.
 */
import { createHash } from 'node:crypto'
import { release } from 'node:os'
import type { LocalCaseStatus, LocalCaseResult } from './local-mode'
import type { LocalRun } from './local-report'
import type { FailureCause } from './failure-cause'

export type Severity = 'blocker' | 'major' | 'minor'

/** Entorno de la corrida. Solo `os`/`node`/`framework` están siempre disponibles; el resto
 * depende de cuánto exponga cada adapter y se omite del render cuando falta. */
export interface RunEnvironment {
  os: string
  osVersion?: string
  node: string
  framework: string
  frameworkVersion?: string
  browser?: string
  baseURL?: string
}

/** Conteos de la corrida completa: `total`/`passed`/`failed` son de la suite entera, no solo
 * de los casos con selector roto (que son los que viven en `cases`). */
export interface RunStats {
  total: number
  passed: number
  failed: number
  healed: number
  review: number
  unresolved: number
  /** Cuántos fallos hubo de cada causa. Es la medida honesta del alcance de la herramienta:
   * `selector` es lo que Healify puede corregir, el resto es lo que solo puede señalar. */
  causes: Record<FailureCause, number>
  durationMs?: number
}

const EMPTY_CAUSE_COUNTS: Record<FailureCause, number> = {
  selector: 0,
  assertion: 0,
  timing: 0,
  navigation: 0,
  runtime: 0,
  unknown: 0,
}

function countCauses(cases: LocalCaseResult[]): Record<FailureCause, number> {
  const counts = { ...EMPTY_CAUSE_COUNTS }
  for (const c of cases) counts[c.cause]++
  return counts
}

/** Entorno mínimo que cualquier adapter puede armar sin datos del framework. */
export function baseEnvironment(framework: string, extra: Partial<RunEnvironment> = {}): RunEnvironment {
  return {
    os: process.platform,
    osVersion: release(),
    node: process.version,
    framework,
    ...extra,
  }
}

/** Cuenta los casos por estado. Los adapters que no saben cuántos tests corrieron en total
 * (Selenium/WebdriverIO curan en vivo) omiten `suite` y los totales salen de los casos. */
export function statsFromCases(
  cases: LocalCaseResult[],
  suite?: { total: number; passed: number; failed: number; durationMs?: number }
): RunStats {
  const count = (status: LocalCaseResult['status']) => cases.filter((c) => c.status === status).length
  return {
    total: suite?.total ?? cases.length,
    passed: suite?.passed ?? 0,
    failed: suite?.failed ?? cases.length,
    healed: count('healed'),
    review: count('review'),
    unresolved: count('unresolved'),
    causes: countCauses(cases),
    durationMs: suite?.durationMs,
  }
}

/** Forma de `LocalRun` con todo resuelto, que es lo que consumen los renderers. */
export type NormalizedRun = LocalRun & {
  verdict: 'passed' | 'failed'
  stats: RunStats
  environment: RunEnvironment
}

/**
 * Rellena los campos del reporte QA que un `LocalRun` armado a mano puede no traer. Sin esto,
 * un consumidor que venía construyendo el objeto antes de que existiera el formato QA rompería
 * al renderizar.
 */
export function normalizeRun(run: LocalRun): NormalizedRun {
  return {
    ...run,
    verdict: run.verdict ?? (run.cases.some((c) => c.status !== 'healed') ? 'failed' : 'passed'),
    stats: run.stats ?? statsFromCases(run.cases),
    environment: run.environment ?? baseEnvironment(run.framework),
  }
}

/**
 * Identificador estable de un defecto: el mismo selector roto en el mismo archivo devuelve
 * siempre el mismo ID, corrida tras corrida y máquina tras máquina.
 *
 * Esa estabilidad es el punto — es la llave que permite reconocer "este defecto ya lo vimos"
 * al cruzar el reporte con el historial (`.healify/history.jsonl`). Por eso el hash se toma
 * del par archivo+selector y no de nada volátil (timestamp, orden de ejecución, ruta absoluta
 * de la máquina).
 */
export function buildDefectId(testFile: string | undefined, selector: string): string {
  const key = `${testFile ?? ''}::${selector}`
  return `HLF-${createHash('sha1').update(key).digest('hex').slice(0, 6).toUpperCase()}`
}

/**
 * Severidad derivada del estado, con una regla fija y auditable (no es un juicio del motor):
 *
 * - `blocker`  — sin sugerencia: el test está roto y no hay camino automático.
 * - `major`    — hay sugerencia pero por debajo del umbral de aplicación: necesita ojo humano.
 * - `minor`    — sanado: hay un arreglo de alta confianza listo para aplicar.
 */
export function severityFor(status: LocalCaseStatus): Severity {
  if (status === 'unresolved') return 'blocker'
  if (status === 'review') return 'major'
  return 'minor'
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  blocker: 'Bloqueante',
  major: 'Mayor',
  minor: 'Menor',
}

export function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds % 60)} s`
}

/** Líneas "clave: valor" del entorno, salteando lo que el adapter no pudo determinar. */
export function environmentRows(rawRun: LocalRun): { label: string; value: string }[] {
  const run = normalizeRun(rawRun)
  const env = run.environment
  const rows: { label: string; value: string }[] = [
    { label: 'Framework', value: env.frameworkVersion ? `${env.framework} ${env.frameworkVersion}` : env.framework },
  ]
  if (env.browser) rows.push({ label: 'Navegador', value: env.browser })
  if (env.baseURL) rows.push({ label: 'URL base', value: env.baseURL })
  rows.push({ label: 'Sistema', value: env.osVersion ? `${env.os} ${env.osVersion}` : env.os })
  rows.push({ label: 'Node', value: env.node })
  const duration = formatDuration(run.stats.durationMs)
  if (duration) rows.push({ label: 'Duración', value: duration })
  return rows
}

function caseMarkdown(c: LocalCaseResult): string {
  const lines: string[] = [`### ${c.defectId} — ${c.testName}`, '']

  const meta: string[] = [`**Severidad:** ${SEVERITY_LABEL[c.severity]}`]
  if (c.testFile) meta.push(`**Ubicación:** \`${c.testFile}${c.line ? `:${c.line}` : ''}\``)
  const duration = formatDuration(c.durationMs)
  if (duration) meta.push(`**Duración:** ${duration}`)
  lines.push(meta.join(' · '), '')

  if (c.expected) lines.push(`**Resultado esperado:** ${c.expected}`, '')
  if (c.actual) lines.push(`**Resultado obtenido:** ${c.actual}`, '')

  if (c.steps && c.steps.length > 0) {
    lines.push('**Pasos para reproducir:**', '')
    c.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
    lines.push('')
  }

  lines.push('**Selector que falló:**', '', '```', c.selector, '```', '')

  if (c.status === 'unresolved') {
    lines.push('**Sugerencia:** sin candidato confiable — requiere análisis manual.', '')
  } else {
    const origen = c.verified
      ? 'verificada contra la página real'
      : 'heurística sobre el texto del selector, sin comprobar contra la página'
    lines.push(`**Sugerencia (${origen}, ${Math.round(c.confidence * 100)}% de confianza):**`, '', '```', c.fixedSelector, '```', '')
    if (c.explanation) lines.push(`> ${c.explanation}`, '')
  }

  if (c.attachments && c.attachments.length > 0) {
    lines.push('**Evidencia:**', '')
    for (const a of c.attachments) lines.push(`- [${a.name}](${a.path})`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * `healify-report.md` — el reporte listo para pegar en un ticket de Jira/Redmine o en un
 * informe. Markdown plano a propósito: sobrevive a cualquier editor sin perder formato.
 */
export function renderLocalReportMarkdown(rawRun: LocalRun): string {
  const run = normalizeRun(rawRun)
  const { stats } = run
  const verdictLabel = run.verdict === 'passed' ? 'PASS' : 'FAIL'

  const lines: string[] = [
    `# Reporte de pruebas — ${run.project}`,
    '',
    `**Resultado: ${verdictLabel}**`,
    '',
    `Ejecutado el ${run.generatedAt.toLocaleString('es-AR')}`,
    '',
    '## Entorno',
    '',
  ]

  for (const row of environmentRows(run)) lines.push(`- **${row.label}:** ${row.value}`)

  lines.push(
    '',
    '## Resumen',
    '',
    '| Métrica | Cantidad |',
    '|---|---|',
    `| Tests ejecutados | ${stats.total} |`,
    `| Tests exitosos | ${stats.passed} |`,
    `| Tests fallidos | ${stats.failed} |`,
    `| Defectos con arreglo sugerido | ${stats.healed} |`,
    `| Defectos que requieren revisión | ${stats.review} |`,
    `| Defectos sin sugerencia | ${stats.unresolved} |`,
    '',
  )

  if (run.cases.length === 0) {
    lines.push(
      '## Defectos',
      '',
      'No se detectaron selectores rotos en esta corrida.',
      '',
    )
  } else {
    lines.push('## Defectos', '')
    // Lo más grave primero, que es como se lee un reporte de defectos.
    const order: Severity[] = ['blocker', 'major', 'minor']
    const sorted = [...run.cases].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.confidence - b.confidence)
    for (const c of sorted) lines.push(caseMarkdown(c))
  }

  lines.push(
    '---',
    '',
    'Generado por Healify — heurística local, sin IA. Las sugerencias marcadas como',
    'verificadas se confrontaron contra el árbol de la página capturado al fallar el test; el',
    'resto sale de analizar el texto del selector y conviene revisarlo antes de aplicarlo.',
    '',
  )

  return lines.join('\n')
}
