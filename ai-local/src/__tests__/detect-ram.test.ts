import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { IncomingMessage, RequestOptions } from 'node:http'

const totalmemMock = vi.fn(() => 16 * 1024 * 1024 * 1024)
const httpGetMock = vi.fn()

vi.mock('os', () => ({
  totalmem: (...args: unknown[]) => totalmemMock(...args),
}))

vi.mock('http', () => ({
  get: (...args: unknown[]) => httpGetMock(...args),
}))

const { getSystemRAM, suggestModel, checkOllamaRunning, getInstalledModels, MODELS } = await import('../detect-ram')

function fakeResponse(statusCode: number, body: string): IncomingMessage {
  const res = new EventEmitter() as unknown as IncomingMessage
  res.statusCode = statusCode
  res.resume = vi.fn() as unknown as () => IncomingMessage
  queueMicrotask(() => {
    res.emit('data', body)
    res.emit('end')
  })
  return res
}

beforeEach(() => {
  totalmemMock.mockReset().mockReturnValue(16 * 1024 * 1024 * 1024)
  httpGetMock.mockReset()
})

describe('getSystemRAM', () => {
  it('redondea la RAM total a GB', () => {
    totalmemMock.mockReturnValue(16 * 1024 * 1024 * 1024)
    expect(getSystemRAM()).toBe(16)
  })
})

describe('suggestModel', () => {
  it('sugiere el modelo más liviano si sobra poca RAM', () => {
    expect(suggestModel(4).name).toBe(MODELS[0].name)
  })

  it('sugiere el modelo más pesado con RAM alta', () => {
    expect(suggestModel(32).name).toBe('llama3.1:13b')
  })

  it('deja 2GB de margen para el sistema operativo', () => {
    // 8GB - 2GB de margen = 6GB disponibles, no alcanza para llama3.2:3b (min 8)
    expect(suggestModel(8).name).toBe('phi3:mini')
  })
})

describe('checkOllamaRunning / getInstalledModels', () => {
  it('devuelve true cuando Ollama responde 200 con JSON válido', async () => {
    httpGetMock.mockImplementation((_url: string, _opts: RequestOptions, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(200, JSON.stringify({ models: [{ name: 'llama3.2:3b' }] })))
      return new EventEmitter()
    })

    await expect(checkOllamaRunning('http://localhost:11434')).resolves.toBe(true)
  })

  it('devuelve false si Ollama responde con status != 200', async () => {
    httpGetMock.mockImplementation((_url: string, _opts: RequestOptions, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(500, ''))
      return new EventEmitter()
    })

    await expect(checkOllamaRunning('http://localhost:11434')).resolves.toBe(false)
  })

  it('devuelve false ante error de red', async () => {
    httpGetMock.mockImplementation((_url: string) => {
      const req = new EventEmitter()
      queueMicrotask(() => req.emit('error', new Error('ECONNREFUSED')))
      return req
    })

    await expect(checkOllamaRunning('http://localhost:11434')).resolves.toBe(false)
  })

  it('devuelve false si el body no es JSON válido', async () => {
    httpGetMock.mockImplementation((_url: string, _opts: RequestOptions, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(200, 'no es json'))
      return new EventEmitter()
    })

    await expect(checkOllamaRunning('http://localhost:11434')).resolves.toBe(false)
  })

  it('usa la URL configurada, no un valor hardcoded', async () => {
    let requestedUrl = ''
    httpGetMock.mockImplementation((url: string, _opts: RequestOptions, cb: (res: IncomingMessage) => void) => {
      requestedUrl = String(url)
      cb(fakeResponse(200, JSON.stringify({ models: [] })))
      return new EventEmitter()
    })

    await checkOllamaRunning('http://otro-host:9999')
    expect(requestedUrl).toBe('http://otro-host:9999/api/tags')
  })

  it('getInstalledModels devuelve la lista de modelos', async () => {
    httpGetMock.mockImplementation((_url: string, _opts: RequestOptions, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(200, JSON.stringify({ models: [{ name: 'phi3:mini' }] })))
      return new EventEmitter()
    })

    await expect(getInstalledModels('http://localhost:11434')).resolves.toEqual([{ name: 'phi3:mini' }])
  })

  it('getInstalledModels devuelve [] si Ollama no responde', async () => {
    httpGetMock.mockImplementation((_url: string) => {
      const req = new EventEmitter()
      queueMicrotask(() => req.emit('error', new Error('ECONNREFUSED')))
      return req
    })

    await expect(getInstalledModels('http://localhost:11434')).resolves.toEqual([])
  })
})
