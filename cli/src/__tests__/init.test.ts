import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execSync: mockExecSync }))

import { init } from '../commands/init'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-init-'))
  mockExecSync.mockReset()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writePkg(devDeps: Record<string, string> = {}, scripts: Record<string, string> = {}) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: devDeps, scripts }))
}

describe('init — CASO C (config existente, falta wirear)', () => {
  it('instala el paquete correcto si falta', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    const report = init(dir)

    expect(mockExecSync).toHaveBeenCalledWith(
      'npm install --save-dev @healify/test-runner',
      expect.objectContaining({ cwd: dir })
    )
    expect(report.results[0].installed).toBe('installed')
  })

  it('no reinstala si el paquete ya está en package.json', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '^0.3.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    const report = init(dir)

    expect(mockExecSync).not.toHaveBeenCalled()
    expect(report.results[0].installed).toBe('already-installed')
  })

  it('marca install-failed si execSync tira, sin romper el resto', () => {
    writePkg({ cypress: '^13.0.0' })
    writeFileSync(join(dir, 'cypress.config.ts'), `export default defineConfig({\n  e2e: { setupNodeEvents(on, config) {} },\n})\n`)
    mockExecSync.mockImplementation(() => { throw new Error('network down') })

    const report = init(dir)

    expect(report.results[0].installed).toBe('install-failed')
    expect(report.results[0].config).toBe('edited')
  })

  it('edita el config de playwright de verdad en disco', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })
    const configPath = join(dir, 'playwright.config.ts')
    writeFileSync(configPath, `export default defineConfig({\n  use: {},\n})\n`)

    const report = init(dir)

    expect(report.results[0].config).toBe('edited')
    expect(readFileSync(configPath, 'utf-8')).toContain('@healify/test-runner/reporter')
  })

  it('no reescribe el config si ya está wireado (idempotente)', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })
    const configPath = join(dir, 'playwright.config.ts')
    const original = `export default defineConfig({\n  reporter: [['list'], ['@healify/test-runner/reporter']],\n})\n`
    writeFileSync(configPath, original)

    const report = init(dir)

    expect(report.results[0].config).toBe('already-wired')
    expect(readFileSync(configPath, 'utf-8')).toBe(original)
  })

  it('procesa varios frameworks detectados en el mismo proyecto', () => {
    writePkg({ '@playwright/test': '^1.58.0', cypress: '^13.0.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    writeFileSync(join(dir, 'cypress.config.ts'), `export default defineConfig({\n  e2e: { setupNodeEvents(on, config) {} },\n})\n`)

    const report = init(dir)

    expect(report.results.map((r) => r.framework)).toEqual(['playwright', 'cypress'])
    expect(report.results.every((r) => r.config === 'edited')).toBe(true)
  })
})

describe('init — CASO B (framework instalado, sin config)', () => {
  it('bug real de sgo-pzbp: paquete instalado pero playwright.config nunca creado -> scaffoldea', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })

    const report = init(dir)

    expect(report.results[0].config).toBe('scaffolded')
    expect(existsSync(join(dir, 'playwright.config.js'))).toBe(true)
    expect(readFileSync(join(dir, 'playwright.config.js'), 'utf-8')).toContain('@healify/test-runner/reporter')
  })

  it('cypress instalado sin config -> scaffoldea config + demo + support', () => {
    writePkg({ cypress: '^13.0.0', '@healify/cypress-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].scaffoldedFiles).toEqual(
      expect.arrayContaining(['cypress.config.js', 'cypress/e2e/healify.demo.cy.js', 'cypress/support/e2e.js'])
    )
    expect(existsSync(join(dir, 'cypress', 'e2e', 'healify.demo.cy.js'))).toBe(true)
  })

  it('selenium: scaffoldea el ejemplo y el demo (no hay config que editar)', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].framework).toBe('selenium')
    expect(report.results[0].config).toBe('scaffolded')
    expect(report.results[0].scaffoldedFiles).toEqual(['healify.selenium.example.js', 'e2e/selenium.demo.test.js'])
    expect(existsSync(join(dir, 'healify.selenium.example.js'))).toBe(true)
    expect(existsSync(join(dir, 'e2e', 'selenium.demo.test.js'))).toBe(true)
  })
})

