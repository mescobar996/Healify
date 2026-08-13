import {
  analyzeAndHeal,
  BROWSER_PROBE_SCRIPT,
  domContextFromProbeResult,
  resolveLocatorStrategy,
  parseRoleSuggestion,
  BROWSER_FIND_BY_ROLE_SCRIPT,
  type HistoryEntry,
} from '@healify/reporter-core'
import { wdioSelectorToSelector } from './locator'
import { DEFAULT_CONFIDENCE_THRESHOLD, type HealifyWebdriverIOOptions, type HealingEvent } from './types'

/**
 * Bug real encontrado verificando contra un chromedriver de verdad (no en teoría): con
 * WebdriverIO 9.x, el mensaje real al fallar un `.click()` sobre un elemento inexistente es
 * `Can't call click on element with selector "..." because element wasn't found` — ninguno de
 * los cuatro patrones de abajo lo reconocía ("elemento wasn't found" ≠ "element not found"), así
 * que el healing nunca se disparaba en la práctica con esta versión, aunque los tests con mocks
 * pasaran igual (los mocks usaban el wording viejo). Se agrega el patrón real sin sacar los
 * anteriores, por si otra versión de wdio o del driver usa un wording distinto.
 */
function isNoElementError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('can\'t find element') ||
    msg.includes('no such element') ||
    msg.includes('element not found') ||
    msg.includes('doesn\'t match any element') ||
    (msg.includes('element') && (msg.includes('wasn\'t found') || msg.includes('was not found')))
}

interface WdioBrowser {
  $(selector: string): unknown
  execute: (...args: unknown[]) => Promise<unknown>
  [key: string]: unknown
}

/** Valida estructuralmente (y sin `instanceof`, que cae en realms distintos) que un valor crudo del browser es un elemento envuelble. */
function isWdioElement(value: unknown): value is WdioElement {
  return typeof value === 'object' && value !== null
}

interface WdioElement {
  then?: unknown
  [key: string]: unknown
}

/**
 * Envuelve un browser de WebdriverIO en un proxy que intercepta las llamadas a $()
 * y cura selectores rotos usando analyzeAndHeal() de @healify/reporter-core.
 *
 * WebdriverIO es lazy: $() no tira error hasta que se interactúa con el elemento.
 * El proxy intercepta el retorno de $() y wrappea sus métodos de interacción
 * (click, setValue, getText, etc.) para capturar el error en el momento correcto.
 */
