import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildAuditEntry, writeAuditReport } from './audit'
import { renderLocalReportJson, buildLocalRunFromEvents } from './local-report'
import type { HealResponse, SelectorType } from './healing-engine'
import type { AuditEntry } from './audit'

/**
 * Evento de healing emitido por cualquier adapter (Selenium, WebdriverIO, etc.).
 * Compartido entre plugins para no duplicar la interfaz.
 */
export interface PluginHealingEvent {
  type: 'healed' | 'no-suggestion' | 'not-convertible' | 'failed' | 'error'
  originalSelector: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  latencyMs: number
  verified?: boolean
}

const MAX_AUDIT_ENTRIES = 1000

/**
 * Construye un AuditEntry a partir de un HealingEvent del plugin.
 * Extraído de selenium-plugin y webdriverio-plugin para eliminar duplicación.
 */
export function buildAuditFromEvent(
  event: PluginHealingEvent,
  existingEntries: AuditEntry[]
): void {
  // Cap array size to prevent unbounded memory growth in long test suites
  if (existingEntries.length >= MAX_AUDIT_ENTRIES) return

  try {
    const selectorType: SelectorType = event.fixedSelector
      ? event.fixedSelector.startsWith('//') || event.fixedSelector.startsWith('(')
        ? 'XPATH'
        : 'CSS'
      : 'CSS'

    const response: HealResponse = {
      fixedSelector: event.fixedSelector ?? event.originalSelector,
      confidence: event.confidence ?? 0,
      verified: event.verified ?? false,
      fromRepertoire: false,
      explanation: event.explanation ?? '',
      selectorType,
      needsReview: false,
      robustnessImprovement: 0,
      alternatives: [],
      technicalDetails: {
        detectedIssue: `${event.type}: ${event.originalSelector}`,
        proposedSolution: event.explanation ?? '',
        accessibilityCompliant: false,
        stableAgainstDOMChanges: false,
      },
    }

    const entry = buildAuditEntry(
      response,
      { selector: event.originalSelector },
      { errorMessage: `${event.type}: ${event.originalSelector}` }
    )
    existingEntries.push(entry)
  } catch {
    // Nunca romper la corrida por un fallo del audit.
  }
}

/**
 * Escribe healify-report.json y healify-audit.json desde el estado acumulado del plugin.
 * Compartido entre selenium-plugin y webdriverio-plugin para eliminar duplicación.
 */
export function flushPlugin(
  events: PluginHealingEvent[],
  auditEntries: AuditEntry[],
  cwd: string,
  projectName: string,
  framework: string
): number {
  if (events.length === 0) return 0

  const run = buildLocalRunFromEvents(events, { project: projectName, framework })

  writeFileSync(join(cwd, 'healify-report.json'), renderLocalReportJson(run))
  const count = run.cases.length
  events.length = 0

  if (auditEntries.length > 0) {
    writeAuditReport([...auditEntries], cwd, projectName, framework)
    auditEntries.length = 0
  }

  return count
}
