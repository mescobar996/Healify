import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isLocalMode, runLocalHealing } from '../local-mode'

describe('isLocalMode', () => {
  const original = process.env.HEALIFY_API_KEY

  afterEach(() => {
    if (original === undefined) delete process.env.HEALIFY_API_KEY
    else process.env.HEALIFY_API_KEY = original
  })

  it('is true when HEALIFY_API_KEY is unset', () => {
    delete process.env.HEALIFY_API_KEY
    expect(isLocalMode()).toBe(true)
  })

  it('is false when HEALIFY_API_KEY is set', () => {
    process.env.HEALIFY_API_KEY = 'hf_live_test'
    expect(isLocalMode()).toBe(false)
  })
})

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
})
