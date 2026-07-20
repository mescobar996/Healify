import { describe, it, expect } from 'vitest'
import { extractSelectorFromError } from '../selector-extractor'

describe('extractSelectorFromError', () => {
  it('extrae selector del error "Waiting for selector"', () => {
    expect(extractSelectorFromError(`Waiting for selector '#login-btn' failed after 30000ms`)).toBe('#login-btn')
  })

  it('extrae selector del error "Element not found"', () => {
    expect(extractSelectorFromError(`Element not found: .submit-button`)).toBe('.submit-button')
  })

  it('extrae selector del error "Unable to locate element"', () => {
    expect(extractSelectorFromError(`Unable to locate element: [data-testid="login"]`)).toBe('[data-testid="login"]')
  })

  it('extrae selector del error "selector ... not found"', () => {
    expect(extractSelectorFromError(`selector '#btn' not found in DOM`)).toBe('#btn')
  })

  it('extrae selector de locator()', () => {
    expect(extractSelectorFromError("Timed out waiting for locator('button.primary')")).toBe('button.primary')
  })

  it('extrae selector de un timeout de Cypress (cy.get)', () => {
    expect(extractSelectorFromError(
      'Expected to find element: `#does-not-exist`, but never found it.'
    )).toBe('#does-not-exist')
  })

  it('devuelve "Unknown selector" cuando no hay match', () => {
    expect(extractSelectorFromError('Generic random error without selector info')).toBe('Unknown selector')
    expect(extractSelectorFromError('')).toBe('Unknown selector')
  })
})
