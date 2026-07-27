import type { WebDriver } from 'selenium-webdriver'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderLocalReportJson, buildLocalRunFromEvents } from '@healify/reporter-core'
import { wrapDriver } from './wrap'
import type { HealifySeleniumOptions, HealingEvent } from './types'

export class HealifySeleniumPlugin {
  private readonly options: HealifySeleniumOptions
  private readonly events: HealingEvent[] = []

  constructor(options: HealifySeleniumOptions = {}) {
    this.options = {
      ...options,
      onEvent: (event: HealingEvent) => {
        this.events.push(event)
        options.onEvent?.(event)
      },
    }
  }

  /** Devuelve un proxy sobre el driver — el original nunca se muta. */
  wrap(driver: WebDriver): WebDriver {
    return wrapDriver(driver, this.options)
  }

  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada
   * (o desde el inicio si nunca se llamó). Mismo formato que Playwright/Cypress.
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
    return count
  }
}
