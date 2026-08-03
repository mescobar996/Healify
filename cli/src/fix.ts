import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { isGitDirty } from './git-check'

/**
 * Valida que un path resuelto esté dentro del project root para prevenir path traversal.
 * Un `healify-report.json` manipulado podría contener paths como `../../.env` para escribir
 * fuera del proyecto. Esta función asegura que solo se lea/escriba dentro del cwd.
 * Si el path ya es absoluto, se valida que no contenga componentes `..` peligrosos.
 * Si es relativo, se resuelve contra projectRoot y se verifica que no escape.
 */
function validatePath(filePath: string, projectRoot: string): string {
  // Reject paths with null bytes (common traversal technique)
  if (filePath.includes('\0')) {
    throw new Error(`Path traversal detected: '${filePath}' contains null byte`)
  }

  const resolved = resolve(projectRoot, filePath)

  // If the original path was absolute, check it doesn't escape to sensitive directories
  if (resolve(filePath) === resolved) {
    const systemRoots = ['/etc', '/sys', '/proc', 'C:\\Windows', 'C:\\System32']
    for (const root of systemRoots) {
      if (resolved.startsWith(root)) {
        throw new Error(`Path traversal detected: '${filePath}' resolves to system directory`)
      }
    }
    return resolved
  }

  // For relative paths, verify they stay within projectRoot
  const rel = relative(projectRoot, resolved)
  if (rel.startsWith('..') || resolve('/') === resolved) {
    throw new Error(`Path traversal detected: '${filePath}' resolves outside project root`)
  }
  return resolved
}

export interface FixOptions {
  dryRun?: boolean
  force?: boolean
}

/**
 * Clasifica el error de leer el reporte para dar un mensaje humano en vez del ENOENT crudo
 * de Node. Un `fix` sin `healify-report.json` NO es un error del usuario: es el estado
 * normal cuando los tests pasaron (ningún selector roto). Por eso ENOENT devuelve exitCode
 * 0 (no romper pipelines) con un mensaje que explica qué hacer; cualquier otro error (JSON
 * corrupto, permisos) sí es un problema real → exitCode 1 con el detalle técnico.
 */
export function describeReadError(reportPath: string, error: unknown): { message: string; exitCode: number; stream: 'log' | 'error' } {
  if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
    return {
      message: `No encontré ${reportPath}.\n\nEso pasa si todavía no corriste tus tests, o si pasaron todos (no hubo selectores rotos que reportar).\nCorré tus tests; si alguno falla por un selector, se genera el reporte y fix va a tener algo que aplicar.`,
      exitCode: 0,
      stream: 'log',
    }
  }
  // EACCES/EPERM es el caso más común de "no es un error del motor" en Windows: el archivo
  // suele estar abierto en otro proceso (VS Code, un `tail`, otro `healify fix` corriendo) o
  // el usuario no tiene permisos de lectura ahí. Mensaje concreto en vez del error crudo de
  // Node, mismo criterio que el caso ENOENT de arriba.
  if (error instanceof Error && ['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) {
    return {
      message: `No se pudo leer ${reportPath}: permisos denegados.\n\nVerificá que el archivo no esté abierto en otro programa (VS Code, otro healify fix corriendo) y que tengas permisos de lectura sobre él.`,
      exitCode: 1,
      stream: 'error',
    }
  }
  return {
    message: `No se pudo leer ${reportPath}: ${error instanceof Error ? error.message : String(error)}`,
    exitCode: 1,
    stream: 'error',
  }
}

export type SkipReason = 'ambiguous' | 'dirty-git' | 'not-found' | 'not-substitutable' | 'declined'

export type FixOutcome =
  | { testFile: string; selector: string; fixedSelector: string; status: 'applied' }
  | { testFile: string; selector: string; status: 'skipped'; reason: SkipReason }

/**
 * Las estrategias ROLE del motor devuelven un string tipo `role('button', { name: 'X' })`
 * — es una representación legible para el reporte HTML, no un valor de selector válido
 * para pegar dentro de las comillas de `page.click('...')`. Aplicarlo tal cual corrompe
 * el archivo (encontrado con verificación real, no en teoría). No hay forma segura de
 * arreglarlo con sustitución de texto — hace falta reescribir la llamada completa
 * (page.click('...') → page.getByRole(...)), que es un cambio estructural, no textual.
 * Se salta y se avisa en vez de romper el archivo.
 */
