import type { By } from 'selenium-webdriver'

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
  const raw = locator as unknown as RawLocator
  if (typeof raw.using !== 'string' || typeof raw.value !== 'string') return null

  if (raw.using === 'css selector') {
    const idMatch = raw.value.match(ID_ATTRIBUTE_PATTERN)
    if (idMatch) return `#${idMatch[1]}`
    return raw.value
  }

  if (raw.using === 'xpath') return raw.value

  return null
}
