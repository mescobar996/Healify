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

    const report = init(dir, { checkPort: () => false })

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

  it('cypress instalado sin config -> scaffoldea config + support (sin ningún test)', () => {
    writePkg({ cypress: '^13.0.0', '@healify/cypress-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].scaffoldedFiles).toEqual(['cypress.config.js', 'cypress/support/e2e.js'])
    expect(existsSync(join(dir, 'cypress', 'e2e'))).toBe(false)
  })

  it('selenium: scaffoldea solo el ejemplo de referencia (no hay config que editar, ningún demo ejecutable)', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].framework).toBe('selenium')
    expect(report.results[0].config).toBe('scaffolded')
    expect(report.results[0].scaffoldedFiles).toEqual(['healify.selenium.example.js'])
    expect(existsSync(join(dir, 'healify.selenium.example.js'))).toBe(true)
  })

  it('bug real: webdriverio instalado sin wdio.conf -> scaffoldea SU PROPIO ejemplo, no el de selenium', () => {
    writePkg({ webdriverio: '^9.0.0', '@healify/webdriverio-plugin': '*' })

    const report = init(dir)

    expect(report.results[0].framework).toBe('webdriverio')
    expect(report.results[0].config).toBe('scaffolded')
    expect(report.results[0].scaffoldedFiles).toEqual(['healify.wdio.example.js'])
    expect(existsSync(join(dir, 'healify.wdio.example.js'))).toBe(true)
    expect(existsSync(join(dir, 'healify.selenium.example.js'))).toBe(false)
  })
})

describe('init — CASO A (nada detectado, elige framework)', () => {
  it('proyecto vacío -> playwright: instala, scaffoldea solo el config (ningún test)', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'playwright' })

    expect(report.prompted).toBe(true)
    expect(report.frameworks).toEqual(['playwright'])
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm install --save-dev @healify/test-runner',
      expect.objectContaining({ cwd: dir })
    )
    expect(report.results[0].scaffoldedFiles).toEqual(['playwright.config.js'])
    expect(existsSync(join(dir, 'e2e'))).toBe(false)
  })

  it('proyecto vacío -> cypress: instala, scaffoldea config + support (ningún test)', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'cypress' })

    expect(report.frameworks).toEqual(['cypress'])
    expect(existsSync(join(dir, 'cypress.config.js'))).toBe(true)
    expect(existsSync(join(dir, 'cypress', 'support', 'e2e.js'))).toBe(true)
    expect(existsSync(join(dir, 'cypress', 'e2e'))).toBe(false)
  })

  it('proyecto vacío -> selenium: instala, scaffoldea solo el ejemplo de referencia', () => {
    writePkg()

    const report = init(dir, { chooseFramework: () => 'selenium' })

    expect(report.frameworks).toEqual(['selenium'])
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm install --save-dev @healify/selenium-plugin',
      expect.objectContaining({ cwd: dir })
    )
    expect(report.results[0].scaffoldedFiles).toEqual(['healify.selenium.example.js'])
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

describe('init — detección de puerto', () => {
  it('no agrega portWarning cuando el puerto está libre', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      devDependencies: { '@playwright/test': '^1.58.0' },
      scripts: { dev: 'vite --port=3000' },
    }))
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    const checkPort = vi.fn().mockReturnValue(false)

    const report = init(dir, { checkPort })

    expect(report.portWarning).toBeUndefined()
    expect(checkPort).toHaveBeenCalledWith(3000)
  })

  it('agrega portWarning cuando algo ya responde en el puerto detectado', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      devDependencies: { '@playwright/test': '^1.58.0' },
      scripts: { dev: 'vite --port=3000' },
    }))
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    const checkPort = vi.fn().mockReturnValue(true)

    const report = init(dir, { checkPort })

    expect(report.portWarning).toContain('3000')
    expect(report.portWarning).toContain('Algo ya responde')
  })

  it('usa el puerto del script dev (--port=4000) para el chequeo', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      devDependencies: { '@playwright/test': '^1.58.0' },
      scripts: { dev: 'vite --port=4000' },
    }))
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    const checkPort = vi.fn().mockReturnValue(true)

    const report = init(dir, { checkPort })

    expect(checkPort).toHaveBeenCalledWith(4000)
    expect(report.portWarning).toContain('4000')
  })

  it('default 5173 cuando no hay pista de puerto', () => {
    writePkg()
    const checkPort = vi.fn().mockReturnValue(false)

    init(dir, { chooseFramework: () => 'playwright', checkPort })

    expect(checkPort).toHaveBeenCalledWith(5173)
  })

  it('sin checkPort inyectado: no tira error (usa defaultCheckPort)', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    // No debe tirar excepción — defaultCheckPort falla silenciosamente en CI
    const report = init(dir)
    expect(report.results).toHaveLength(1)
  })

  it('defaultCheckPort parsea el stdout real de Test-NetConnection (True → portWarning)', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    mockExecSync.mockReturnValue('True\r\n')

    const report = init(dir)

    expect(report.portWarning).toContain('5173')
  })

  it('defaultCheckPort parsea el stdout real de Test-NetConnection (False → sin portWarning)', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    mockExecSync.mockReturnValue('False\r\n')

    const report = init(dir)

    expect(report.portWarning).toBeUndefined()
  })

  it('bug real: sin PowerShell disponible (execSync tira) no se confunde con "puerto libre" — avisa que no se pudo chequear', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)
    mockExecSync.mockImplementation(() => { throw new Error('powershell: command not found') })

    const report = init(dir)

    expect(report.portWarning).toContain('No pudimos verificar')
    expect(report.portWarning).toContain('5173')
  })
})

describe('init — forma del proyecto reportada (ext/moduleType)', () => {
  it('proyecto sin tsconfig y sin "type": "module" → js + cjs', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.js'), `module.exports = defineConfig({\n  use: {},\n})\n`)

    const report = init(dir)

    expect(report.results[0].ext).toBe('js')
    expect(report.results[0].moduleType).toBe('cjs')
  })

  it('proyecto con tsconfig.json → ts', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    const report = init(dir)

    expect(report.results[0].ext).toBe('ts')
  })

  it('la forma reportada coincide con la extensión del config scaffoldeado (CASO B, sin config previo)', () => {
    writePkg({ '@playwright/test': '^1.58.0' })

    const result = init(dir).results[0]

    expect(result.scaffoldedFiles).toContain(`playwright.config.${result.ext}`)
  })

  it('Selenium también reporta la forma del proyecto', () => {
    writePkg({ 'selenium-webdriver': '^4.0.0' })
    writeFileSync(join(dir, 'tsconfig.json'), '{}')

    const result = init(dir).results[0]

    expect(result.ext).toBe('ts')
    expect(result.scaffoldedFiles).toContain('healify.selenium.example.ts')
  })
})
