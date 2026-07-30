/**
 * Shape del mensaje que viaja por `cy.task()` entre el browser (support.ts) y el proceso
 * Node del plugin (plugin.ts). Cypress corre esos dos mundos en procesos separados — este
 * archivo es el único punto de acuerdo entre ambos, sin runtime propio (solo tipos), para
 * que support.ts pueda importarlo sin arrastrar nada de Node/reporter-core a su bundle de
 * browser.
 */

export interface HealTaskInput {
  selector: string
  testFile?: string
  pageElements: unknown
}

export interface HealTaskOutput {
  fixedSelector: string
  confidence: number
  verified: boolean
  fromRepertoire: boolean
  explanation: string
  locator: { strategy: 'css' | 'xpath' | 'unsupported'; value: string | null }
}

export type RecordEventType = 'healed' | 'no-suggestion' | 'not-convertible' | 'failed' | 'error'

export interface RecordEventInput {
  type: RecordEventType
  originalSelector: string
  testFile?: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  verified?: boolean
  fromRepertoire?: boolean
}
