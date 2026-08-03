import type { HealTaskInput, HealTaskOutput, RecordEventInput } from './support-protocol'

// Igual al piso que usan selenium-plugin/webdriverio-plugin (DEFAULT_CONFIDENCE_THRESHOLD en
// sus types.ts): acá no hay paso de revisión humana antes del retry, así que el piso para
// actuar solo debe ser el más alto que el motor define (0.9 = HEALED_THRESHOLD), no el de
// "a revisar" (0.8). No se importa la constante de reporter-core para no arrastrar ese
// paquete al bundle de browser — ver el comentario de import-type más abajo.
const DEFAULT_CONFIDENCE_THRESHOLD = 0.9

/**
 * Registra un listener global `Cypress.on('fail')` para capturar fallos de test y generar
 * entradas de auditoría. Se ejecuta una sola vez al importar el archivo de soporte.
 * Cada fallo con un selector extraído se envía a `plugin.ts` vía `cy.task()` para que
 * construya la entrada de auditoría en el proceso Node (donde `reporter-core` tiene acceso
 * a `node:fs` y `node:crypto`).
 */
function registerAuditHandler(): void {
  const seen = new Set<string>()
  Cypress.on('fail', (error: Error) => {
    const selector = error.message.match(/selector['":\s]+([^\s'"]+)/)?.[1]
    if (selector && !seen.has(selector)) {
      seen.add(selector)
      cy.task(
        'healify:audit-entry',
        {
          selector,
          error: error.message,
          url: Cypress.config('baseUrl'),
          html: '',
          stackTrace: error.stack || '',
        },
        { log: false }
      )
    }
    throw error
  })
}

registerAuditHandler()

export interface HealifyGetOptions {
  /** Milisegundos que se espera al selector original (poll) antes de intentar curarlo.
   * Default: `Cypress.config('defaultCommandTimeout')`, igual que `cy.get()`. */
  timeout?: number
  /** Confianza mínima (0-1) para probar la sugerencia. Default: 0.9. */
  confidenceThreshold?: number
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Como `cy.get()`, pero si el selector no aparece dentro del timeout, sondea el DOM
       * real de la página, pide una curación a Healify y reintenta con la sugerencia antes
       * de fallar el test. Ver docs/adapters o cypress-plugin/README.md.
       */
      healifyGet(selector: string, options?: HealifyGetOptions): Chainable<JQuery<HTMLElement>>
    }
  }
}

// Cypress no expone un gancho para envolver `cy.get()` sin pisar su motor de retry-ability
// interno — a diferencia de Selenium/WebdriverIO, donde `wrapDriver()`/`overwriteCommand()`
// interceptan una función que Healify llama directo. Por eso `healifyGet` es un comando nuevo,
// opt-in: se registra como efecto de importar este archivo (`import '@healify/cypress-plugin/support'`
// en el support file del proyecto), mismo criterio de "un import y listo" que el resto de Healify.
Cypress.Commands.add('healifyGet', (selector: string, options: HealifyGetOptions = {}) => {
  const timeout = options.timeout ?? (Cypress.config('defaultCommandTimeout') as number)
  const confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD
  return pollForSelector(selector, timeout).then(($el) => {
    if ($el && $el.length > 0) return cy.wrap($el, { log: false })
    return healAndRetry(selector, timeout, confidenceThreshold)
  })
})

/**
 * Sondeo manual del selector, no el retry-ability nativo de `cy.get()` (Cypress no lo expone
 * para reusarlo desde un comando custom sin duplicar su motor entero) — mismo espíritu: reintenta
 * hasta el timeout antes de asumir que el selector está roto, para no confundir "todavía no
 * renderizó" con "el selector ya no existe".
 */
function pollForSelector(selector: string, timeout: number): Cypress.Chainable<JQuery<HTMLElement> | null> {
  return cy.window({ log: false }).then(() => {
    return new Cypress.Promise<JQuery<HTMLElement> | null>((resolve) => {
      const deadline = Date.now() + timeout
      const tick = () => {
        let $el: JQuery<HTMLElement>
        try {
          $el = Cypress.$(selector)
        } catch {
          resolve(null)
          return
        }
        if ($el.length > 0) {
          resolve($el)
          return
        }
        if (Date.now() > deadline) {
          resolve(null)
          return
        }
        setTimeout(tick, 50)
      }
      tick()
    })
  })
}

