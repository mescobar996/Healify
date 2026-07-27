/**
 * analyzeAndHeal() devuelve algunas sugerencias en sintaxis específica de Playwright
 * (role('button', {...}), button:has-text('X'), getByRole(...), o el fallback
 * visible=selector) — ninguna es CSS nativo válido para drivers que llaman directo al
 * motor CSS del browser (Selenium By.css(), WebdriverIO $()). Antes duplicado 1:1 en
 * selenium-plugin/src/locator.ts y webdriverio-plugin/src/locator.ts.
 */
export function isPlaywrightOnlySelector(selector: string): boolean {
  return (
    /^role\(/.test(selector) ||
    selector.includes(':has-text(') ||
    /^visible=/.test(selector) ||
    /^getBy[A-Z]/.test(selector)
  )
}
