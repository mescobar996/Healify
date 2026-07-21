import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import {
  resolveConfig,
  reportFailure,
  extractSelectorFromError,
  ATTACHMENT_NAME,
  runLocalHealing,
  renderLocalReportHtml,
  renderLocalReportJson,
  type HealifyConfig,
  type LocalCaseResult,
} from '@healify/reporter-core'

/**
 * Sin HEALIFY_API_KEY no hay cuenta ni servidor — en vez de quedar en no-op,
 * el reporter corre la heurística local (sin red) y al final de la corrida
 * escribe healify-report.html/json en el directorio de trabajo.
 */
export default class HealifyReporter implements Reporter {
  private config: HealifyConfig | null
  private localResults: LocalCaseResult[] = []

  constructor() {
    this.config = resolveConfig()
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    const errorMessage = result.error?.message ?? result.errors[0]?.message ?? result.error?.value ?? result.errors[0]?.value ?? 'Unknown error'
    const testName = test.titlePath().filter(Boolean).join(' > ')
    const testFile = test.location.file

    if (this.config) {
      const domAttachment = result.attachments.find((a) => a.name === ATTACHMENT_NAME)
      const context = domAttachment?.body?.toString('utf-8')

      void reportFailure(this.config, {
        testName,
        testFile,
        selector: extractSelectorFromError(errorMessage),
        error: errorMessage,
        context,
      })
      return
    }

    try {
      this.localResults.push(runLocalHealing({ testName, testFile, errorMessage }))
    } catch {
      // Nunca romper la corrida real por un fallo del healing local.
    }
  }

  onEnd(): void {
    if (this.config || this.localResults.length === 0) return

    try {
      const run = { project: 'Playwright suite', framework: 'Playwright', generatedAt: new Date(), cases: this.localResults }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
    } catch {
      // Fire-and-forget: el reporte local nunca debe romper la corrida.
    }
  }
}
