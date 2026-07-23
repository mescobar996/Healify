import { describe, it, expect } from 'vitest'
import { wirePlaywrightConfig, wireCypressConfig, PLAYWRIGHT_MARKER, CYPRESS_MARKER } from '../config-edit'

describe('wirePlaywrightConfig', () => {
  it('agrega el reporter cuando ya existe un array reporter: []', () => {
    const content = `export default defineConfig({\n  reporter: [['list']],\n})\n`
    const result = wirePlaywrightConfig(content)
    expect(result.status).toBe('edited')
    expect(result.content).toContain(`reporter: [['${PLAYWRIGHT_MARKER}'], ['list']]`)
  })

  it('agrega la key reporter completa cuando no existe ninguna', () => {
    const content = `import { defineConfig } from '@playwright/test'\n\nexport default defineConfig({\n  use: { headless: true },\n})\n`
    const result = wirePlaywrightConfig(content)
    expect(result.status).toBe('edited')
    expect(result.content).toContain(`reporter: [['list'], ['${PLAYWRIGHT_MARKER}']],`)
    // no debe tocar el resto del archivo
    expect(result.content).toContain('use: { headless: true }')
  })

  it('es idempotente: no duplica si ya está wireado', () => {
    const content = `export default defineConfig({\n  reporter: [['list'], ['${PLAYWRIGHT_MARKER}']],\n})\n`
    const result = wirePlaywrightConfig(content)
    expect(result.status).toBe('already-wired')
    expect(result.content).toBeUndefined()
  })

  it('no toca un reporter que no es array (forma no reconocida)', () => {
    const content = `export default defineConfig({\n  reporter: 'list',\n})\n`
    const result = wirePlaywrightConfig(content)
    expect(result.status).toBe('unsupported-shape')
    expect(result.content).toBeUndefined()
  })

  it('unsupported-shape si no encuentra defineConfig(', () => {
    const content = `module.exports = { use: {} }\n`
    const result = wirePlaywrightConfig(content)
    expect(result.status).toBe('unsupported-shape')
  })
})

describe('wireCypressConfig', () => {
  it('agrega el import y la llamada dentro de setupNodeEvents(on, config) { }', () => {
    const content = `import { defineConfig } from 'cypress'\n\nexport default defineConfig({\n  e2e: {\n    setupNodeEvents(on, config) {\n      // implement node event listeners here\n    },\n  },\n})\n`
    const result = wireCypressConfig(content)
    expect(result.status).toBe('edited')
    expect(result.content).toContain(`import { HealifyCypressPlugin } from '${CYPRESS_MARKER}'`)
    expect(result.content).toContain('HealifyCypressPlugin(on, config)')
    // no debe borrar el comentario original
    expect(result.content).toContain('// implement node event listeners here')
  })

  it('soporta la forma setupNodeEvents: (on, config) => { }', () => {
    const content = `export default defineConfig({\n  e2e: {\n    setupNodeEvents: (on, config) => {\n      return config\n    },\n  },\n})\n`
    const result = wireCypressConfig(content)
    expect(result.status).toBe('edited')
    expect(result.content).toContain('HealifyCypressPlugin(on, config)')
    // no debe pisar el return existente
    expect(result.content).toContain('return config')
  })

  it('es idempotente: no duplica si ya está wireado', () => {
    const content = `import { HealifyCypressPlugin } from '${CYPRESS_MARKER}'\nexport default defineConfig({\n  e2e: {\n    setupNodeEvents(on, config) {\n      HealifyCypressPlugin(on, config)\n    },\n  },\n})\n`
    const result = wireCypressConfig(content)
    expect(result.status).toBe('already-wired')
    expect(result.content).toBeUndefined()
  })

  it('unsupported-shape si no encuentra setupNodeEvents', () => {
    const content = `export default defineConfig({\n  e2e: {},\n})\n`
    const result = wireCypressConfig(content)
    expect(result.status).toBe('unsupported-shape')
  })
})
