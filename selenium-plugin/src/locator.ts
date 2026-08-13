import type { By } from 'selenium-webdriver'
import { isPlaywrightOnlySelector } from '@healify/reporter-core'

/** Las únicas dos propiedades públicas y estables que expone el constructor de By (lib/by.js) — using/value, no hay tipo runtime más específico que inspeccionar. */
interface RawLocator {
  using: string
  value: string
}

// El .* greedy es seguro porque By.id() ya pasó el valor por escapeCss() de Selenium
// (lib/by.js), que escapa comillas y backslashes antes de armar el atributo — nunca hay
// una comilla sin escapar dentro del valor que pueda generar un split ambiguo.
const ID_ATTRIBUTE_PATTERN = /^\*\[id="(.*)"\]$/

/**
 * Convierte un locator de Selenium a un selector-string que analyzeAndHeal()
 * sabe interpretar. Devuelve null cuando el locator no tiene equivalente
 * limpio (linkText/partialLinkText/tagName) — el llamador debe tratar null
 * como "no convertible", nunca inventar una heurística nueva acá.
 */
export function locatorToSelector(locator: By): string | null {
  const raw = rawLocator(locator)
  if (raw === null) return null

  if (raw.using === 'css selector') {
    const idMatch = raw.value.match(ID_ATTRIBUTE_PATTERN)
    if (idMatch) return `#${idMatch[1]}`
    return raw.value
  }

  if (raw.using === 'xpath') return raw.value

  return null
}

/** Lee `using`/`value` del objeto `By` real (lib/by.js) con validación estructural, sin depender de su tipo estático. */
function rawLocator(locator: By): RawLocator | null {
  if (typeof locator !== 'object' || locator === null) return null
  if (!('using' in locator) || !('value' in locator)) return null
  if (typeof locator.using !== 'string' || typeof locator.value !== 'string') return null
  return { using: locator.using, value: locator.value }
}

/**
 * analyzeAndHeal() devuelve algunas sugerencias en sintaxis específica de Playwright
 * (role('button', {...}), button:has-text('X'), o el fallback visible=selector) — ninguna
 * es CSS nativo válido para By.css(), que llama directo al motor CSS del browser
 * (querySelectorAll). Mismo problema ya resuelto para @healify/cli fix
 * (cli/src/fix.ts, isSubstitutable) — acá el alcance es más amplio porque Selenium no
 * tiene el motor de Playwright para interpretarlas.
 */
export function isSeleniumCssCompatible(selector: string): boolean {
  return !isPlaywrightOnlySelector(selector)
}
