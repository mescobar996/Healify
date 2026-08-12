import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

const mocks = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockFix: vi.fn(),
  mockFixAst: vi.fn(),
  mockDetectGitHubCLI: vi.fn(),
  mockCreateBranch: vi.fn(),
  mockCreateCommit: vi.fn(),
  mockCreatePRInstructions: vi.fn(),
  mockCreatePRWithGH: vi.fn(),
  mockAppendHistory: vi.fn(),
  mockRunInteractiveFix: vi.fn(),
  mockRunFixWatch: vi.fn(),
  mockParseInterval: vi.fn(),
  mockParseReportPath: vi.fn(),
  mockExit: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readFileSync: mocks.mockReadFileSync }
})
vi.mock('../fix', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fix')>()
  return { ...actual, fix: mocks.mockFix }
})
vi.mock('../fix-ast', () => ({ fixAst: mocks.mockFixAst }))
vi.mock('../pr', () => ({
  detectGitHubCLI: mocks.mockDetectGitHubCLI,
  createBranch: mocks.mockCreateBranch,
  createCommit: mocks.mockCreateCommit,
  createPRInstructions: mocks.mockCreatePRInstructions,
  createPRWithGH: mocks.mockCreatePRWithGH,
}))
vi.mock('../history', () => ({ appendHistory: mocks.mockAppendHistory }))
vi.mock('../interactive', () => ({ runInteractiveFix: mocks.mockRunInteractiveFix }))
vi.mock('../prompt', () => ({ promptLine: vi.fn() }))
vi.mock('../commands/watch', () => ({
  runFixWatch: mocks.mockRunFixWatch,
  parseInterval: mocks.mockParseInterval,
  parseReportPath: mocks.mockParseReportPath,
}))

import { applyRun, applyFixOnce, runFix, printOutcomes } from '../commands/fix-pr'
import type { FixOutcome } from '../fix'

const CASE: LocalCaseResult = {
  testName: 'agrega al carrito',
  testFile: 'e2e/checkout.spec.ts',
  selector: '#add-to-cart',
  errorMessage: "Waiting for selector '#add-to-cart' failed",
  status: 'healed',
  fixedSelector: "[data-testid='add-to-cart']",
  confidence: 0.95,
  explanation: '',
  selectorType: 'TESTID',
  cause: 'selector',
  defectId: 'HLF-000001',
  severity: 'major',
}

const RUN: LocalRun = {
  project: 'demo',
  framework: 'Playwright',
  generatedAt: new Date('2026-08-06T00:00:00.000Z'),
  cases: [CASE],
}

const APPLIED: FixOutcome = {
  testFile: 'e2e/checkout.spec.ts',
  selector: '#add-to-cart',
  fixedSelector: "[data-testid='add-to-cart']",
  status: 'applied',
}

function spyConsole() {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  return { log, error }
}

beforeEach(() => {
  vi.restoreAllMocks()
  mocks.mockReadFileSync.mockReset()
  mocks.mockFix.mockReset()
  mocks.mockFixAst.mockReset()
  mocks.mockDetectGitHubCLI.mockReset()
  mocks.mockCreateBranch.mockReset()
  mocks.mockCreateCommit.mockReset()
  mocks.mockCreatePRInstructions.mockReset()
  mocks.mockCreatePRWithGH.mockReset()
  mocks.mockAppendHistory.mockReset()
  mocks.mockRunInteractiveFix.mockReset()
  mocks.mockRunFixWatch.mockReset()
  mocks.mockParseInterval.mockReset()
  mocks.mockParseReportPath.mockReset()
  mocks.mockExit.mockReset()
  mocks.mockFix.mockReturnValue([APPLIED])
  mocks.mockFixAst.mockReturnValue([])
})

