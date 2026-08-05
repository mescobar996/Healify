/**
 * Reporte de defectos a herramientas ágiles (Jira / webhook genérico).
 *
 * El diseño sigue el patrón que la investigación de campo (gap G18) encontró en la competencia:
 * "webhook → JQL lookup por clave estable → crear si no existe / comentar si existe". La clave
 * estable es el `defectId` de Healify (`HLF-XXXXXXXX`, sha1 de archivo+selector), que ya viene
 * en el título y la descripción — el mismo selector roto nunca vuelve a crear un ticket.
 *
 * Regla no negociable (mismo estándar que "Cadena de custodia"): el reporte es opt-in, off por
 * default; las credenciales son del USUARIO contra SU instancia; la única salida de datos es el
 * POST hacia su Jira/webhook. El hallazgo se reporta ANTES o junto con la sugerencia, y la
 * sugerencia viaja como comentario/contexto del ticket — nunca borra el rastro original.
 */
import { environmentRows, type Severity } from './qa-report'
import { resolveAgile, type AgileProvider, type HealifyConfig, type ResolvedAgileConfig } from './config'
import { createJiraClient } from './jira'
import { createGithubIssuesClient } from './github-issues'
import { postJson } from './webhook'
import type { LocalCaseResult } from './local-mode'
import type { LocalRun } from './local-report'

/** La sugerencia de Healify, como contexto adjunto al ticket — nunca reemplaza el hallazgo. */
export interface AgileDefectSuggestion {
  fixedSelector: string
  confidence: number
  verified: boolean
  explanation?: string
  alternatives: { selector: string; confidence: number }[]
}

/** Un defecto listo para reportar: el hallazgo (con su rastro) + la sugerencia como contexto. */
export interface AgileDefect {
  defectId: string
  severity: Severity
  title: string
  description: string
  priority: string
  labels: string[]
  selector: string
  testFile?: string
  expected?: string
  actual?: string
  steps: string[]
  environmentRows: { label: string; value: string }[]
  suggestion?: AgileDefectSuggestion
}

/** Resultado por defecto del orquestador. `key` = issue de Jira; webhook no tiene clave. */
export type AgileOutcome =
  | { case: LocalCaseResult; action: 'created' | 'existing'; key: string }
  | { case: LocalCaseResult; action: 'sent' }
  | { case: LocalCaseResult; action: 'failed'; message: string }

export interface AgileReportResult {
  enabled: boolean
  provider: AgileProvider
  outcomes: AgileOutcome[]
}

/**
 * Traduce cada `LocalCaseResult` a un defecto. El `defectId` va en el título Y en la descripción
 * para que el lookup JQL de dedupe (`text ~ "HLF-XXXXXXXX"`) lo encuentre igual en cada corrida.
 */
export function buildAgileDefects(run: LocalRun, config: HealifyConfig = {}): AgileDefect[] {
  const agile = resolveAgile(config)
  const rows = environmentRows(run)

  return run.cases.map((c) => {
    const hasSuggestion = c.status !== 'unresolved' && Boolean(c.fixedSelector)
    const suggestion: AgileDefectSuggestion | undefined = hasSuggestion
      ? {
          fixedSelector: c.fixedSelector,
          confidence: c.confidence,
          verified: c.verified ?? false,
          explanation: c.explanation || undefined,
          alternatives: c.healResponse?.alternatives ?? [],
        }
      : undefined

    return {
      defectId: c.defectId,
      severity: c.severity,
      title: `[${c.defectId}] ${c.testName}`,
      description: buildDescription(c, rows),
      priority: agile.priorityBySeverity[c.severity] ?? 'Highest',
      labels: [...agile.labels],
      selector: c.selector,
      testFile: c.testFile,
      expected: c.expected,
      actual: c.actual,
      steps: c.steps ?? [],
      environmentRows: rows,
      suggestion,
    }
  })
}

