import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOLS, analyzeSelector, diagnoseFailureTool, reportSummary, chronicSelectors, batchAnalyzeSelectorsTool } from '../tools'
import { cacheKey } from '../cache'

const parse = (texto: string) => JSON.parse(texto)

describe('healify_analyze_selector', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-analyze-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const deps = () => ({ cachePath: join(dir, 'cache.json') })

  it('marca un ID dinámico como frágil y explica por qué', () => {
    const r = parse(analyzeSelector({ selector: '#btn-a1b2c3d4' }, deps()))

    expect(r.fragile).toBe(true)
    expect(r.detectedIssue).toBeTruthy()
  })

  it('NUNCA ofrece un reemplazo concreto sin haber visto la página', () => {
    // La propiedad central de esta herramienta. El motor sin htmlContext igual produce un
    // nombre sacado de diccionarios; exponerlo como corrección haría que un agente lo aplique
    // con total confianza y termine con un test que sigue roto pero parece arreglado.
    for (const selector of ['#login-btn', '//div[3]/button', '.card > .title', "[data-testid='buy']"]) {
      const r = parse(analyzeSelector({ selector }, deps()))

      expect(r.verifiedReplacementAvailable).toBe(false)
      expect(r).not.toHaveProperty('suggestedSelector')
      expect(r).not.toHaveProperty('fixedSelector')
      expect(r.note).toContain('NO')
    }
  })

  it('un testid no se marca como frágil', () => {
    const r = parse(analyzeSelector({ selector: "[data-testid='add-to-cart']" }, deps()))
    expect(r.selectorType).toBe('TESTID')
  })

  it('sin selector, error claro', () => {
    expect(() => analyzeSelector({}, deps())).toThrow(/selector/)
    expect(() => analyzeSelector({ selector: '   ' }, deps())).toThrow(/selector/)
  })
})

describe('healify_analyze_selector con framework', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-fw-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const deps = () => ({ cachePath: join(dir, 'cache.json') })

  it('devuelve la sugerencia adaptada a cada framework', () => {
    const selector = '#btn-ingresar'

    expect(parse(analyzeSelector({ selector, framework: 'playwright' }, deps())).suggestion).toBe("getByRole('button', { name: 'Ingresar' })")
    expect(parse(analyzeSelector({ selector, framework: 'cypress' }, deps())).suggestion).toBe("cy.contains('button', 'Ingresar')")
    expect(parse(analyzeSelector({ selector, framework: 'selenium' }, deps())).suggestion).toMatch(/^By\.xpath\("/)
    expect(parse(analyzeSelector({ selector, framework: 'webdriverio' }, deps())).suggestion).toMatch(/^\$\("/)
  })

  it('un framework inválido da un error claro, no una sugerencia rara', () => {
    expect(() => analyzeSelector({ selector: '#a', framework: 'nope' }, deps())).toThrow(/framework/)
  })

  it('sin framework no se expone suggestion, se conserva la nota original', () => {
    const r = parse(analyzeSelector({ selector: '#btn-ingresar' }, deps()))
    expect(r).not.toHaveProperty('suggestion')
    expect(r.note).toContain('NO')
  })
})

describe('cache local de análisis', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-cachetool-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const cachePath = () => join(dir, 'cache.json')

  it('escribe el cache en disco tras el primer análisis', () => {
    analyzeSelector({ selector: '#btn-ingresar' }, { cachePath: cachePath() })
    expect(existsSync(cachePath())).toBe(true)
  })

  it('un hit con timestamp fresco devuelve lo cacheado sin re-analizar', () => {
    const selector = '#btn-ingresar'
    const key = cacheKey(selector, undefined, 'cypress')
    // Valor "caché" deliberadamente distinto: si el resultado es ESTE, se leyó del cache
    // (y pasó la guarda de forma, que exige selector y selectorType).
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      cachePath(),
      JSON.stringify({ [key]: { value: { selector, selectorType: 'ROLE', desdeCache: true }, timestamp: Date.now() } }),
      'utf-8'
    )

    const r = parse(analyzeSelector({ selector, framework: 'cypress' }, { cachePath: cachePath() }))

    expect(r.desdeCache).toBe(true)
  })

  it('un hit vencido por TTL se ignora y se computa fresco', () => {
    const selector = '#btn-ingresar'
    const key = cacheKey(selector, undefined, 'cypress')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      cachePath(),
      JSON.stringify({
        [key]: { value: { selector, selectorType: 'ROLE', desdeCache: true }, timestamp: Date.now() - 6 * 60 * 1000 },
      }),
      'utf-8'
    )

    const r = parse(analyzeSelector({ selector, framework: 'cypress' }, { cachePath: cachePath() }))

    expect(r).not.toHaveProperty('desdeCache')
    expect(r.suggestion).toBe("cy.contains('button', 'Ingresar')")
  })

  it('un cache corrupto no rompe el análisis', () => {
    writeFileSync(cachePath(), '{no es json', 'utf-8')

    const r = parse(analyzeSelector({ selector: '[data-testid=\'add-to-cart\']' }, { cachePath: cachePath() }))

    expect(r.selectorType).toBe('TESTID')
  })
})

