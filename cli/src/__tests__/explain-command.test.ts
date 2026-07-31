import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockLoadConfig } = vi.hoisted(() => ({ mockLoadConfig: vi.fn(() => ({ })) }))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return { ...actual, loadConfig: mockLoadConfig }
})

import { runExplain } from '../commands/explain'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-explain-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('runExplain', () => {
  it('selector directo: devuelve clasificación y fix', () => {
    const result = runExplain(['[data-testid="btn-123"]'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.selector).toBe('[data-testid="btn-123"]')
      expect(result.output.classification).toContain('TESTID')
      expect(result.output.fixProposed).toBeTruthy()
      expect(result.output.confidence).toBeGreaterThanOrEqual(0.75)
    }
  })

  it('sin args y sin reporte: error claro', () => {
    // cwd del proceso no tiene reporte
    const result = runExplain([])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No hay selector para analizar')
    }
  })

  it('sin args, con reporte: analiza el último caso', () => {
    const reportDir = join(dir, '.healify')
    mkdirSync(reportDir, { recursive: true })
    writeFileSync(
      join(reportDir, 'healify-report.json'),
      JSON.stringify({
        cases: [
          { selector: '#btn-viejo', status: 'unresolved' },
          { selector: '#btn-actual', status: 'review' },
        ],
      })
    )

    // Mock process.cwd para que apunte al directorio temporal
    const originalCwd = process.cwd
    process.cwd = () => dir
    try {
      const result = runExplain([])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.output.selector).toBe('#btn-actual')
      }
    } finally {
      process.cwd = originalCwd
    }
  })

  it('--json produce output JSON válido', () => {
    const result = runExplain(['[data-testid="x"]', '--json'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      const parsed = JSON.parse(result.humanText)
      expect(parsed.selector).toBe('[data-testid="x"]')
      expect(parsed.classification).toBeTruthy()
      expect(typeof parsed.confidence).toBe('number')
    }
  })

  it('sin --json produce output humano legible', () => {
    const result = runExplain(['[data-testid="x"]'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.humanText).toContain('Selector:')
      expect(result.humanText).toContain('Clasificación:')
      expect(result.humanText).toContain('Confidence:')
      expect(result.humanText).toContain('Fix propuesto:')
    }
  })

  it('selector XPath se clasifica como frágil', () => {
    const result = runExplain(["//button[@class='submit']"])

    expect(result.ok).toBe(true)
    if (result.ok) {
      // XPath se reemplaza por un selector de rol, así que selectorType es ROLE
      expect(result.output.classification).toContain('ROLE')
      expect(result.output.issue).toContain('XPath')
    }
  })

  it('selector getByRole se clasifica como modern locator', () => {
    const result = runExplain(["getByRole('button', { name: 'Login' })"])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.classification).toContain('ROLE')
    }
  })

  it('usa customTestIds de la config del proyecto', () => {
    mockLoadConfig.mockReturnValueOnce({ customTestIds: ['data-cy-custom'] })

    const result = runExplain(['[data-cy-custom="x"]'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.classification).toContain('TESTID')
      expect(result.output.confidence).toBeGreaterThanOrEqual(0.9)
    }
  })
})