export function wrapBrowser(browser: WdioBrowser, options: HealifyWebdriverIOOptions = {}, repertoire: HistoryEntry[] = []): WdioBrowser {
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD
  const events: HealingEvent[] = []

  function emit(event: HealingEvent): void {
    events.push(event)
    options.onEvent?.(event)
  }

  function wrapElement(el: WdioElement, originalSelector: string, isHealed = false): WdioElement {
    const interactionMethods = ['click', 'setValue', 'addValue', 'getText', 'getAttribute',
      'waitForExist', 'waitForDisplayed', 'waitForClickable', 'isExisting', 'isDisplayed',
      'getHTML', 'getLocation', 'getSize']

    const wrapped: Record<string, unknown> = {}
    for (const prop of interactionMethods) {
      const method = el[prop]
      if (typeof method === 'function') {
        wrapped[prop] = function (...args: unknown[]) {
          try {
            const result = method.apply(el, args)
            // WebdriverIO v9 returns thenables — catch rejections
            if (result && typeof result.then === 'function') {
              return result.catch((err: unknown) => {
                if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector)
                throw err
              })
            }
            return result
          } catch (err) {
            if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector)
            throw err
          }
        }
      } else {
        wrapped[prop] = method
      }
    }

    // Preserve thenable behavior for chaining
    if (typeof el.then === 'function') {
      wrapped.then = el.then
    }

    return wrapped
  }

  async function tryHeal(originalSelector: string): Promise<unknown> {
    const start = Date.now()
    const selector = wdioSelectorToSelector(originalSelector)
    if (selector === null) {
      emit({ type: 'not-convertible', originalSelector, latencyMs: Date.now() - start })
      throw new Error(`Healify: selector '${originalSelector}' is not convertible to CSS/XPath`)
    }

    // WebdriverIO tiene el browser vivo en la mano, a diferencia de Playwright (que necesita
    // que el framework le regale un archivo con el snapshot posterior al fallo). Se consulta
    // el DOM real en el momento exacto del fallo, vía execute(). Si tira (sesión rara, browser
    // que no soporta JS) se degrada limpio a la heurística a ciegas de siempre — mismo criterio
    // que Playwright sin el attachment.
    let domContext: string | undefined
    try {
      domContext = domContextFromProbeResult(await browser.execute(BROWSER_PROBE_SCRIPT))
    } catch {
      domContext = undefined
    }

    let result: ReturnType<typeof analyzeAndHeal>
    try {
      result = analyzeAndHeal({ selector, htmlContext: domContext, repertoire })
    } catch (healErr) {
      const message = healErr instanceof Error ? healErr.message : String(healErr)
      emit({ type: 'error', originalSelector: selector, explanation: message, latencyMs: Date.now() - start })
      throw new Error(`Healify: heuristic error for '${selector}': ${message}`)
    }

    if (result.confidence < threshold) {
      emit({ type: 'no-suggestion', originalSelector: selector, confidence: result.confidence, latencyMs: Date.now() - start })
      throw new Error(`Healify: no confident suggestion for '${selector}' (confidence: ${result.confidence})`)
    }

    // Las sugerencias de rol (`role('button', { name: 'Comprar' })`) no son CSS — Playwright
    // las interpreta con su propio motor de locators, WebdriverIO no. resolveLocatorStrategy
    // (reporter-core) convierte eso a un XPath real que busca por el mismo criterio de
    // nombre que usó el sondeo del DOM, así encuentra el mismo elemento que originó la
    // sugerencia. $() de wdio autodetecta XPath por el '//' inicial, no hace falta ningún
    // wrapper. Misma función que usa `healify heal` para dar servicio a otros lenguajes.
    const resolution = resolveLocatorStrategy(result.fixedSelector)
    const retrySelector = resolution.strategy === 'unsupported' ? null : resolution.value

    if (!retrySelector) {
      emit({ type: 'no-suggestion', originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start })
      throw new Error(`Healify: suggestion '${result.fixedSelector}' is not locatable for WebdriverIO`)
    }

    if (options.dryRun) {
      emit({ type: 'healed', originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, verified: result.verified, latencyMs: Date.now() - start })
      throw new Error(`Healify: would fix '${selector}' → '${result.fixedSelector}' (dry run)`)
    }

    // Try the healed selector — get the element from the ORIGINAL browser (not wrapped)
    // so we can detect if the healed selector itself fails.
    let healedEl: WdioElement
    try {
      healedEl = await resolveHealedElement(browser, result.fixedSelector, retrySelector)
    } catch {
      emit({ type: 'failed', originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start })
      throw new Error(`Healify: healed selector '${result.fixedSelector}' also failed for '${selector}'`)
    }

    emit({ type: 'healed', originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, verified: result.verified, latencyMs: Date.now() - start })

    // Wrap the healed element with isHealed=true to prevent infinite re-healing.
    // If the user's interaction with the healed element fails, let the error propagate as-is.
    return wrapElement(healedEl, result.fixedSelector, true)
  }

  /** Resuelve el elemento curado: primero el buscador que atraviesa shadow DOM, después el selector. `$()` resuelve por CSS o XPath, y ninguno cruza un shadow root. */
  async function resolveHealedElement(browser: WdioBrowser, fixedSelector: string, retrySelector: string): Promise<WdioElement> {
    const parsedRole = parseRoleSuggestion(fixedSelector)
    if (parsedRole?.name) {
      try {
        const found = await browser.execute(BROWSER_FIND_BY_ROLE_SCRIPT, parsedRole.role, parsedRole.name)
        if (isWdioElement(found)) return found
      } catch {
        // se degrada al selector normal — mismo criterio que Selenium.
      }
    }
    const bySelector = browser.$(retrySelector)
    if (isWdioElement(bySelector)) return bySelector
    throw new Error(`Healify: healed selector '${fixedSelector}' resolved to nothing in the DOM`)
  }

  return new Proxy(browser, {
    get(target, prop, receiver) {
      if (prop === '$') {
        return function (selector: string) {
          const el = target.$(selector)
          return wrapElement(isWdioElement(el) ? el : {}, selector)
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