function buildDescription(
  c: LocalCaseResult,
  rows: { label: string; value: string }[]
): string {
  const lines: string[] = []
  if (c.testFile) lines.push(`**Archivo:** \`${c.testFile}\``)
  lines.push(`**Selector que falló:** \`${c.selector}\``)

  if (c.expected) lines.push('', `**Resultado esperado:** ${c.expected}`)
  if (c.actual) lines.push('', `**Resultado obtenido:** ${c.actual}`)

  if (c.steps && c.steps.length > 0) {
    lines.push('', '**Pasos para reproducir:**')
    c.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
  }

  if (rows.length > 0) {
    lines.push('', '**Entorno:**')
    for (const row of rows) lines.push(`- ${row.label}: ${row.value}`)
  }

  if (c.attachments && c.attachments.length > 0) {
    lines.push('', '**Evidencia:**')
    for (const a of c.attachments) lines.push(`- [${a.name}](${a.path})`)
  }

  // La clave de dedupe, siempre presente: el JQL la busca en el texto del issue.
  lines.push('', `**defectId:** ${c.defectId}`)
  return lines.join('\n')
}

/** La sugerencia de Healify va como comentario del ticket — contexto, nunca el rastro original. */
function buildSuggestionComment(c: LocalCaseResult): string {
  const lines = ['**Sugerencia de Healify**', '']

  if (c.status === 'unresolved' || !c.fixedSelector) {
    lines.push('Sin candidato confiable — el defecto requiere análisis manual.', '')
    return lines.join('\n')
  }

  const origen = c.verified
    ? 'verificada contra la página real'
    : 'heurística sobre el texto del selector, sin comprobar contra la página'
  lines.push(`Selector sugerido (${origen}, ${Math.round(c.confidence * 100)}% de confianza):`)
  lines.push('', '```', c.fixedSelector, '```', '')
  if (c.explanation) lines.push('', `> ${c.explanation}`)
  if (c.healResponse?.alternatives && c.healResponse.alternatives.length > 0) {
    lines.push('', 'Alternativas:')
    for (const alt of c.healResponse.alternatives) {
      lines.push(`- \`${alt.selector}\` (${Math.round(alt.confidence * 100)}% de confianza)`)
    }
  }
  lines.push('', '_Healify es heurística local, sin IA. La sugerencia es contexto del defecto._')
  return lines.join('\n')
}

function webhookPayload(defect: AgileDefect): Record<string, unknown> {
  return {
    defectId: defect.defectId,
    severity: defect.severity,
    title: defect.title,
    description: defect.description,
    priority: defect.priority,
    labels: defect.labels,
    selector: defect.selector,
    testFile: defect.testFile,
    expected: defect.expected,
    actual: defect.actual,
    steps: defect.steps,
    environment: Object.fromEntries(defect.environmentRows.map((row) => [row.label, row.value])),
    suggestion: defect.suggestion,
  }
}

/**
 * GitHub Issues: mismo contrato que Jira (buscar por defectId → crear o comentar), pero el
 * cuerpo viaja en Markdown plano, que es lo que la API espera — sin ADF ni conversión.
 *
 * La sugerencia va en el cuerpo del issue y no como comentario aparte: en GitHub un issue
 * recién creado con un comentario inmediato genera dos notificaciones para lo mismo. Cuando el
 * issue ya existe, ahí sí corresponde comentar, porque es información nueva sobre algo viejo.
 */
