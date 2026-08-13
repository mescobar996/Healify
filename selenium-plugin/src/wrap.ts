import type { WebDriver, WebElement, By } from 'selenium-webdriver'
import { By as SeleniumBy, error } from 'selenium-webdriver'
import {
  analyzeAndHeal,
  BROWSER_PROBE_SCRIPT,
  domContextFromProbeResult,
  resolveLocatorStrategy,
  parseRoleSuggestion,
  BROWSER_FIND_BY_ROLE_SCRIPT,
  type HistoryEntry,
} from '@healify/reporter-core'
import { locatorToSelector } from './locator'
import { DEFAULT_CONFIDENCE_THRESHOLD, type HealifySeleniumOptions, type HealingEvent } from './types'

/**
 * `instanceof` no alcanza acá, y de eso dependía que el adapter hiciera algo.
 *
 * Basta con que haya DOS instancias del módulo `selenium-webdriver` en juego (un monorepo, un
 * install de pnpm, dos versiones en el árbol) para que `err instanceof error.NoSuchElementError`
 * dé `false` sobre un error que sí es un NoSuchElementError: la clase existe dos veces y las
 * referencias no coinciden. El síntoma era silencioso y total — el wrapper salía por esta guarda
 * antes de sondear nada, y Healify no curaba absolutamente nunca. Encontrado corriendo Selenium
 * de verdad (examples/selenium-live-heal), no en los tests unitarios: ahí el mock y el plugin
 * comparten instancia y `instanceof` funciona siempre.
 *
 * El nombre del error sí es estable entre instancias, así que se chequea eso además.
 */
function isNoSuchElementError(err: unknown): boolean {
  if (err instanceof error.NoSuchElementError) return true
  if (typeof err !== 'object' || err === null) return false
  if ('name' in err && err.name === 'NoSuchElementError') return true
  return hasConstructorName(err, 'NoSuchElementError')
}

/** Busca `constructor.name` en la cadena de prototipos — cubre el caso de un error de otro realm, donde `instanceof` no aplica. */
function hasConstructorName(value: object, target: string): boolean {
  let proto: unknown = Object.getPrototypeOf(value)
  for (let depth = 0; proto !== null && depth < 3; depth++) {
    if (typeof proto !== 'object' || proto === null) break
    if ('constructor' in proto) {
      const ctor: unknown = proto.constructor
      if (typeof ctor === 'object' && ctor !== null && 'name' in ctor && ctor.name === target) return true
    }
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

/** Mejor esfuerzo para describir un locator no convertible en el evento emitido — no es un selector real, solo para logging. */
function rawLocatorValue(locator: By): string {
  if (typeof locator === 'object' && locator !== null && 'value' in locator && typeof locator.value === 'string') {
    return locator.value
  }
  return String(locator)
}

/**
 * Envuelve un WebDriver de Selenium en un proxy que cura findElement() en
 * vivo usando analyzeAndHeal() de @healify/reporter-core — el mismo motor
 * que usan test-runner/cypress-plugin. No reimplementa heurística.
 */
export function wrapDriver(driver: WebDriver, options: HealifySeleniumOptions = {}, repertoire: HistoryEntry[] = []): WebDriver {
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
        result = analyzeAndHeal({ selector, htmlContext: domContext, repertoire })
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
      // las interpreta con su propio motor de locators, Selenium no. resolveLocatorStrategy
      // (reporter-core) convierte eso a un XPath real que busca por el mismo criterio de
      // nombre que usó el sondeo del DOM, así encuentra el mismo elemento que originó la
      // sugerencia. El resto (TESTID/CSS/CLASS) sigue el camino CSS de siempre. Misma función
      // que usa `healify heal` para dar servicio a otros lenguajes — una sola fuente de verdad.
      const resolution = resolveLocatorStrategy(result.fixedSelector)
      const retryLocator =
        resolution.strategy === 'xpath'
          ? SeleniumBy.xpath(resolution.value!)
          : resolution.strategy === 'css'
            ? SeleniumBy.css(resolution.value!)
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
        // Primero el buscador que atraviesa shadow DOM, y solo despues el locator. Ni CSS ni
        // XPath cruzan la frontera de un shadow root: sin esto, una curacion correcta sobre un
        // elemento de un web component se pierde justo en el ultimo paso — el sondeo lo ve, la
        // sugerencia es la buena, y `findElement` no lo encuentra. Verificado corriendo Selenium
        // de verdad contra un <save-panel> (examples/selenium-live-heal).
        const healedElement = (await findAcrossShadowRoots(driver, result.fixedSelector))
          ?? (await driver.findElement(retryLocator))
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
      } catch {
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


/**
 * Busca el elemento por rol + nombre accesible caminando shadow roots abiertos e iframes
 * same-origin, con el mismo criterio que uso el sondeo para identificarlo.
 *
 * `null` cuando la sugerencia no es de rol, no tiene nombre, o el script no encuentra nada: ahi
 * el caller sigue con el locator CSS/XPath de siempre.
 */
async function findAcrossShadowRoots(
  driver: WebDriver,
  fixedSelector: string
): Promise<WebElement | null> {
  const parsed = parseRoleSuggestion(fixedSelector)
  if (!parsed?.name) return null
  try {
    // executeScript devuelve un WebElement cuando el script retorna un nodo del DOM.
    const el = await driver.executeScript<WebElement | null>(BROWSER_FIND_BY_ROLE_SCRIPT, parsed.role, parsed.name)
    return el ?? null
  } catch {
    return null
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
