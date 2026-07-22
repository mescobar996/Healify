import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunLocalHealing, mockWriteFileSync } = vi.hoisted(() => {
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
  return { mockRunLocalHealing, mockWriteFileSync }
})

vi.mock('@healify/reporter-core', () => ({
  runLocalHealing: mockRunLocalHealing,
  renderLocalReportHtml: vi.fn(() => '<html></html>'),
  renderLocalReportJson: vi.fn(() => '{}'),
}))

vi.mock('node:fs', () => ({
  writeFileSync: mockWriteFileSync,
}))

import { HealifyCypressPlugin } from '../plugin'

/** Captura los handlers que el plugin registra vía on(event, handler), para invocarlos a mano. */
function createOnCapture() {
  const handlers: Record<string, (...args: any[]) => any> = {}
  const on = vi.fn((event: string, handler: (...args: any[]) => any) => {
    handlers[event] = handler
  }) as unknown as Cypress.PluginEvents
  return { on, handlers }
}

function makeSpec(overrides?: Record<string, unknown>) {
  return { relative: 'e2e/login.cy.ts', ...overrides } as any
}

function makeResults(tests: Record<string, unknown>[]) {
  return { tests } as any
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

  it('escribe healify-report.html/json en after:run cuando hay casos acumulados', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest()]))
    handlers['after:run']()

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
    const paths = mockWriteFileSync.mock.calls.map((call) => call[0])
    expect(paths.some((p: string) => p.endsWith('healify-report.html'))).toBe(true)
    expect(paths.some((p: string) => p.endsWith('healify-report.json'))).toBe(true)
  })

  it('NO escribe nada en after:run si no hubo tests fallidos', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:spec'](makeSpec(), makeResults([makeTest({ state: 'passed' })]))
    handlers['after:run']()

    expect(mockWriteFileSync).not.toHaveBeenCalled()
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
