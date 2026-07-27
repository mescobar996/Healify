import { describe, it, expect } from 'vitest'
import { parseHistoryLines, findRepertoireMatch, type HistoryEntry } from '../repertoire'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    testFile: 'e2e/login.spec.ts',
    testName: 'login',
    selector: '#comprar-ahora-a1b2c3',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Comprar' })",
    selectorType: 'ROLE',
    confidence: 0.97,
    verified: true,
    ...overrides,
  }
}

describe('parseHistoryLines', () => {
  it('parsea líneas JSONL válidas', () => {
    const raw = [JSON.stringify(makeEntry()), JSON.stringify(makeEntry({ selector: '#otro' }))].join('\n') + '\n'

    expect(parseHistoryLines(raw)).toHaveLength(2)
  })

  it('ignora líneas corruptas sin romper el resto', () => {
    const raw = [JSON.stringify(makeEntry()), '{"json": "roto"', JSON.stringify(makeEntry({ selector: '#otro' }))].join('\n')

    expect(parseHistoryLines(raw)).toHaveLength(2)
  })

  it('ignora líneas vacías', () => {
    expect(parseHistoryLines('\n\n' + JSON.stringify(makeEntry()) + '\n\n')).toHaveLength(1)
  })

  it('string vacío da []', () => {
    expect(parseHistoryLines('')).toEqual([])
  })
})

describe('findRepertoireMatch', () => {
  it('encuentra una entrada verificada por archivo+selector exactos', () => {
    const entries = [makeEntry()]

    const match = findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', 'e2e/login.spec.ts')

    expect(match?.fixedSelector).toBe("role('button', { name: 'Comprar' })")
  })

  it('no matchea el mismo selector en un archivo distinto — evita colisiones entre specs', () => {
    const entries = [makeEntry({ testFile: 'e2e/login.spec.ts' })]

    expect(findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', 'e2e/checkout.spec.ts')).toBeNull()
  })

  it('matchea por selector solo cuando testFile es undefined en ambos lados — caso Selenium/WebdriverIO', () => {
    const entries = [makeEntry({ testFile: undefined })]

    expect(findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', undefined)).not.toBeNull()
  })

  it('ignora entradas no verificadas — reusar una curación a ciegas no aporta nada, es determinística', () => {
    const entries = [makeEntry({ verified: false })]

    expect(findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', 'e2e/login.spec.ts')).toBeNull()
  })

  it('ignora entradas sin el campo verified (historiales grabados antes de este bloque)', () => {
    const entries = [makeEntry({ verified: undefined })]

    expect(findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', 'e2e/login.spec.ts')).toBeNull()
  })

  it('elige la más reciente cuando hay varias coincidencias', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T00:00:00.000Z', fixedSelector: 'viejo' }),
      makeEntry({ timestamp: '2026-03-01T00:00:00.000Z', fixedSelector: 'nuevo' }),
      makeEntry({ timestamp: '2026-02-01T00:00:00.000Z', fixedSelector: 'medio' }),
    ]

    expect(findRepertoireMatch(entries, '#comprar-ahora-a1b2c3', 'e2e/login.spec.ts')?.fixedSelector).toBe('nuevo')
  })

  it('null sin ninguna coincidencia', () => {
    expect(findRepertoireMatch([], '#comprar-ahora-a1b2c3', 'e2e/login.spec.ts')).toBeNull()
  })

  it('null con un selector distinto', () => {
    const entries = [makeEntry()]

    expect(findRepertoireMatch(entries, '#otro-selector', 'e2e/login.spec.ts')).toBeNull()
  })
})
