import { describe, it, expect } from 'vitest'
import { runLocalHealing } from '../local-mode'

describe('runLocalHealing', () => {
  it('extracts the selector from the error message and runs the heuristic', () => {
    const result = runLocalHealing({
      testName: 'agrega producto al carrito',
      testFile: 'e2e/checkout.spec.ts',
      errorMessage: 'Expected to find element: `[data-testid="add-to-cart"]`, but never found it.',
    })

    expect(result.selector).toBe('[data-testid="add-to-cart"]')
    expect(result.status).toBe('healed')
    expect(result.fixedSelector).toBeTruthy()
  })

  it('returns status "unresolved" without calling the engine when no selector can be extracted', () => {
    const result = runLocalHealing({
      testName: 'algo raro pasó',
      errorMessage: 'Something went wrong',
    })

    expect(result.selector).toBe('Unknown selector')
    expect(result.status).toBe('unresolved')
    expect(result.fixedSelector).toBe('')
  })

  it('includes healResponse in the result', () => {
    const result = runLocalHealing({
      testName: 'test',
      errorMessage: 'Expected to find element: `[data-testid="btn"]`, but never found it.',
    })

    expect(result.healResponse).toBeDefined()
    expect(result.healResponse?.fixedSelector).toBeTruthy()
    expect(result.healResponse?.confidence).toBeGreaterThan(0)
  })

  it('generates consistent defectId for the same selector and testFile', () => {
    const result1 = runLocalHealing({
      testName: 'test1',
      testFile: 'e2e/spec.ts',
      errorMessage: 'Expected to find element: `#btn`, but never found it.',
    })
    const result2 = runLocalHealing({
      testName: 'test1',
      testFile: 'e2e/spec.ts',
      errorMessage: 'Expected to find element: `#btn`, but never found it.',
    })

    expect(result1.defectId).toBe(result2.defectId)
  })

  it('generates different defectId for different selectors', () => {
    const result1 = runLocalHealing({
      testName: 'test',
      testFile: 'e2e/spec.ts',
      errorMessage: 'Expected to find element: `#btn-a`, but never found it.',
    })
    const result2 = runLocalHealing({
      testName: 'test',
      testFile: 'e2e/spec.ts',
      errorMessage: 'Expected to find element: `#btn-b`, but never found it.',
    })

    expect(result1.defectId).not.toBe(result2.defectId)
  })

  it('passes through optional input fields', () => {
    const result = runLocalHealing({
      testName: 'test',
      testFile: 'e2e/spec.ts',
      errorMessage: 'Expected to find element: `#btn`, but never found it.',
      line: 42,
      durationMs: 1500,
      steps: ['Step 1', 'Step 2'],
      attachments: [{ name: 'screenshot', path: 'test-results/screenshot.png' }],
    })

    expect(result.line).toBe(42)
    expect(result.durationMs).toBe(1500)
    expect(result.steps).toEqual(['Step 1', 'Step 2'])
    expect(result.attachments).toHaveLength(1)
  })

  it('sets severity based on status', () => {
    const healed = runLocalHealing({
      testName: 'test',
      errorMessage: 'Expected to find element: `[data-testid="btn"]`, but never found it.',
    })

    expect(healed.severity).toBeDefined()
    expect(['minor', 'major', 'blocker']).toContain(healed.severity)
  })
})

describe('runLocalHealing — config del proyecto', () => {
  const testidError = 'Expected to find element: `[data-testid="add-to-cart"]`, but never found it.'

  it('sin config se comporta igual que siempre (0.90 / 0.80 / 3 alternativas)', () => {
    expect(runLocalHealing({ testName: 't', errorMessage: testidError })).toEqual(
      runLocalHealing({ testName: 't', errorMessage: testidError }, {})
    )
  })

  it('minConfidence más exigente baja un caso de healed a review', () => {
    const base = runLocalHealing({ testName: 't', errorMessage: testidError })
    expect(base.status).toBe('healed')

    const strict = runLocalHealing({ testName: 't', errorMessage: testidError }, { minConfidence: 0.999 })

    expect(strict.status).toBe('review')
    expect(strict.confidence).toBe(base.confidence)
  })

  it('reviewConfidence mueve la frontera review/unresolved', () => {
    const result = runLocalHealing(
      { testName: 't', errorMessage: testidError },
      { minConfidence: 0.999, reviewConfidence: 0.998 }
    )

    expect(result.status).toBe('unresolved')
  })

  it('healEnabled:false reporta el fallo pero no propone nada ni corre el motor', () => {
    const result = runLocalHealing({ testName: 't', errorMessage: testidError }, { healEnabled: false })

    expect(result.status).toBe('unresolved')
    expect(result.fixedSelector).toBe('')
    expect(result.confidence).toBe(0)
    expect(result.healResponse).toBeUndefined()
    expect(result.explanation).toContain('desactivado')
    // El selector se sigue extrayendo: apagar el sanado no es apagar el reporte.
    expect(result.selector).toBe('[data-testid="add-to-cart"]')
  })

  it('maxAlternatives recorta la lista de alternativas', () => {
    const error = 'Expected to find element: `#login-btn-a1b2c3`, but never found it.'

    const base = runLocalHealing({ testName: 't', errorMessage: error })
    const capped = runLocalHealing({ testName: 't', errorMessage: error }, { maxAlternatives: 1 })

    expect(base.healResponse?.alternatives?.length).toBeGreaterThan(1)
    expect(capped.healResponse?.alternatives?.length).toBe(1)
  })

  it('customTestIds del proyecto llega al motor — antes la config no tenía efecto en el reporte', () => {
    const error = 'Expected to find element: `[data-qa-id="submit"]`, but never found it.'

    const sinConfig = runLocalHealing({ testName: 't', errorMessage: error })
    const conConfig = runLocalHealing({ testName: 't', errorMessage: error }, { customTestIds: ['data-qa-id'] })

    expect(sinConfig.selectorType).not.toBe('TESTID')
    expect(conConfig.selectorType).toBe('TESTID')
  })
})
