import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extractSelectorFromError, parseTestLog } from './log-parser.js'
import { statusForConfidence, defectIdFor, buildRunFromHealResults } from './report-builder.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFileSync(join(here, 'test', 'fixtures', name), 'utf-8')

describe('extractSelectorFromError', () => {
  it('extrae selectores CSS citados (Playwright locator)', () => {
    const error = "Error: locator.click: Timeout 5000ms exceeded.\n  waiting for locator('[data-testid=\"login-button\"]')"
    expect(extractSelectorFromError(error)).toBe('[data-testid="login-button"]')
  })

  it('no corta en comillas dobles internas (bug real de reporter-core)', () => {
    // El patrón viejo cortaba acá en la primera comilla doble → "Unknown selector" siempre.
    const error = "Timeout 5000ms exceeded.\n  - waiting for locator('[data-testid=\"user-1a2b3c\"]')"
    expect(extractSelectorFromError(error)).toBe('[data-testid="user-1a2b3c"]')
  })

  it('extrae locators modernos getBy*', () => {
    const error = "waiting for getByRole('button', { name: 'Add to cart' })"
    expect(extractSelectorFromError(error)).toBe("getByRole('button', { name: 'Add to cart' })")
  })

  it('extrae selectores de Cypress cy.get()', () => {
    const error = 'AssertionError: cy.get() Expected to find element: `#login-form` but never did.'
    expect(extractSelectorFromError(error)).toBe('#login-form')
  })

  it('convierte el texto citado de Cypress .contains() en text=...', () => {
    const error = "cy.contains() Expected to find content: 'Welcome' but never did."
    expect(extractSelectorFromError(error)).toBe('text=Welcome')
  })

  it('devuelve Unknown selector cuando no hay patrón que matchee', () => {
    expect(extractSelectorFromError('Total failure: something exploded')).toBe('Unknown selector')
  })

  it('ignora códigos ANSI', () => {
    const error = '\u001b[31mError:\u001b[0m Element not found: .btn-primary'
    expect(extractSelectorFromError(error)).toBe('.btn-primary')
  })
})

describe('parseTestLog — fixture Playwright', () => {
  const { framework, cases } = parseTestLog(fixture('playwright-failures.log'))

  it('detecta playwright', () => {
    expect(framework).toBe('playwright')
  })

  it('extrae los tres selectores rotos', () => {
    expect(cases).toHaveLength(3)
  })

  it('asocia cada selector con su archivo de test', () => {
    const bySelector = Object.fromEntries(cases.map((c) => [c.selector, c.testFile]))
    expect(bySelector['[data-testid="login-button"]']).toBe('e2e/login.spec.ts')
    expect(bySelector["getByRole('button', { name: 'Add to cart' })"]).toBe('e2e/cart.spec.ts')
    expect(bySelector['.search-result-card']).toBe('e2e/search.spec.ts')
  })

  it('mantiene el mensaje de error completo por caso', () => {
    expect(cases[0].errorMessage).toContain('Timeout 5000ms exceeded')
    expect(cases[0].errorMessage).toContain('waiting for locator')
  })
})

describe('parseTestLog — fixture Cypress', () => {
  const { framework, cases } = parseTestLog(fixture('cypress-failures.log'))

  it('detecta cypress', () => {
    expect(framework).toBe('cypress')
  })

  it('extrae el selector de la línea Running: de Cypress (sin cabecera numerada)', () => {
    expect(cases).toHaveLength(1)
    expect(cases[0].selector).toBe('#login-form')
    expect(cases[0].testFile).toBe('cypress/e2e/login.cy.ts')
  })
})

describe('parseTestLog — log limpio', () => {
  it('no reporta casos cuando no hay errores', () => {
    const { framework, cases } = parseTestLog(fixture('clean-pass.log'))
    expect(framework).toBe('playwright')
    expect(cases).toHaveLength(0)
  })
})

