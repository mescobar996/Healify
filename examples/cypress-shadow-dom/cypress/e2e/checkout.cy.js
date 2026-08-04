/**
 * El botón de pagar vive DENTRO del shadow root de `<checkout-widget>`, y su id cambió en el
 * último deploy. O sea: el selector está roto Y el elemento está escondido detrás de una
 * frontera de shadow DOM.
 *
 * `cy.healifyGet()` es igual a `cy.get()` hasta que el selector falla. Ahí sondea el DOM real
 * —atravesando shadow roots abiertos— y reintenta con lo que encontró de verdad. El test pasa
 * sin que nadie toque el código.
 */
describe('checkout', () => {
  it('paga el pedido aunque el id del botón haya cambiado', () => {
    cy.visit('/')

    // El id real es #pay-btn-7c4d2e. Este ya no existe.
    cy.healifyGet('#pay-btn-a1b2c3').click()

    cy.get('#resultado').should('have.text', 'Pago confirmado')
  })
})
