const { defineConfig } = require('cypress')
const { HealifyCypressPlugin } = require('@healify/cypress-plugin')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4322',
    // Registra `cy.healifyGet()` — sin esto el comando no existe.
    supportFile: 'cypress/support/e2e.js',
    video: false,
    screenshotOnRunFailure: false,
    // Cypress no atraviesa shadow DOM por default. Sin esto ni siquiera podría *buscar* adentro.
    includeShadowDom: true,
    // Un solo intento: el ejemplo tiene que fallar rápido y de forma predecible.
    retries: 0,
    defaultCommandTimeout: 4000,
    setupNodeEvents(on, config) {
      // 👇 Lo único que hay que agregar en un proyecto real.
      return HealifyCypressPlugin(on, config)
    },
  },
})
