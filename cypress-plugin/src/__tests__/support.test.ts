import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * `support.ts` corre dentro del browser, así que no se puede importar a secas: se apoya en los
 * globales `Cypress` y `cy`. Acá se fabrican los mínimos necesarios para ejercitar el camino que
 * importa, y el módulo se importa DESPUÉS de definirlos (import dinámico) porque al importarse
 * registra el listener de `Cypress.on('fail')`.
 *
 * El fake de chainable no es Cypress de verdad: ejecuta los callbacks de `.then()` en orden
 * (con el valor con que resolvería cada tarea mockeada), suficiente para recorrer los flujos de
 * sondeo + curación sin un browser.
 */

type ThenArgs = { timeout?: number } | undefined

interface FakeChainable {
  __initial: unknown
  __handlers: Array<(value: unknown) => unknown>
  then(...args: unknown[]): FakeChainable
}

function chainable(initial: unknown = undefined): FakeChainable {
  const handlers: Array<(value: unknown) => unknown> = []
  const chain: FakeChainable = {
    __initial: initial,
    __handlers: handlers,
    then(...args: unknown[]): FakeChainable {
      const hasOptions = typeof args[0] !== 'function'
      thenOptions.push((hasOptions ? args[0] : undefined) as ThenArgs)
      handlers.push((hasOptions ? args[1] : args[0]) as (value: unknown) => unknown)
      return chain
    },
  }
  return chain
}

/** Corre la cadena: cada handler recibe el valor que fluye; si devuelve otro chainable, se recorre en profundidad. */
async function drive(chain: FakeChainable): Promise<unknown> {
  let value = chain.__initial
  for (const handler of chain.__handlers) {
    const result = handler(value)
    value =
      result && typeof result === 'object' && '__handlers' in (result as object)
        ? await drive(result as FakeChainable)
        : await result
  }
  return value
}

/** Options que recibió cada `.then()`, en orden de llamada (para el chequeo del presupuesto de tiempo). */
let thenOptions: ThenArgs[] = []

/** Valores con los que resuelve cada `cy.task()` mockeado, por nombre. */
let taskResults: Record<string, unknown> = {}

let failHandler: ((error: Error) => void) | null = null

interface FakeWin {
  Function: ReturnType<typeof vi.fn>
  document: {
    querySelector: ReturnType<typeof vi.fn>
    evaluate: ReturnType<typeof vi.fn>
  }
}

function makeWin(overrides: Partial<FakeWin> = {}): FakeWin {
  return {
    // `new win.Function(...)` exige un constructor real: una arrow function como
    // implementación del mock tira TypeError ("not a constructor") y el try/catch
    // de support.ts lo degradaría silenciosamente a null.
    Function: vi.fn(function (this: unknown) {
      return function () {
        return []
      }
    }),
    document: {
      querySelector: vi.fn(() => null),
      evaluate: vi.fn(() => ({ singleNodeValue: null })),
    },
    ...overrides,
  }
}

interface CypressFake {
  Commands: { add: ReturnType<typeof vi.fn> }
  Promise: typeof Promise
  $: ReturnType<typeof vi.fn>
  config: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  spec: { relative: string }
}

function installCypressGlobals(win: FakeWin = makeWin()): { cypress: CypressFake; cy: ReturnType<typeof vi.fn> } {
  thenOptions = []
  taskResults = {}
  failHandler = null

  const cypress = {
    Commands: { add: vi.fn() },
    Promise,
    $: vi.fn(() => ({ length: 0 })),
    config: vi.fn((key: string) => (key === 'defaultCommandTimeout' ? 4000 : undefined)),
    on: vi.fn((event: string, handler: (error: Error) => void) => {
      if (event === 'fail') failHandler = handler
    }),
    spec: { relative: 'cypress/e2e/x.cy.js' },
  }

  const cy = {
    window: vi.fn(() => chainable(win)),
    wrap: vi.fn((value: unknown) => chainable(value)),
    task: vi.fn((name: string) => chainable(taskResults[name])),
  }

  ;(globalThis as Record<string, unknown>).Cypress = cypress
  ;(globalThis as Record<string, unknown>).cy = cy
  // `resolveElement` usa XPathResult.FIRST_ORDERED_NODE_TYPE, un global del browser que no existe en Node.
  ;(globalThis as Record<string, unknown>).XPathResult = { FIRST_ORDERED_NODE_TYPE: 9 }
  return { cypress, cy }
}

async function loadHealifyGet(): Promise<(selector: string, options?: Record<string, unknown>) => unknown> {
  vi.resetModules()
  await import('../support')
  const cypress = (globalThis as Record<string, unknown>).Cypress as { Commands: { add: ReturnType<typeof vi.fn> } }
  const registration = cypress.Commands.add.mock.calls.find((call) => call[0] === 'healifyGet')
  if (!registration) throw new Error('healifyGet no se registró')
  return registration[1] as (selector: string, options?: Record<string, unknown>) => unknown
}