function isSubstitutable(fixedSelector: string): boolean {
  return !/^role\(/.test(fixedSelector)
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while (true) {
    idx = haystack.indexOf(needle, idx)
    if (idx === -1) break
    count++
    idx += needle.length
  }
  return count
}

/**
 * Bug real encontrado en auditoría: si el selector roto quedó mencionado solo en un
 * comentario (ej. `// TODO: reemplazar '#btn-a1b2c3'`) y ya no existe en el código real,
 * `countOccurrences` sobre el texto crudo lo contaba igual — `fix` lo reemplazaba ahí y
 * reportaba `applied` con confianza total, sin cambiar nada funcional. Se enmascaran los
 * comentarios (mismo largo, reemplazados por espacios, para no correr los índices) antes
 * de contar/ubicar el reemplazo real — así una mención solo en un comentario cuenta como
 * "no encontrado", nunca se reemplaza ahí. Bloques `/* ... *\/` completos, y líneas que
 * (tras trim) arrancan con `//`. No intenta parsear `//` dentro de strings (ej. URLs) —
 * es imposible sin un parser completo; el costo de falsos positivos es bajo porque los
 * selectores que buscamos raramente aparecen en strings que además contienen `//`.
 */
export function maskComments(content: string): string {
  // Pass 1: mask block comments /* ... */ (may span multiple lines)
  const noBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  // Pass 2: mask line comments — both standalone (line starts with //) and inline
  // (code followed by //). The regex skips strings by only matching // that is NOT
  // preceded by a quote character, which is a conservative heuristic.
  return noBlockComments
    .split('\n')
    .map((line) => {
      // Standalone comment: line starts with //
      if (/^\s*\/\//.test(line)) return line.replace(/[^\n]/g, ' ')
      // Inline comment: // after code, not inside a string (heuristic: not preceded by ")
      const inlineMatch = line.match(/(?<=[^"'])\/\//)
      if (inlineMatch && inlineMatch.index !== undefined) {
        return line.slice(0, inlineMatch.index) + '  ' + line.slice(inlineMatch.index + 2).replace(/[^\n]/g, ' ')
      }
      return line
    })
    .join('\n')
}

/**
 * Aplica las sugerencias "healed" (≥90% confianza) de un reporte local directo sobre los
 * archivos de test. Conservador a propósito: nunca adivina — si un selector aparece 0 o
 * 2+ veces en el archivo, lo salta. Ordena los reemplazos de un mismo archivo de más largo
 * a más corto para que un selector corto no corrompa a uno más largo que lo contiene
 * (ej. "#btn" dentro de "#btn-guardar").
 */
export function fix(run: LocalRun, options: FixOptions = {}): FixOutcome[] {
  const casesByFile = new Map<string, LocalCaseResult[]>()
  for (const c of run.cases) {
    if (c.status !== 'healed' || !c.testFile) continue
    const list = casesByFile.get(c.testFile) ?? []
    list.push(c)
    casesByFile.set(c.testFile, list)
  }

  const outcomes: FixOutcome[] = []

  for (const [testFile, cases] of casesByFile) {
    let resolvedFile: string
    try {
      resolvedFile = validatePath(testFile, process.cwd())
    } catch {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
      continue
    }

    if (!options.dryRun && !options.force && isGitDirty(resolvedFile)) {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'dirty-git' })
      continue
    }

    let content: string
    try {
      content = readFileSync(resolvedFile, 'utf-8')
    } catch {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
      continue
    }

    const sorted = [...cases].sort((a, b) => b.selector.length - a.selector.length)
    let changed = false

    for (const c of sorted) {
      if (!isSubstitutable(c.fixedSelector)) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' })
        continue
      }
      // codeOnly tiene el mismo largo que content (comentarios enmascarados con espacios,
      // preservando offsets) — así una mención solo en un comentario nunca cuenta ni se
      // reemplaza, y el índice encontrado sigue siendo válido para el content real.
      const codeOnly = maskComments(content)
      const occurrences = countOccurrences(codeOnly, c.selector)
      if (occurrences === 0) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
        continue
      }
      if (occurrences > 1) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'ambiguous' })
        continue
      }
      const idx = codeOnly.indexOf(c.selector)
      content = content.slice(0, idx) + c.fixedSelector + content.slice(idx + c.selector.length)
      changed = true
      outcomes.push({ testFile, selector: c.selector, fixedSelector: c.fixedSelector, status: 'applied' })
    }

    if (changed && !options.dryRun) {
      writeFileSync(resolvedFile, content, 'utf-8')
    }
  }

  return outcomes
}
