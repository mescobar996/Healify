import type { ModuleType } from './detect'

export interface ScaffoldFile {
  path: string
  content: string
}

function playwrightConfigContent(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): string {
  const body = `  testDir: './e2e',
  use: {
    baseURL: '${baseUrl}',
  },
  reporter: [['list'], ['@healify/test-runner/reporter']],`

  if (ext === 'js' && moduleType === 'cjs') {
    return `const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
${body}
})
`
  }

  return `import { defineConfig } from '@playwright/test'

export default defineConfig({
${body}
})
`
}

function cypressConfigContent(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): string {
  const body = `  e2e: {
    baseUrl: '${baseUrl}',
    setupNodeEvents(on, config) {
      HealifyCypressPlugin(on, config)
      return config
    },
  },`

  if (ext === 'js' && moduleType === 'cjs') {
    return `const { defineConfig } = require('cypress')
const { HealifyCypressPlugin } = require('@healify/cypress-plugin')

module.exports = defineConfig({
${body}
})
`
  }

  return `import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
${body}
})
`
}

function cypressSupportContent(): string {
  return `// Support file de Cypress, se carga antes de cada test. Vacío a propósito —
// Healify no necesita nada acá, el wiring vive en cypress.config vía setupNodeEvents.
export {}
`
}

function seleniumExampleContent(): string {
  return `/**
 * Ejemplo de cómo envolver tu WebDriver con Healify. A diferencia de Playwright/Cypress,
 * Selenium no tiene archivo de config ni hook de "fin de corrida" — .wrap() cura en vivo,
 * selector por selector, dentro de tu propio código de test. Copiá este patrón a donde
 * armes tu driver real (no hace falta ejecutar este archivo).
 */
import { Builder } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

export async function createHealedDriver() {
  const raw = await new Builder().forBrowser('chrome').build()
  return new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)
}
`
}

function webdriverioExampleContent(): string {
  return `/**
 * Ejemplo de cómo envolver tu browser de WebdriverIO con Healify. Igual que Selenium,
 * WebdriverIO no tiene hook de "fin de corrida" que Healify pueda usar para un config
 * automático — .wrap() cura en vivo, selector por selector, dentro de tu propio código
 * de test. Copiá este patrón a donde uses el objeto \`browser\` real (no hace falta
 * ejecutar este archivo).
 */
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

export function wrapHealedBrowser(browser: WebdriverIO.Browser) {
  return new HealifyWebdriverIOPlugin({ onEvent: console.log }).wrap(browser)
}
`
}

/** Solo config real, wireada con el reporter de Healify — sin ningún test generado. */
export function scaffoldPlaywright(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): ScaffoldFile[] {
  return [{ path: `playwright.config.${ext}`, content: playwrightConfigContent(baseUrl, ext, moduleType) }]
}

/** Config real + support file (Cypress lo exige para e2e testing, no es un extra de Healify) — sin ningún test generado. */
export function scaffoldCypress(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): ScaffoldFile[] {
  return [
    { path: `cypress.config.${ext}`, content: cypressConfigContent(baseUrl, ext, moduleType) },
    { path: `cypress/support/e2e.${ext}`, content: cypressSupportContent() },
  ]
}

/** Solo el ejemplo de referencia (no se ejecuta, no simula ningún resultado) — sin ningún demo ejecutable. */
export function scaffoldSelenium(ext: 'ts' | 'js'): ScaffoldFile[] {
  return [{ path: `healify.selenium.example.${ext}`, content: seleniumExampleContent() }]
}

/** Solo el ejemplo de referencia (no se ejecuta, no simula ningún resultado) — sin ningún demo ejecutable. */
export function scaffoldWebdriverio(ext: 'ts' | 'js'): ScaffoldFile[] {
  return [{ path: `healify.wdio.example.${ext}`, content: webdriverioExampleContent() }]
}
