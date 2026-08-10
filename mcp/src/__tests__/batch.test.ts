import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mapWithConcurrency, withTimeout, analyzeBatchSelectors, MAX_CONCURRENCY, ANALYSIS_TIMEOUT_MS } from '../batch'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('mapWithConcurrency', () => {
  it('preserva el orden y nunca pasa del límite de concurrentes', async () => {
    let active = 0
    let peak = 0
    const result = await mapWithConcurrency([10, 20, 30, 40, 50, 60], 2, async (x) => {
      active++
      peak = Math.max(peak, active)
      await delay(x)
      active--
      return x * 2
    })

    expect(result).toEqual([20, 40, 60, 80, 100, 120])
    expect(peak).toBe(2)
  })

  it('trabaja con listas más chicas que el límite', async () => {
    const result = await mapWithConcurrency([1, 2], 5, async (x) => x + 1)
    expect(result).toEqual([2, 3])
  })

  it('el límite por defecto del batch es 5', () => {
    expect(MAX_CONCURRENCY).toBe(5)
  })
})

describe('withTimeout', () => {
  it('resuelve antes del plazo', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1_000, 'timeout', 'x')).resolves.toBe('ok')
  })

  it('rechaza con el código cuando vence', async () => {
    await expect(withTimeout(delay(200), 10, 'timeout', 'se colgó')).rejects.toMatchObject({
      code: 'timeout',
      message: 'se colgó',
    })
  })

  it('el timeout por análisis es de 30 segundos', () => {
    expect(ANALYSIS_TIMEOUT_MS).toBe(30_000)
  })
})

describe('analyzeBatchSelectors', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-mcp-batch-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('un selector vacío va a errors, el resto se analiza igual', async () => {
    const { results, errors } = await analyzeBatchSelectors(['#btn-ingresar', '   ', '#user-correo'], undefined, undefined, {
      cachePath: join(dir, 'cache.json'),
    })

    expect(results.map((r) => r.original)).toEqual(['#btn-ingresar', '#user-correo'])
    expect(errors).toEqual([{ original: '   ', code: 'INVALID_INPUT', message: 'Selector vacío.' }])
    expect(errors).toHaveLength(1)
  })

  it('cachea por selector: la segunda pasada lee el cache y escribe el archivo', async () => {
    const cachePath = join(dir, 'cache.json')
    const primera = await analyzeBatchSelectors(['#btn-ingresar'], undefined, undefined, { cachePath })
    const segunda = await analyzeBatchSelectors(['#btn-ingresar'], undefined, undefined, { cachePath })

    expect(primera.results[0]).toEqual(segunda.results[0])
    expect(primera.results[0].suggestions.length).toBeGreaterThan(0)
    expect(primera.results[0].confidence).toBeGreaterThan(0)
    expect(existsSync(cachePath)).toBe(true)
  })

  it('adapta las sugerencias al framework pedido', async () => {
    const { results } = await analyzeBatchSelectors(['#btn-ingresar'], undefined, 'cypress', { cachePath: join(dir, 'cache.json') })

    expect(results[0].suggestions[0]).toBe("cy.contains('button', 'Ingresar')")
  })
})
