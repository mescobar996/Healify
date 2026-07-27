import type { WebDriver, WebElement, By } from 'selenium-webdriver'
import { By as SeleniumBy, error } from 'selenium-webdriver'
import { analyzeAndHeal, BROWSER_PROBE_SCRIPT, domContextFromProbeResult, parseRoleSuggestion, roleSuggestionToXPath } from '@healify/reporter-core'
import { locatorToSelector, isSeleniumCssCompatible } from './locator'
import { DEFAULT_CONFIDENCE_THRESHOLD, type HealifySeleniumOptions, type HealingEvent } from './types'

function isNoSuchElementError(err: unknown): boolean {
  return err instanceof error.NoSuchElementError
}

/** Mejor esfuerzo para describir un locator no convertible en el evento emitido — no es un selector real, solo para logging. */
function rawLocatorValue(locator: By): string {
  const raw = locator as unknown as { value?: unknown }
  return typeof raw.value === 'string' ? raw.value : String(locator)
}

/**
 * Envuelve un WebDriver de Selenium en un proxy que cura findElement() en
 * vivo usando analyzeAndHeal() de @healify/reporter-core — el mismo motor
 * que usan test-runner/cypress-plugin. No reimplementa heurística.
 */
export function wrapDriver(driver: WebDriver, options: HealifySeleniumOptions = {}): WebDriver {
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD

  function emit(event: HealingEvent): void {
    options.onEvent?.(event)
  }

  async function findElement(locator: By): Promise<WebElement> {
    const start = Date.now()
    try {
      return await driver.findElement(locator)
    } catch (originalErr) {
      if (!isNoSuchElementError(originalErr)) throw originalErr

      const selector = locatorToSelector(locator)
      if (selector === null) {
        emit({ type: 'not-convertible', originalSelector: rawLocatorValue(locator), latencyMs: Date.now() - start })
        throw originalErr
      }

      // Selenium tiene el browser vivo en la mano, a diferencia de Playwright (que necesita
      // que el framework le regale un archivo con el snapshot posterior al fallo). Se consulta
      // el DOM real en el momento exacto del fallo, vía executeScript. Si tira (sesión rara,
      // browser que no soporta JS) se degrada limpio a la heurística a ciegas de siempre —
      // mismo criterio que Playwright sin el attachment.
      let domContext: string | undefined
      try {
        domContext = domContextFromProbeResult(await driver.executeScript(BROWSER_PROBE_SCRIPT))
      } catch {
        domContext = undefined
      }

      let result: ReturnType<typeof analyzeAndHeal>
      try {
        result = analyzeAndHeal({ selector, htmlContext: domContext })
      } catch (healErr) {
        const message = healErr instanceof Error ? healErr.message : String(healErr)
        emit({ type: 'error', originalSelector: selector, explanation: message, latencyMs: Date.now() - start })
        throw originalErr
      }

      if (result.confidence < threshold) {
        emit({
          type: 'no-suggestion',
          originalSelector: selector,
          confidence: result.confidence,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      // Las sugerencias de rol (`role('button', { name: 'Comprar' })`) no son CSS — Playwright
      // las interpreta con su propio motor de locators, Selenium no. Se convierten a un XPath
      // real que busca por el mismo criterio de nombre que usó el sondeo del DOM, así encuentra
      // el mismo elemento que originó la sugerencia. El resto (TESTID/CSS/CLASS) sigue el
      // camino CSS de siempre.
      const roleSuggestion = parseRoleSuggestion(result.fixedSelector)
      const roleXpath = roleSuggestion?.name ? roleSuggestionToXPath(roleSuggestion.role, roleSuggestion.name) : null
      const retryLocator = roleXpath
        ? SeleniumBy.xpath(roleXpath)
        : isSeleniumCssCompatible(result.fixedSelector)
          ? SeleniumBy.css(result.fixedSelector)
          : null

      if (!retryLocator) {
        emit({
          type: 'no-suggestion',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      if (options.dryRun) {
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
          verified: result.verified,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      try {
        const healedElement = await driver.findElement(retryLocator)
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
          verified: result.verified,
          latencyMs: Date.now() - start,
        })
        return healedElement
      } catch (retryErr) {
        emit({
          type: 'failed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }
    }
  }

  return new Proxy(driver, {
    get(target, prop, receiver) {
      // No .bind(target) here: findElement is a closure that already captures `driver` directly, unlike the passthrough methods below.
      if (prop === 'findElement') return findElement
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
