describe('sample failing spec', () => {
  it('fails on purpose so the plugin reports it', () => {
    cy.document().then((doc) => {
      doc.body.innerHTML = '<button id="real-button">Click me</button>'
    })
    cy.get('#does-not-exist', { timeout: 1000 }).click()
  })
})
