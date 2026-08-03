import type { WebDriver } from 'selenium-webdriver'
import {
  readRepertoire,
  buildAuditFromEvent,
  flushPlugin,
  type HistoryEntry,
  type AuditEntry,
  type PluginHealingEvent,
} from '@healify/reporter-core'
import { wrapDriver } from './wrap'
import type { HealifySeleniumOptions } from './types'

export class HealifySeleniumPlugin {
  private readonly options: HealifySeleniumOptions
  private readonly events: PluginHealingEvent[] = []
  private readonly auditEntries: AuditEntry[] = []
  // Se lee una sola vez, al construir el plugin — no por cada findElement() que falla. Solo
  // entra en juego cuando esta corrida no pudo verificar nada por su cuenta (ver el comentario
  // de cabecera de reporter-core/src/repertoire.ts).
  private readonly repertoire: HistoryEntry[]

  constructor(options: HealifySeleniumOptions = {}) {
    this.options = {
      ...options,
      onEvent: (event) => {
        this.events.push(event)
        try {
          buildAuditFromEvent(event, this.auditEntries)
        } catch {
          // Nunca romper la corrida por un fallo del audit.
        }
        options.onEvent?.(event)
      },
    }
    this.repertoire = readRepertoire(process.cwd())
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
    return flushPlugin(
      this.events,
      this.auditEntries,
      cwd,
      this.options.projectName ?? 'selenium-project',
      'Selenium'
    )
  }
}
