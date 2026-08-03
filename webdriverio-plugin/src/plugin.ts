import {
  readRepertoire,
  buildAuditFromEvent,
  flushPlugin,
  type HistoryEntry,
  type AuditEntry,
  type PluginHealingEvent,
} from '@healify/reporter-core'
import { wrapBrowser } from './wrap'
import type { HealifyWebdriverIOOptions } from './types'

export class HealifyWebdriverIOPlugin {
  private readonly options: HealifyWebdriverIOOptions
  private readonly events: PluginHealingEvent[] = []
  private readonly auditEntries: AuditEntry[] = []
  // Se lee una sola vez, al construir el plugin. Solo entra en juego cuando esta corrida no
  // pudo verificar nada por su cuenta (ver reporter-core/src/repertoire.ts).
  private readonly repertoire: HistoryEntry[]

  constructor(options: HealifyWebdriverIOOptions = {}) {
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
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada
   * (o desde el inicio si nunca se llamó). Mismo formato que Playwright/Cypress/Selenium.
   * También escribe healify-audit.json si hay entradas de auditoría.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd: string = process.cwd()): number {
    return flushPlugin(
      this.events,
      this.auditEntries,
      cwd,
      this.options.projectName ?? 'webdriverio-project',
      'WebdriverIO'
    )
  }
}