function healOutput(overrides: Record<string, unknown> = {}): HealTaskOutputLike {
  return {
    fixedSelector: '#nuevo',
    confidence: 0.95,
    locator: { strategy: 'css', value: '#nuevo' },
    role: { role: 'button', name: 'Nuevo' },
    verified: true,
    explanation: 'probado contra la página',
    fromRepertoire: false,
    ...overrides,
  }
}

interface HealTaskOutputLike {
  fixedSelector?: string
  confidence: number
  locator: { strategy: string; value: string | null }
  role?: { role: string; name: string }
  verified?: boolean
  explanation?: string
  fromRepertoire?: boolean
}

describe('cy.healifyGet — presupuesto de tiempo del sondeo', () => {
  beforeEach(() => {
    installCypressGlobals()
  })

  /**
   * El bug: el `.then()` que contiene el sondeo heredaba `defaultCommandTimeout`, o sea el MISMO
   * número que el sondeo iba a esperar. Como el sondeo recién resuelve en el tick posterior al
   * vencimiento, Cypress mataba el comando primero — siempre, no de a ratos — con
   * "cy.then() timed out … promise that never resolved".
   */
  it('le da al comando más tiempo del que va a esperar el sondeo', async () => {
    const healifyGet = await loadHealifyGet()
    healifyGet('#no-existe', { timeout: 100 })

    const pollOptions = thenOptions[0]
    expect(pollOptions?.timeout).toBeGreaterThan(100)
  })

  it('el margen también aplica cuando el timeout sale de defaultCommandTimeout', async () => {
    const healifyGet = await loadHealifyGet()
    healifyGet('#no-existe')

    const pollOptions = thenOptions[0]
    expect(pollOptions?.timeout).toBeGreaterThan(4000)
  })
})

describe('registerAuditHandler — Cypress.on("fail")', () => {
  it('registra una entrada de auditoría por cada selector distinto y re-lanza el error', async () => {
    const { cypress, cy } = installCypressGlobals()
    await loadHealifyGet()

    expect(cypress.on).toHaveBeenCalledWith('fail', expect.any(Function))
    const error = new Error("CypressError: Timed out retrying: Expected to find selector: '#roto', but never found it")
    expect(() => failHandler?.(error)).toThrow(error)

    expect(cy.task).toHaveBeenCalledWith(
      'healify:audit-entry',
      expect.objectContaining({ selector: '#roto', error: error.message, stackTrace: expect.any(String) }),
      { log: false }
    )
  })

  it('no duplica entradas para el mismo selector en la misma corrida', async () => {
    const { cy } = installCypressGlobals()
    await loadHealifyGet()

    const error = new Error("Expected to find selector: '#roto'")
    expect(() => failHandler?.(error)).toThrow(error)
    expect(() => failHandler?.(error)).toThrow(error)

    const auditCalls = cy.task.mock.calls.filter((call) => call[0] === 'healify:audit-entry')
    expect(auditCalls).toHaveLength(1)
  })

  it('ignora fallos sin selector extraíble', async () => {
    const { cy } = installCypressGlobals()
    await loadHealifyGet()

    expect(() => failHandler?.(new Error('assertion failed: expected 2 to equal 3'))).toThrow()
    const auditCalls = cy.task.mock.calls.filter((call) => call[0] === 'healify:audit-entry')
    expect(auditCalls).toHaveLength(0)
  })
})

describe('healifyGet — selector presente', () => {
  it('devuelve el elemento envuelto sin pasar por la curación', async () => {
    const { cypress } = installCypressGlobals()
    const $el = { length: 1, selector: '#ok' }
    cypress.$.mockReturnValue($el)
    const healifyGet = await loadHealifyGet()

    const result = await drive(healifyGet('#ok', { timeout: 50 }) as FakeChainable)

    expect(cypress.$.mock.calls[0][0]).toBe('#ok')
    expect(result).toBe($el)
  })
})

