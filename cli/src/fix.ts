import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { roleSuggestionToPlaywrightSelector } from '@healify/reporter-core'
import { isGitDirty } from './git-check'
import { collectCodeFiles } from './pom'

/**
 * Valida que un path resuelto esté dentro del project root para prevenir path traversal.
 * Un `healify-report.json` manipulado podría contener paths como `../../.env` para escribir
 * fuera del proyecto. Esta función asegura que solo se lea/escriba dentro del cwd.
 * Si el path ya es absoluto, se valida que no contenga componentes `..` peligrosos.
 * Si es relativo, se resuelve contra projectRoot y se verifica que no escape.
 */
export function validatePath(filePath: string, projectRoot: string): string {
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
  /**
   * Buscar el selector en los page objects del proyecto cuando no está en el archivo de test.
   * Default: true. `false` restaura el comportamiento previo (`--no-pom`).
   */
  pageObjects?: boolean
  /** Raíces donde buscar page objects. Default: `[process.cwd()]`. Inyectable para tests. */
  pageObjectRoots?: string[]
}

/** Lee `error.code` de forma segura — los errores de Node lo llevan en la instancia (ENOENT, EACCES…). */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  return 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

/**
 * Clasifica el error de leer el reporte para dar un mensaje humano en vez del ENOENT crudo
 * de Node. Un `fix` sin `healify-report.json` NO es un error del usuario: es el estado
 * normal cuando los tests pasaron (ningún selector roto). Por eso ENOENT devuelve exitCode
 * 0 (no romper pipelines) con un mensaje que explica qué hacer; cualquier otro error (JSON
 * corrupto, permisos) sí es un problema real → exitCode 1 con el detalle técnico.
 */
