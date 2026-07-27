import { readSync } from 'node:fs'
import type { Framework } from './detect'

const CHOICES: Record<string, Framework> = {
  playwright: 'playwright',
  cypress: 'cypress',
  selenium: 'selenium',
  webdriverio: 'webdriverio',
}

/**
 * Lee una línea de stdin de forma sincrónica, sin dependencias nuevas (fs.readSync sobre el
 * fd 0) — evita agregar un paquete de prompts solo para esto. Si stdin no es una TTY (CI,
 * tests, pipe cerrado) no hay nadie para responder: devuelve `''` en vez de colgarse
 * esperando un readSync que nunca termina.
 */
export function promptLine(question: string): string {
  if (!process.stdin.isTTY) return ''

  process.stdout.write(question)

  const buf = Buffer.alloc(256)
  let answer = ''
  try {
    while (!answer.includes('\n')) {
      const bytesRead = readSync(0, buf, 0, buf.length, null)
      if (bytesRead === 0) break
      answer += buf.toString('utf-8', 0, bytesRead)
    }
  } catch {
    return ''
  }

  return answer.trim()
}

export function promptFrameworkChoice(defaultFramework: Framework = 'playwright'): Framework {
  const answer = promptLine(
    `No detectamos e2e. ¿Framework? [playwright/cypress/selenium/webdriverio] (default: ${defaultFramework}) `
  ).toLowerCase()
  return CHOICES[answer] ?? defaultFramework
}
