import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderLocalReportJson, type LocalRun, type LocalCaseResult } from '@healify/reporter-core'
import { wrapBrowser } from './wrap'
import type { HealifyWebdriverIOOptions, HealingEvent } from './types'

export class HealifyWebdriverIOPlugin {
  private readonly options: HealifyWebdriverIOOptions
  private readonly events: HealingEvent[] = []

  constructor(options: HealifyWebdriverIOOptions = {}) {
    this.options = {
      ...options,
      onEvent: (event: HealingEvent) => {
        this.events.push(event)
        options.onEvent?.(event)
      },
    }
  }

  /** Devuelve un proxy sobre el browser — el original nunca se muta. */
  wrap(browser: ReturnType<typeof wrapBrowser> extends infer T ? Record<string, unknown> : never): Record<string, unknown> {
    return wrapBrowser(browser as any, this.options) as unknown as Record<string, unknown>
  }

  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada.
   * Mismo formato que Playwright/Cypress/Selenium.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd: string = process.cwd()): number {
    if (this.events.length === 0) return 0

    const cases: LocalCaseResult[] = this.events.map((e) => ({
      testName: e.originalSelector,
      selector: e.originalSelector,
      errorMessage: `${e.type}: ${e.originalSelector}`,
      status: (e.type === 'healed' ? 'healed' : e.type === 'no-suggestion' || e.type === 'failed' ? 'unresolved' : 'review') as LocalCaseResult['status'],
      fixedSelector: e.fixedSelector ?? '',
      confidence: e.confidence ?? 0,
      explanation: e.explanation ?? '',
      selectorType: e.type === 'healed' ? 'HEALED' : 'UNKNOWN',
    }))

    const run: LocalRun = {
      project: this.options.projectName ?? 'webdriverio-project',
      framework: 'WebdriverIO',
      generatedAt: new Date(),
      cases,
    }

    writeFileSync(join(cwd, 'healify-report.json'), renderLocalReportJson(run))
    const count = cases.length
    this.events.length = 0
    return count
  }
}
