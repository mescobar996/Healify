import { describe, it, expect, vi } from 'vitest'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

// Sin anotar el retorno, `vi.fn(() => [])` infiere `never[]` y cualquier mockReturnValue
// posterior falla al tipar. Lo detecto tsc recien cuando el tsconfig dejo de excluir los tests.
const { mockReadRepertoire } = vi.hoisted(() => ({ mockReadRepertoire: vi.fn((): unknown[] => []) }))

// Las estadísticas viven en `~/.healify/stats.json` — los tests redirigen homedir a un
// directorio temporal para no escribir ni leer el home real de quien corra la suite.
const { TEST_HOME } = vi.hoisted(() => ({
  TEST_HOME: require('path').join(process.env.TEMP || process.env.TMP || '.', 'healify-cli-test-home'),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return { ...actual, readRepertoire: mockReadRepertoire }
})

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => TEST_HOME }
})

import { runHeal, readHealStats, emptyHealStats, accumulateHealStats, formatHealStatsSummary } from '../commands/heal'

describe('runHeal', () => {
  it('input inválido (sin selector) devuelve error, no tira', () => {
    const result = runHeal({})

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('selector')
  })

  it('input que no es un objeto devuelve error', () => {
    expect(runHeal('un string cualquiera').ok).toBe(false)
    expect(runHeal(null).ok).toBe(false)
    expect(runHeal(42).ok).toBe(false)
  })

  it('selector CSS simple: heurística a ciegas, sin pageElements', () => {
    const result = runHeal({ selector: '#comprar-ahora-a1b2c3' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.verified).toBe(false)
      expect(result.output.fromRepertoire).toBe(false)
    }
  })

  it('con pageElements que confirman el botón real, la sugerencia sale verificada y con locator xpath', () => {
    const result = runHeal({
      selector: '#comprar-ahora-a1b2c3',
      pageElements: [{ role: 'button', name: 'Comprar' }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.fixedSelector).toBe("role('button', { name: 'Comprar' })")
      expect(result.output.verified).toBe(true)
      expect(result.output.locator).toEqual({
        strategy: 'xpath',
        value: expect.stringContaining("normalize-space(.)='Comprar'"),
      })
    }
  })

  it('MEJORA 1: el data-testid real del DOM se expone como alternativa del bridge (confianza 0.94)', () => {
    const result = runHeal({
      selector: '#comprar-ahora-a1b2c3',
      pageElements: [{ role: 'button', name: 'Comprar', testId: 'add-to-cart', testIdAttr: 'data-testid' }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Solo el role verificado en vivo (priority 0) supera al testid (priority 1).
      expect(result.output.fixedSelector).toBe("role('button', { name: 'Comprar' })")
      expect(result.output.alternatives?.[0]).toEqual({ selector: "[data-testid='add-to-cart']", confidence: 0.94 })
    }
  })

  it('selector TESTID resuelve a locator css, listo para usar tal cual', () => {
    const result = runHeal({ selector: '[data-testid="add-to-cart"]' })

    expect(result.ok).toBe(true)
    // El motor normaliza la sintaxis del testid (comillas simples) — es la salida real, no
    // el selector de entrada tal cual.
    if (result.ok) expect(result.output.locator).toEqual({ strategy: 'css', value: "[data-testid='add-to-cart']" })
  })

  it('consulta el repertorio del lado del servidor — el cliente no manda nada de eso', () => {
    mockReadRepertoire.mockReturnValueOnce([
      {
        timestamp: '2026-01-01T00:00:00.000Z',
        testFile: 'tests/test_checkout.py',
        testName: 'x',
        selector: '#comprar-ahora-a1b2c3',
        status: 'healed',
        fixedSelector: "role('button', { name: 'Comprar' })",
        selectorType: 'ROLE',
        confidence: 0.97,
        verified: true,
      },
    ])

    const result = runHeal({ selector: '#comprar-ahora-a1b2c3', testFile: 'tests/test_checkout.py' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.fromRepertoire).toBe(true)
      expect(result.output.verified).toBe(true)
    }
  })

  it('pageElements con forma inválida se ignora en vez de romper — heurística a ciegas', () => {
    const result = runHeal({ selector: '#comprar-ahora-a1b2c3', pageElements: 'no es un array' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output.verified).toBe(false)
  })

  it('pasa cwd a readRepertoire, para no depender de process.cwd() global', () => {
    runHeal({ selector: '#x' }, '/algun/proyecto')

    expect(mockReadRepertoire).toHaveBeenCalledWith('/algun/proyecto')
  })

  it('pasa customTestIds al motor — data-cy-custom se reconoce como TESTID', () => {
    const result = runHeal({
      selector: "[data-cy-custom='add-to-cart']",
      customTestIds: ['data-cy-custom'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.selectorType).toBe('TESTID')
      expect(result.output.confidence).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('sin customTestIds, data-cy-custom no es TESTID', () => {
    const result = runHeal({ selector: "[data-cy-custom='add-to-cart']" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.selectorType).not.toBe('TESTID')
    }
  })
})

describe('métricas locales (sin telemetría externa)', () => {
  it('mide el tiempo de cada fase y lo expone en el output', () => {
    const result = runHeal({ selector: '#comprar-ahora-a1b2c3' }, process.cwd(), { statsPath: null })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const { timings } = result.output
      expect(timings.probeMs).toBeGreaterThanOrEqual(0)
      expect(timings.analysisMs).toBeGreaterThanOrEqual(0)
      expect(timings.healingMs).toBeGreaterThanOrEqual(0)
      expect(timings.totalMs).toBeGreaterThanOrEqual(0)
      expect(timings.healingMs).toBe(Math.max(0, timings.totalMs - timings.probeMs - timings.analysisMs))
    }
  })

  it('acumula en stats.json: total analizado, tipos más comunes y promedio de healing', () => {
    const statsPath = join(TEST_HOME, 'stats-acumula.json')
    try { unlinkSync(statsPath) } catch { /* no existe todavía */ }
    mkdirSync(dirname(statsPath), { recursive: true })

    runHeal(
      { selector: '#comprar-ahora-a1b2c3', pageElements: [{ role: 'button', name: 'Comprar' }] },
      process.cwd(),
      { statsPath }
    )
    runHeal({ selector: "[data-testid='add-to-cart']" }, process.cwd(), { statsPath })
    // Sin nombre accesible ni testid: sugerencia que requiere revisión → fallida.
    runHeal({ selector: '#btn-aceptar', pageElements: [{ role: 'button', name: '' }] }, process.cwd(), { statsPath })

    const stats = readHealStats(statsPath)
    expect(stats.totalAnalyzed).toBe(3)
    expect(stats.healed).toBe(2)
    expect(stats.failed).toBe(1)
    expect(stats.byType.role).toBe(2)
    expect(stats.byType.testid).toBe(1)
    expect(stats.avgHealingMs).toBe(Math.round(stats.totalHealingMs / stats.totalAnalyzed))
  })

  it('una sugerencia que requiere revisión manual cuenta como fallida, no como sanada', () => {
    const statsPath = join(TEST_HOME, 'stats-revision.json')
    try { unlinkSync(statsPath) } catch { /* no existe todavía */ }
    mkdirSync(dirname(statsPath), { recursive: true })

    runHeal({ selector: '#btn-aceptar', pageElements: [{ role: 'button', name: '' }] }, process.cwd(), { statsPath })

    const stats = readHealStats(statsPath)
    expect(stats.totalAnalyzed).toBe(1)
    expect(stats.healed).toBe(0)
    expect(stats.failed).toBe(1)
  })

  it('statsPath: null desactiva el guardado — el heal sigue funcionando igual', () => {
    const statsPath = join(TEST_HOME, 'stats-null.json')
    try { unlinkSync(statsPath) } catch { /* no existe todavía */ }

    const result = runHeal({ selector: '#x' }, process.cwd(), { statsPath: null })

    expect(result.ok).toBe(true)
    expect(existsSync(statsPath)).toBe(false)
  })

  it('readHealStats tolera un archivo ausente o corrupto — arranca de cero', () => {
    expect(readHealStats(join(TEST_HOME, 'no-existe.json'))).toEqual(emptyHealStats())

    const corrupto = join(TEST_HOME, 'stats-corrupto.json')
    mkdirSync(dirname(corrupto), { recursive: true })
    writeFileSync(corrupto, '{ no es json')
    expect(readHealStats(corrupto)).toEqual(emptyHealStats())
  })

  it('accumulateHealStats promedia el tiempo de healing y cuenta por tipo en minúscula', () => {
    const first = accumulateHealStats(emptyHealStats(), 'healed', 'ROLE', 200)
    const second = accumulateHealStats(first, 'healed', 'TESTID', 300)

    expect(second.totalAnalyzed).toBe(2)
    expect(second.healed).toBe(2)
    expect(second.byType).toEqual({ role: 1, testid: 1 })
    expect(second.totalHealingMs).toBe(500)
    expect(second.avgHealingMs).toBe(250)
  })

  it('formatHealStatsSummary arma el resumen humano del ejemplo', () => {
    const stats = {
      totalAnalyzed: 3,
      healed: 3,
      failed: 0,
      byType: { role: 2, testid: 1 },
      totalHealingMs: 702,
      avgHealingMs: 234,
    }

    expect(formatHealStatsSummary(stats)).toBe('✅ 3 selectores sanados (2 roles, 1 testid) en 234ms — tasa de éxito: 100%')
  })

  it('el resumen sin datos todavía no inventa conteos', () => {
    expect(formatHealStatsSummary(emptyHealStats())).toBe('✅ 0 selectores sanados en 0ms — tasa de éxito: 0%')
  })
})
