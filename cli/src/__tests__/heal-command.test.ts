import { describe, it, expect, vi } from 'vitest'

// Sin anotar el retorno, `vi.fn(() => [])` infiere `never[]` y cualquier mockReturnValue
// posterior falla al tipar. Lo detecto tsc recien cuando el tsconfig dejo de excluir los tests.
const { mockReadRepertoire } = vi.hoisted(() => ({ mockReadRepertoire: vi.fn((): unknown[] => []) }))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return { ...actual, readRepertoire: mockReadRepertoire }
})

import { runHeal } from '../commands/heal'

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