describe('printOutcomes', () => {
  it('avisa si no hay casos en la corrida', () => {
    const { log } = spyConsole()
    printOutcomes([], { ...RUN, cases: [] }, true)
    expect(log).toHaveBeenCalledWith('Ningún selector roto en la última corrida — no hay nada que aplicar.')
  })

  it('listas aplicados, salteados y casos review', () => {
    const { log } = spyConsole()
    const outcomes: FixOutcome[] = [
      APPLIED,
      { testFile: 'a.spec.ts', selector: '#b', status: 'skipped', reason: 'ambiguous' },
    ]
    const runWithReview = { ...RUN, cases: [{ ...CASE, status: 'review' as const }, { ...CASE, status: 'review' as const }] }
    printOutcomes(outcomes, runWithReview, true)

    const all = log.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(all).toContain('✓ e2e/checkout.spec.ts — #add-to-cart')
    expect(all).toContain('⚠ a.spec.ts — saltado')
    expect(all).toContain('2 casos "review" sin tocar')
  })

  it('marca el page object cuando aplicó afuera del test file', () => {
    const { log } = spyConsole()
    const outcomes: FixOutcome[] = [
      { testFile: 'e2e/checkout.spec.ts', selector: '#add-to-cart', fixedSelector: "[data-testid='add-to-cart']", status: 'applied', appliedIn: 'pages/cart.page.ts' },
    ]
    printOutcomes(outcomes, RUN, true)
    expect(log.mock.calls.flat().join('\n')).toContain('✓ pages/cart.page.ts (page object de e2e/checkout.spec.ts)')
  })

  it('usa singular en conteos de 1', () => {
    const { log } = spyConsole()
    const runWithReview = { ...RUN, cases: [{ ...CASE, status: 'review' as const }] }
    printOutcomes([APPLIED], runWithReview, true)
    const all = log.mock.calls.flat().join('\n')
    expect(all).toContain('1 selector aplicado · 0 salteados')
    expect(all).toContain('1 caso "review" sin tocar')
  })

  it('describe cada razón de salteo', () => {
    const { log } = spyConsole()
    const reasons: FixOutcome[] = [
      { testFile: 'a', selector: '#1', status: 'skipped', reason: 'dirty-git' },
      { testFile: 'b', selector: '#2', status: 'skipped', reason: 'not-found' },
      { testFile: 'c', selector: '#3', status: 'skipped', reason: 'not-substitutable' },
      { testFile: 'd', selector: '#4', status: 'skipped', reason: 'declined' },
    ]
    printOutcomes(reasons, RUN, false)
    const all = log.mock.calls.flat().join('\n')
    expect(all).toContain('cambios sin commitear')
    expect(all).toContain('no se encontró ni en el archivo de test')
    expect(all).toContain('no es un valor de selector sustituible')
    expect(all).toContain('vos decidiste no aplicarlo')
  })
})

describe('applyRun', () => {
  it('devuelve los outcomes de fix sin tocar AST si ast es false', () => {
    mocks.mockFix.mockReturnValue([APPLIED])
    const result = applyRun(RUN, RUN, { dryRun: true, force: false, ast: false, pageObjects: false })
    expect(result).toEqual([APPLIED])
    expect(mocks.mockFix).toHaveBeenCalledWith(RUN, { dryRun: true, force: false, pageObjects: false })
    expect(mocks.mockFixAst).not.toHaveBeenCalled()
  })

  it('reescribe por AST los casos not-substitutable', () => {
    const notSub: FixOutcome = { testFile: 'e2e/checkout.spec.ts', selector: '#add-to-cart', status: 'skipped', reason: 'not-substitutable' }
    const astApplied: FixOutcome = { testFile: 'e2e/checkout.spec.ts', selector: '#add-to-cart', fixedSelector: 'page.getByRole(...)', status: 'applied' }
    mocks.mockFix.mockReturnValue([notSub])
    mocks.mockFixAst.mockReturnValue([astApplied])

    const result = applyRun(RUN, RUN, { dryRun: true, force: false, ast: true, pageObjects: false })
    expect(result).toEqual([astApplied])
    expect(mocks.mockFixAst).toHaveBeenCalledTimes(1)
  })

  it('deja intactos los outcomes cuando el AST no devuelve nada para la clave', () => {
    const notSub: FixOutcome = { testFile: 'e2e/checkout.spec.ts', selector: '#add-to-cart', status: 'skipped', reason: 'not-substitutable' }
    mocks.mockFix.mockReturnValue([notSub])
    mocks.mockFixAst.mockReturnValue([])

    const result = applyRun(RUN, RUN, { dryRun: true, force: false, ast: true, pageObjects: false })
    expect(result).toEqual([notSub])
  })
})

