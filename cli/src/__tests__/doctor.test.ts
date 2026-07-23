import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { doctor } from '../commands/doctor'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-doctor-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writePkg(devDeps: Record<string, string> = {}) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: devDeps }))
}

describe('doctor', () => {
  it('un solo check en rojo si no detecta ningún framework', () => {
    writePkg()
    const report = doctor(dir)
    expect(report.checks).toHaveLength(1)
    expect(report.checks[0].ok).toBe(false)
    expect(report.checks[0].fix).toBeTruthy()
  })

  it('todo en verde cuando está instalado y wireado', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  reporter: [['@healify/test-runner/reporter']],\n})\n`)
    writeFileSync(join(dir, 'healify-report.json'), '{}')

    const report = doctor(dir)

    expect(report.checks.every((c) => c.ok)).toBe(true)
  })

  it('marca el paquete como no instalado con el comando de fix correcto', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    const report = doctor(dir)

    const pkgCheck = report.checks.find((c) => c.label.includes('@healify/test-runner instalado'))
    expect(pkgCheck?.ok).toBe(false)
    expect(pkgCheck?.fix).toBe('npm install --save-dev @healify/test-runner')
  })

  it('marca el config como no wireado y sugiere npx @healify/cli init', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  use: {},\n})\n`)

    const report = doctor(dir)

    const configCheck = report.checks.find((c) => c.label.includes('tiene Healify configurado'))
    expect(configCheck?.ok).toBe(false)
    expect(configCheck?.fix).toBe('npx @healify/cli init')
  })

  it('marca config no encontrado si no hay archivo de config', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })

    const report = doctor(dir)

    const configCheck = report.checks.find((c) => c.label.includes('Config de playwright encontrado'))
    expect(configCheck?.ok).toBe(false)
  })

  it('healify-report.json ausente se marca en rojo con sugerencia de correr los tests', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  reporter: [['@healify/test-runner/reporter']],\n})\n`)

    const report = doctor(dir)

    const reportCheck = report.checks.find((c) => c.label.includes('healify-report.json'))
    expect(reportCheck?.ok).toBe(false)
    expect(reportCheck?.fix).toBeTruthy()
  })

  it('selenium no genera check de config (no tiene archivo)', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = doctor(dir)

    expect(report.checks.some((c) => c.label.includes('Config de selenium'))).toBe(false)
  })

  it('selenium-only: no pide healify-report.json como si fuera un error (nunca lo genera)', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = doctor(dir)

    expect(report.checks.some((c) => c.label.includes('healify-report.json existe'))).toBe(false)
    const infoCheck = report.checks.find((c) => c.info)
    expect(infoCheck).toMatchObject({ label: 'Selenium cura en vivo, no genera reporte', ok: true, info: true })
  })

  it('selenium-only: todos los checks quedan en ok (incluido el informativo)', () => {
    writePkg({ 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })

    const report = doctor(dir)

    expect(report.checks.every((c) => c.ok)).toBe(true)
  })

  it('playwright + selenium juntos: sí pide healify-report.json porque playwright lo genera', () => {
    writePkg({ '@playwright/test': '^1.58.0', '@healify/test-runner': '*', 'selenium-webdriver': '^4.46.0', '@healify/selenium-plugin': '*' })
    writeFileSync(join(dir, 'playwright.config.ts'), `export default defineConfig({\n  reporter: [['@healify/test-runner/reporter']],\n})\n`)

    const report = doctor(dir)

    const reportCheck = report.checks.find((c) => c.label.includes('healify-report.json existe'))
    expect(reportCheck).toBeDefined()
    expect(reportCheck?.ok).toBe(false)
  })

  it('doctor no modifica ningún archivo', () => {
    writePkg({ '@playwright/test': '^1.58.0' })
    const configPath = join(dir, 'playwright.config.ts')
    const original = `export default defineConfig({\n  use: {},\n})\n`
    writeFileSync(configPath, original)

    doctor(dir)

    expect(readFileSync(configPath, 'utf-8')).toBe(original)
  })
})
