import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLocalHealing, type LocalRun, type LocalCaseResult } from '@healify/reporter-core'
import { appendHistory } from '../history'
import { history } from '../commands/history'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: 'e2e/login.spec.ts',
    selector: '#old',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    confidence: 0.95,
    explanation: '',
    selectorType: 'TESTID',
    cause: 'selector',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('history()', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-history-cmd-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('hasHistory: false cuando nunca se grabó nada', () => {
    expect(history(dir)).toEqual({ hasHistory: false, topRecurrent: [], rebroken: [], chronic: [] })
  })

  it('hasHistory: true y calcula las vistas cuando hay historial', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' }), makeCase({ selector: '#a' })]), dir)

    const report = history(dir)

    expect(report.hasHistory).toBe(true)
    expect(report.topRecurrent).toEqual([{ selector: '#a', count: 2 }])
    expect(report.rebroken).toEqual([])
    expect(report.chronic).toEqual([])
  })

  it('la causa persiste desde el motor hasta el veredicto, pasando por disco', () => {
    // Ciclo completo con el motor REAL, no con un caso armado a mano: runLocalHealing
    // clasifica → appendHistory serializa a JSONL → readHistory parsea → computeChronic
    // concluye. Si `cause` se perdiera en cualquiera de esos cuatro pasos, la recomendación
    // caería en la rama genérica del testid y este test lo detecta.
    const fallaDeAsercion = () =>
      runLocalHealing({
        testName: 'el total suma',
        testFile: 'e2e/carrito.spec.ts',
        errorMessage: "expect(page.locator('#total')).toHaveText('99')\n\nExpected: \"99\"\nReceived: \"12\"",
      })

    for (let i = 0; i < 3; i++) appendHistory(makeRun([fallaDeAsercion()]), dir)

    const report = history(dir)

    expect(report.chronic).toHaveLength(1)
    expect(report.chronic[0].causes).toEqual({ assertion: 3 })
    expect(report.chronic[0].recommendation).toContain('El locator no es el problema')
  })

  it('un selector roto de verdad recibe la recomendación del testid', () => {
    const fallaDeSelector = () =>
      runLocalHealing({
        testName: 'agrega al carrito',
        testFile: 'e2e/checkout.spec.ts',
        errorMessage: "Waiting for selector '#add-to-cart' failed",
      })

    for (let i = 0; i < 3; i++) appendHistory(makeRun([fallaDeSelector()]), dir)

    const report = history(dir)

    expect(report.chronic[0].causes).toEqual({ selector: 3 })
    expect(report.chronic[0].recommendation).toContain('data-testid')
  })
})
