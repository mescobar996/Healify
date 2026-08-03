import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunLocalHealing, mockWriteFileSync, mockAnalyzeAndHeal, mockResolveLocatorStrategy } = vi.hoisted(() => {
  const mockRunLocalHealing = vi.fn((input: { testName: string; testFile?: string; errorMessage: string }) => ({
    testName: input.testName,
    testFile: input.testFile,
    selector: 'Unknown selector',
    errorMessage: input.errorMessage,
    status: 'unresolved' as const,
    fixedSelector: '',
    confidence: 0,
    explanation: '',
    selectorType: 'UNKNOWN',
  }))
  const mockWriteFileSync = vi.fn()
  const mockAnalyzeAndHeal = vi.fn(() => ({
    fixedSelector: "role('button', { name: 'Comprar' })",
    confidence: 0.97,
    verified: true,
    fromRepertoire: false,
    explanation: 'texto real de la página',
    selectorType: 'ROLE',
  }))
  const mockResolveLocatorStrategy = vi.fn(() => ({ strategy: 'xpath' as const, value: "//button[normalize-space(.)='Comprar']" }))
  return { mockRunLocalHealing, mockWriteFileSync, mockAnalyzeAndHeal, mockResolveLocatorStrategy }
})

vi.mock('@healify/reporter-core', () => ({
  runLocalHealing: mockRunLocalHealing,
  renderLocalReportHtml: vi.fn(() => '<html></html>'),
  renderLocalReportJson: vi.fn(() => '{}'),
  renderLocalReportMarkdown: vi.fn(() => '# reporte'),
  printSummary: vi.fn(),
  baseEnvironment: vi.fn((framework: string, extra = {}) => ({ os: 'test', node: 'v20', framework, ...extra })),
  statsFromCases: vi.fn((cases: unknown[], suite?: { total: number; passed: number; failed: number }) => ({
    total: suite?.total ?? cases.length,
    passed: suite?.passed ?? 0,
    failed: suite?.failed ?? cases.length,
    healed: 0,
    review: 0,
    unresolved: 0,
  })),
  readRepertoire: vi.fn(() => []),
  loadConfig: vi.fn(() => ({})),
  analyzeAndHeal: mockAnalyzeAndHeal,
  resolveLocatorStrategy: mockResolveLocatorStrategy,
  domContextFromProbeResult: vi.fn((raw: unknown) => (Array.isArray(raw) && raw.length > 0 ? 'button "Comprar"' : undefined)),
  BROWSER_PROBE_SCRIPT: 'return [];',
  buildDefectId: vi.fn((testFile: string | undefined, selector: string) => `DEF-${testFile ?? 'x'}-${selector}`),
  severityFor: vi.fn((status: string) => (status === 'unresolved' ? 'blocker' : 'minor')),
}))

vi.mock('node:fs', () => ({
  writeFileSync: mockWriteFileSync,
}))

import { HealifyCypressPlugin } from '../plugin'

/** Captura los handlers que el plugin registra vía on(event, handler), para invocarlos a mano. */
type TaskHandler = (...args: unknown[]) => unknown

function createOnCapture() {
  const handlers: Record<string, TaskHandler> = {}
  const on = vi.fn((event: string, handler: TaskHandler) => {
    handlers[event] = handler
  }) as unknown as Cypress.PluginEvents
  return { on, handlers }
}

function makeSpec(overrides?: Record<string, unknown>) {
  return { relative: 'e2e/login.cy.ts', ...overrides }
}

function makeResults(tests: Record<string, unknown>[]) {
  return { tests }
}

function makeTest(overrides?: Record<string, unknown>) {
  return {
    title: ['login', 'muestra error con credenciales inválidas'],
    state: 'failed',
    displayError: "Expected to find element: `#login-btn`, but never found it.",
    ...overrides,
  }
}

const fakeConfig = {} as Cypress.PluginConfigOptions

