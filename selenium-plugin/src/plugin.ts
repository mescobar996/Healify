import type { WebDriver } from 'selenium-webdriver'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  renderLocalReportJson,
  buildLocalRunFromEvents,
  readRepertoire,
  buildAuditEntry,
  writeAuditReport,
  type HistoryEntry,
  type AuditEntry,
  type HealResponse,
  type SelectorType,
} from '@healify/reporter-core'
import { wrapDriver } from './wrap'
import type { HealifySeleniumOptions, HealingEvent } from './types'

export class HealifySeleniumPlugin {
  private readonly options: HealifySeleniumOptions
  private readonly events: HealingEvent[] = []
  private readonly auditEntries: AuditEntry[] = []
  // Se lee una sola vez, al construir el plugin — no por cada findElement() que falla. Solo
  // entra en juego cuando esta corrida no pudo verificar nada por su cuenta (ver el comentario
  // de cabecera de reporter-core/src/repertoire.ts).
  private readonly repertoire: HistoryEntry[]

  constructor(options: HealifySeleniumOptions = {}) {
    this.options = {
      ...options,
      onEvent: (event: HealingEvent) => {
        this.events.push(event)
        this.buildAuditFromEvent(event)
        options.onEvent?.(event)
      },
    }
    this.repertoire = readRepertoire(process.cwd())
  }

  private buildAuditFromEvent(event: HealingEvent): void {
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
      this.auditEntries.push(entry)
    } catch {
      // Nunca romper la corrida por un fallo del audit.
    }
  }

  /** Devuelve un proxy sobre el driver — el original nunca se muta. */
  wrap(driver: WebDriver): WebDriver {
    return wrapDriver(driver, this.options, this.repertoire)
  }

  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada
   * (o desde el inicio si nunca se llamó). Mismo formato que Playwright/Cypress.
   * También escribe healify-audit.json si hay entradas de auditoría.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd: string = process.cwd()): number {
    if (this.events.length === 0) return 0

    const run = buildLocalRunFromEvents(this.events, {
      project: this.options.projectName ?? 'selenium-project',
      framework: 'Selenium',
    })

    writeFileSync(join(cwd, 'healify-report.json'), renderLocalReportJson(run))
    const count = run.cases.length
    this.events.length = 0

    if (this.auditEntries.length > 0) {
      writeAuditReport(
        [...this.auditEntries],
        cwd,
        this.options.projectName ?? 'selenium-project',
        'Selenium'
      )
      this.auditEntries.length = 0
    }

    return count
  }
}
