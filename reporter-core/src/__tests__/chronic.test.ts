import { describe, it, expect } from 'vitest'
import { computeChronic } from '../dashboard'
import type { HistoryEntry } from '../repertoire'

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-08-01T10:00:00.000Z',
    testFile: 'e2e/checkout.spec.ts',
    testName: 'agrega al carrito',
    selector: '#add-to-cart',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Agregar' })",
    selectorType: 'ROLE',
    confidence: 0.92,
    cause: 'selector',
    ...over,
  }
}

describe('computeChronic', () => {
  it('ignora los selectores por debajo del umbral', () => {
    const chronic = computeChronic([entry(), entry()])
    expect(chronic).toEqual([])
  })

  it('marca como crónico un selector con 3 roturas y calcula la ventana temporal', () => {
    const chronic = computeChronic([
      entry({ timestamp: '2026-07-15T10:00:00.000Z' }),
      entry({ timestamp: '2026-07-28T10:00:00.000Z' }),
      entry({ timestamp: '2026-08-05T10:00:00.000Z' }),
    ])

    expect(chronic).toHaveLength(1)
    expect(chronic[0].breakages).toBe(3)
    expect(chronic[0].spanDays).toBe(21)
    expect(chronic[0].firstSeen).toBe('2026-07-15T10:00:00.000Z')
    expect(chronic[0].lastSeen).toBe('2026-08-05T10:00:00.000Z')
    expect(chronic[0].recommendation).toContain('data-testid')
  })

  it('el mismo selector en dos archivos distintos son dos problemas distintos', () => {
    // Mismo criterio de agrupación que defectId — si se agruparan juntos, tres roturas
    // repartidas entre dos tests parecerían un solo selector crónico que no existe.
    const chronic = computeChronic([
      entry({ testFile: 'e2e/a.spec.ts' }),
      entry({ testFile: 'e2e/a.spec.ts' }),
      entry({ testFile: 'e2e/b.spec.ts' }),
    ])
    expect(chronic).toEqual([])
  })

  it('cuando la mayoría de las roturas no son de selector, señala el flujo y no el locator', () => {
    // El pago de cruzar el clasificador de causa con el historial: esta conclusión no se
    // podía sacar cuando el historial no guardaba la causa.
    const chronic = computeChronic([
      entry({ cause: 'assertion' }),
      entry({ cause: 'assertion' }),
      entry({ cause: 'runtime' }),
      entry({ cause: 'selector' }),
    ])

    expect(chronic[0].causes).toEqual({ assertion: 2, runtime: 1, selector: 1 })
    expect(chronic[0].recommendation).toContain('El locator no es el problema')
  })

  it('si ya usa test-id y se sigue rompiendo, no recomienda otro test-id', () => {
    const chronic = computeChronic([
      entry({ selectorType: 'TESTID', selector: '[data-testid="buy"]' }),
      entry({ selectorType: 'TESTID', selector: '[data-testid="buy"]' }),
      entry({ selectorType: 'TESTID', selector: '[data-testid="buy"]' }),
    ])

    expect(chronic[0].recommendation).toContain('pese a usar un test-id')
    expect(chronic[0].recommendation).not.toContain('agregale un data-testid')
  })

  it('un historial viejo sin cause sigue funcionando', () => {
    // Los archivos escritos antes de que existiera la clasificación no traen `cause`. Tienen
    // que leerse sin migración: se pierde la recomendación por causa, no la vista entera.
    const chronic = computeChronic([
      entry({ cause: undefined }),
      entry({ cause: undefined }),
      entry({ cause: undefined }),
    ])

    expect(chronic).toHaveLength(1)
    expect(chronic[0].causes).toEqual({})
    expect(chronic[0].recommendation).toContain('data-testid')
  })

  it('timestamps invertidos o inválidos no producen NaN en la ventana', () => {
    const chronic = computeChronic([
      entry({ timestamp: 'no-es-una-fecha' }),
      entry({ timestamp: 'tampoco' }),
      entry({ timestamp: 'ni-esta' }),
    ])

    expect(chronic[0].spanDays).toBe(0)
    expect(chronic[0].recommendation).toContain('el mismo día')
    expect(chronic[0].recommendation).not.toContain('NaN')
  })

  it('ordena por cantidad de roturas descendente', () => {
    const chronic = computeChronic([
      ...Array.from({ length: 3 }, () => entry({ selector: '#tres' })),
      ...Array.from({ length: 5 }, () => entry({ selector: '#cinco' })),
    ])

    expect(chronic.map((c) => c.selector)).toEqual(['#cinco', '#tres'])
  })

  it('minBreakages configurable', () => {
    const chronic = computeChronic([entry(), entry()], { minBreakages: 2 })
    expect(chronic).toHaveLength(1)
  })
})