let cachedProbeScript: string | null = null

/**
 * Sondea el DOM real en vivo (mismo criterio que Selenium/WebdriverIO: el browser ya está
 * abierto en la mano, no hace falta que ningún framework regale un snapshot post-mortem),
 * pide la curación a `healify:heal` y reintenta. Cae limpio a "no se pudo curar" cuando la
 * heurística no propone nada aprovechable — nunca inventa un elemento.
 */
function healAndRetry(selector: string, timeout: number, confidenceThreshold: number): Cypress.Chainable<JQuery<HTMLElement>> {
  const testFile = Cypress.spec?.relative

  const probe$ = cachedProbeScript
    ? cy.wrap(cachedProbeScript, { log: false })
    : cy.task<string>('healify:probe-script', null, { log: false, timeout }).then((script) => {
        cachedProbeScript = script
        return script
      })

  return probe$.then((script) => {
    return cy.window({ log: false }).then((win) => {
      let pageElements: unknown = []
      try {
        // `new Function(...)` a secas crea la función en el scope global del spec (la ventana
        // del test-runner de Cypress), no en el iframe de la app bajo test — `document`
        // resolvería al documento equivocado y el sondeo siempre volvería vacío. El
        // constructor `Function` de `win` (la ventana de la AUT que ya nos dio cy.window())
        // crea la función en ESE realm, así el `document` suelto del script cae en el
        // documento real de la página. Mismo cuerpo ES5 que reporter-core ya usa con
        // Selenium/WebdriverIO vía executeScript — acá corre en la misma ventana bajo test,
        // no en contenido de terceros.
        // eslint-disable-next-line no-new-func
        pageElements = new win.Function(script)()
      } catch {
        pageElements = []
      }

      const input: HealTaskInput = { selector, testFile, pageElements }
      return cy.task<HealTaskOutput>('healify:heal', input, { log: false, timeout }).then((healed) => {
        const noSuggestion =
          !healed || healed.confidence < confidenceThreshold || healed.locator.strategy === 'unsupported' || !healed.locator.value
        if (noSuggestion) {
          return recordEvent({
            type: 'no-suggestion',
            originalSelector: selector,
            testFile,
            fixedSelector: healed?.fixedSelector,
            confidence: healed?.confidence,
          }).then(() => {
            throw new Error(`Healify: no se pudo curar el selector roto "${selector}".`)
          })
        }

        const retryEl = resolveElement(win, healed.locator)
        if (!retryEl) {
          return recordEvent({
            type: 'failed',
            originalSelector: selector,
            testFile,
            fixedSelector: healed.fixedSelector,
            confidence: healed.confidence,
          }).then(() => {
            throw new Error(`Healify: la sugerencia "${healed.fixedSelector}" tampoco encontró el elemento.`)
          })
        }

        return recordEvent({
          type: 'healed',
          originalSelector: selector,
          testFile,
          fixedSelector: healed.fixedSelector,
          confidence: healed.confidence,
          explanation: healed.explanation,
          verified: healed.verified,
          fromRepertoire: healed.fromRepertoire,
        }).then(() => cy.wrap(Cypress.$(retryEl), { log: false }))
      })
    })
  })
}

function resolveElement(win: Cypress.AUTWindow, locator: HealTaskOutput['locator']): Element | null {
  if (locator.strategy === 'css') {
    try {
      return win.document.querySelector(locator.value as string)
    } catch {
      return null
    }
  }
  if (locator.strategy === 'xpath') {
    try {
      const result = win.document.evaluate(locator.value as string, win.document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      return result.singleNodeValue as Element | null
    } catch {
      return null
    }
  }
  return null
}

function recordEvent(event: RecordEventInput): Cypress.Chainable<null> {
  return cy.task('healify:record-event', event, { log: false })
}