describe('healify_batch_analyze_selectors', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-batchtool-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const deps = () => ({ cachePath: join(dir, 'cache.json') })

  it('analiza los tres selectores en orden, con sugerencias y confianza', async () => {
    const r = parse(await batchAnalyzeSelectorsTool(
      { selectors: ["[data-testid='add-to-cart']", '#btn-ingresar', '#user-correo'] },
      deps()
    ))

    expect(r.errors).toEqual([])
    expect(r.results).toHaveLength(3)
    expect(r.results.map((res: { original: string }) => res.original)).toEqual([
      "[data-testid='add-to-cart']",
      '#btn-ingresar',
      '#user-correo',
    ])
    expect(r.results[0].suggestions).toContain("[data-testid='add-to-cart']")
    expect(r.results[1].suggestions).toContain("role('button', { name: 'Ingresar' })")
    for (const res of r.results) {
      expect(res.confidence).toBeGreaterThan(0)
    }
  })

  it('adapta las sugerencias al framework pedido', async () => {
    const r = parse(await batchAnalyzeSelectorsTool({ selectors: ['#btn-ingresar'], framework: 'cypress' }, deps()))

    expect(r.results[0].suggestions[0]).toBe("cy.contains('button', 'Ingresar')")
  })

  it('un selector inválido va a errors estructurado, sin tumbar el resto', async () => {
    const r = parse(await batchAnalyzeSelectorsTool({ selectors: ['#btn-ingresar', '', '#user-correo'] }, deps()))

    expect(r.results).toHaveLength(2)
    expect(r.errors).toEqual([{ original: '', code: 'INVALID_INPUT', message: 'Selector vacío.' }])
  })

  it('sin selectors o con selectors vacíos, error claro', async () => {
    await expect(batchAnalyzeSelectorsTool({}, deps())).rejects.toThrow(/selectors/)
    await expect(batchAnalyzeSelectorsTool({ selectors: [] }, deps())).rejects.toThrow(/selectors/)
  })

  it('un framework inválido también se rechaza en batch', async () => {
    await expect(batchAnalyzeSelectorsTool({ selectors: ['#a'], framework: 'nope' }, deps())).rejects.toThrow(/framework/)
  })

  it('ignora entradas que dejó otra herramienta en el cache', async () => {
    // Simula una entrada de healify_analyze_selector (misma clave con kind 'analyze'): el batch
    // no debe leerla como si fuera suya, ni siquiera si el valor tiene otra forma.
    const key = cacheKey('#btn-ingresar', undefined, 'cypress', 'analyze')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'cache.json'),
      JSON.stringify({ [key]: { value: { selector: '#btn-ingresar', desdeAnalisis: true }, timestamp: Date.now() } }),
      'utf-8'
    )

    const r = parse(await batchAnalyzeSelectorsTool({ selectors: ['#btn-ingresar'], framework: 'cypress' }, deps()))

    expect(r.errors).toEqual([])
    expect(r.results).toHaveLength(1)
    expect(r.results[0].original).toBe('#btn-ingresar')
    expect(r.results[0].suggestions[0]).toBe("cy.contains('button', 'Ingresar')")
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
  it('las cinco tienen nombre, descripción y schema de objeto', () => {
    expect(TOOLS).toHaveLength(5)
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
