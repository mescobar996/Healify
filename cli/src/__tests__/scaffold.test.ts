import { describe, it, expect } from 'vitest'
import { transformSync } from 'esbuild'
import {
  scaffoldPlaywright,
  scaffoldCypress,
  scaffoldSelenium,
  DEMO_CSS_SELECTOR,
  DEMO_SELENIUM_BROKEN_ID,
  DEMO_SELENIUM_HEALED_CLASS,
} from '../scaffold'

describe('scaffold', () => {
  it('DEMO_CSS_SELECTOR usa sintaxis data-testid -> el motor lo clasifica TESTID (confidence >= 0.90 siempre)', () => {
    expect(DEMO_CSS_SELECTOR).toMatch(/^\[data-testid="[^"]+"\]$/)
  })

  it('playwright: config .ts trae baseURL y el reporter de Healify ya wireado', () => {
    const files = scaffoldPlaywright('http://localhost:5173', 'ts', 'esm')
    const config = files.find((f) => f.path === 'playwright.config.ts')!
    expect(config.content).toContain("baseURL: 'http://localhost:5173'")
    expect(config.content).toContain('@healify/test-runner/reporter')
  })

  it('playwright: config .js en proyecto CJS usa require/module.exports, no import/export', () => {
    const files = scaffoldPlaywright('http://localhost:3000', 'js', 'cjs')
    const config = files.find((f) => f.path === 'playwright.config.js')!
    expect(config.content).toContain("require('@playwright/test')")
    expect(config.content).not.toContain('import {')
  })

  it('cypress: config trae HealifyCypressPlugin wireado en setupNodeEvents desde cero', () => {
    const files = scaffoldCypress('http://localhost:5173', 'ts', 'esm')
    const config = files.find((f) => f.path === 'cypress.config.ts')!
    expect(config.content).toContain('HealifyCypressPlugin(on, config)')
    expect(config.content).toContain("baseUrl: 'http://localhost:5173'")
  })

  it('selenium: el demo ejecutable usa HealifySeleniumPlugin().wrap() con threshold bajado y una página autocontenida', () => {
    const files = scaffoldSelenium('ts')
    const demo = files.find((f) => f.path === 'healify.selenium.demo.ts')!
    expect(demo.content).toContain('new HealifySeleniumPlugin({ onEvent: console.log, confidenceThreshold: 0.75 }).wrap(raw)')
    expect(demo.content).toContain(`#${DEMO_SELENIUM_BROKEN_ID}`)
    // El HTML embebido va serializado con JSON.stringify -> las comillas quedan escapadas (\").
    expect(demo.content).toContain(`class=\\"${DEMO_SELENIUM_HEALED_CLASS}\\"`)
    expect(demo.content).not.toContain('${baseUrl}')
  })

  it('selenium: el demo NO vive en e2e/ ni usa sufijo .test./.spec. (evita que Playwright/Cypress lo confundan con un test propio)', () => {
    const files = scaffoldSelenium('ts')
    for (const f of files) {
      expect(f.path.startsWith('e2e/')).toBe(false)
      expect(f.path).not.toMatch(/\.(spec|test)\.ts$/)
    }
  })

  it('selenium: el ejemplo (no ejecutable) sigue el patrón wrap() del README, sin threshold custom', () => {
    const files = scaffoldSelenium('ts')
    const example = files.find((f) => f.path === 'healify.selenium.example.ts')!
    expect(example.content).toContain('new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)')
  })

  it('todos los archivos generados parsean como TS/JS válido (regresión: un "*/" literal dentro de un comentario JSDoc lo cerraba antes de tiempo)', () => {
    const allFiles = [
      ...scaffoldPlaywright('http://localhost:5173', 'ts', 'esm'),
      ...scaffoldCypress('http://localhost:5173', 'ts', 'esm'),
      ...scaffoldSelenium('ts'),
    ]
    for (const f of allFiles) {
      if (f.path.endsWith('.gitkeep')) continue
      expect(() => transformSync(f.content, { loader: 'ts' }), f.path).not.toThrow()
    }
  })
})