describe('healifyGet — selector roto, curación con sugerencia', () => {
  it('sondea, cura con locator css y registra el evento healed', async () => {
    const win = makeWin({
      document: { querySelector: vi.fn(() => ({ tagName: 'BUTTON' })), evaluate: vi.fn(() => ({ singleNodeValue: null })) },
    })
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = '(function(){ return [] })'
    taskResults['healify:find-script'] = 'return function(){ return null }'
    taskResults['healify:heal'] = healOutput()
    const healifyGet = await loadHealifyGet()

    const result = await drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)

    // El sondeo del DOM se ejecuta con el script cacheado en la ventana real de la AUT.
    expect(win.Function).toHaveBeenCalled()
    // El heal recibe el selector y el resultado del sondeo.
    const healCall = cy.task.mock.calls.find((call) => call[0] === 'healify:heal')
    expect(healCall?.[1]).toMatchObject({ selector: '#roto', testFile: 'cypress/e2e/x.cy.js' })
    // Se registra el evento healed con la sugerencia verificada.
    const healedEvent = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(healedEvent?.[1]).toMatchObject({ type: 'healed', originalSelector: '#roto', fixedSelector: '#nuevo', verified: true })
    expect(result).toEqual({ length: 0 })
  })

  it('cura con locator xpath usando el resultado de evaluate()', async () => {
    const win = makeWin({
      document: { querySelector: vi.fn(() => null), evaluate: vi.fn(() => ({ singleNodeValue: { tagName: 'A' } })) },
    })
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput({ locator: { strategy: 'xpath', value: "//button[normalize-space(.)='Nuevo']" } })
    const healifyGet = await loadHealifyGet()

    await drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)

    expect(win.document.evaluate).toHaveBeenCalled()
    const healedEvent = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(healedEvent?.[1]).toMatchObject({ type: 'healed' })
  })

  it('si el css falla pero el buscador por rol encuentra el elemento en shadow DOM, cura igual', async () => {
    const finder = function () {
      return { tagName: 'BUTTON' }
    }
    const win = makeWin({
      document: { querySelector: vi.fn(() => null), evaluate: vi.fn(() => ({ singleNodeValue: null })) },
      Function: vi.fn(function (this: unknown, body: string) {
        // La búsqueda por rol se cachea aparte del sondeo; el cuerpo del finder es distinguible.
        return String(body).includes('find') ? finder : function () {
          return []
        }
      }),
    })
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = 'probe'
    taskResults['healify:find-script'] = 'find'
    taskResults['healify:heal'] = healOutput({ locator: { strategy: 'css', value: '#nuevo' } })
    const healifyGet = await loadHealifyGet()

    await drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)

    const healedEvent = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(healedEvent?.[1]).toMatchObject({ type: 'healed', fixedSelector: '#nuevo' })
  })
})

describe('healifyGet — curaciones que no se pueden aplicar', () => {
  it('confianza por debajo del umbral: registra no-suggestion y tira error', async () => {
    const { cy } = installCypressGlobals()
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput({ confidence: 0.5 })
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(
      'Healify: no se pudo curar el selector roto "#roto".'
    )
    const event = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(event?.[1]).toMatchObject({ type: 'no-suggestion', originalSelector: '#roto' })
  })

  it('locator unsupported: registra no-suggestion', async () => {
    const { cy } = installCypressGlobals()
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput({ locator: { strategy: 'unsupported', value: null } })
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(/no se pudo curar/)
    const event = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(event?.[1]).toMatchObject({ type: 'no-suggestion' })
  })

  it('sugerencia que tampoco encuentra el elemento: registra failed y tira error', async () => {
    const { cy } = installCypressGlobals()
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput()
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(
      'Healify: la sugerencia "#nuevo" tampoco encontró el elemento.'
    )
    const event = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(event?.[1]).toMatchObject({ type: 'failed', originalSelector: '#roto', fixedSelector: '#nuevo' })
  })

  it('querySelector que tira: cae al failed con el mismo criterio', async () => {
    const win = makeWin({
      document: { querySelector: vi.fn(() => { throw new Error('selector inválido') }), evaluate: vi.fn(() => ({ singleNodeValue: null })) },
    })
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput()
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(/tampoco encontró/)
    const event = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(event?.[1]).toMatchObject({ type: 'failed' })
  })

  it('el sondeo del DOM que tira degrada a pageElements vacíos sin romper el heal', async () => {
    const win = makeWin({
      Function: vi.fn(() => () => { throw new Error('boom') }),
    })
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput()
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(/tampoco encontró/)
    const healCall = cy.task.mock.calls.find((call) => call[0] === 'healify:heal')
    expect(healCall?.[1]).toMatchObject({ pageElements: [] })
  })

  it('sin rol ni finder cacheado: la sugerencia css que no resuelve queda en failed', async () => {
    const win = makeWin()
    const { cy } = installCypressGlobals(win)
    taskResults['healify:probe-script'] = '() => []'
    taskResults['healify:find-script'] = '() => null'
    taskResults['healify:heal'] = healOutput({ role: undefined, locator: { strategy: 'css', value: '#nuevo' } })
    const healifyGet = await loadHealifyGet()

    await expect(drive(healifyGet('#roto', { timeout: 50 }) as FakeChainable)).rejects.toThrow(/tampoco encontró/)
    const event = cy.task.mock.calls.find((call) => call[0] === 'healify:record-event')
    expect(event?.[1]).toMatchObject({ type: 'failed' })
  })
})
