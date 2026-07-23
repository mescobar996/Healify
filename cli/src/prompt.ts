import { readSync } from 'node:fs'
import type { Framework } from './detect'

const CHOICES: Record<string, Framework> = { playwright: 'playwright', cypress: 'cypress', selenium: 'selenium' }

/**
 * Prompt sync sin dependencias nuevas (fs.readSync sobre el fd 0) — evita agregar un
 * paquete solo para leer una línea de stdin. Si stdin no es una TTY (CI, tests, pipe
 * cerrado) no hay nadie para responder: devuelve el default en vez de colgarse esperando
 * un readSync que nunca termina.
 */
export function promptFrameworkChoice(defaultFramework: Framework = 'playwright'): Framework {
  if (!process.stdin.isTTY) return defaultFramework

  process.stdout.write(`No detectamos e2e. ¿Framework? [playwright/cypress/selenium] (default: ${defaultFramework}) `)

  const buf = Buffer.alloc(256)
  let answer = ''
  try {
    while (!answer.includes('\n')) {
      const bytesRead = readSync(0, buf, 0, buf.length, null)
      if (bytesRead === 0) break
      answer += buf.toString('utf-8', 0, bytesRead)
    }
  } catch {
    return defaultFramework
  }

  const trimmed = answer.trim().toLowerCase()
  return CHOICES[trimmed] ?? defaultFramework
}
