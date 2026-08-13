import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'

/**
 * Validación post-fix (`healify fix --validate`): después de aplicar un fix, se vuelve a
 * ejecutar la prueba más pequeña que fallaba (el archivo de test del caso aplicado) para
 * confirmar que el selector nuevo funciona de verdad. Si falla, el fix se revierte.
 *
 * Es el "auto-apply gana confianza" del feedback: no editar el código fuente sin evidencia
 * de que la sugerencia pasa el test que la originó.
 */

/** Tiempo máximo de espera para la corrida de validación (3 min). */
const VALIDATION_TIMEOUT_MS = 180_000

export interface ValidationOutcome {
  ran: boolean
  ok: boolean
  command: string | null
  /** Por qué no se pudo validar, cuando `ran` es false. */
  reason?: 'no-framework' | 'no-command'
  /** Últimos caracteres de la salida, para el mensaje al usuario. */
  output?: string
}

/**
 * Arma el comando de test por framework. `--test-command` gana siempre: el usuario conoce
 * su proyecto mejor que una tabla de frameworks. Sin override, los casos conocidos:
 * Playwright → `npx playwright test <archivos>`, Cypress → `npx cypress run --spec <csv>`,
 * y vitest (los ejemplos de Selenium/WebdriverIO lo usan) → `npx vitest run <archivos>`.
 * Framework desconocido → null (se omite la validación con un aviso, nunca se adivina).
 */
export function buildTestCommand(run: LocalRun, files: string[]): string | null {
  const framework = (run.framework ?? '').toLowerCase()
  if (framework.includes('playwright')) return `npx playwright test ${files.join(' ')}`
  if (framework.includes('cypress')) return `npx cypress run --spec ${files.join(',')}`
  if (framework.includes('selenium') || framework.includes('webdriver') || framework.includes('vitest')) {
    return `npx vitest run ${files.join(' ')}`
  }
  return null
}

/** Corre el comando de validación (spawn con shell, timeout). `ok` = exit code 0. */
export function runValidationCommand(command: string): { ok: boolean; output: string } {
  const result = spawnSync(command, {
    shell: true,
    timeout: VALIDATION_TIMEOUT_MS,
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return { ok: result.status === 0, output: output.slice(-4000) }
}

/**
 * Valida los archivos de test de los fixes aplicados. Devuelve el resultado crudo: la
 * decisión de revertir (o no) la toma el llamador, que tiene el snapshot a mano.
 */
export function runValidation(run: LocalRun, files: string[], override?: string): ValidationOutcome {
  const command = override && override.trim().length > 0 ? override.trim() : buildTestCommand(run, files)
  if (!command) {
    return { ran: false, ok: false, command: null, reason: override ? 'no-command' : 'no-framework' }
  }
  const { ok, output } = runValidationCommand(command)
  return { ran: true, ok, command, output }
}

/**
 * Snapshot de archivos antes de aplicar: `null` significa que el archivo no existía
 * (el restore lo borra si el fix lo creó). Restaurar es best-effort — si algo falla al
 * escribir, el mensaje de error ya avisó; no se miente sobre la validez.
 */
export type FileSnapshot = Map<string, string | null>

export function snapshotFiles(files: string[]): FileSnapshot {
  const snapshot: FileSnapshot = new Map()
  for (const file of files) {
    try {
      snapshot.set(file, readFileSync(file, 'utf-8'))
    } catch {
      snapshot.set(file, null)
    }
  }
  return snapshot
}

export function restoreSnapshot(snapshot: FileSnapshot): void {
  for (const [file, content] of snapshot) {
    try {
      if (content === null) {
        if (existsSync(file)) rmSync(file)
      } else {
        writeFileSync(file, content, 'utf-8')
      }
    } catch {
      // best-effort: el error de validación ya se reportó; no enmascararlo con otro.
    }
  }
}