describe('parseTestLog — edge cases', () => {
  it('tolera entrada vacía', () => {
    expect(parseTestLog('')).toEqual({ framework: 'playwright', cases: [] })
  })

  it('tolera ANSI en el log', () => {
    const log = '\u001b[32m✓\u001b[0m e2e/a.spec.ts\n\n  Error: Element not found: .x'
    const { cases } = parseTestLog(log)
    expect(cases).toHaveLength(1)
    expect(cases[0].selector).toBe('.x')
  })

  it('deduplica el mismo selector en el mismo archivo', () => {
    const log = [
      '  1) e2e/a.spec.ts › test one',
      '',
      '  Error: Element not found: .dup',
      '',
      '  2) e2e/a.spec.ts › test two',
      '',
      '  Error: Element not found: .dup',
    ].join('\n')
    const { cases } = parseTestLog(log)
    expect(cases).toHaveLength(1)
  })

  it('no confunde una prueba aprobada con un error', () => {
    const log = ['  ✓ e2e/a.spec.ts › passes (1.2s)', '', '  1) e2e/b.spec.ts › fails', '', '  Error: Unable to locate element: #nav'].join('\n')
    const { cases } = parseTestLog(log)
    expect(cases).toHaveLength(1)
    expect(cases[0].selector).toBe('#nav')
  })
})

describe('report-builder — statusForConfidence', () => {
  it('clasifica por los umbrales del motor (0.90 / 0.80)', () => {
    expect(statusForConfidence(0.95, false)).toBe('healed')
    expect(statusForConfidence(0.9, false)).toBe('healed')
    expect(statusForConfidence(0.85, false)).toBe('review')
    expect(statusForConfidence(0.79, false)).toBe('unresolved')
  })

  it('trata un heal fallido como unresolved', () => {
    expect(statusForConfidence(0.95, true)).toBe('unresolved')
  })
})

describe('report-builder — defectIdFor', () => {
  it('es estable para el mismo selector y archivo', () => {
    expect(defectIdFor('a.spec.ts', '#x')).toBe(defectIdFor('a.spec.ts', '#x'))
  })

  it('varía si cambia el archivo o el selector', () => {
    expect(defectIdFor('a.spec.ts', '#x')).not.toBe(defectIdFor('a.spec.ts', '#y'))
    expect(defectIdFor('a.spec.ts', '#x')).not.toBe(defectIdFor('b.spec.ts', '#x'))
  })
})

describe('report-builder — buildRunFromHealResults', () => {
  const cases = [
    { testFile: 'e2e/login.spec.ts', selector: '#old-btn', errorMessage: 'Error: Element not found: #old-btn' },
    { testFile: 'e2e/cart.spec.ts', selector: '.cart-empty', errorMessage: 'Error: Element not found: .cart-empty' },
  ]
  const healResults = [
    { ok: true, output: { fixedSelector: '[data-testid="btn"]', confidence: 0.95, verified: false, fromRepertoire: false, explanation: 'rol', selectorType: 'TESTID' } },
    { ok: false, error: 'npx: command not found' },
  ]

  it('arma un LocalRun que fix puede consumir', () => {
    const run = buildRunFromHealResults(cases, healResults, { project: 'myproj', framework: 'playwright' })
    expect(run.project).toBe('myproj')
    expect(run.framework).toBe('playwright')
    expect(run.cases).toHaveLength(2)

    const [healed, failed] = run.cases
    expect(healed.status).toBe('healed')
    expect(healed.fixedSelector).toBe('[data-testid="btn"]')
    expect(healed.selector).toBe('#old-btn')
    expect(healed.testFile).toBe('e2e/login.spec.ts')
    expect(healed.defectId).toBeTruthy()

    expect(failed.status).toBe('unresolved')
    expect(failed.fixedSelector).toBe('')
    expect(failed.confidence).toBe(0)
    expect(failed.explanation).toContain('command not found')
  })

  it('cuenta los estados en stats', () => {
    const run = buildRunFromHealResults(cases, healResults, { project: 'p', framework: 'playwright' })
    expect(run.stats.healed).toBe(1)
    expect(run.stats.review).toBe(0)
    expect(run.stats.unresolved).toBe(1)
    expect(run.verdict).toBe('failed')
  })
})