describe('init — CASO A (nada detectado, elige framework)', () => {
  it('proyecto vacío -> playwright: instala, scaffoldea config + demo + .gitkeep', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'playwright' })

    expect(report.prompted).toBe(true)
    expect(report.frameworks).toEqual(['playwright'])
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm install --save-dev @healify/test-runner',
      expect.objectContaining({ cwd: dir })
    )
    expect(report.results[0].scaffoldedFiles).toEqual(
      expect.arrayContaining(['playwright.config.js', 'e2e/healify.demo.spec.js', 'e2e/.gitkeep'])
    )
    expect(existsSync(join(dir, 'e2e', 'healify.demo.spec.js'))).toBe(true)
  })

  it('proyecto vacío -> cypress: instala, scaffoldea config + demo + support', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'cypress' })

    expect(report.frameworks).toEqual(['cypress'])
    expect(existsSync(join(dir, 'cypress.config.js'))).toBe(true)
    expect(existsSync(join(dir, 'cypress', 'support', 'e2e.js'))).toBe(true)
  })

  it('proyecto vacío -> selenium: instala, scaffoldea ejemplo + demo ejecutable', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'selenium' })

    expect(report.frameworks).toEqual(['selenium'])
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm install --save-dev @healify/selenium-plugin',
      expect.objectContaining({ cwd: dir })
    )
    expect(existsSync(join(dir, 'healify.selenium.example.js'))).toBe(true)
  })

  it('sin chooseFramework inyectado y stdin sin TTY: no cuelga, usa el default playwright', () => {
    writePkg()
    // Forzado explícito: no depender de si vitest corre con una TTY real adjunta —
    // el comportamiento sin-prompt debe ser determinístico en cualquier entorno de CI.
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })

    try {
      const report = init(dir)
      expect(report.prompted).toBe(true)
      expect(report.frameworks).toEqual(['playwright'])
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
    }
  })
})

describe('init — baseURL universal', () => {
  it('vite-only real (puerto en el script dev, no en vite.config): baseURL usa ese puerto', () => {
    // Reproduce sgo-pzbp: "dev": "vite --port=3000 --host=0.0.0.0", vite.config.ts sin server.port.
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite --port=3000 --host=0.0.0.0' } }))
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    writeFileSync(join(dir, 'vite.config.ts'), 'export default { plugins: [] }')

    const report = init(dir, { chooseFramework: () => 'playwright' })

    expect(report.results[0].scaffoldedFiles).toContain('playwright.config.ts')
    expect(readFileSync(join(dir, 'playwright.config.ts'), 'utf-8')).toContain('http://localhost:3000')
  })

  it('sin ninguna pista de puerto: default 5173', () => {
    writePkg()

    init(dir, { chooseFramework: () => 'playwright' })

    expect(readFileSync(join(dir, 'playwright.config.js'), 'utf-8')).toContain('http://localhost:5173')
  })
})

describe('init — JS puro vs TypeScript', () => {
  it('sin tsconfig.json: scaffoldea .js', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'playwright' })

    expect(report.results[0].scaffoldedFiles).toContain('playwright.config.js')
  })

  it('con tsconfig.json: scaffoldea .ts', () => {
    writePkg()
    writeFileSync(join(dir, 'tsconfig.json'), '{}')

    const report = init(dir, { chooseFramework: () => 'playwright' })

    expect(report.results[0].scaffoldedFiles).toContain('playwright.config.ts')
  })
})

describe('init — idempotencia del scaffold', () => {
  it('correr init dos veces no pisa el config ni el demo ya generados', () => {
    writePkg()

    init(dir, { chooseFramework: () => 'playwright' })
    const configPath = join(dir, 'playwright.config.js')
    const editedByUser = readFileSync(configPath, 'utf-8') + '\n// edité esto a mano\n'
    writeFileSync(configPath, editedByUser)

    const second = init(dir, { chooseFramework: () => 'playwright' })

    // La segunda corrida ya detecta el framework por el config existente (CASO C) — el
    // marcador de Healify ya está, así que solo confirma already-wired, nunca reescribe.
    expect(second.results[0].config).toBe('already-wired')
    expect(readFileSync(configPath, 'utf-8')).toBe(editedByUser)
  })
})
