import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn((): boolean => false),
  mockReadFileSync: vi.fn((): string => '{}'),
  mockWriteFileSync: vi.fn(),
  mockCheckOllamaRunning: vi.fn((): Promise<boolean> => Promise.resolve(true)),
  mockGetSystemRAM: vi.fn((): number => 16),
  mockSuggestModel: vi.fn(() => ({ name: 'llama3:8b', size: '4.7GB', description: 'balance', minRAM: 8 })),
  mockGetInstalledModels: vi.fn((): Promise<Array<{ name: string; size: number }>> => Promise.resolve([])),
  mockCreateInterface: vi.fn(),
  mockInit: vi.fn((): Promise<{ success: boolean; message: string }> => Promise.resolve({ success: true, message: 'ok' })),
  mockExplainSelector: vi.fn((): Promise<string> => Promise.resolve('explicación')),
  mockChat: vi.fn((): Promise<string> => Promise.resolve('respuesta')),
}))

vi.mock('@healify/ai-local', () => ({
  HealifyAI: class {
    init = mocks.mockInit
    explainSelector = mocks.mockExplainSelector
    chat = mocks.mockChat
  },
  checkOllamaRunning: mocks.mockCheckOllamaRunning,
  getSystemRAM: mocks.mockGetSystemRAM,
  suggestModel: mocks.mockSuggestModel,
  getInstalledModels: mocks.mockGetInstalledModels,
  MODELS: [
    { name: 'llama3:8b', size: '4.7GB', description: 'balance', minRAM: 8 },
    { name: 'qwen2.5:7b', size: '4.7GB', description: 'rápido', minRAM: 16 },
  ],
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: mocks.mockExistsSync, readFileSync: mocks.mockReadFileSync, writeFileSync: mocks.mockWriteFileSync }
})

vi.mock('node:readline', () => ({ createInterface: mocks.mockCreateInterface }))

import {
  runAiSetup,
  runAiStatus,
  runAiExplain,
  runAiChat,
  runAiModels,
} from '../commands/ai'

