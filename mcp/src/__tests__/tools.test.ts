import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOLS, analyzeSelector, diagnoseFailureTool, reportSummary, chronicSelectors } from '../tools'

const parse = (texto: string) => JSON.parse(texto)

describe('healify_analyze_selector', () => {
  it('marca un ID dinámico como frágil y explica por qué', () => {
    const r = parse(analyzeSelector({ selector: '#btn-a1b2c3d4' }))

    expect(r.fragile).toBe(true)
    expect(r.detectedIssue).toBeTruthy()
  })

  it('NUNCA ofrece un reemplazo concreto sin haber visto la página', () => {
    // La propiedad central de esta herramienta. El motor sin htmlContext igual produce un
    // nombre sacado de diccionarios; exponerlo como corrección haría que un agente lo aplique
    // con total confianza y termine con un test que sigue roto pero parece arreglado.
    for (const selector of ['#login-btn', '//div[3]/button', '.card > .title', "[data-testid='buy']"]) {
      const r = parse(analyzeSelector({ selector }))

      expect(r.verifiedReplacementAvailable).toBe(false)
      expect(r).not.toHaveProperty('suggestedSelector')
      expect(r).not.toHaveProperty('fixedSelector')
      expect(r.note).toContain('NO')
    }
  })

  it('un testid no se marca como frágil', () => {
    const r = parse(analyzeSelector({ selector: "[data-testid='add-to-cart']" }))
    expect(r.selectorType).toBe('TESTID')
  })

  it('sin selector, error claro', () => {
    expect(() => analyzeSelector({})).toThrow(/selector/)
    expect(() => analyzeSelector({ selector: '   ' })).toThrow(/selector/)
  })
})

describe('healify_diagnose_failure', () => {
  it('una aserción fallida no habilita el sanado de selectores', () => {
    const r = parse(diagnoseFailureTool({ errorMessage: "expect(page.locator('#total')).toHaveText('99')\nExpected: \"99\"\nReceived: \"12\"" }))

    expect(r.cause).toBe('assertion')
    expect(r.selectorHealingApplies).toBe(false)
    expect(r.causeLabel).toBeTruthy()
  })

  it('un selector que no apareció sí lo habilita', () => {
    const r = parse(diagnoseFailureTool({ errorMessage: "Waiting for selector '#add-to-cart-btn' failed" }))

    expect(r.cause).toBe('selector')
    expect(r.selectorHealingApplies).toBe(true)
  })

  it('sin errorMessage, error claro', () => {
    expect(() => diagnoseFailureTool({})).toThrow(/errorMessage/)
  })
})

describe('healify_report_summary', () => {
  let dir: string
  let cwdAnterior: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-'))
    cwdAnterior = process.cwd()
    process.chdir(dir)
  })

  afterEach(() => {
    process.chdir(cwdAnterior)
    rmSync(dir, { recursive: true, force: true })
  })

  const escribirReporte = (cases: unknown[]) =>
    writeFileSync(join(dir, 'healify-report.json'), JSON.stringify({ project: 'p', framework: 'Playwright', cases }), 'utf-8')

  it('distingue lo verificado de lo deducido', () => {
    // Un agente tiene que poder ver esa diferencia ANTES de tocar un archivo.
    escribirReporte([
      { testName: 'a', selector: '#a', status: 'healed', fixedSelector: "role('button')", verified: true, confidence: 0.97, cause: 'selector', explanation: '' },
      { testName: 'b', selector: '#b', status: 'healed', fixedSelector: "role('link')", verified: false, confidence: 0.92, cause: 'selector', explanation: '' },
    ])

    const r = parse(reportSummary({}))

    expect(r.total).toBe(2)
    expect(r.cases[0].safeToApply).toBe(true)
    expect(r.cases[1].safeToApply).toBe(false)
  })

  it('un caso en review nunca es seguro de aplicar', () => {
    escribirReporte([
      { testName: 'c', selector: '#c', status: 'review', fixedSelector: "role('button')", verified: true, confidence: 0.85, cause: 'selector', flakeVerdict: 'flaky', explanation: '' },
    ])

    const r = parse(reportSummary({}))

    expect(r.cases[0].safeToApply).toBe(false)
    expect(r.cases[0].flakeVerdict).toBe('flaky')
  })

  it('sin reporte, un error que dice cómo generarlo', () => {
    expect(() => reportSummary({})).toThrow(/Corré tus tests/)
  })

  it('un reporte corrupto no se hace pasar por vacío', () => {
    writeFileSync(join(dir, 'healify-report.json'), '{roto', 'utf-8')
    expect(() => reportSummary({})).toThrow(/no es JSON válido/)
  })

  it('acepta una ruta alternativa', () => {
    writeFileSync(join(dir, 'otro.json'), JSON.stringify({ cases: [] }), 'utf-8')
    const r = parse(reportSummary({ reportPath: 'otro.json' }))
    expect(r.total).toBe(0)
  })
})

describe('healify_chronic_selectors', () => {
  let dir: string
  let cwdAnterior: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-hist-'))
    cwdAnterior = process.cwd()
    process.chdir(dir)
  })

  afterEach(() => {
    process.chdir(cwdAnterior)
    rmSync(dir, { recursive: true, force: true })
  })

  it('sin historial devuelve vacío y dice cómo generarlo, en vez de fallar', () => {
    const r = parse(chronicSelectors({}))
    expect(r.total).toBe(0)
    expect(r.note).toContain('--record-history')
  })

  it('devuelve los crónicos con su recomendación', () => {
    mkdirSync(join(dir, '.healify'))
    const entrada = (timestamp: string) =>
      JSON.stringify({ timestamp, testFile: 'e2e/a.spec.ts', testName: 't', selector: '#viejo', status: 'healed', fixedSelector: 'x', selectorType: 'CSS', confidence: 0.9, cause: 'selector' })
    writeFileSync(
      join(dir, '.healify', 'history.jsonl'),
      [entrada('2026-07-01T10:00:00.000Z'), entrada('2026-07-15T10:00:00.000Z'), entrada('2026-07-30T10:00:00.000Z')].join('\n') + '\n',
      'utf-8'
    )

    const r = parse(chronicSelectors({}))

    expect(r.total).toBe(1)
    expect(r.chronic[0].breakages).toBe(3)
    expect(r.chronic[0].recommendation).toContain('data-testid')
  })
})

describe('TOOLS', () => {
  it('los cuatro tienen nombre, descripción y schema de objeto', () => {
    expect(TOOLS).toHaveLength(4)
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^healify_/)
      expect(t.description.length).toBeGreaterThan(30)
      expect(t.inputSchema.type).toBe('object')
    }
  })

  it('los nombres no se repiten', () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length)
  })
})
