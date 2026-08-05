import { readFileSync } from 'node:fs'
import {
  loadConfig,
  resolveAgile,
  reportDefects,
  buildAgileDefects,
  type LocalRun,
  type AgileOutcome,
  type AgileProvider,
  type AgileDefect,
} from '@healify/reporter-core'
import { describeReadError } from '../fix'

export interface ReportCommandResult {
  ok: boolean
  dryRun: boolean
  enabled: boolean
  provider: AgileProvider
  reportPath: string
  lines: string[]
}

function countBy(outcomes: AgileOutcome[]): Record<AgileOutcome['action'], number> {
  const counts = { created: 0, existing: 0, sent: 0, failed: 0 }
  for (const outcome of outcomes) counts[outcome.action] += 1
  return counts
}

function summaryText(outcomes: AgileOutcome[], provider: AgileProvider): string {
  const counts = countBy(outcomes)
  const parts: string[] = []
  if (counts.created > 0) parts.push(`${counts.created} creado${counts.created === 1 ? '' : 's'}`)
  if (counts.existing > 0) parts.push(`${counts.existing} ya existía${counts.existing === 1 ? '' : 'n'}`)
  if (counts.sent > 0) parts.push(`${counts.sent} enviado${counts.sent === 1 ? '' : 's'}`)
  if (counts.failed > 0) parts.push(`${counts.failed} fallido${counts.failed === 1 ? '' : 's'}`)
  const base = parts.length > 0 ? parts.join(' · ') : 'nada que reportar'
  return `${base} (${provider})`
}

function dryRunLines(defects: AgileDefect[], provider: AgileProvider): string[] {
  const lines = [`Healify report (dry run) — no se tocó la red.`]
  if (defects.length === 0) {
    lines.push('Ningún defecto en la corrida — no hay nada que reportar.')
    return lines
  }
  lines.push(`${defects.length} defecto${defects.length === 1 ? '' : 's'} que se reportaría${defects.length === 1 ? '' : 'n'} a ${provider}:`)
  for (const d of defects) {
    const name = d.title.replace(`[${d.defectId}] `, '')
    lines.push(`  [${d.defectId}] ${name} (${d.severity} → ${d.priority})`)
    if (d.testFile) lines.push(`    en: ${d.testFile} · selector ${d.selector}`)
  }
  lines.push('')
  // Quién dedupe cambia con el provider, y decirlo mal importa: con webhook, si el receptor no
  // implementa el create-or-update, el mismo selector roto abre un ticket por corrida de CI.
  lines.push(
    provider === 'webhook'
      ? 'Con webhook el dedupe lo hace el receptor, usando el defectId: si tu automatización no lo implementa, cada corrida crea un ticket nuevo.'
      : `Healify busca el defectId en ${provider} antes de crear: el mismo selector roto comenta en el ticket que ya existe, no abre otro.`
  )
  return lines
}

/**
 * `healify report [reporte.json] [--dry-run]` — cierra el loop "selector roto → ticket ágil".
 *
 * La lógica vive acá, separada de `index.ts` (que solo parsea args e imprime) — mismo patrón
 * que `commands/history.ts`. El reporte es opt-in: sin `agile.enabled: true` esto no hace
 * ningún fetch y lo dice en la salida.
 */
export async function runReport(args: string[], cwd: string = process.cwd()): Promise<ReportCommandResult> {
  const dryRun = args.includes('--dry-run')
  const reportPath = args.find((a) => !a.startsWith('--')) ?? 'healify-report.json'

  let run: LocalRun
  try {
    run = JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch (error) {
    const { message, exitCode, stream } = describeReadError(reportPath, error)
    void exitCode
    void stream
    return { ok: false, dryRun, enabled: false, provider: 'jira', reportPath, lines: [message] }
  }

  if (!run || typeof run !== 'object' || !Array.isArray((run as { cases?: unknown }).cases)) {
    return { ok: false, dryRun, enabled: false, provider: 'jira', reportPath, lines: [`${reportPath} no parece un healify-report.json válido (falta el array "cases").`] }
  }

  const config = loadConfig(cwd)
  const agile = resolveAgile(config)

  if (!agile.enabled) {
    return {
      ok: true,
      dryRun,
      enabled: false,
      provider: agile.provider,
      reportPath,
      lines: [
        'El reporte ágil está desactivado — no se tocó la red.',
        'Activá agile.enabled: true en healify.config.* (o HEALIFY_AGILE_ENABLED=true en CI) y configurá',
        'JIRA_EMAIL/JIRA_API_TOKEN o HEALIFY_WEBHOOK_URL. Ver README → "Reporte a herramientas ágiles".',
      ],
    }
  }

  if (dryRun) {
    return { ok: true, dryRun, enabled: true, provider: agile.provider, reportPath, lines: dryRunLines(buildAgileDefects(run, config), agile.provider) }
  }

  const result = await reportDefects(run, config)
  const failed = result.outcomes.filter((o) => o.action === 'failed')
  const lines = [summaryText(result.outcomes, result.provider)]
  for (const f of failed) {
    if (f.action === 'failed') lines.push(`  ${f.case.testFile} :: ${f.case.selector} → ${f.message}`)
  }
  return { ok: failed.length === 0, dryRun, enabled: true, provider: result.provider, reportPath, lines }
}
