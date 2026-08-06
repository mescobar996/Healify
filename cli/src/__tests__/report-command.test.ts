import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockLoadConfig, mockResolveAgile, mockReportDefects, mockBuildAgileDefects } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(() => ({})),
  mockResolveAgile: vi.fn(() => ({ enabled: false, provider: 'jira', issueType: 'Bug', priorityBySeverity: {}, labels: [] })),
  mockReportDefects: vi.fn(),
  // Anotado por el mismo motivo que en heal-command: `() => []` infiere `never[]`.
  mockBuildAgileDefects: vi.fn((): unknown[] => []),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return {
    ...actual,
    loadConfig: mockLoadConfig,
    resolveAgile: mockResolveAgile,
    reportDefects: mockReportDefects,
    buildAgileDefects: mockBuildAgileDefects,
  }
})

import { runReport } from '../commands/report'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

function makeCase(): LocalCaseResult {
  return {
    testName: 'compra exprés',
    testFile: 'e2e/compra.spec.ts',
    selector: '#comprar-ahora-a1b2c3',
    errorMessage: 'NoSuchElementError: no se encontró #comprar-ahora-a1b2c3',
    status: 'unresolved',
    fixedSelector: '',
    confidence: 0,
    explanation: '',
    selectorType: 'ID',
    cause: 'selector',
    defectId: 'HLF-AABB11',
    severity: 'blocker',
    expected: 'El botón "Comprar ahora" es visible.',
    actual: 'No se encontró ningún elemento con #comprar-ahora-a1b2c3.',
    steps: ['Ir a /checkout', 'Hacer click en "Comprar ahora"'],
  }
}

function writeReport(dir: string): string {
  const run: LocalRun = {
    project: 'Healify demo',
    framework: 'playwright',
    generatedAt: new Date('2026-08-03T12:00:00.000Z'),
    cases: [makeCase()],
    environment: { os: 'win32', node: 'v22.0.0', framework: 'playwright', frameworkVersion: '1.49.0', baseURL: 'https://demo.local' },
  }
  const path = join(dir, 'healify-report.json')
  writeFileSync(path, JSON.stringify(run))
  return path
}

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), 'healify-report-'))
}

describe('runReport', () => {
  let dir: string
  let reportPath: string

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveAgile.mockReturnValue({ enabled: false, provider: 'jira', issueType: 'Bug', priorityBySeverity: {}, labels: [] })
    dir = makeDir()
    reportPath = writeReport(dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('agile off: no toca la red, dice que está desactivado y no llama reportDefects', async () => {
    const result = await runReport([reportPath], dir)

    expect(result.ok).toBe(true)
    expect(result.enabled).toBe(false)
    expect(result.lines.join('\n')).toContain('desactivado')
    expect(mockReportDefects).not.toHaveBeenCalled()
    expect(mockBuildAgileDefects).not.toHaveBeenCalled()
  })

  it('--dry-run: imprime los defectos que se reportarían sin tocar la red', async () => {
    mockResolveAgile.mockReturnValue({ enabled: true, provider: 'jira', issueType: 'Bug', priorityBySeverity: {}, labels: [] })
    mockBuildAgileDefects.mockReturnValue([
      {
        defectId: 'HLF-AABB11',
        severity: 'blocker',
        title: '[HLF-AABB11] compra exprés',
        description: 'desc',
        priority: 'Highest',
        labels: [],
        selector: '#comprar-ahora-a1b2c3',
        testFile: 'e2e/compra.spec.ts',
        steps: [],
        environmentRows: [],
      },
    ])

    const result = await runReport([reportPath, '--dry-run'], dir)

    expect(result.ok).toBe(true)
    expect(result.dryRun).toBe(true)
    const text = result.lines.join('\n')
    expect(text).toContain('dry run')
    expect(text).toContain('HLF-AABB11')
    expect(mockReportDefects).not.toHaveBeenCalled()
  })

  it('real: reporta y resume creados/existentes/fallidos', async () => {
    mockResolveAgile.mockReturnValue({ enabled: true, provider: 'jira', issueType: 'Bug', priorityBySeverity: {}, labels: [] })
    mockReportDefects.mockResolvedValue({
      enabled: true,
      provider: 'jira',
      outcomes: [
        { case: makeCase(), action: 'created', key: 'QA-11' },
        { case: makeCase(), action: 'existing', key: 'QA-7' },
      ],
    })

    const result = await runReport([reportPath], dir)

    expect(result.ok).toBe(true)
    const text = result.lines.join('\n')
    expect(text).toContain('1 creado')
    expect(text).toContain('1 ya existía')
    expect(mockReportDefects).toHaveBeenCalledTimes(1)
  })

  it('fallos: ok false y muestra el mensaje por defecto', async () => {
    mockResolveAgile.mockReturnValue({ enabled: true, provider: 'jira', issueType: 'Bug', priorityBySeverity: {}, labels: [] })
    mockReportDefects.mockResolvedValue({
      enabled: true,
      provider: 'jira',
      outcomes: [{ case: makeCase(), action: 'failed', message: 'Jira respondió 403: permisos insuficientes' }],
    })

    const result = await runReport([reportPath], dir)

    expect(result.ok).toBe(false)
    const text = result.lines.join('\n')
    expect(text).toContain('1 fallido')
    expect(text).toContain('403')
  })

  it('reporte ausente: ok false con mensaje claro (mismo que fix)', async () => {
    const result = await runReport([join(dir, 'no-existe.json')], dir)

    expect(result.ok).toBe(false)
    expect(result.lines.join('\n')).toContain('No encontré')
  })

  it('JSON sin cases: no parece un reporte válido', async () => {
    const badPath = join(dir, 'malo.json')
    writeFileSync(badPath, JSON.stringify({ hola: 'mundo' }))

    const result = await runReport([badPath], dir)

    expect(result.ok).toBe(false)
    expect(result.lines.join('\n')).toContain('cases')
    expect(mockReportDefects).not.toHaveBeenCalled()
  })
})
