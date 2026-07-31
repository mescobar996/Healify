import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

const checkOllamaRunningMock = vi.fn()
const getInstalledModelsMock = vi.fn()
const httpRequestMock = vi.fn()

vi.mock('../detect-ram', () => ({
  checkOllamaRunning: (...args: unknown[]) => checkOllamaRunningMock(...args),
  getInstalledModels: (...args: unknown[]) => getInstalledModelsMock(...args),
  getSystemRAM: () => 16,
  suggestModel: () => ({ name: 'llama3.2:3b', minRAM: 8, size: '~2GB', description: '' }),
  MODELS: [],
}))

vi.mock('http', () => ({
  request: (...args: unknown[]) => httpRequestMock(...args),
}))

const { HealifyAI } = await import('../index')

function fakeResponse(statusCode: number, body: string) {
  const res: any = new EventEmitter()
  res.statusCode = statusCode
  res.resume = vi.fn()
  queueMicrotask(() => {
    res.emit('data', body)
    res.emit('end')
  })
  return res
}

function fakeRequest() {
  const req: any = new EventEmitter()
  req.write = vi.fn()
  req.end = vi.fn()
  req.destroy = vi.fn()
  return req
}

beforeEach(() => {
  checkOllamaRunningMock.mockReset()
  getInstalledModelsMock.mockReset()
  httpRequestMock.mockReset()
})

describe('HealifyAI.init', () => {
  it('falla con mensaje claro si Ollama no está corriendo', async () => {
    checkOllamaRunningMock.mockResolvedValue(false)

    const ai = new HealifyAI({ ollamaUrl: 'http://localhost:11434' })
    const result = await ai.init()

    expect(result.success).toBe(false)
    expect(result.message).toContain('http://localhost:11434')
  })

  it('usa config.ollamaUrl al chequear disponibilidad (no un valor fijo)', async () => {
    checkOllamaRunningMock.mockResolvedValue(false)

    const ai = new HealifyAI({ ollamaUrl: 'http://otro-host:9999' })
    await ai.init()

    expect(checkOllamaRunningMock).toHaveBeenCalledWith('http://otro-host:9999')
  })

  it('falla si el modelo configurado no está instalado', async () => {
    checkOllamaRunningMock.mockResolvedValue(true)
    getInstalledModelsMock.mockResolvedValue([{ name: 'phi3:mini', size: 1 }])

    const ai = new HealifyAI({ model: 'llama3.1:8b' })
    const result = await ai.init()

    expect(result.success).toBe(false)
    expect(result.message).toContain('llama3.1:8b')
  })

  it('éxito si Ollama corre y el modelo está instalado', async () => {
    checkOllamaRunningMock.mockResolvedValue(true)
    getInstalledModelsMock.mockResolvedValue([{ name: 'llama3.2:3b', size: 1 }])

    const ai = new HealifyAI({ model: 'llama3.2:3b' })
    const result = await ai.init()

    expect(result.success).toBe(true)
  })
})

describe('HealifyAI - llamadas a Ollama', () => {
  beforeEach(() => {
    checkOllamaRunningMock.mockResolvedValue(true)
    getInstalledModelsMock.mockResolvedValue([{ name: 'llama3.2:3b', size: 1 }])
  })

  it('explainSelector devuelve la respuesta de Ollama en éxito', async () => {
    httpRequestMock.mockImplementation((_url: any, _opts: any, cb: any) => {
      cb(fakeResponse(200, JSON.stringify({ response: 'explicación de prueba' })))
      return fakeRequest()
    })

    const ai = new HealifyAI({})
    await ai.init()
    await expect(ai.explainSelector('.btn')).resolves.toBe('explicación de prueba')
  })

  it('rechaza con error claro si Ollama responde status != 200', async () => {
    httpRequestMock.mockImplementation((_url: any, _opts: any, cb: any) => {
      cb(fakeResponse(500, ''))
      return fakeRequest()
    })

    const ai = new HealifyAI({})
    await ai.init()
    await expect(ai.explainSelector('.btn')).rejects.toThrow(/500/)
  })

  it('rechaza en vez de colgarse cuando la request hace timeout', async () => {
    httpRequestMock.mockImplementation((_url: any, _opts: any) => {
      const req = fakeRequest()
      req.destroy = vi.fn(() => {
        queueMicrotask(() => req.emit('error', new Error('socket hang up')))
      })
      queueMicrotask(() => req.emit('timeout'))
      return req
    })

    const ai = new HealifyAI({})
    await ai.init()
    await expect(ai.explainSelector('.btn')).rejects.toThrow()
  })

  it('chat trunca el historial a los últimos 20 mensajes antes de mandarlo', async () => {
    let sentMessages: any[] = []
    httpRequestMock.mockImplementation((_url: any, _opts: any, cb: any) => {
      const req = fakeRequest()
      req.write = vi.fn((data: string) => {
        sentMessages = JSON.parse(data).messages
      })
      queueMicrotask(() => cb(fakeResponse(200, JSON.stringify({ message: { content: 'ok' } }))))
      return req
    })

    const ai = new HealifyAI({})
    await ai.init()

    const longHistory = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg ${i}` }))
    await ai.chat('pregunta nueva', longHistory)

    // system + 20 de historial + el mensaje nuevo del usuario
    expect(sentMessages.length).toBe(22)
    expect(sentMessages[0].role).toBe('system')
  })
})
