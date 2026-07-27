import type { LocalCaseResult } from '@healify/reporter-core'
import type { FixOutcome } from './fix'

/**
 * Modo interactivo de `fix`: en vez de aplicar todo lo que supera el umbral automático, le
 * muestra cada sugerencia al desarrollador y deja que decida. Es la mitad del pedido original
 * que faltaba — hasta ahora `fix` solo sabía hacer la otra mitad ("si no sabés, aplico solo").
 *
 * Solo se ofrecen casos `healed` y `review` — `unresolved` no tiene ninguna sugerencia que
 * mostrar. El default al tocar Enter varía: `healed` (≥90%, ya pasaba el umbral automático)
 * default Sí; `review` (80-89%, hoy invisible para `fix`) default No, porque el motor mismo
 * no está seguro.
 */

function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

function origenLabel(c: LocalCaseResult): string {
  if (c.fromRepertoire) return 'repertorio: confirmado en una corrida anterior'
  if (c.verified) return 'verificado en la página'
  return 'heurística, sin comprobar'
}

/** El bloque que se muestra por caso antes de preguntar. */
export function formatCasePrompt(c: LocalCaseResult): string {
  const lines = [
    `${c.testFile ?? c.testName}`,
    `  ${c.selector}`,
    `  → ${c.fixedSelector}`,
    `  ${pct(c.confidence)} · ${origenLabel(c)}`,
  ]
  if (c.explanation) lines.push(`  ${c.explanation}`)
  return lines.join('\n')
}

export interface InteractiveFixResult {
  /** Claves `${testFile}::${selector}` de los casos que el usuario aprobó. */
  approved: Set<string>
  /** Outcomes ya armados para los casos que el usuario vio y rechazó explícitamente. */
  declined: FixOutcome[]
}

function key(c: LocalCaseResult): string {
  return `${c.testFile}::${c.selector}`
}

/**
 * Recorre los casos ofrecibles y pregunta uno por uno con `ask` (inyectable — mismo patrón
 * que `chooseFramework` en `init`, para no depender de stdin real en los tests).
 *
 * Comandos globales, además de sí/no: `a` aplica el resto sin seguir preguntando, `q` deja el
 * resto sin tocar (se listan como declinados, no como "no preguntados").
 */
export function runInteractiveFix(cases: LocalCaseResult[], ask: (question: string) => string): InteractiveFixResult {
  const offerable = cases.filter((c) => c.status === 'healed' || c.status === 'review')
  const approved = new Set<string>()
  const declined: FixOutcome[] = []

  let mode: 'ask' | 'apply-all' | 'skip-rest' = 'ask'

  for (let i = 0; i < offerable.length; i++) {
    const c = offerable[i]

    if (mode === 'apply-all') {
      approved.add(key(c))
      continue
    }
    if (mode === 'skip-rest') {
      declined.push({ testFile: c.testFile ?? '', selector: c.selector, status: 'skipped', reason: 'declined' })
      continue
    }

    const defaultYes = c.status === 'healed'
    const suffix = defaultYes ? '[S/n/a/q]' : '[s/N/a/q]'
    const question = `\n[${i + 1}/${offerable.length}] ${formatCasePrompt(c)}\n  Aplicar? ${suffix} `
    const answer = ask(question).trim().toLowerCase()

    if (answer === 'a') {
      mode = 'apply-all'
      approved.add(key(c))
      continue
    }
    if (answer === 'q') {
      mode = 'skip-rest'
      declined.push({ testFile: c.testFile ?? '', selector: c.selector, status: 'skipped', reason: 'declined' })
      continue
    }

    const yes = answer === '' ? defaultYes : answer === 's' || answer === 'si' || answer === 'sí' || answer === 'y'
    if (yes) {
      approved.add(key(c))
    } else {
      declined.push({ testFile: c.testFile ?? '', selector: c.selector, status: 'skipped', reason: 'declined' })
    }
  }

  return { approved, declined }
}
