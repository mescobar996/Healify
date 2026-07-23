import { describe, it, expect } from 'vitest'
import { transformSync } from 'esbuild'
import { scaffoldPlaywright, scaffoldCypress, scaffoldSelenium } from '../scaffold'

describe('scaffold', () => {
  it('playwright: config .ts trae baseURL y el reporter de Healify ya wireado, sin ningún test', () => {
    const files = scaffoldPlaywright('http://localhost:5173', 'ts', 'esm')
    expect(files).toHaveLength(1)
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

  it('cypress: config trae HealifyCypressPlugin wireado en setupNodeEvents desde cero, sin ningún test', () => {
    const files = scaffoldCypress('http://localhost:5173', 'ts', 'esm')
    expect(files.map((f) => f.path)).toEqual(['cypress.config.ts', 'cypress/support/e2e.ts'])
    const config = files.find((f) => f.path === 'cypress.config.ts')!
    expect(config.content).toContain('HealifyCypressPlugin(on, config)')
    expect(config.content).toContain("baseUrl: 'http://localhost:5173'")
  })

  it('selenium: scaffoldea solo el ejemplo de referencia, sin ningún demo ejecutable', () => {
    const files = scaffoldSelenium('ts')
    expect(files.map((f) => f.path)).toEqual(['healify.selenium.example.ts'])
    const example = files[0]
    expect(example.content).toContain('new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)')
    expect(example.path.startsWith('e2e/')).toBe(false)
  })

  it('todos los archivos generados parsean como TS/JS válido', () => {
    const allFiles = [
      ...scaffoldPlaywright('http://localhost:5173', 'ts', 'esm'),
      ...scaffoldCypress('http://localhost:5173', 'ts', 'esm'),
      ...scaffoldSelenium('ts'),
    ]
    for (const f of allFiles) {
      expect(() => transformSync(f.content, { loader: 'ts' }), f.path).not.toThrow()
    }
  })
})
