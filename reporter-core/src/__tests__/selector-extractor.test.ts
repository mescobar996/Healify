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

  it('limpia codigos ANSI antes de extraer', () => {
    const ansiError = '\x1B[2mWaiting for selector \x1B[22m\x1B[36m\'#login-btn\'\x1B[39m\x1B[2m failed\x1B[22m'
    expect(extractSelectorFromError(ansiError)).toBe('#login-btn')
  })

  it('devuelve "Unknown selector" cuando no hay match', () => {
    expect(extractSelectorFromError('Generic random error without selector info')).toBe('Unknown selector')
    expect(extractSelectorFromError('')).toBe('Unknown selector')
  })

  it('extrae un locator moderno de Playwright (getByRole) de un mensaje real multilínea', () => {
    const msg = "page.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Login' })"
    expect(extractSelectorFromError(msg)).toBe("getByRole('button', { name: 'Login' })")
  })

  it('extrae getByText, getByLabel, getByPlaceholder y getByTestId', () => {
    expect(extractSelectorFromError("waiting for getByText('Aplicar cupón')")).toBe("getByText('Aplicar cupón')")
    expect(extractSelectorFromError("waiting for getByLabel('Correo')")).toBe("getByLabel('Correo')")
    expect(extractSelectorFromError("waiting for getByPlaceholder('Buscar...')")).toBe("getByPlaceholder('Buscar...')")
    expect(extractSelectorFromError("waiting for getByTestId('add-to-cart')")).toBe("getByTestId('add-to-cart')")
  })

  it('extrae selectores descendientes con espacios (regresión del fix (\\S+) → (.+))', () => {
    expect(extractSelectorFromError('Element not found: .card .title')).toBe('.card .title')
    expect(extractSelectorFromError('Unable to locate element: .modal .close-btn')).toBe('.modal .close-btn')
  })

  it('extrae y envuelve como text= el texto citado de un .contains() de Cypress', () => {
    const msg = "Timed out retrying after 4000ms: Expected to find content: 'Aplicar cupón' within the element: <body> but never did."
    expect(extractSelectorFromError(msg)).toBe('text=Aplicar cupón')
  })

  describe('bug real: locator() con data-testid (comillas dobles adentro de comillas simples)', () => {
    it('extrae un [data-testid=...] completo de un timeout real de page.click, sin cortar en la comilla interna', () => {
      const msg = 'TimeoutError: page.click: Timeout 3000ms exceeded.\nCall log:\n  - waiting for locator(\'[data-testid="demo-boton-roto-healify"]\')\n'
      expect(extractSelectorFromError(msg)).toBe('[data-testid="demo-boton-roto-healify"]')
    })

    it('mismo caso con data-cy (Cypress-style testid) y comillas ANSI en el medio', () => {
      const msg = '\x1B[2m  - waiting for locator(\x1B[22m\'[data-cy="checkout-btn"]\'\x1B[2m)\x1B[22m'
      expect(extractSelectorFromError(msg)).toBe('[data-cy="checkout-btn"]')
    })

    it('"Waiting for selector" con comillas dobles adentro de comillas simples', () => {
      expect(extractSelectorFromError(`Waiting for selector '[name="email"]' failed after 30000ms`)).toBe('[name="email"]')
    })

    it('"selector ... not found" con comillas dobles adentro de comillas simples', () => {
      expect(extractSelectorFromError(`selector '[aria-label="Cerrar"]' not found in DOM`)).toBe('[aria-label="Cerrar"]')
    })

    it('locator() delimitado por comillas dobles con comillas simples adentro (caso inverso)', () => {
      expect(extractSelectorFromError(`waiting for locator("//button[text()='Login']")`)).toBe("//button[text()='Login']")
    })

    it('sigue funcionando el caso simple sin comillas anidadas (no regresión)', () => {
      expect(extractSelectorFromError("Timed out waiting for locator('button.primary')")).toBe('button.primary')
    })
  })
})
