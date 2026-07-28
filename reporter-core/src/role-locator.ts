/**
 * Convierte una sugerencia de rol (`role('button', { name: 'Comprar' })`) en un locator que
 * Selenium/WebdriverIO puedan ejecutar de verdad.
 *
 * Playwright interpreta ese formato con su propio motor de locators (`getByRole`); Selenium y
 * WebdriverIO no tienen equivalente — necesitan un selector CSS o XPath real para `By.xpath()`
 * / `$()`. El mapeo de abajo construye un XPath que busca por el mismo criterio de nombre
 * accesible que usa `browser-probe.ts` para identificar elementos en vivo (texto visible,
 * aria-label, placeholder, value): el elemento que este XPath encuentra es, en la inmensa
 * mayoría de los casos, el mismo que originó la sugerencia.
 */

import { isPlaywrightOnlySelector } from './selector-compat'

/**
 * `role('button', { name: 'X' })` o `role('button')` → sus partes.
 *
 * Extraída tal cual — mismo regex, cero cambio de comportamiento — de la función interna que
 * ya usaba `healing-engine.ts` para confrontar sugerencias contra la página. Vive acá para que
 * los plugins de Selenium/WebdriverIO también la puedan usar, sin duplicar el regex.
 */
export function parseRoleSuggestion(selector: string): { role: string; name?: string } | null {
  const withName = selector.match(/^role\('([^']+)',\s*\{\s*name:\s*'([^']*)'\s*\}\s*\)$/)
  if (withName) return { role: withName[1], name: withName[2] }

  const roleOnly = selector.match(/^role\('([^']+)'\)$/)
  return roleOnly ? { role: roleOnly[1] } : null
}

/**
 * Literal de XPath 1.0 seguro para cualquier texto, incluso con comillas simples y dobles
 * mezcladas (XPath 1.0 no tiene forma de escapar comillas dentro de un string). Truco estándar:
 * envolver en el tipo de comilla que el texto no tenga, o armar un `concat()` cuando tiene las
 * dos.
 */
function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"')) return `"${value}"`
  const parts = value.split("'").map((part) => `'${part}'`)
  return `concat(${parts.join(`, "'", `)})`
}

const ROLE_TO_XPATH: Record<string, (literal: string) => string> = {
  button: (l) =>
    `//button[normalize-space(.)=${l}] | //button[@aria-label=${l}] | ` +
    `//input[(@type='submit' or @type='button') and @value=${l}] | ` +
    `//*[@role='button'][normalize-space(.)=${l} or @aria-label=${l}]`,
  link: (l) => `//a[normalize-space(.)=${l}] | //a[@aria-label=${l}] | //*[@role='link'][normalize-space(.)=${l} or @aria-label=${l}]`,
  textbox: (l) =>
    `//input[@aria-label=${l}] | //input[@placeholder=${l}] | //textarea[@aria-label=${l}] | //textarea[@placeholder=${l}]`,
  checkbox: (l) => `//input[@type='checkbox'][@aria-label=${l}] | //*[@role='checkbox'][@aria-label=${l}]`,
  radio: (l) => `//input[@type='radio'][@aria-label=${l}] | //*[@role='radio'][@aria-label=${l}]`,
  searchbox: (l) => `//input[@type='search'][@aria-label=${l} or @placeholder=${l}]`,
}

/**
 * `null` cuando el rol no tiene un mapeo conocido, o el nombre está vacío — sin nombre no hay
 * nada confiable para buscar, y un XPath que matchee "cualquier botón" sería peor que no
 * sugerir nada.
 */
export function roleSuggestionToXPath(role: string, name: string): string | null {
  if (!name) return null
  const build = ROLE_TO_XPATH[role]
  return build ? build(xpathLiteral(name)) : null
}

export interface LocatorResolution {
  strategy: 'css' | 'xpath' | 'unsupported'
  value: string | null
}

/**
 * Qué locator ejecutable corresponde a una sugerencia del motor, sin importar quién pregunta.
 *
 * Antes vivía duplicada e inline en `selenium-plugin/src/wrap.ts` y
 * `webdriverio-plugin/src/wrap.ts` (mismo criterio, dos copias) — se extrajo acá para que la
 * compartan esos dos plugins JS y, ahora, cualquier lenguaje que llame a `healify heal` por
 * subproceso. Es la única fuente de verdad de "cómo convertir una sugerencia en algo que un
 * driver pueda ejecutar".
 *
 * - `role('X', { name: 'Y' })` con nombre → XPath (ver `roleSuggestionToXPath`).
 * - `role('X')` sin nombre → `unsupported` (nada confiable para buscar).
 * - Cualquier otra sintaxis Playwright-only (`:has-text()`, `visible=`, `getBy*(...)`) →
 *   `unsupported`: no es CSS real y no hay forma de convertirla a XPath.
 * - El resto (ya es CSS: TESTID, atributo, clase estable) → `css`, tal cual.
 */
export function resolveLocatorStrategy(fixedSelector: string): LocatorResolution {
  const roleSuggestion = parseRoleSuggestion(fixedSelector)
  if (roleSuggestion) {
    const xpath = roleSuggestion.name ? roleSuggestionToXPath(roleSuggestion.role, roleSuggestion.name) : null
    return xpath ? { strategy: 'xpath', value: xpath } : { strategy: 'unsupported', value: null }
  }

  if (isPlaywrightOnlySelector(fixedSelector)) return { strategy: 'unsupported', value: null }
  return { strategy: 'css', value: fixedSelector }
}
