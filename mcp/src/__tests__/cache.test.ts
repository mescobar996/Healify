import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cacheKey, readCache, writeCache, getCached, setCached, DEFAULT_TTL_MS } from '../cache'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-mcp-cache-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const cachePath = () => join(dir, 'mcp-cache.json')

describe('cacheKey', () => {
  it('es un sha256 estable: mismo input, misma clave', () => {
    expect(cacheKey('#add-to-cart')).toBe(cacheKey('#add-to-cart'))
    expect(cacheKey('#add-to-cart')).toHaveLength(64)
  })

  it('distingue selector, pageUrl y framework', () => {
    expect(cacheKey('#a', undefined, 'cypress')).not.toBe(cacheKey('#a'))
    expect(cacheKey('#a', 'https://x.com')).not.toBe(cacheKey('#a'))
    expect(cacheKey('#a', 'https://x.com', 'playwright')).not.toBe(cacheKey('#a', 'https://x.com', 'cypress'))
    expect(cacheKey('#a', 'https://x.com')).not.toBe(cacheKey('#a', 'https://y.com'))
  })

  it('separa por herramienta: analyze y batch nunca comparten entrada', () => {
    expect(cacheKey('#a', undefined, 'cypress', 'analyze')).not.toBe(cacheKey('#a', undefined, 'cypress', 'batch'))
  })
})

describe('getCached/setCached', () => {
  it('roundtrip dentro del TTL', () => {
    const key = cacheKey('#a')
    setCached(cachePath(), key, { selector: '#a' }, DEFAULT_TTL_MS, 1_000)
    expect(getCached(cachePath(), key, DEFAULT_TTL_MS, 1_000)).toEqual({ selector: '#a' })
    expect(getCached(cachePath(), key, DEFAULT_TTL_MS, 1_000 + DEFAULT_TTL_MS - 1)).toEqual({ selector: '#a' })
  })

  it('invalida al vencer el TTL', () => {
    const key = cacheKey('#a')
    setCached(cachePath(), key, { selector: '#a' }, DEFAULT_TTL_MS, 1_000)
    expect(getCached(cachePath(), key, DEFAULT_TTL_MS, 1_000 + DEFAULT_TTL_MS + 1)).toBeNull()
  })

  it('miss devuelve null, no el valor', () => {
    expect(getCached(cachePath(), cacheKey('#x'), DEFAULT_TTL_MS, Date.now())).toBeNull()
  })

  it('un cache corrupto se ignora y no tira', () => {
    writeFileSync(cachePath(), '{no es json', 'utf-8')
    expect(readCache(cachePath())).toEqual({})
    expect(getCached(cachePath(), cacheKey('#a'), DEFAULT_TTL_MS, Date.now())).toBeNull()

    // Y sigue funcionando para escribir/leer fresco.
    setCached(cachePath(), cacheKey('#a'), { ok: 1 }, DEFAULT_TTL_MS, Date.now())
    expect(getCached(cachePath(), cacheKey('#a'), DEFAULT_TTL_MS, Date.now())).toEqual({ ok: 1 })
  })

  it('entradas con forma inesperada se descartan', () => {
    // Sin timestamp numérico no es una entrada válida del cache.
    writeFileSync(cachePath(), JSON.stringify({ [cacheKey('#a')]: { value: 1 } }), 'utf-8')
    expect(readCache(cachePath())).toEqual({})
  })

  it('writeCache poda las entradas vencidas', () => {
    const store = {
      [cacheKey('#a')]: { value: 1, timestamp: 1_000 },
      [cacheKey('#b')]: { value: 2, timestamp: 9_000 },
    }
    writeCache(cachePath(), store, 5_000, 10_000)
    const onDisk = readCache(cachePath())
    expect(onDisk[cacheKey('#a')]).toBeUndefined()
    expect(onDisk[cacheKey('#b')]?.value).toBe(2)
  })
})
