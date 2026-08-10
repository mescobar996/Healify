/**
 * Traduce una sugerencia del motor de Healify (`fixedSelector`) a la sintaxis de un framework.
 *
 * El motor propone en su propio dialecto: `role('button', { name: 'Ingresar' })`, selectores
 * CSS, XPath, y formas de Playwright (`getByRole`, `:has-text`, `visible=`). Ese dialecto no
 * se puede pegar en cualquier archivo — Cypress no entiende `getByRole` sin librería extra,
 * Selenium no tiene equivalente a `:has-text`, y `role(...)` no es un valor de selector en
 * ningún lado salvo como representación legible para el reporte.
 *
 * Acá se convierte, para cada framework, en algo que se pueda escribir literalmente en un
 * test. La conversión es 1:1 y determinista, y prioriza lo idiomático de cada framework sobre
 * una "forma universal" que no exista en ninguno.
 */

import { parseRoleSuggestion, roleSuggestionToXPath } from '@healify/reporter-core'

export type TestFramework = 'playwright' | 'cypress' | 'selenium' | 'webdriverio'

export const TEST_FRAMEWORKS: TestFramework[] = ['playwright', 'cypress', 'selenium', 'webdriverio']

export function isTestFramework(value: unknown): value is TestFramework {
  return typeof value === 'string' && (TEST_FRAMEWORKS as string[]).includes(value)
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Elige comillas simples o dobles según qué tenga el valor adentro; el caso con ambas se escapa. */
function wrap(value: string): string {
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"')) return `"${value}"`
  return `'${value.replace(/'/g, "\\'")}'`
}

/** Parsea `getByRole('X', { name: 'Y' })` y `getByText('X')` — las formas modernas de Playwright. */
function parseModernLocator(selector: string): { kind: 'role' | 'text' | 'testid' | 'label' | 'placeholder'; value: string; name?: string } | null {
  const role = selector.match(/^getByRole\(\s*'((?:[^'\\]|\\.)+)'\s*(?:,\s*\{\s*name:\s*'((?:[^'\\]|\\.)*)'\s*\}\s*)?\)$/)
  if (role) {
    return {
      kind: 'role',
      value: role[1].replace(/\\(.)/g, '$1'),
      ...(role[2] !== undefined ? { name: role[2].replace(/\\(.)/g, '$1') } : {}),
    }
  }
  const simple = selector.match(/^getBy(Text|TestId|Label|Placeholder)\(\s*'((?:[^'\\]|\\.)+)'\s*\)$/)
  if (simple) {
    const kind = (simple[1] === 'TestId' ? 'testid' : simple[1].toLowerCase()) as 'text' | 'testid' | 'label' | 'placeholder'
    return { kind, value: simple[2].replace(/\\(.)/g, '$1') }
  }
  return null
}

/** Extrae el tag y el texto de `tag:has-text('X')` / `label:has-text('X') + input`. */
function parseHasText(selector: string): { tag: string; text: string; sibling?: string } | null {
  const match = selector.match(/^([a-zA-Z]+):has-text\(\s*'((?:[^'\\]|\\.)*)'\s*\)\s*(?:\+\s*([a-zA-Z]+))?$/)
  return match ? { tag: match[1], text: match[2].replace(/\\(.)/g, '$1'), sibling: match[3] } : null
}

interface LocatorSpec {
  kind: 'role' | 'text' | 'testid' | 'label' | 'placeholder' | 'xpath' | 'label-input' | 'text-in-tag' | 'visible' | 'css'
  role?: string
  name?: string
  value: string
  tag?: string
  sibling?: string
}

function parseLocatorSpec(selector: string): LocatorSpec {
  const role = parseRoleSuggestion(selector)
  if (role) return { kind: 'role', role: role.role, name: role.name, value: role.name ?? role.role }

  const modern = parseModernLocator(selector)
  if (modern) return { ...modern, role: modern.kind === 'role' ? modern.value : undefined }

  if (selector.startsWith('//')) return { kind: 'xpath', value: selector }

  const hasText = parseHasText(selector)
  if (hasText) {
    if (hasText.sibling === 'input') return { kind: 'label-input', value: hasText.text, tag: hasText.tag }
    if (hasText.text !== undefined) return { kind: 'text-in-tag', value: hasText.text, tag: hasText.tag }
  }

  if (selector.startsWith('visible=')) return { kind: 'visible', value: selector.slice('visible='.length) }

  return { kind: 'css', value: selector }
}

const ROLE_ATTR_XPATH = (role: string) => `//*[@role='${role}']`
const TEXT_XPATH = (value: string) => `//*[contains(text(),${wrap(value)})]`
const TAG_TEXT_XPATH = (tag: string, value: string) => `//${tag}[contains(text(),${wrap(value)})]`
const LABEL_INPUT_XPATH = (value: string) =>
  `//label[contains(text(),${wrap(value)})]/following-sibling::input | //label[contains(text(),${wrap(value)})]/input`

