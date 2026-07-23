import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectFramework, findConfigForFramework, healifyPackageFor, installCommand } from '../detect'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-detect-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writePkg(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps, devDependencies: devDeps }))
}

describe('detectFramework', () => {
  it('detecta playwright por devDependency', () => {
    writePkg({}, { '@playwright/test': '^1.58.0' })
    expect(detectFramework(dir).frameworks).toEqual(['playwright'])
  })

  it('detecta cypress por dependency', () => {
    writePkg({ cypress: '^13.0.0' })
    expect(detectFramework(dir).frameworks).toEqual(['cypress'])
  })

  it('detecta selenium por devDependency', () => {
    writePkg({}, { 'selenium-webdriver': '^4.46.0' })
    expect(detectFramework(dir).frameworks).toEqual(['selenium'])
  })

  it('detecta playwright por archivo de config aunque no esté en package.json', () => {
    writePkg()
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default {}')
    expect(detectFramework(dir).frameworks).toEqual(['playwright'])
  })

  it('detecta cypress.config.js (no solo .ts)', () => {
    writePkg()
    writeFileSync(join(dir, 'cypress.config.js'), 'module.exports = {}')
    expect(detectFramework(dir).frameworks).toEqual(['cypress'])
  })

  it('detecta varios frameworks a la vez', () => {
    writePkg({}, { '@playwright/test': '^1.58.0', cypress: '^13.0.0', 'selenium-webdriver': '^4.46.0' })
    expect(detectFramework(dir).frameworks).toEqual(['playwright', 'cypress', 'selenium'])
  })

  it('devuelve frameworks vacío cuando no hay nada', () => {
    writePkg()
    expect(detectFramework(dir).frameworks).toEqual([])
  })

  it('no explota si no hay package.json', () => {
    expect(() => detectFramework(dir)).not.toThrow()
    expect(detectFramework(dir).frameworks).toEqual([])
  })

  it('configPath apunta al config de playwright si existe', () => {
    writePkg({}, { '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default {}')
    expect(detectFramework(dir).configPath).toBe(join(dir, 'playwright.config.ts'))
  })

  it('configPath es null si el framework detectado no tiene archivo de config presente', () => {
    writePkg({}, { '@playwright/test': '^1.58.0' })
    expect(detectFramework(dir).configPath).toBeNull()
  })

  it('configPath es null cuando el único framework es selenium', () => {
    writePkg({}, { 'selenium-webdriver': '^4.46.0' })
    expect(detectFramework(dir).configPath).toBeNull()
  })

  it('packageManager es npm por default', () => {
    writePkg()
    expect(detectFramework(dir).packageManager).toBe('npm')
  })

  it('packageManager es yarn si hay yarn.lock', () => {
    writePkg()
    writeFileSync(join(dir, 'yarn.lock'), '')
    expect(detectFramework(dir).packageManager).toBe('yarn')
  })

  it('packageManager es pnpm si hay pnpm-lock.yaml', () => {
    writePkg()
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectFramework(dir).packageManager).toBe('pnpm')
  })

  it('pnpm gana si coexisten pnpm-lock.yaml y yarn.lock', () => {
    writePkg()
    writeFileSync(join(dir, 'yarn.lock'), '')
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectFramework(dir).packageManager).toBe('pnpm')
  })
})

describe('findConfigForFramework', () => {
  it('encuentra playwright.config.mjs', () => {
    writeFileSync(join(dir, 'playwright.config.mjs'), 'export default {}')
    expect(findConfigForFramework(dir, 'playwright')).toBe(join(dir, 'playwright.config.mjs'))
  })

  it('encuentra cypress.config.cjs', () => {
    writeFileSync(join(dir, 'cypress.config.cjs'), 'module.exports = {}')
    expect(findConfigForFramework(dir, 'cypress')).toBe(join(dir, 'cypress.config.cjs'))
  })

  it('devuelve null si no hay config', () => {
    expect(findConfigForFramework(dir, 'playwright')).toBeNull()
  })

  it('siempre devuelve null para selenium', () => {
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default {}')
    expect(findConfigForFramework(dir, 'selenium')).toBeNull()
  })
})

describe('healifyPackageFor', () => {
  it('mapea cada framework a su paquete', () => {
    expect(healifyPackageFor('playwright')).toBe('@healify/test-runner')
    expect(healifyPackageFor('cypress')).toBe('@healify/cypress-plugin')
    expect(healifyPackageFor('selenium')).toBe('@healify/selenium-plugin')
  })
})

describe('installCommand', () => {
  it('arma el comando de npm', () => {
    expect(installCommand('npm', '@healify/test-runner')).toBe('npm install --save-dev @healify/test-runner')
  })

  it('arma el comando de yarn', () => {
    expect(installCommand('yarn', '@healify/cypress-plugin')).toBe('yarn add --dev @healify/cypress-plugin')
  })

  it('arma el comando de pnpm', () => {
    expect(installCommand('pnpm', '@healify/selenium-plugin')).toBe('pnpm add --save-dev @healify/selenium-plugin')
  })
})
