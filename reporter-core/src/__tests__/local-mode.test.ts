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
