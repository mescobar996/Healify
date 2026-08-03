import { describe, it, expect } from 'vitest'
import { detectFlakyTests, type RunRecord } from '../flake'

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    type: 'run',
    runId: 'run-1',
    timestamp: '2026-08-01T10:00:00.000Z',
    project: 'Playwright suite',
    framework: 'Playwright',
    total: 2,
    passed: 1,
    failed: 1,
    tests: [
      { testName: 'login ok', testFile: 'e2e/login.spec.ts', passed: true },
      { testName: 'pago ok', testFile: 'e2e/pago.spec.ts', passed: false },
    ],
    ...overrides,
  }
}

describe('detectFlakyTests', () => {
  it('devuelve [] sin corridas', () => {
    expect(detectFlakyTests([])).toEqual([])
  })

  it('clasifica flaky: pasó en algunas corridas y falló en otras', () => {
    const runs = [
      makeRun({ runId: 'r1', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: true }] }),
      makeRun({ runId: 'r2', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: false }] }),
    ]

    const tests = detectFlakyTests(runs)

    expect(tests).toHaveLength(1)
    expect(tests[0]).toMatchObject({
      testName: 'login ok',
      testFile: 'a.spec.ts',
      runs: 2,
      passed: 1,
      failed: 1,
      flakeRate: 0.5,
      verdict: 'flaky',
    })
  })

  it('clasifica healthy y always-failing', () => {
    const runs = [
      makeRun({ runId: 'r1', tests: [
        { testName: 'estable', testFile: 'a.spec.ts', passed: true },
        { testName: 'muerto', testFile: 'b.spec.ts', passed: false },
      ] }),
      makeRun({ runId: 'r2', tests: [
        { testName: 'estable', testFile: 'a.spec.ts', passed: true },
        { testName: 'muerto', testFile: 'b.spec.ts', passed: false },
      ] }),
    ]

    const tests = detectFlakyTests(runs)

    expect(tests.find((t) => t.testName === 'estable')).toMatchObject({ verdict: 'healthy', flakeRate: 0 })
    expect(tests.find((t) => t.testName === 'muerto')).toMatchObject({ verdict: 'always-failing', flakeRate: 1 })
  })

  it('insufficient-data con menos de minRuns corridas', () => {
    const runs = [makeRun({ runId: 'r1', tests: [{ testName: 'solo una', testFile: 'a.spec.ts', passed: false }] })]

    expect(detectFlakyTests(runs)).toEqual([
      expect.objectContaining({ testName: 'solo una', runs: 1, verdict: 'insufficient-data' }),
    ])
  })

  it('agrupa por testFile + testName: mismo nombre en archivos distintos es otro test', () => {
    const runs = [
      makeRun({ runId: 'r1', tests: [
        { testName: 'login', testFile: 'e2e/a.spec.ts', passed: true },
        { testName: 'login', testFile: 'e2e/b.spec.ts', passed: false },
      ] }),
    ]

    const tests = detectFlakyTests(runs)

    expect(tests).toHaveLength(2)
    expect(tests.every((t) => t.runs === 1)).toBe(true)
  })

  it('respeta minRuns custom y deja todo como insufficient-data', () => {
    const runs = [
      makeRun({ runId: 'r1', tests: [{ testName: 'x', testFile: 'a.spec.ts', passed: false }] }),
      makeRun({ runId: 'r2', tests: [{ testName: 'x', testFile: 'a.spec.ts', passed: true }] }),
    ]

    const tests = detectFlakyTests(runs, { minRuns: 3 })

    expect(tests[0]).toMatchObject({ runs: 2, verdict: 'insufficient-data' })
  })

  it('ordena: flaky primero (flakeRate desc), luego always-failing, luego healthy, luego insufficient-data', () => {
    const runs = [
      makeRun({ runId: 'r1', tests: [
        { testName: 'flaky-mitad', testFile: 'a.spec.ts', passed: true },
        { testName: 'flaky-bajo', testFile: 'b.spec.ts', passed: true },
        { testName: 'muerto', testFile: 'c.spec.ts', passed: false },
        { testName: 'estable', testFile: 'd.spec.ts', passed: true },
        { testName: 'solo-una', testFile: 'e.spec.ts', passed: false },
      ] }),
      makeRun({ runId: 'r2', tests: [
        { testName: 'flaky-mitad', testFile: 'a.spec.ts', passed: false },
        { testName: 'flaky-bajo', testFile: 'b.spec.ts', passed: false },
        { testName: 'muerto', testFile: 'c.spec.ts', passed: false },
        { testName: 'estable', testFile: 'd.spec.ts', passed: true },
      ] }),
    ]

    const order = detectFlakyTests(runs).map((t) => t.testName)

    expect(order).toEqual(['flaky-bajo', 'flaky-mitad', 'muerto', 'estable', 'solo-una'])
  })
})