async function reportToGithub(
  defects: AgileDefect[],
  run: LocalRun,
  agile: ResolvedAgileConfig,
  fetchImpl: typeof fetch
): Promise<AgileOutcome[]> {
  const client = createGithubIssuesClient(agile, fetchImpl)
  const outcomes: AgileOutcome[] = []

  for (let i = 0; i < defects.length; i++) {
    const defect = defects[i]
    const c = run.cases[i]
    try {
      const existing = await client.searchByDefectId(defect.defectId)
      if (existing !== null) {
        await client.addComment(existing, buildSuggestionComment(c))
        outcomes.push({ case: c, action: 'existing', key: `#${existing}` })
      } else {
        const number = await client.createIssue({
          title: defect.title,
          body: `${defect.description}\n\n---\n\n${buildSuggestionComment(c)}`,
          labels: defect.labels,
        })
        outcomes.push({ case: c, action: 'created', key: `#${number}` })
      }
    } catch (error) {
      outcomes.push({ case: c, action: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return outcomes
}

/**
 * Orquestador: reporta cada defecto de la corrida al provider configurado.
 *
 * - Jira: `searchByDefectId` → si existe, `existing` (no se duplica); si no, `createIssue` +
 *   `addComment` con la sugerencia → `created`.
 * - GitHub: mismo contrato, con Markdown en vez de ADF.
 * - Webhook: POST del payload → `sent` (el create-or-update lo hace el receptor).
 * - Un fallo por defecto → `failed`, sin tirar la corrida completa: un 503 del gestor nunca
 *   debe hacer que se pierda el reporte local.
 */
export async function reportDefects(
  run: LocalRun,
  config: HealifyConfig = {},
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<AgileReportResult> {
  const agile = resolveAgile(config)
  if (!agile.enabled) return { enabled: false, provider: agile.provider, outcomes: [] }

  const defects = buildAgileDefects(run, config)
  const outcomes: AgileOutcome[] = []
  const failAll = (message: string): AgileReportResult => ({
    enabled: true,
    provider: agile.provider,
    outcomes: defects.map((_, i) => ({ case: run.cases[i], action: 'failed' as const, message })),
  })

  if (agile.provider === 'webhook') {
    if (!agile.webhookUrl) {
      return failAll('Falta agile.webhookUrl para el provider webhook.')
    }
    for (const defect of defects) {
      try {
        await postJson(agile.webhookUrl, webhookPayload(defect), fetchImpl)
        outcomes.push({ case: run.cases[defects.indexOf(defect)], action: 'sent' })
      } catch (error) {
        outcomes.push({
          case: run.cases[defects.indexOf(defect)],
          action: 'failed',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return { enabled: true, provider: agile.provider, outcomes }
  }

  if (agile.provider === 'github') {
    if (!agile.repository || !agile.apiToken) {
      const missing = [!agile.repository ? 'repository' : '', !agile.apiToken ? 'apiToken' : ''].filter(Boolean).join('/')
      return failAll(`Falta agile.${missing} para reportar a GitHub Issues.`)
    }
    return { enabled: true, provider: 'github', outcomes: await reportToGithub(defects, run, agile, fetchImpl) }
  }

  if (!agile.baseUrl || !agile.email || !agile.apiToken) {
    const missing = [!agile.baseUrl ? 'baseUrl' : '', !agile.email ? 'email' : '', !agile.apiToken ? 'apiToken' : '']
      .filter(Boolean)
      .join('/')
    return failAll(`Falta agile.${missing} para reportar a Jira.`)
  }

  const client = createJiraClient(agile, fetchImpl)
  for (let i = 0; i < defects.length; i++) {
    const defect = defects[i]
    const c = run.cases[i]
    try {
      const existing = await client.searchByDefectId(agile.project ?? '', defect.defectId)
      if (existing) {
        outcomes.push({ case: c, action: 'existing', key: existing })
      } else {
        const key = await client.createIssue({
          project: agile.project ?? '',
          issueType: agile.issueType,
          summary: defect.title,
          description: defect.description,
          priority: defect.priority,
          labels: defect.labels,
        })
        await client.addComment(key, buildSuggestionComment(c))
        outcomes.push({ case: c, action: 'created', key })
      }
    } catch (error) {
      outcomes.push({ case: c, action: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { enabled: true, provider: 'jira', outcomes }
}
