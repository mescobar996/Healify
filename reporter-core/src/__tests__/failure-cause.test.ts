import { describe, it, expect } from 'vitest'
import { diagnoseFailure } from '../failure-cause'

describe('diagnoseFailure', () => {
  describe('clasifica como selector los fallos que sí son de selector', () => {
    // Estos son los mensajes que el motor viene curando desde siempre: si alguno cayera de
    // 'selector', el clasificador estaría apagando funcionalidad que ya andaba.
    const selectorErrors = [
      "Waiting for selector '#add-to-cart-btn' failed",
      'Element not found: .card > .title',
      'Unable to locate element: {"method":"css selector","selector":"#login"}',
      "Timed out 5000ms waiting for locator('[data-testid=\"buy\"]')",
      'Expected to find element: `#login-btn`, but never found it.',
      "Expected to find content: 'Agregar al carrito' but never did.",
      'waiting for getByRole(\'button\', { name: \'Comprar\' })',
    ]

    for (const errorMessage of selectorErrors) {
      it(errorMessage.slice(0, 55), () => {
        const diagnosis = diagnoseFailure(errorMessage)
        expect(diagnosis.cause).toBe('selector')
        expect(diagnosis.healable).toBe(true)
      })
    }
  })

  it('un timeout de Playwright esperando un locator sigue siendo un selector roto', () => {
    // El caso que obliga a que la regla de timing sea angosta: "Timed out ... waiting for
    // locator" es el pan de cada día del motor. Si la palabra "Timeout" sola disparara la
    // regla de timing, Healify dejaría de curar su caso principal.
    const diagnosis = diagnoseFailure(
      "locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for locator('#comprar')"
    )
    expect(diagnosis.cause).toBe('selector')
    expect(diagnosis.healable).toBe(true)
  })

  it('una aserción fallida no se cura, aunque el mensaje mencione un locator', () => {
    // El falso verde que motiva todo el módulo: el elemento se encontró, falló el valor.
    // Proponer otro selector acá haría pasar el test tapando el defecto.
    const diagnosis = diagnoseFailure(
      "expect(page.locator('#total')).toHaveText('99')\n\nExpected: \"99\"\nReceived: \"12\""
    )
    expect(diagnosis.cause).toBe('assertion')
    expect(diagnosis.healable).toBe(false)
    expect(diagnosis.rationale).toContain('tapando el defecto')
  })

  it('el fraseo de aserción de Cypress para un elemento ausente sigue siendo selector', () => {
    // "Expected to find element" parece una aserción y no lo es: es como Cypress reporta un
    // selector que nunca apareció.
    const diagnosis = diagnoseFailure(
      'AssertionError: Timed out retrying: Expected to find element: `#carrito`, but never found it.'
    )
    expect(diagnosis.cause).toBe('selector')
    expect(diagnosis.healable).toBe(true)
  })

  it('un TypeError es un error de runtime', () => {
    const diagnosis = diagnoseFailure("TypeError: Cannot read properties of undefined (reading 'click')")
    expect(diagnosis.cause).toBe('runtime')
    expect(diagnosis.healable).toBe(false)
    expect(diagnosis.signal).toContain('TypeError')
  })

  it('un error de red es de navegación/entorno', () => {
    const diagnosis = diagnoseFailure('page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/')
    expect(diagnosis.cause).toBe('navigation')
    expect(diagnosis.healable).toBe(false)
  })

  it('una espera de navegación es timing, no selector', () => {
    const diagnosis = diagnoseFailure('page.waitForLoadState: Timeout 30000ms exceeded while waiting for networkidle')
    expect(diagnosis.cause).toBe('timing')
    expect(diagnosis.healable).toBe(false)
  })

  it('sin señal reconocible devuelve unknown y no cura', () => {
    const diagnosis = diagnoseFailure('el test falló')
    expect(diagnosis.cause).toBe('unknown')
    expect(diagnosis.healable).toBe(false)
  })

  it('el runtime gana sobre la aserción cuando el mensaje trae las dos cosas', () => {
    // Un TypeError adentro de un expect() sigue siendo un bug de código, no un valor que no
    // coincide: la causa accionable es la de más arriba en la cadena.
    const diagnosis = diagnoseFailure(
      "expect(received).toBe(expected)\nTypeError: Cannot read properties of null (reading 'text')"
    )
    expect(diagnosis.cause).toBe('runtime')
  })

  it('el signal recorta y normaliza el fragmento que disparó la regla', () => {
    const diagnosis = diagnoseFailure('ReferenceError:   foo   is not defined')
    expect(diagnosis.signal).toBe('ReferenceError')
    expect(diagnosis.signal!.length).toBeLessThanOrEqual(120)
  })
})