describe('HealifyCypressPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('corre runLocalHealing solo para tests fallidos, no para los que pasan', async () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([
      makeTest({ state: 'passed' }),
      makeTest({ state: 'failed' }),
    ]))

    expect(mockRunLocalHealing).toHaveBeenCalledTimes(1)
  })

  it('manda testName/testFile/errorMessage correctos a runLocalHealing', async () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec({ relative: 'e2e/cart.cy.ts' }), makeResults([makeTest()]))

    expect(mockRunLocalHealing.mock.calls[0][0]).toMatchObject({
      testName: 'login > muestra error con credenciales inválidas',
      testFile: 'e2e/cart.cy.ts',
      errorMessage: "Expected to find element: `#login-btn`, but never found it.",
    })
  })

  it('usa "Unknown error" cuando falta displayError', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest({ displayError: undefined })]))

    expect(mockRunLocalHealing.mock.calls[0][0]).toMatchObject({ errorMessage: 'Unknown error' })
  })

  it('escribe healify-report.html/json/md en after:run cuando hay casos acumulados', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest()]))
    handlers['after:run']()

    expect(mockWriteFileSync).toHaveBeenCalledTimes(3)
    const paths = mockWriteFileSync.mock.calls.map((call) => call[0])
    expect(paths.some((p: string) => p.endsWith('healify-report.html'))).toBe(true)
    expect(paths.some((p: string) => p.endsWith('healify-report.json'))).toBe(true)
    expect(paths.some((p: string) => p.endsWith('healify-report.md'))).toBe(true)
  })

  it('escribe el reporte también cuando toda la suite pasó — el "todo verde" también es un entregable', () => {
    // Cambio de comportamiento deliberado: antes se cortaba con `if (localResults.length === 0)
    // return`. Un reporte que solo existe cuando algo falla no distingue "salió todo bien" de
    // "no se corrió nada".
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest({ state: 'passed' })]))
    handlers['after:run']()

    expect(mockWriteFileSync).toHaveBeenCalledTimes(3)
  })

  it('no rompe si Cypress invoca after:run sin resultados', () => {
    // Cypress no pasa `results` en todos los modos de ejecución. Encontrado por este test:
    // leer `results.browserName` sin chequear tiraba y el reporte no se escribía nunca.
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest()]))
    expect(() => handlers['after:run'](undefined)).not.toThrow()
    expect(mockWriteFileSync).toHaveBeenCalledTimes(3)
  })

  it('no rompe la corrida si runLocalHealing lanza una excepción', () => {
    mockRunLocalHealing.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    expect(() => handlers['after:spec'](makeSpec(), makeResults([makeTest()]))).not.toThrow()
  })

  it('devuelve la config sin modificar', () => {
    const { on } = createOnCapture()
    expect(HealifyCypressPlugin(on, fakeConfig)).toBe(fakeConfig)
  })
})

describe('HealifyCypressPlugin — tasks de cy.healifyGet (live)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function taskHandlers(on: Cypress.PluginEvents, handlers: Record<string, TaskHandler>) {
    HealifyCypressPlugin(on, fakeConfig)
    return handlers['task'] as Record<string, TaskHandler>
  }

  it("'healify:probe-script' devuelve BROWSER_PROBE_SCRIPT tal cual", () => {
    const { on, handlers } = createOnCapture()
    const tasks = taskHandlers(on, handlers)

    expect(tasks['healify:probe-script']()).toBe('return [];')
  })

  it("'healify:heal' llama analyzeAndHeal con el repertorio ya leído y devuelve el locator resuelto", () => {
    const { on, handlers } = createOnCapture()
    const tasks = taskHandlers(on, handlers)

    const output = tasks['healify:heal']({
      selector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.cy.ts',
      pageElements: [{ role: 'button', name: 'Comprar' }],
    })

    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(
      expect.objectContaining({
        selector: '#comprar-ahora-a1b2c3',
        testFile: 'e2e/checkout.cy.ts',
        htmlContext: 'button "Comprar"',
      })
    )
    expect(output).toEqual({
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      verified: true,
      fromRepertoire: false,
      explanation: 'texto real de la página',
      locator: { strategy: 'xpath', value: "//button[normalize-space(.)='Comprar']" },
    })
  })

  it("'healify:heal' degrada a heurística a ciegas cuando pageElements no trae nada aprovechable", () => {
    const { on, handlers } = createOnCapture()
    const tasks = taskHandlers(on, handlers)

    tasks['healify:heal']({ selector: '#comprar-ahora-a1b2c3', pageElements: [] })

    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(expect.objectContaining({ htmlContext: undefined }))
  })

  it("'healify:record-event' de un 'healed' vivo aparece en el reporte final aunque el test haya pasado", () => {
    const { on, handlers } = createOnCapture()
    const tasks = taskHandlers(on, handlers)

    tasks['healify:record-event']({
      type: 'healed',
      originalSelector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.cy.ts',
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      explanation: 'texto real de la página',
      verified: true,
      fromRepertoire: false,
    })

    // Nunca hubo un after:spec con test fallido — el único caso viene de la task en vivo.
    handlers['after:run']()

    const jsonCall = mockWriteFileSync.mock.calls.find((call) => String(call[0]).endsWith('healify-report.json'))
    expect(jsonCall).toBeDefined()
  })

  it("'healify:record-event' de un 'no-suggestion' se reporta como unresolved", () => {
    const { on, handlers } = createOnCapture()
    const tasks = taskHandlers(on, handlers)

    const result = tasks['healify:record-event']({
      type: 'no-suggestion',
      originalSelector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.cy.ts',
    })

    expect(result).toBeNull()
  })
})
