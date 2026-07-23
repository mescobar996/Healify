import { readFileSync, writeFileSync } from 'node:fs'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { isGitDirty } from './git-check'

export interface FixOptions {
  dryRun?: boolean
  force?: boolean
}

export type SkipReason = 'ambiguous' | 'dirty-git' | 'not-found' | 'not-substitutable'

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
 * (tras trim) arrancan con `//` — no intenta parsear si el `//` está dentro de un string
 * real (ej. una URL), a propósito: conservador, prefiere no enmascarar de más antes que
 * arriesgarse a ocultar una ocurrencia de código real.
 */
export function maskComments(content: string): string {
  const noBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  return noBlockComments
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? line.replace(/[^\n]/g, ' ') : line))
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
    if (!options.dryRun && !options.force && isGitDirty(testFile)) {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'dirty-git' })
      continue
    }

    let content: string
    try {
      content = readFileSync(testFile, 'utf-8')
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
      writeFileSync(testFile, content, 'utf-8')
    }
  }

  return outcomes
}
