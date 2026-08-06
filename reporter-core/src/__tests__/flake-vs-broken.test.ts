import { describe, it, expect } from 'vitest'
import { runLocalHealing } from '../local-mode'
import { flakeVerdictFor, detectFlakyTests } from '../flake'
import type { RunRecord } from '../runs'

const TEST_NAME = 'agrega al carrito'
const TEST_FILE = 'e2e/checkout.spec.ts'
const ERROR = "Waiting for selector '#add-to-cart-btn' failed"

/** Una corrida con un solo test, que pasó o falló. */
function corrida(runId: string, passed: boolean, over: Partial<RunRecord> = {}): RunRecord {
  return {
    type: 'run',
    runId,
    timestamp: `2026-08-0${runId}T10:00:00.000Z`,
    project: 'demo',
    framework: 'Playwright',
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    tests: [{ testName: TEST_NAME, testFile: TEST_FILE, passed }],
    ...over,
  }
}

describe('flakeVerdictFor', () => {
  it('coincide con detectFlakyTests sobre los mismos datos', () => {
    // Las dos leen el mismo archivo y responden sobre el mismo test: si divergieran, el
    // comando `flake` y el motor de sanado dirían cosas distintas del mismo caso.
    const runs = [corrida('1', true), corrida('2', false), corrida('3', true)]

    const delComando = detectFlakyTests(runs).find((t) => t.testName === TEST_NAME)!.verdict
    const delMotor = flakeVerdictFor(runs, TEST_NAME, TEST_FILE)

    expect(delMotor).toBe(delComando)
    expect(delMotor).toBe('flaky')
  })

  it('siempre rojo es always-failing, no flaky', () => {
    const runs = [corrida('1', false), corrida('2', false)]
    expect(flakeVerdictFor(runs, TEST_NAME, TEST_FILE)).toBe('always-failing')
  })

  it('una sola corrida no alcanza para opinar', () => {
    expect(flakeVerdictFor([corrida('1', false)], TEST_NAME, TEST_FILE)).toBe('insufficient-data')
  })

  it('distingue el mismo nombre de test en archivos distintos', () => {
    const runs = [corrida('1', true), corrida('2', false)]
    expect(flakeVerdictFor(runs, TEST_NAME, 'e2e/otro.spec.ts')).toBe('insufficient-data')
  })
})

describe('runLocalHealing con historial de corridas', () => {
  it('un test flaky no se cura solo, aunque la sugerencia sea buena', () => {
    // El razonamiento: un selector realmente roto falla SIEMPRE. Que este test haya pasado en
    // dos corridas con el mismo selector prueba que el locator resuelve, así que lo
    // intermitente es otra cosa.
    const runHistory = [corrida('1', true), corrida('2', false), corrida('3', true)]

    const conHistorial = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR, runHistory })
    const sinHistorial = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR })

    expect(sinHistorial.status).toBe('healed')
    expect(conHistorial.status).toBe('review')
    expect(conHistorial.flakeVerdict).toBe('flaky')
    // La sugerencia NO se descarta: puede haber render condicional y el rol sí ayudaría.
    expect(conHistorial.fixedSelector).toBe(sinHistorial.fixedSelector)
    expect(conHistorial.explanation).toContain('Un selector roto falla siempre')
  })

  it('un test que falla siempre sí se cura — eso es una rotura, no flakiness', () => {
    const runHistory = [corrida('1', false), corrida('2', false), corrida('3', false)]

    const result = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR, runHistory })

    expect(result.flakeVerdict).toBe('always-failing')
    expect(result.status).toBe('healed')
    expect(result.explanation).not.toContain('Un selector roto falla siempre')
  })

  it('sin historial de corridas el comportamiento es exactamente el de antes', () => {
    // Selenium y WebdriverIO curan en vivo y no tienen concepto de suite: nunca van a pasar
    // runHistory, y no pueden verse afectados por esto.
    const result = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR })

    expect(result.flakeVerdict).toBeUndefined()
    expect(result.status).toBe('healed')
  })

  it('con datos insuficientes no se degrada nada', () => {
    const result = runLocalHealing({
      testName: TEST_NAME,
      testFile: TEST_FILE,
      errorMessage: ERROR,
      runHistory: [corrida('1', false)],
    })

    expect(result.flakeVerdict).toBe('insufficient-data')
    expect(result.status).toBe('healed')
  })

  it('la severidad acompaña la bajada a review', () => {
    // severityFor() se calcula sobre el status final, no sobre el de confianza: si se pasara
    // el viejo, el reporte diría "review" y la severidad seguiría siendo la de un curado.
    const runHistory = [corrida('1', true), corrida('2', false)]
    const flaky = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR, runHistory })
    const roto = runLocalHealing({ testName: TEST_NAME, testFile: TEST_FILE, errorMessage: ERROR })

    expect(flaky.severity).not.toBe(roto.severity)
  })

  it('un fallo fuera de alcance sigue saliendo fuera de alcance, haya o no historial', () => {
    // Las dos reglas de abstención son independientes: la causa manda antes de mirar corridas.
    const result = runLocalHealing({
      testName: TEST_NAME,
      testFile: TEST_FILE,
      errorMessage: "expect(page.locator('#total')).toHaveText('99')\n\nExpected: \"99\"\nReceived: \"12\"",
      runHistory: [corrida('1', true), corrida('2', false)],
    })

    expect(result.cause).toBe('assertion')
    expect(result.status).toBe('unresolved')
    expect(result.fixedSelector).toBe('')
  })
})
