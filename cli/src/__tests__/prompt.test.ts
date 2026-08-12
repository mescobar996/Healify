import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockReadSync } = vi.hoisted(() => ({ mockReadSync: vi.fn() }))

// `prompt.ts` importa `readSync` de node:fs; lo mockeamos a nivel de módulo para no tocar
// un fd real en los tests. El resto de node:fs queda intacto vía importOriginal.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readSync: mockReadSync }
})

import { promptLine, promptFrameworkChoice } from '../prompt'

describe('promptLine', () => {
  const originalIsTTY = process.stdin.isTTY
  const originalWrite = process.stdout.write

  beforeEach(() => {
    mockReadSync.mockReset()
  })

  afterEach(() => {
    process.stdin.isTTY = originalIsTTY
    process.stdout.write = originalWrite
  })

  it('devuelve cadena vacía si stdin no es una TTY (CI / pipe cerrado)', () => {
    process.stdin.isTTY = false
    expect(promptLine('¿Framework? ')).toBe('')
  })

  it('escribe la pregunta en stdout y lee la línea con readSync', () => {
    process.stdin.isTTY = true
    const write = vi.fn()
    process.stdout.write = write
    mockReadSync.mockImplementationOnce((_fd: unknown, buf: Buffer) => {
      const chunk = Buffer.from('cypress\n', 'utf-8')
      chunk.copy(buf)
      return chunk.length
    })

    expect(promptLine('¿Framework? ')).toBe('cypress')
    expect(write).toHaveBeenCalledWith('¿Framework? ')
  })

  it('acumula varios chunks hasta encontrar el salto de línea', () => {
    process.stdin.isTTY = true
    process.stdout.write = vi.fn()
    const chunks = ['play', 'wright\n']
    let i = 0
    mockReadSync.mockImplementation((_fd: unknown, buf: Buffer) => {
      const chunk = Buffer.from(chunks[i] ?? '', 'utf-8')
      i += 1
      chunk.copy(buf)
      return chunk.length
    })

    expect(promptLine('x')).toBe('playwright')
    expect(i).toBe(2)
  })

  it('rompe el loop si readSync devuelve 0 bytes (EOF) y recorta el resultado', () => {
    process.stdin.isTTY = true
    process.stdout.write = vi.fn()
    mockReadSync.mockReturnValueOnce(0)

    expect(promptLine('x')).toBe('')
  })

  it('devuelve cadena vacía si readSync lanza (stdin cerrado)', () => {
    process.stdin.isTTY = true
    process.stdout.write = vi.fn()
    mockReadSync.mockImplementation(() => {
      throw new Error('EBADF')
    })

    expect(promptLine('x')).toBe('')
  })
})

describe('promptFrameworkChoice', () => {
  beforeEach(() => {
    mockReadSync.mockReset()
  })

  it('devuelve el framework elegido, ignorando mayúsculas y espacios', () => {
    process.stdin.isTTY = true
    process.stdout.write = vi.fn()
    mockReadSync.mockImplementationOnce((_fd: unknown, buf: Buffer) => {
      Buffer.from('  Cypress\n', 'utf-8').copy(buf)
      return 10
    })

    expect(promptFrameworkChoice()).toBe('cypress')
  })

  it('devuelve el default si la respuesta no es un framework conocido', () => {
    process.stdin.isTTY = true
    process.stdout.write = vi.fn()
    mockReadSync.mockImplementationOnce((_fd: unknown, buf: Buffer) => {
      Buffer.from('ruby\n', 'utf-8').copy(buf)
      return 5
    })

    expect(promptFrameworkChoice()).toBe('playwright')
  })

  it('devuelve el default indicado si la respuesta está vacía', () => {
    process.stdin.isTTY = false
    expect(promptFrameworkChoice('selenium')).toBe('selenium')
  })
})
