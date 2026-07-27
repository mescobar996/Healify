import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderLocalReportJson, buildLocalRunFromEvents, readRepertoire, type HistoryEntry } from '@healify/reporter-core'
import { wrapBrowser } from './wrap'
import type { HealifyWebdriverIOOptions, HealingEvent } from './types'

export class HealifyWebdriverIOPlugin {
  private readonly options: HealifyWebdriverIOOptions
  private readonly events: HealingEvent[] = []
  // Se lee una sola vez, al construir el plugin. Solo entra en juego cuando esta corrida no
  // pudo verificar nada por su cuenta (ver reporter-core/src/repertoire.ts).
  private readonly repertoire: HistoryEntry[]

  constructor(options: HealifyWebdriverIOOptions = {}) {
    this.options = {
      ...options,
      onEvent: (event: HealingEvent) => {
        this.events.push(event)
        options.onEvent?.(event)
      },
    }
    this.repertoire = readRepertoire(process.cwd())
  }

  /**
   * Devuelve un proxy sobre el browser — el original nunca se muta.
   *
   * Genérico a propósito: `WebdriverIO.Browser` es una interfaz sin index signature, así que
   * no es asignable a `Record<string, unknown>` y tiparlo así rompía el uso real (ver
   * healify.wdio.example.ts). Con `<T extends object>` el usuario además conserva el tipado
   * y el autocompletado de su propio browser, que es lo que el proxy devuelve en runtime.
   */
  wrap<T extends object>(browser: T): T {
    return wrapBrowser(browser as unknown as Parameters<typeof wrapBrowser>[0], this.options, this.repertoire) as unknown as T
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