describe('applyFixOnce', () => {
  it('devuelve false si el reporte no se puede leer', () => {
    mocks.mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(applyFixOnce('report.json', { dryRun: true, force: false, ast: false, pageObjects: false })).toBe(false)
  })

  it('graba historial y aplica cuando el reporte se lee bien', () => {
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify(RUN))
    mocks.mockFix.mockReturnValue([APPLIED])
    spyConsole()

    const ok = applyFixOnce('report.json', { dryRun: false, force: false, ast: false, pageObjects: false })
    expect(ok).toBe(true)
    expect(mocks.mockAppendHistory).toHaveBeenCalledTimes(1)
  })

  it('no graba historial en dry-run sin flag', () => {
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify(RUN))
    mocks.mockFix.mockReturnValue([])
    spyConsole()

    applyFixOnce('report.json', { dryRun: true, force: false, ast: false, pageObjects: false })
    expect(mocks.mockAppendHistory).not.toHaveBeenCalled()
  })
})

describe('runFix', () => {
  beforeEach(() => {
    mocks.mockParseReportPath.mockReturnValue('healify-report.json')
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify(RUN))
    mocks.mockFix.mockReturnValue([APPLIED])
    mocks.mockExit.mockImplementation((code?: number) => {
      throw new Error(`PROCESS_EXIT:${code}`)
    })
    vi.spyOn(process, 'exit').mockImplementation(mocks.mockExit as unknown as typeof process.exit)
  })

  it('delega a runFixWatch cuando viene --watch', () => {
    spyConsole()
    runFix(['--watch', 'healify-report.json'])
    expect(mocks.mockRunFixWatch).toHaveBeenCalled()
  })

  it('sale con código 0 y mensaje log para ENOENT', () => {
    const { log } = spyConsole()
    const err = new Error('no such file') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    mocks.mockReadFileSync.mockImplementation(() => {
      throw err
    })
    expect(() => runFix(['healify-report.json'])).toThrow('PROCESS_EXIT:0')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No encontré'))
  })

  it('sale con código 1 y stream error para permisos denegados', () => {
    const { error } = spyConsole()
    const err = new Error('denied') as NodeJS.ErrnoException
    err.code = 'EACCES'
    mocks.mockReadFileSync.mockImplementation(() => {
      throw err
    })
    expect(() => runFix(['healify-report.json'])).toThrow('PROCESS_EXIT:1')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('permisos denegados'))
  })

  it('sale con código 1 para JSON corrupto', () => {
    const { error } = spyConsole()
    mocks.mockReadFileSync.mockImplementation(() => {
      throw new Error('Unexpected token')
    })
    expect(() => runFix(['healify-report.json'])).toThrow('PROCESS_EXIT:1')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No se pudo leer'))
  })

  it('aplica, graba historial e imprime el resumen en el camino feliz', () => {
    const { log } = spyConsole()
    runFix(['healify-report.json'])
    expect(mocks.mockAppendHistory).toHaveBeenCalledTimes(1)
    expect(log.mock.calls.flat().join('\n')).toContain('1 selector aplicado')
  })

  it('respeta --dry-run y --record-history', () => {
    spyConsole()
    runFix(['--dry-run', '--record-history', 'healify-report.json'])
    expect(mocks.mockAppendHistory).toHaveBeenCalledTimes(1)
    expect(mocks.mockFix).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: true }))
  })

  it('respeta --no-ast y --no-pom', () => {
    spyConsole()
    runFix(['--no-ast', '--no-pom', 'healify-report.json'])
    expect(mocks.mockFix).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pageObjects: false }))
    expect(mocks.mockFixAst).not.toHaveBeenCalled()
  })

  it('usa --force para ignorar git sucio', () => {
    spyConsole()
    runFix(['--force', 'healify-report.json'])
    expect(mocks.mockFix).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ force: true }))
  })

  it('filtra los casos declinados en modo interactivo', () => {
    process.stdin.isTTY = true
    const { log } = spyConsole()
    mocks.mockRunInteractiveFix.mockReturnValue({
      approved: new Set([`${CASE.testFile}::${CASE.selector}`]),
      declined: [{ testFile: 'other.spec.ts', selector: '#x', status: 'skipped', reason: 'declined' }],
    })

    runFix(['--interactive', 'healify-report.json'])
    expect(mocks.mockRunInteractiveFix).toHaveBeenCalledTimes(1)
    expect(log.mock.calls.flat().join('\n')).toContain('interactivo')
    delete (process.stdin as { isTTY?: boolean }).isTTY
  })

  it('sigue en modo automático si --interactive sin terminal', () => {
    const { log } = spyConsole()
    runFix(['--interactive', 'healify-report.json'])
    expect(mocks.mockRunInteractiveFix).not.toHaveBeenCalled()
    expect(log.mock.calls.flat().join('\n')).toContain('no hay una terminal')
  })

  it('crea la PR con gh cuando el CLI está disponible', () => {
    const { log } = spyConsole()
    mocks.mockDetectGitHubCLI.mockReturnValue(true)
    mocks.mockCreateBranch.mockReturnValue('healify/fix-20260806-120000')
    mocks.mockCreatePRWithGH.mockReturnValue('https://github.com/u/r/pull/1')

    runFix(['--pr', 'healify-report.json'])
    expect(mocks.mockCreateBranch).toHaveBeenCalled()
    expect(mocks.mockCreateCommit).toHaveBeenCalledWith(1, [CASE.testFile])
    expect(mocks.mockCreatePRWithGH).toHaveBeenCalled()
    expect(log.mock.calls.flat().join('\n')).toContain('✅ PR created: https://github.com/u/r/pull/1')
  })

  it('crea la PR con gh incluyendo la tabla de revisión para confidence < 90%', () => {
    spyConsole()
    mocks.mockDetectGitHubCLI.mockReturnValue(true)
    mocks.mockCreateBranch.mockReturnValue('healify/fix-x')
    const lowConfCase: LocalCaseResult = { ...CASE, confidence: 0.85 }
    const lowRun = { ...RUN, cases: [lowConfCase] }
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify(lowRun))
    mocks.mockFix.mockReturnValue([{ ...APPLIED, selector: '#add-to-cart' }])
    mocks.mockCreatePRWithGH.mockReturnValue('https://github.com/u/r/pull/2')

    runFix(['--pr', 'healify-report.json'])
    const body = mocks.mockCreatePRWithGH.mock.calls[0][1]
    expect(body).toContain('1 necesitan revisión')
    expect(body).toContain('Selectores que necesitan revisión')
  })

  it('imprime instrucciones manuales cuando gh no está disponible', () => {
    const { log } = spyConsole()
    mocks.mockDetectGitHubCLI.mockReturnValue(false)
    mocks.mockCreateBranch.mockReturnValue('healify/fix-20260806-120000')
    mocks.mockCreatePRInstructions.mockReturnValue('INSTRUCCIONES')

    runFix(['--pr', 'healify-report.json'])
    expect(mocks.mockCreatePRWithGH).not.toHaveBeenCalled()
    expect(log.mock.calls.flat().join('\n')).toContain('INSTRUCCIONES')
  })

  it('no crea PR si no hay nada aplicado', () => {
    spyConsole()
    mocks.mockFix.mockReturnValue([])
    runFix(['--pr', 'healify-report.json'])
    expect(mocks.mockCreateBranch).not.toHaveBeenCalled()
  })

  it('captura errores al crear la PR sin reventar', () => {
    const { error } = spyConsole()
    mocks.mockDetectGitHubCLI.mockReturnValue(true)
    mocks.mockCreateBranch.mockReturnValue('healify/fix-x')
    mocks.mockCreatePRWithGH.mockImplementation(() => {
      throw new Error('auth failed')
    })

    runFix(['--pr', 'healify-report.json'])
    expect(error.mock.calls.flat().join('\n')).toContain('❌ Error creating PR: auth failed')
  })
})
