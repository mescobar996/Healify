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

  it('should handle --pr flag without crashing (mock git)', () => {
    const specFile = join(testDir, 'pr-test.spec.ts')
    writeFileSync(specFile, `test('pr test', async ({ page }) => {\n  await page.click('#pr-btn')\n})`, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'pr test',
        testFile: specFile,
        selector: '#pr-btn',
        errorMessage: "Element not found",
        status: 'healed',
        fixedSelector: "[data-testid='pr-btn']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    let exitCode = 0
    try {
      execSync(`node "${cliPath}" fix "${reportPath}" --pr --force`, {
        cwd: testDir,
        encoding: 'utf-8',
      })
    } catch (err) {
      exitCode = (err as { status?: number }).status ?? 1
    }

    expect(exitCode).toBe(0)
  })

  it('should chain fix command and verify healify-report.json structure', () => {
    const specFile = join(testDir, 'chain-test.spec.ts')
    writeFileSync(specFile, `test('chain test', async ({ page }) => {\n  await page.click('#chain-btn')\n})`, 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'chain test',
        testFile: specFile,
        selector: '#chain-btn',
        errorMessage: "Element not found",
        status: 'healed',
        fixedSelector: "[data-testid='chain-btn']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
    ])

    execSync(`node "${cliPath}" fix "${reportPath}" --force`, {
      cwd: testDir,
      encoding: 'utf-8',
    })

    const reportContent = readFileSync(reportPath, 'utf-8')
    const report = JSON.parse(reportContent)

    expect(report).toHaveProperty('project')
    expect(report).toHaveProperty('framework')
    expect(report).toHaveProperty('generatedAt')
    expect(report).toHaveProperty('cases')
    expect(Array.isArray(report.cases)).toBe(true)
    expect(report.cases.length).toBe(1)
    expect(report.cases[0]).toHaveProperty('testName')
    expect(report.cases[0]).toHaveProperty('selector')
    expect(report.cases[0]).toHaveProperty('status')
    expect(report.cases[0]).toHaveProperty('fixedSelector')
  })

  it('should verify audit report structure after fix with multiple cases', () => {
    const specFile = join(testDir, 'audit-structure.spec.ts')
    writeFileSync(specFile, [
      `test('audit a', async ({ page }) => {`,
      `  await page.click('#audit-a')`,
      `})`,
      `test('audit b', async ({ page }) => {`,
      `  await page.click('#audit-b')`,
      `})`,
    ].join('\n'), 'utf-8')

    const reportPath = makeHealifyReport(testDir, [
      {
        testName: 'audit a',
        testFile: specFile,
        selector: '#audit-a',
        errorMessage: "Selector not found",
        status: 'healed',
        fixedSelector: "[data-testid='audit-a']",
        confidence: 0.95,
        explanation: '',
        selectorType: 'TESTID',
      },
      {
        testName: 'audit b',
        testFile: specFile,
        selector: '#audit-b',
        errorMessage: "Selector not found",
        status: 'healed',
        fixedSelector: "[data-testid='audit-b']",
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

    const reportContent = readFileSync(reportPath, 'utf-8')
    const report = JSON.parse(reportContent)

    expect(report.project).toBe('integration-test')
    expect(report.framework).toBe('Playwright')
    expect(report.generatedAt).toBeTruthy()
    expect(report.cases.length).toBe(2)

    for (const c of report.cases) {
      expect(c).toHaveProperty('testName')
      expect(c).toHaveProperty('testFile')
      expect(c).toHaveProperty('selector')
      expect(c).toHaveProperty('errorMessage')
      expect(c).toHaveProperty('status')
      expect(c).toHaveProperty('fixedSelector')
      expect(c).toHaveProperty('confidence')
      expect(c).toHaveProperty('selectorType')
    }

    const content = readFileSync(specFile, 'utf-8')
    expect(content).toContain("[data-testid='audit-a']")
    expect(content).toContain("[data-testid='audit-b']")
    expect(content).not.toContain('#audit-a')
    expect(content).not.toContain('#audit-b')
  })
})
