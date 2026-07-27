import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderLocalReportJson, buildLocalRunFromEvents } from '@healify/reporter-core'
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
  wrap(browser: Record<string, unknown>): Record<string, unknown> {
    return wrapBrowser(browser as any, this.options) as unknown as Record<string, unknown>
  }

  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada.
   * Mismo formato que Playwright/Cypress/Selenium.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd: string = process.cwd()): number {
    if (this.events.length === 0) return 0

    const run = buildLocalRunFromEvents(this.events, {
      project: this.options.projectName ?? 'webdriverio-project',
      framework: 'WebdriverIO',
    })

    writeFileSync(join(cwd, 'healify-report.json'), renderLocalReportJson(run))
    const count = run.cases.length
    this.events.length = 0
    return count
  }
}
