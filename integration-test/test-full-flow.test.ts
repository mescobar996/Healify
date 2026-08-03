import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cliPath = join(__dirname, '..', 'cli', 'dist', 'index.js')

function makeHealifyReport(testDir: string, cases: object[]): string {
  const report = {
    project: 'integration-test',
    framework: 'Playwright',
    generatedAt: new Date().toISOString(),
    cases,
  }
  const reportPath = join(testDir, 'healify-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  return reportPath
}

describe('Healify Full Flow Integration', () => {
  let testDir: string

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'healify-integration-'))
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('should run healify fix and apply healed selectors to test files', () => {
    const specFile = join(testDir, 'login.spec.ts')
    writeFileSync(specFile, [
      `test('iniciar sesion', async ({ page }) => {`,
      `  await page.click('#login-btn-old')`,
      `})`,
    ].join('\n'), 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'iniciar sesion',
        testFile: specFile,
        selector: '#login-btn-old',
        errorMessage: "Waiting for selector '#login-btn-old' failed",
        status: 'healed',
        fixedSelector: "[data-testid='login-btn']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    const output = execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    expect(output).toContain('Healify')

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toContain("[data-testid='login-btn']")
    expect(content).not.toContain('#login-btn-old')
  })

  it('should run healify fix --dry-run without modifying files', () => {
    const specFile = join(testDir, 'checkout.spec.ts')
    const originalContent = [
      `test('agregar al carrito', async ({ page }) => {`,
      `  await page.click('#add-to-cart-old')`,
      `})`,
    ].join('\n')
    writeFileSync(specFile, originalContent, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'agregar al carrito',
        testFile: specFile,
        selector: '#add-to-cart-old',
        errorMessage: "Element not found: #add-to-cart-old",
        status: 'healed',
        fixedSelector: "[data-testid='add-to-cart']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    const output = execSync(`node "${cliPath}" fix "${reportPath}" --dry-run --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    expect(output).toContain('Healify')

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toBe(originalContent)
  })

  it('should report multiple selectors with correct summary', () => {
    const specFile = join(testDir, 'multi.spec.ts')
    writeFileSync(specFile, [
      `test('test a', async ({ page }) => {`,
      `  await page.click('#btn-a-old')`,
      `})`,
      `test('test b', async ({ page }) => {`,
      `  await page.click('#btn-b-old')`,
      `})`,
    ].join('\n'), 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'test a',
        testFile: specFile,
        selector: '#btn-a-old',
        errorMessage: "Selector not found",
        status: 'healed',
        fixedSelector: "[data-testid='btn-a']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
      {
        testName: 'test b',
        testFile: specFile,
        selector: '#btn-b-old',
        errorMessage: "Selector not found",
        status: 'healed',
        fixedSelector: "[data-testid='btn-b']",
        confidence: 0.92,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    const output = execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    expect(output).toContain('Healify')
    expect(output).toContain('2')

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toContain("[data-testid='btn-a']")
    expect(content).toContain("[data-testid='btn-b']")
    expect(content).not.toContain('#btn-a-old')
    expect(content).not.toContain('#btn-b-old')
  })

  it('should skip ambiguous selectors without modifying file', () => {
    const specFile = join(testDir, 'ambiguous.spec.ts')
    const originalContent = [
      `test('duplicate selector', async ({ page }) => {`,
      `  await page.click('#same-btn')`,
      `  await page.click('#same-btn')`,
      `})`,
    ].join('\n')
    writeFileSync(specFile, originalContent, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'duplicate selector',
        testFile: specFile,
        selector: '#same-btn',
        errorMessage: "Element not found",
        status: 'healed',
        fixedSelector: "[data-testid='same']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    const output = execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    expect(output).toContain('salteado')

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toBe(originalContent)
  })

  it('should skip review status cases without modifying file', () => {
    const specFile = join(testDir, 'review.spec.ts')
    const originalContent = `test('review case', async ({ page }) => {\n  await page.click('#review-btn')\n})`
    writeFileSync(specFile, originalContent, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'review case',
        testFile: specFile,
        selector: '#review-btn',
        errorMessage: "Element not found",
        status: 'review',
        fixedSelector: "[data-testid='review']",
        confidence: 0.85,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    const output = execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    expect(output).toContain('sin tocar')

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toBe(originalContent)
  })

  it('should record history when not in dry-run mode', () => {
    const specFile = join(testDir, 'history.spec.ts')
    writeFileSync(specFile, `test('history test', async ({ page }) => {\n  await page.click('#hist-btn')\n})`, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'history test',
        testFile: specFile,
        selector: '#hist-btn',
        errorMessage: "Element not found",
        status: 'healed',
        fixedSelector: "[data-testid='hist']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    const historyPath = join(testDir, '.healify', 'history.jsonl')
    expect(existsSync(historyPath)).toBe(true)

    const historyContent = readFileSync(historyPath, 'utf-8')
    expect(historyContent).toContain('#hist-btn')
  })

  it('should not record history in dry-run mode', () => {
    const dryRunDir = mkdtempSync(join(tmpdir(), 'healify-dryrun-'))
    try {
      const specFile = join(dryRunDir, 'dry.spec.ts')
      writeFileSync(specFile, `test('dry test', async ({ page }) => {\n  await page.click('#dry-btn')\n})`, 'utf-8')

      const reportPath = makeHealifyReport(dryRunDir, [
        {
          testName: 'dry test',
          testFile: specFile,
          selector: '#dry-btn',
          errorMessage: "Element not found",
          status: 'healed',
          fixedSelector: "[data-testid='dry']",
          confidence: 0.95,
          explanation: '',
          selectorType: 'TESTID',
        },
      ])

      execSync(`node "${cliPath}" fix "${reportPath}" --dry-run --force`, {
        cwd: dryRunDir,
        encoding: 'utf-8',
      })

      const historyPath = join(dryRunDir, '.healify', 'history.jsonl')
      expect(existsSync(historyPath)).toBe(false)
    } finally {
      rmSync(dryRunDir, { recursive: true, force: true })
    }
  })

  it('should handle empty report gracefully', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'healify-empty-'))
    try {
      const reportPath = makeHealifyReport(emptyDir, [])

      const output = execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
        cwd: emptyDir,
        encoding: 'utf-8',
      })

      expect(output).toContain('Healify')
      expect(output).toContain('Ningún selector roto')
    } finally {
      rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('should display version with --version flag', () => {
    const output = execSync(`node "${cliPath}" --version`, {
      encoding: 'utf-8',
    })

    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should display help with --help flag', () => {
    const output = execSync(`node "${cliPath}" --help`, {
      encoding: 'utf-8',
    })

    expect(output).toContain('healify')
    expect(output).toContain('fix')
    expect(output).toContain('init')
    expect(output).toContain('doctor')
  })
})
