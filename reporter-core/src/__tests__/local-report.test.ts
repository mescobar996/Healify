import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  renderLocalReportHtml,
  renderLocalReportJson,
  buildLocalRunFromEvents,
  printSummary,
  type LocalRun,
} from '../local-report'
import type { LocalCaseResult } from '../local-mode'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'agrega producto al carrito',
    testFile: 'e2e/checkout.spec.ts',
    selector: '#add-to-cart-btn',
    errorMessage: "Waiting for selector '#add-to-cart-btn' failed",
    status: 'healed',
    fixedSelector: "[data-testid='add-to-cart']",
    confidence: 0.97,
    explanation: 'Coincidencia por testid',
    selectorType: 'TESTID',
    cause: 'selector',
    defectId: 'HLF-ABC123',
    severity: 'major',
    expected: 'El selector #add-to-cart-btn encuentra un elemento en la página.',
    actual: "Waiting for selector '#add-to-cart-btn' failed",
    ...overrides,
  }
}

function makeRun(overrides: Partial<LocalRun> = {}): LocalRun {
  return {
    project: 'tienda-demo',
    framework: 'Playwright',
    generatedAt: new Date('2026-07-21T12:00:00Z'),
    cases: [makeCase()],
    ...overrides,
  }
}

const run = makeRun()

describe('renderLocalReportHtml', () => {
  it('produces a self-contained document with no external requests', () => {
    const html = renderLocalReportHtml(run)
    expect(html).toContain('<!doctype html>')
    expect(html).not.toContain('http://')
    expect(html).not.toContain('googleapis')
  })

  it('escapes case data so it never breaks the surrounding markup', () => {
    const malicious: LocalCaseResult = { ...makeCase(), testName: '<script>alert(1)</script>' }
    const html = renderLocalReportHtml({ ...run, cases: [malicious] })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes the project name and case counts', () => {
    const html = renderLocalReportHtml(run)
    expect(html).toContain('tienda-demo')
    expect(html).toContain('Sanado')
  })

  it('marca el veredicto como PASS cuando todos los casos sanaron', () => {
    const html = renderLocalReportHtml(makeRun({ verdict: 'passed' }))
    expect(html).toContain('verdict pass')
    expect(html).toContain('PASS')
  })

  it('muestra el aviso de estado vacío cuando no hay casos', () => {
    const html = renderLocalReportHtml(makeRun({ cases: [] }))
    expect(html).toContain('Ningún test falló por un selector roto en esta corrida.')
  })

  it('muestra el aviso de todo limpio cuando todos sanaron y hay casos', () => {
    const html = renderLocalReportHtml(makeRun({ cases: [makeCase()] }))
    expect(html).toContain('Todo limpio — no hay selectores que necesiten revisión manual.')
  })

  it('renderiza un caso review con sugerencia verificada', () => {
    const c = makeCase({
      status: 'review',
      confidence: 0.85,
      fixedSelector: "[data-testid='login-btn']",
      verified: true,
    })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('verificada en la página')
    expect(html).toContain('Copiar sugerencia')
    expect(html).toContain('85%')
  })

  it('renderiza un caso review con sugerencia heurística no verificada', () => {
    const c = makeCase({ status: 'review', confidence: 0.82, verified: false })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('heurística local, sin comprobar')
    expect(html).toContain('Copiar sugerencia')
  })

  it('renderiza un caso unresolved sin candidato confiable', () => {
    const c = makeCase({ status: 'unresolved', fixedSelector: '', confidence: 0 })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('sin candidato confiable')
    expect(html).not.toContain('Copiar sugerencia')
  })

  it('no muestra la explicación del motor en casos unresolved', () => {
    const c = makeCase({ status: 'unresolved', fixedSelector: '', explanation: 'Estrategia probada: ID' })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).not.toContain('Estrategia probada: ID')
  })

  it('muestra la explicación del motor en casos non-unresolved', () => {
    const c = makeCase({ status: 'review', explanation: 'Coincidencia por testid' })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('Coincidencia por testid')
  })

  it('incluye ubicación con línea cuando el caso la tiene', () => {
    const c = makeCase({ status: 'review', testFile: 'e2e/login.spec.ts', line: 42 })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('e2e/login.spec.ts:42')
  })

  it('omite ubicación cuando falta el testFile', () => {
    const c = makeCase({ status: 'review', testFile: undefined })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).not.toContain('e2e/checkout.spec.ts')
  })

  it('renderiza pasos de reproducción y evidencia con imagen', () => {
    const c = makeCase({
      status: 'review',
      steps: ['abrir la página', 'click en carrito'],
      attachments: [
        { name: 'shot.png', path: '/tmp/shot.png', contentType: 'image/png' },
        { name: 'trace.zip', path: '/tmp/trace.zip', contentType: 'application/zip' },
      ],
    })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('abrir la página')
    expect(html).toContain('click en carrito')
    expect(html).toContain('<img src="/tmp/shot.png"')
    expect(html).toContain('trace.zip')
  })

  it('renderiza un caso healed en la sección resumida', () => {
    const c = makeCase({ testFile: 'e2e/checkout.spec.ts' })
    const html = renderLocalReportHtml(makeRun({ cases: [c] }))
    expect(html).toContain('Sanados automáticamente')
    expect(html).toContain('e2e/checkout.spec.ts')
  })

  it('ordena los casos de atención por confianza ascendente dentro del mismo estado', () => {
    const html = renderLocalReportHtml(makeRun({ cases: [
      makeCase({ status: 'review', selector: '#high', confidence: 0.89 }),
      makeCase({ status: 'review', selector: '#low', confidence: 0.81 }),
    ] }))
    const lowIdx = html.indexOf('#low')
    const highIdx = html.indexOf('#high')
    expect(lowIdx).toBeGreaterThan(-1)
    expect(highIdx).toBeGreaterThan(lowIdx)
  })

  it('incluye filas de entorno y las estadísticas de la corrida', () => {
    const withEnv = makeRun({
      environment: {
        os: 'win32',
        osVersion: '10.0.26200',
        node: 'v22.0.0',
        framework: 'Playwright',
        frameworkVersion: '1.58.0',
        browser: 'chromium',
        baseURL: 'http://localhost:3000',
      },
      stats: { total: 10, passed: 9, failed: 1, healed: 0, review: 1, unresolved: 0, durationMs: 12_500 },
    })
    const html = renderLocalReportHtml(withEnv)
    expect(html).toContain('chromium')
    expect(html).toContain('9 de 10')
  })
})