let log: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`PROCESS_EXIT:${code ?? ''}`)
  }) as typeof process.exit)
  vi.clearAllMocks()
  mocks.mockExistsSync.mockReturnValue(false)
  mocks.mockReadFileSync.mockReturnValue('{}')
  mocks.mockCheckOllamaRunning.mockResolvedValue(true)
  mocks.mockGetInstalledModels.mockResolvedValue([])
  mocks.mockInit.mockResolvedValue({ success: true, message: 'ok' })
  mocks.mockExplainSelector.mockResolvedValue('explicación')
  mocks.mockChat.mockResolvedValue('respuesta')
  mocks.mockCreateInterface.mockReturnValue({ question: vi.fn(), close: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function rlQuestion(): (input: string) => void {
  const rl = mocks.mockCreateInterface.mock.results[0].value
  return rl.question.mock.calls[0][1]
}

describe('runAiSetup', () => {
  it('sale con 1 si Ollama no está disponible', async () => {
    mocks.mockCheckOllamaRunning.mockResolvedValue(false)

    await expect(runAiSetup()).rejects.toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Ollama no está disponible'))
    expect(mocks.mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('configura y guarda la configuración con el modelo sugerido', async () => {
    await expect(runAiSetup()).resolves.toBeUndefined()

    expect(log).toHaveBeenCalledWith('✅ Ollama detectado en http://localhost:11434')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('llama3:8b'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No hay modelos instalados'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ollama pull llama3:8b'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Configuración guardada'))

    const written = JSON.parse(mocks.mockWriteFileSync.mock.calls[0][1] as string)
    expect(written.ai).toEqual({ enabled: true, model: 'llama3:8b', language: 'es', ollamaUrl: 'http://localhost:11434' })
  })

  it('no sugiere descargar si el modelo sugerido ya está instalado', async () => {
    mocks.mockGetInstalledModels.mockResolvedValue([{ name: 'llama3:8b', size: 4700000000 }])

    await expect(runAiSetup()).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('ollama pull llama3:8b'))
  })

  it('preserva el idioma existente de la config y lista modelos instalados', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify({ ai: { language: 'en' } }))
    mocks.mockGetInstalledModels.mockResolvedValue([{ name: 'qwen2.5:7b', size: 4700000000 }])

    await expect(runAiSetup()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('   - qwen2.5:7b')

    const written = JSON.parse(mocks.mockWriteFileSync.mock.calls[0][1] as string)
    expect(written.ai.language).toBe('en')
  })

  it('config corrupta cae al default y sigue funcionando', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReadFileSync.mockReturnValue('{ no es json')

    await expect(runAiSetup()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('✅ Ollama detectado en http://localhost:11434')
  })
})

describe('runAiStatus', () => {
  it('Ollama caído: reporta no disponible', async () => {
    mocks.mockCheckOllamaRunning.mockResolvedValue(false)

    await expect(runAiStatus()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('❌ No disponible'))
  })

  it('Ollama corriendo con config: reporta modelo, idioma y modelos instalados', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReadFileSync.mockReturnValue(JSON.stringify({ ai: { model: 'llama3:8b', language: 'es', ollamaUrl: 'http://x:11434' } }))
    mocks.mockGetInstalledModels.mockResolvedValue([{ name: 'llama3:8b', size: 1 }])

    await expect(runAiStatus()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('✅ Corriendo'))
    expect(log).toHaveBeenCalledWith('  Modelo: llama3:8b')
    expect(log).toHaveBeenCalledWith('  Idioma: es')
    expect(log).toHaveBeenCalledWith('  - llama3:8b')
  })

  it('Ollama corriendo sin config.ai: no imprime sección de configuración', async () => {
    await expect(runAiStatus()).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Modelo:'))
  })
})

describe('runAiExplain', () => {
  it('sin argumentos: imprime uso y sale con 1', async () => {
    await expect(runAiExplain([])).rejects.toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('Uso: healify ai explain <selector>')
  })

  it('init falla: imprime el mensaje y sale con 1', async () => {
    mocks.mockInit.mockResolvedValue({ success: false, message: 'Ollama no está disponible en x' })

    await expect(runAiExplain(['#boton'])).rejects.toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('❌ Ollama no está disponible en x')
  })

  it('init ok: explica el selector', async () => {
    await expect(runAiExplain(['#boton'])).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('\n🔍 Analizando: #boton\n')
    expect(log).toHaveBeenCalledWith('explicación')
  })

  it('el motor tira: imprime error y sale con 1', async () => {
    mocks.mockExplainSelector.mockRejectedValue(new Error('timeout'))

    await expect(runAiExplain(['#boton'])).rejects.toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('❌ Error: timeout')
  })
})

describe('runAiChat', () => {
  it('init falla: sale con 1 sin crear el readline', async () => {
    mocks.mockInit.mockResolvedValue({ success: false, message: 'sin ollama' })

    await expect(runAiChat()).rejects.toThrow('PROCESS_EXIT:1')
    expect(mocks.mockCreateInterface).not.toHaveBeenCalled()
  })

  it('"salir" cierra el chat', async () => {
    await expect(runAiChat()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Chat con Healify AI'))
    await expect(rlQuestion()('salir')).rejects.toThrow('PROCESS_EXIT:0')
    expect(log).toHaveBeenCalledWith('\n👋 ¡Hasta luego!')
    expect(mocks.mockCreateInterface.mock.results[0].value.close).toHaveBeenCalled()
  })

  it('input vacío vuelve a preguntar', async () => {
    await expect(runAiChat()).resolves.toBeUndefined()
    await rlQuestion()('   ')
    expect(mocks.mockCreateInterface.mock.results[0].value.question).toHaveBeenCalledTimes(2)
  })

  it('conversa, guarda historial y termina con salir', async () => {
    await expect(runAiChat()).resolves.toBeUndefined()
    await rlQuestion()('hola')
    expect(log).toHaveBeenCalledWith('\nIA: respuesta\n')
    const rl = mocks.mockCreateInterface.mock.results[0].value
    expect(rl.question).toHaveBeenCalledTimes(2)
    expect(mocks.mockChat).toHaveBeenCalledWith('hola', expect.any(Array))
    await expect(rl.question.mock.calls[1][1]('salir')).rejects.toThrow('PROCESS_EXIT:0')
    expect(rl.close).toHaveBeenCalled()
  })

  it('error del chat se muestra y se vuelve a preguntar', async () => {
    mocks.mockChat.mockRejectedValue(new Error('ollama caído'))
    await expect(runAiChat()).resolves.toBeUndefined()
    await rlQuestion()('hola')
    expect(log).toHaveBeenCalledWith('\n❌ Error: ollama caído\n')
    const rl = mocks.mockCreateInterface.mock.results[0].value
    expect(rl.question).toHaveBeenCalledTimes(2)
  })
})

describe('runAiModels', () => {
  it('Ollama caído: sale con 1', async () => {
    mocks.mockCheckOllamaRunning.mockResolvedValue(false)

    await expect(runAiModels()).rejects.toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('❌ Ollama no está corriendo')
  })

  it('lista instalados y recomendados con su ícono según RAM', async () => {
    mocks.mockGetInstalledModels.mockResolvedValue([{ name: 'qwen2.5:7b', size: 1 }])

    await expect(runAiModels()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('RAM del sistema: 16GB\n')
    expect(log).toHaveBeenCalledWith('  ✅ qwen2.5:7b')
    expect(log).toHaveBeenCalledWith('  ✅ llama3:8b (4.7GB) - balance')
    // qwen2.5:7b pide 16GB de RAM mínima: con 16GB reales (ram >= minRAM + 2 → 16 >= 18) no alcanza.
    expect(log).toHaveBeenCalledWith('  ❌ qwen2.5:7b (4.7GB) - rápido')
  })
})
