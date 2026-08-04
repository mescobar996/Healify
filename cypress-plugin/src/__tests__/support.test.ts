import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * `support.ts` corre dentro del browser, así que no se puede importar a secas: se apoya en los
 * globales `Cypress` y `cy`. Acá se fabrican los mínimos necesarios para ejercitar el camino que
 * importa, y el módulo se importa DESPUÉS de definirlos (import dinámico) porque al importarse
 * registra el listener de `Cypress.on('fail')`.
 *
 * Lo que se verifica es una sola propiedad, y es la que se rompió de verdad en producción: el
 * comando de Cypress que envuelve al sondeo tiene que tener MÁS presupuesto de tiempo que el
 * sondeo mismo.
 */

type ThenArgs = { timeout?: number } | undefined

/** Options que recibió cada `.then()`, en orden de llamada. */
let thenOptions: ThenArgs[] = []

interface FakeChainable {
  then(...args: unknown[]): FakeChainable
  __promise: Promise<unknown>
}

function chainable(promise: Promise<unknown>): FakeChainable {
  return {
    then(...args: unknown[]): FakeChainable {
      const hasOptions = typeof args[0] !== 'function'
      const options = (hasOptions ? args[0] : undefined) as ThenArgs
      const callback = (hasOptions ? args[1] : args[0]) as (value: unknown) => unknown
      thenOptions.push(options)
      return chainable(promise.then((value) => callback(value)))
    },
    __promise: promise,
  }
}

function installCypressGlobals(): void {
  thenOptions = []

  const cypress = {
    Commands: { add: vi.fn() },
    Promise,
    $: vi.fn(() => ({ length: 0 })),
    config: vi.fn((key: string) => (key === 'defaultCommandTimeout' ? 4000 : undefined)),
    on: vi.fn(),
    spec: { relative: 'cypress/e2e/x.cy.js' },
  }

  const cy = {
    window: vi.fn(() => chainable(Promise.resolve({}))),
    wrap: vi.fn((value: unknown) => chainable(Promise.resolve(value))),
    task: vi.fn(() => chainable(Promise.resolve(null))),
  }

  ;(globalThis as Record<string, unknown>).Cypress = cypress
  ;(globalThis as Record<string, unknown>).cy = cy
}

async function loadHealifyGet(): Promise<(selector: string, options?: Record<string, unknown>) => unknown> {
  vi.resetModules()
  await import('../support')
  const cypress = (globalThis as Record<string, unknown>).Cypress as { Commands: { add: ReturnType<typeof vi.fn> } }
  const registration = cypress.Commands.add.mock.calls.find((call) => call[0] === 'healifyGet')
  if (!registration) throw new Error('healifyGet no se registró')
  return registration[1] as (selector: string, options?: Record<string, unknown>) => unknown
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
   *
   * Lo peor era dónde caía: solo cuando el selector NO existía, que es el único caso en el que
   * Healify tiene algo que hacer. Con el selector presente el sondeo resolvía enseguida y todo
   * parecía funcionar.
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
