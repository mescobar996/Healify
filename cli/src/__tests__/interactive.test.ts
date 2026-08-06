import { describe, it, expect, vi } from 'vitest'
import { runInteractiveFix, formatCasePrompt } from '../interactive'
import type { LocalCaseResult } from '@healify/reporter-core'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'compra un producto',
    testFile: 'e2e/checkout.spec.ts',
    selector: '#comprar-ahora-a1b2c3',
    errorMessage: 'no such element',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Comprar' })",
    confidence: 0.97,
    explanation: 'x',
    selectorType: 'ROLE',
    verified: true,
    defectId: 'HLF-ABC123',
    severity: 'minor',
    cause: 'selector',
    ...overrides,
  }
}

function key(c: LocalCaseResult): string {
  return `${c.testFile}::${c.selector}`
}

describe('runInteractiveFix', () => {
  it('aprueba un caso healed cuando el usuario responde "s"', () => {
    const c = makeCase()
    const ask = vi.fn(() => 's')

    const { approved, declined } = runInteractiveFix([c], ask)

    expect(approved.has(key(c))).toBe(true)
    expect(declined).toHaveLength(0)
  })

  it('rechaza un caso cuando el usuario responde "n"', () => {
    const c = makeCase()
    const ask = vi.fn(() => 'n')

    const { approved, declined } = runInteractiveFix([c], ask)

    expect(approved.has(key(c))).toBe(false)
    expect(declined).toEqual([{ testFile: c.testFile, selector: c.selector, status: 'skipped', reason: 'declined' }])
  })

  it('Enter vacío en un caso healed usa el default Sí', () => {
    const c = makeCase({ status: 'healed' })
    const ask = vi.fn(() => '')

    const { approved } = runInteractiveFix([c], ask)

    expect(approved.has(key(c))).toBe(true)
  })

  it('Enter vacío en un caso review usa el default No — el motor mismo no está seguro', () => {
    const c = makeCase({ status: 'review', confidence: 0.85 })
    const ask = vi.fn(() => '')

    const { approved, declined } = runInteractiveFix([c], ask)

    expect(approved.has(key(c))).toBe(false)
    expect(declined).toHaveLength(1)
  })

  it('un caso review se puede aprobar explícitamente — el desarrollador puede aplicar algo de menor confianza si decide', () => {
    const c = makeCase({ status: 'review', confidence: 0.85 })
    const ask = vi.fn(() => 's')

    const { approved } = runInteractiveFix([c], ask)

    expect(approved.has(key(c))).toBe(true)
  })

  it('"a" aplica el resto sin seguir preguntando', () => {
    const cases = [makeCase({ selector: '#uno' }), makeCase({ selector: '#dos' }), makeCase({ selector: '#tres' })]
    const ask = vi.fn().mockReturnValueOnce('a')

    const { approved } = runInteractiveFix(cases, ask)

    expect(approved.size).toBe(3)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('"q" deja el resto sin tocar, listado como declinado — no como "no preguntado"', () => {
    const cases = [makeCase({ selector: '#uno' }), makeCase({ selector: '#dos' }), makeCase({ selector: '#tres' })]
    const ask = vi.fn().mockReturnValueOnce('q')

    const { approved, declined } = runInteractiveFix(cases, ask)

    expect(approved.size).toBe(0)
    expect(declined).toHaveLength(3)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('nunca ofrece un caso unresolved — no hay sugerencia que mostrar', () => {
    const cases = [makeCase({ status: 'unresolved', fixedSelector: '' })]
    const ask = vi.fn()

    const { approved, declined } = runInteractiveFix(cases, ask)

    expect(ask).not.toHaveBeenCalled()
    expect(approved.size).toBe(0)
    expect(declined).toHaveLength(0)
  })

  it('pregunta healed y review en el orden en que vienen, cada uno con su propio prompt', () => {
    const healed = makeCase({ selector: '#a', status: 'healed' })
    const review = makeCase({ selector: '#b', status: 'review', confidence: 0.85 })
    const ask = vi.fn().mockReturnValueOnce('s').mockReturnValueOnce('s')

    runInteractiveFix([healed, review], ask)

    expect(ask).toHaveBeenCalledTimes(2)
    expect(ask.mock.calls[0][0]).toContain('#a')
    expect(ask.mock.calls[1][0]).toContain('#b')
  })
})

describe('formatCasePrompt', () => {
  it('incluye el archivo, el selector, la sugerencia y la confianza', () => {
    const prompt = formatCasePrompt(makeCase())

    expect(prompt).toContain('e2e/checkout.spec.ts')
    expect(prompt).toContain('#comprar-ahora-a1b2c3')
    expect(prompt).toContain("role('button', { name: 'Comprar' })")
    expect(prompt).toContain('97%')
  })

  it('marca cuándo la sugerencia viene del repertorio, distinto de "verificado en esta corrida"', () => {
    const prompt = formatCasePrompt(makeCase({ fromRepertoire: true, verified: true }))

    expect(prompt).toContain('corrida anterior')
  })

  it('marca cuándo la sugerencia se verificó en esta corrida', () => {
    const prompt = formatCasePrompt(makeCase({ verified: true, fromRepertoire: false }))

    expect(prompt).toContain('verificado en la página')
  })

  it('marca cuándo la sugerencia es heurística sin comprobar', () => {
    const prompt = formatCasePrompt(makeCase({ verified: false, fromRepertoire: false }))

    expect(prompt).toContain('sin comprobar')
  })
})