export function describeReadError(reportPath: string, error: unknown): { message: string; exitCode: number; stream: 'log' | 'error' } {
  if (error instanceof Error && errorCode(error) === 'ENOENT') {
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
  if (error instanceof Error && ['EACCES', 'EPERM'].includes(errorCode(error) ?? '')) {
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
  | {
      testFile: string
      selector: string
      fixedSelector: string
      status: 'applied'
      /**
       * Archivo donde se aplicó de verdad, cuando NO es `testFile` — el page object que tenía
       * el selector. `testFile` se deja intacto a propósito: la clave `testFile::selector` es
       * la que usa el armado del PR para cruzar outcomes con casos del reporte.
       */
      appliedIn?: string
    }
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

/** Cuenta apariciones de un substring (sin overlaps). */
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
  const pom = createPageObjectResolver(run, options)

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
      // codeOnly tiene el mismo largo que content (comentarios enmascarados con espacios,
      // preservando offsets) — así una mención solo en un comentario nunca cuenta ni se
      // reemplaza, y el índice encontrado sigue siendo válido para el content real.
      const codeOnly = maskComments(content)
      const occurrences = countOccurrences(codeOnly, c.selector)

      // El orden importa: primero se pregunta DÓNDE está el selector, después si la sugerencia
      // es sustituible. Al revés (como estaba), una sugerencia de rol se descartaba por
      // "not-substitutable" antes de mirar si el selector vivía en un page object — y como con
      // Playwright casi toda sugerencia con evidencia de página es de rol, el fallback a page
      // objects no se disparaba nunca en el runner más usado. Encontrado dogfoodeando el
      // ejemplo `examples/playwright-pom`.
      if (occurrences === 0) {
        // No está en el spec: en un proyecto con Page Object Model eso es lo NORMAL, el
        // selector vive en `pages/*.page.ts`.
        outcomes.push(pom.resolve(testFile, c))
        continue
      }

      if (!isSubstitutable(c.fixedSelector)) {
        // Está en el spec, así que el call site está acá y el AST puede reescribir la llamada
        // entera (`page.click('x')` → `page.getByRole(...)`), que es mejor que un string.
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' })
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

  pom.flush()

  return outcomes
}

/**
 * Fallback a page objects: cuando el selector no está en el archivo de test, se busca en el
 * resto del código del proyecto.
 *
 * Conservador con el mismo criterio que el loop principal — solo aplica cuando hay **un único**
 * archivo con **una única** ocurrencia. Con dos candidatos no se adivina: se reporta ambiguo.
 *
 * Las ediciones se acumulan en memoria y se escriben todas juntas al final, para que dos
 * selectores distintos que caen en el mismo page object no se pisen entre sí.
 */
function createPageObjectResolver(run: LocalRun, options: FixOptions) {
  const enabled = options.pageObjects !== false
  const roots = options.pageObjectRoots ?? [process.cwd()]
  // `role=button[name="X"]` es sintaxis del motor de selectores de Playwright: en Cypress
  // (jQuery) o Selenium (CSS/XPath nativo) sería un selector inválido, peor que no tocar nada.
  const isPlaywright = /playwright/i.test(run.framework ?? '')

  /** Archivos ya manejados por el loop principal: contarlos acá perdería ediciones. */
  const testFiles = new Set(
    run.cases
      .map((c) => c.testFile)
      .filter((f): f is string => !!f)
      .map((f) => {
        try {
          return validatePath(f, process.cwd())
        } catch {
          return f
        }
      })
  )

  let candidates: string[] | null = null
  const contents = new Map<string, string>()
  const touched = new Set<string>()

  function readCached(file: string): string | null {
    const cached = contents.get(file)
    if (cached !== undefined) return cached
    try {
      const raw = readFileSync(file, 'utf-8')
      contents.set(file, raw)
      return raw
    } catch {
      return null
    }
  }

  function resolve(testFile: string, c: LocalCaseResult): FixOutcome {
    const notFound: FixOutcome = { testFile, selector: c.selector, status: 'skipped', reason: 'not-found' }
    if (!enabled) return notFound

    // El valor que se va a escribir en el page object. Una sugerencia de rol no se puede pegar
    // tal cual (`role('button', {...})` es para leer, no un selector), y acá el AST tampoco
    // sirve: la llamada vive en el spec, en otro archivo. Playwright sí acepta la forma string
    // `role=button[name="X"]`, así que para Playwright se convierte y la curación se salva; en
    // los demás runners esa sintaxis no existe y el caso queda para revisión manual.
    let replacement = c.fixedSelector
    if (!isSubstitutable(replacement)) {
      const asString = isPlaywright ? roleSuggestionToPlaywrightSelector(replacement) : null
      if (!asString) return { testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' }
      replacement = asString
    }

    if (candidates === null) {
      candidates = collectCodeFiles(roots).filter((f) => !testFiles.has(f))
    }

    const hits = candidates.filter((file) => {
      const content = readCached(file)
      return content !== null && countOccurrences(maskComments(content), c.selector) === 1
    })

    if (hits.length === 0) return notFound
    // Dos page objects con el mismo selector: no hay forma de saber cuál rompió el test.
    if (hits.length > 1) return { testFile, selector: c.selector, status: 'skipped', reason: 'ambiguous' }

    const target = hits[0]
    if (!options.dryRun && !options.force && isGitDirty(target)) {
      return { testFile, selector: c.selector, status: 'skipped', reason: 'dirty-git' }
    }

    const content = contents.get(target)
    if (content === undefined) return { testFile, selector: c.selector, status: 'skipped', reason: 'not-found' }
    const idx = maskComments(content).indexOf(c.selector)
    contents.set(target, content.slice(0, idx) + replacement + content.slice(idx + c.selector.length))
    touched.add(target)

    return { testFile, selector: c.selector, fixedSelector: replacement, status: 'applied', appliedIn: target }
  }

  function flush(): void {
    if (options.dryRun) return
    for (const file of touched) {
      const content = contents.get(file)
      if (content === undefined) continue
      writeFileSync(file, content, 'utf-8')
    }
  }

  return { resolve, flush }
}
