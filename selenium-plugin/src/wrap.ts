import type { WebDriver, WebElement, By } from 'selenium-webdriver'
import { By as SeleniumBy, error } from 'selenium-webdriver'
import { analyzeAndHeal } from '@healify/reporter-core'
import { locatorToSelector } from './locator'
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

      let result: ReturnType<typeof analyzeAndHeal>
      try {
        result = analyzeAndHeal({ selector })
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

      if (options.dryRun) {
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      try {
        const healedElement = await driver.findElement(SeleniumBy.css(result.fixedSelector))
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
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