describe('renderLocalReportJson', () => {
  it('produces valid JSON with a summary and the raw cases', () => {
    const parsed = JSON.parse(renderLocalReportJson(run))
    expect(parsed.summary.total).toBe(1)
    expect(parsed.summary.healed).toBe(1)
    expect(parsed.cases[0].selector).toBe('#add-to-cart-btn')
  })

  it('desglosa el resumen por estado', () => {
    const three = makeRun({
      cases: [
        makeCase(),
        makeCase({ status: 'review', selector: '#a' }),
        makeCase({ status: 'unresolved', selector: '#b' }),
      ],
    })
    const parsed = JSON.parse(renderLocalReportJson(three))
    expect(parsed.summary.healed).toBe(1)
    expect(parsed.summary.review).toBe(1)
    expect(parsed.summary.unresolved).toBe(1)
  })

  it('serializa fecha y veredicto derivados sin pasarlos', () => {
    const parsed = JSON.parse(renderLocalReportJson(run))
    expect(parsed.generatedAt).toBe('2026-07-21T12:00:00.000Z')
    expect(parsed.verdict).toBeDefined()
    expect(parsed.stats).toBeDefined()
  })
})

describe('buildLocalRunFromEvents', () => {
  it('mapea eventos healed con veredicto passed', () => {
    const lr = buildLocalRunFromEvents([{ type: 'healed', originalSelector: '#cart', fixedSelector: '[data-testid="cart"]', confidence: 0.98, verified: true }], {
      project: 'shop',
      framework: 'WebdriverIO',
    })
    expect(lr.cases[0].status).toBe('healed')
    expect(lr.cases[0].selectorType).toBe('HEALED')
    expect(lr.cases[0].fixedSelector).toBe('[data-testid="cart"]')
    expect(lr.verdict).toBe('passed')
    expect(lr.framework).toBe('WebdriverIO')
  })

  it('mapea eventos no-suggestion y failed como unresolved', () => {
    const lr = buildLocalRunFromEvents(
      [
        { type: 'no-suggestion', originalSelector: '#x' },
        { type: 'failed', originalSelector: '#y' },
      ],
      { project: 'shop', framework: 'Selenium' }
    )
    expect(lr.cases.map((c) => c.status)).toEqual(['unresolved', 'unresolved'])
    expect(lr.verdict).toBe('failed')
  })

  it('mapea cualquier otro tipo de evento como review', () => {
    const lr = buildLocalRunFromEvents([{ type: 'unexpected', originalSelector: '#z', explanation: 'algo raro' }], {
      project: 'shop',
      framework: 'Selenium',
    })
    expect(lr.cases[0].status).toBe('review')
    expect(lr.cases[0].explanation).toBe('algo raro')
    expect(lr.cases[0].selectorType).toBe('UNKNOWN')
  })

  it('asigna defectId estable y severidad según el estado', () => {
    const lr = buildLocalRunFromEvents([{ type: 'healed', originalSelector: '#cart' }], { project: 'shop', framework: 'Selenium' })
    expect(lr.cases[0].defectId).toMatch(/^HLF-[0-9A-F]{6}$/)
    expect(lr.cases[0].severity).toBeDefined()
  })
})

describe('printSummary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('imprime conteos por estado en una línea', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSummary([makeCase(), makeCase({ status: 'review' }), makeCase({ status: 'unresolved' })])
    expect(spy).toHaveBeenCalledWith('Healed: 1 | Review: 1 | Unresolved: 1')
  })

  it('agrega la línea de causas fuera de alcance cuando existen', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSummary([makeCase({ cause: 'assertion' }), makeCase({ cause: 'timing' }), makeCase()])
    expect(spy).toHaveBeenCalledWith('Healed: 3 | Review: 0 | Unresolved: 0')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Fuera de alcance del sanado (2)'))
  })

  it('omite la línea de causas cuando todo es selector o unknown', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSummary([makeCase(), makeCase({ cause: 'unknown' })])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('Fuera de alcance'))
  })
})