function toPlaywright(spec: LocatorSpec, raw: string): string {
  if (spec.kind === 'role') {
    return spec.name !== undefined ? `getByRole('${spec.role}', { name: '${escapeSingleQuoted(spec.name)}' })` : `getByRole('${spec.role}')`
  }
  // Todo lo demás ya es sintaxis de Playwright: getBy*, :has-text, visible=, CSS, XPath.
  return raw
}

function toCypress(spec: LocatorSpec): string {
  switch (spec.kind) {
    case 'role':
      return spec.name !== undefined
        ? `cy.contains('${spec.role}', '${escapeSingleQuoted(spec.name)}')`
        : `cy.get('[role="${spec.role}"]')`
    case 'text':
      return `cy.contains('${escapeSingleQuoted(spec.value)}')`
    case 'testid':
      return `cy.get('[data-testid="${spec.value}"]')`
    case 'label':
      return `cy.get('label').contains('${escapeSingleQuoted(spec.value)}')`
    case 'placeholder':
      return `cy.get('[placeholder="${spec.value}"]')`
    case 'xpath':
      return `cy.xpath(${wrap(spec.value)})`
    case 'label-input':
      return `cy.contains('label', '${escapeSingleQuoted(spec.value)}').siblings('input')`
    case 'text-in-tag':
      return `cy.contains('${spec.tag}', '${escapeSingleQuoted(spec.value)}')`
    case 'visible':
      return `cy.get(${wrap(spec.value)}).filter(':visible')`
    default:
      return `cy.get(${wrap(spec.value)})`
  }
}

function toSelenium(spec: LocatorSpec): string {
  switch (spec.kind) {
    case 'role': {
      if (spec.name !== undefined) {
        const xpath = roleSuggestionToXPath(spec.role!, spec.name)
        return xpath ? `By.xpath(${wrap(xpath)})` : `By.xpath(${wrap(`//*[@role='${spec.role}'][contains(text(),${wrap(spec.name)})]`)})`
      }
      return `By.xpath(${wrap(ROLE_ATTR_XPATH(spec.role!))})`
    }
    case 'text':
      return `By.xpath(${wrap(TEXT_XPATH(spec.value))})`
    case 'testid':
      return `By.cssSelector('[data-testid="${spec.value}"]')`
    case 'label':
      return `By.xpath(${wrap(`//label[contains(text(),${wrap(spec.value)})]`)})`
    case 'placeholder':
      return `By.cssSelector('[placeholder="${spec.value}"]')`
    case 'xpath':
      return `By.xpath(${wrap(spec.value)})`
    case 'label-input':
      return `By.xpath(${wrap(LABEL_INPUT_XPATH(spec.value))})`
    case 'text-in-tag':
      return `By.xpath(${wrap(TAG_TEXT_XPATH(spec.tag!, spec.value))})`
    default:
      return `By.cssSelector(${wrap(spec.value)})`
  }
}

function toWebdriverIO(spec: LocatorSpec): string {
  switch (spec.kind) {
    case 'role': {
      if (spec.name !== undefined) {
        const xpath = roleSuggestionToXPath(spec.role!, spec.name)
        return xpath ? `$(${wrap(xpath)})` : `$(${wrap(`//*[@role='${spec.role}'][contains(text(),${wrap(spec.name)})]`)})`
      }
      return `$(${wrap(ROLE_ATTR_XPATH(spec.role!))})`
    }
    case 'text':
      return `$(${wrap(TEXT_XPATH(spec.value))})`
    case 'testid':
      return `$('[data-testid="${spec.value}"]')`
    case 'label':
      return `$(${wrap(`//label[contains(text(),${wrap(spec.value)})]`)})`
    case 'placeholder':
      return `$('[placeholder="${spec.value}"]')`
    case 'xpath':
      return `$(${wrap(spec.value)})`
    case 'label-input':
      return `$(${wrap(LABEL_INPUT_XPATH(spec.value))})`
    case 'text-in-tag':
      return `$(${wrap(TAG_TEXT_XPATH(spec.tag!, spec.value))})`
    default:
      return `$(${wrap(spec.value)})`
  }
}

/** Traduce un selector del dialecto del motor a la sintaxis de un framework. */
export function adaptSelectorText(selector: string, framework: TestFramework): string {
  const spec = parseLocatorSpec(selector)
  switch (framework) {
    case 'playwright':
      return toPlaywright(spec, selector)
    case 'cypress':
      return toCypress(spec)
    case 'selenium':
      return toSelenium(spec)
    case 'webdriverio':
      return toWebdriverIO(spec)
  }
}
