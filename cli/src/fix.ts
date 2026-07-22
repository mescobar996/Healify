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

function countOccurrences(haystack: string, needle: string): number {
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

function replaceOnce(haystack: string, needle: string, replacement: string): string {
  const idx = haystack.indexOf(needle)
  if (idx === -1) return haystack
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length)
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
      const occurrences = countOccurrences(content, c.selector)
      if (occurrences === 0) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
        continue
      }
      if (occurrences > 1) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'ambiguous' })
        continue
      }
      content = replaceOnce(content, c.selector, c.fixedSelector)
      changed = true
      outcomes.push({ testFile, selector: c.selector, fixedSelector: c.fixedSelector, status: 'applied' })
    }

    if (changed && !options.dryRun) {
      writeFileSync(testFile, content, 'utf-8')
    }
  }

  return outcomes
}
