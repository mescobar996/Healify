import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
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

function writePkg(devDeps: Record<string, string> = {}) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: devDeps }))
}

describe('init', () => {
  it('devuelve frameworks vacío y no instala nada si no detecta ningún framework', () => {
    writePkg()
    const report = init(dir)
    expect(report.frameworks).toEqual([])
    expect(mockExecSync).not.toHaveBeenCalled()
  })

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
    // igual intenta wirear el config aunque falle la instalación
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

  it('selenium: no intenta editar ningún config', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].framework).toBe('selenium')
    expect(report.results[0].config).toBe('no-config-found')
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
