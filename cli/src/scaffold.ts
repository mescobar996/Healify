import type { ModuleType } from './detect'

/**
 * Selector roto a propósito, compartido por los 3 demos. Usa sintaxis `[data-testid=...]`
 * para que analyzeAndHeal() lo clasifique como TESTID (confidence base 0.95) — el ajuste
 * determinístico por hash va de -0.05 a +0.049, así que el piso real es 0.90, exactamente
 * el HEALED_THRESHOLD de reporter-core. El demo siempre termina en "healed", sin depender
 * de que el selector matchee algo real en la página: la heurística es 100% pattern-matching
 * de texto, no verifica el DOM.
 */
export const DEMO_TESTID = 'demo-boton-roto-healify'
export const DEMO_CSS_SELECTOR = `[data-testid="${DEMO_TESTID}"]`

/**
 * El demo de Selenium NO puede reusar DEMO_CSS_SELECTOR. La estrategia TESTID solo
 * normaliza el estilo de comillas (`[data-testid="x"]` -> `[data-testid='x']`) — para el
 * navegador ambas son EXACTAMENTE el mismo selector CSS, matchean el mismo elemento. Eso
 * significa que si el original no encuentra nada, el reintento con el "fix" tampoco va a
 * encontrar nada nunca (no hay forma de que un elemento real exista para el fixedSelector
 * pero no para el original). Confirmado corriendo el demo real: el evento de cura se emite
 * bien (confidence 0.93) pero el reintento vuelve a tirar NoSuchElementError porque la
 * página no tiene ningún elemento con ese testid. Bug de diseño real, no de código.
 *
 * Para que Selenium (que reintenta en vivo, a diferencia de Playwright/Cypress que solo
 * clasifican offline) pueda mostrar una cura Y un click exitoso de verdad, hace falta un
 * selector cuyo "fix" sea un selector CSS genuinamente distinto — la estrategia de ID
 * dinámico -> clase estable sirve: extractBaseClass('boton-viejo-12345678') dio
 * '.boton-viejo' (confirmado corriendo analyzeAndHeal() real). Esa clase sí puede existir
 * en un elemento real aunque el ID original no.
 */
export const DEMO_SELENIUM_BROKEN_ID = 'boton-viejo-12345678'
export const DEMO_SELENIUM_HEALED_CLASS = 'boton-viejo'

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

function playwrightDemoSpecContent(): string {
  return `import { test, expect } from '@playwright/test'

// Selector roto a propósito — no existe en el DOM. Al fallar, Healify propone una cura
// heurística y la vuelca en healify-report.html/json (correlo con \`npm run verify\` o
// mirá el archivo directo después de \`npx playwright test\`). Necesitás tu app corriendo
// en el baseURL de playwright.config antes de correr este test (ej. \`npm run dev\`).
// Borralo cuando ya viste el reporte una vez.
test('healify demo — selector roto', async ({ page }) => {
  await page.goto('/')
  await page.click('${DEMO_CSS_SELECTOR}', { timeout: 3000 })
  await expect(page).toBeTruthy()
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

function cypressDemoSpecContent(): string {
  return `// Selector roto a propósito — no existe en el DOM. Al fallar, Healify propone una cura
// heurística y la vuelca en healify-report.html/json. Necesitás tu app corriendo en el
// baseUrl de cypress.config antes de correr este test (ej. \`npm run dev\`).
// Borralo cuando ya viste el reporte una vez.
describe('healify demo', () => {
  it('selector roto', () => {
    cy.visit('/')
    cy.get('${DEMO_CSS_SELECTOR}', { timeout: 3000 }).click()
  })
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

function seleniumDemoTestContent(): string {
  const demoHtml = `<!doctype html><html><body><button class="${DEMO_SELENIUM_HEALED_CLASS}">Click</button></body></html>`

  return `/**
 * Demo ejecutable (no es un test de ningún framework — Selenium no tiene config para
 * wirear, así que esto es un script standalone). Corré con \`npx tsx e2e/selenium.demo.test.ts\`
 * (o compilá con tsc y usá \`node\`). Requiere ChromeDriver instalado — no requiere tu app
 * corriendo, navega a una página mínima autocontenida (data: URL) para no depender del DOM
 * real de tu proyecto. Borralo cuando ya viste la cura una vez.
 *
 * confidenceThreshold bajado SOLO para este demo: el selector elegido produce confidence
 * 0.82 (por debajo del 0.9 default de producción), a propósito, para no auto-aplicar curas
 * de baja confianza en un proyecto real sin que un humano las revise primero. Para tu código
 * real dejá el default (ver healify.selenium.example.ts).
 */
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

const DEMO_HTML = ${JSON.stringify(demoHtml)}

async function main(): Promise<void> {
  const raw = await new Builder().forBrowser('chrome').build()
  const driver = new HealifySeleniumPlugin({ onEvent: console.log, confidenceThreshold: 0.75 }).wrap(raw)
  try {
    await driver.get('data:text/html;charset=utf-8,' + encodeURIComponent(DEMO_HTML))
    const el = await driver.findElement(By.css('#${DEMO_SELENIUM_BROKEN_ID}'))
    await el.click()
    console.log('✅ Healify curó el selector en vivo y el click funcionó — mirá el evento "healed" arriba.')
  } catch (err) {
    console.error('❌ El demo no pudo curar/clickear. Mirá el evento de arriba (si hay uno) para el detalle:', err instanceof Error ? err.message : err)
  } finally {
    await driver.quit()
  }
}

main()
`
}

export function scaffoldPlaywright(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): ScaffoldFile[] {
  return [
    { path: `playwright.config.${ext}`, content: playwrightConfigContent(baseUrl, ext, moduleType) },
    { path: `e2e/healify.demo.spec.${ext}`, content: playwrightDemoSpecContent() },
    { path: 'e2e/.gitkeep', content: '' },
  ]
}

export function scaffoldCypress(baseUrl: string, ext: 'ts' | 'js', moduleType: ModuleType): ScaffoldFile[] {
  return [
    { path: `cypress.config.${ext}`, content: cypressConfigContent(baseUrl, ext, moduleType) },
    { path: `cypress/e2e/healify.demo.cy.${ext}`, content: cypressDemoSpecContent() },
    { path: `cypress/support/e2e.${ext}`, content: cypressSupportContent() },
  ]
}

// Selenium no navega al baseURL real en el demo (ver comentario en seleniumDemoTestContent) —
// no toma baseUrl a propósito, a diferencia de scaffoldPlaywright/scaffoldCypress.
export function scaffoldSelenium(ext: 'ts' | 'js'): ScaffoldFile[] {
  return [
    { path: `healify.selenium.example.${ext}`, content: seleniumExampleContent() },
    { path: `e2e/selenium.demo.test.${ext}`, content: seleniumDemoTestContent() },
  ]
}
