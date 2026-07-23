/**
 * Convierte un selector string de WebdriverIO a un selector que analyzeAndHeal() puede interpretar.
 * WebdriverIO usa strings directos (CSS, XPath, etc.) — no tiene la clase By de Selenium.
 */
export function wdioSelectorToSelector(selector: string): string | null {
  const trimmed = selector.trim()

  // WebdriverIO custom strategies: linkText=, partialText=, xpath=, etc. — not CSS-convertible
  if (/^[a-zA-Z]+=/.test(trimmed)) return null

  // CSS selectors: start with . # [ or a tag name
  if (/^[.#\[]/.test(trimmed) || /^[a-z][a-z0-9]*/i.test(trimmed)) return trimmed

  // XPath: starts with // or (//
  if (trimmed.startsWith('//') || trimmed.startsWith('(//')) return trimmed

  return null
}

/**
 * analyzeAndHeal() devuelve algunas sugerencias en sintaxis de Playwright
 * (role('button', {...}), button:has-text('X'), visible=..., getByRole(...)).
 * WebdriverIO no tiene motor de Playwright para interpretarlas — rechazar las que no son CSS válido.
 */
export function isWdioCssCompatible(selector: string): boolean {
  return (
    !/^role\(/.test(selector) &&
    !selector.includes(':has-text(') &&
    !/^visible=/.test(selector) &&
    !/^getBy[A-Z]/.test(selector)
  )
}
