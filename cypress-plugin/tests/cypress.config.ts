import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '../src/plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
})
