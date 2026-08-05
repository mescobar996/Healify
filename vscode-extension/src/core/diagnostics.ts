import { analyzeAndHeal } from '@healify/reporter-core'
import { findSelectors, type FoundSelector } from './selectors'
import type { ReportCase } from './report'

/**
 * Convierte un archivo abierto en la lista de cosas que hay que marcar en el editor.
 *
 * Acá vive la regla que define toda la extensión, y por eso este módulo no importa 'vscode':
 * se puede testear entera sin levantar un editor.
 *
 * **Un selector no recibe un reemplazo concreto si no fue confrontado contra una página real.**
 *
 * El motor, cuando no tiene evidencia del DOM, igual propone algo: preguntarle por
 * `#btn-a1b2c3` devuelve `role('button', { name: 'Submit' })` con `verified: false`. Ese
 * "Submit" no salió de ninguna página — es un nombre plausible. Ofrecerlo como Quick Fix
 * sería exactamente la adivinanza que Healify dice no hacer, y encima dentro del editor,
 * donde un Ctrl+. distraído lo aplica sin leer.
 *
 * De ahí los dos niveles:
 *
 * - `warning` — el lint en vivo. Dice *por qué* el selector es frágil y no propone nada.
 * - `error` — vino del reporte de una corrida real, con `verified: true`. Ese sí trae fix.
 */

export type FindingLevel = 'warning' | 'error'

export interface Finding {
  level: FindingLevel
  message: string
  start: number
  end: number
  selector: string
  /** Solo presente en findings `error`. Es lo que habilita el Quick Fix. */
  fix?: string
}

export interface AnalyzeOptions {
  /** Casos del último healify-report.json. Vacío si no hay corrida previa. */
  reportCases?: ReportCase[]
  /** Marcar selectores frágiles mientras se escribe. */
  liveLint?: boolean
  /** IDs custom que el proyecto considera estables (healify.config.js). */
  customTestIds?: string[]
}

/**
 * `TESTID` es el único tipo que significa "el selector que me diste ya es estable":
 * `[data-testid="x"]` es justamente lo que Healify recomienda, sería absurdo subrayarlo.
 *
 * Ojo con el resto: `selectorType` describe el tipo del **fix propuesto**, no el del selector
 * de entrada. `#btn-a1b2c3` sale como `ROLE` porque el motor propone un role para
 * reemplazarlo, no porque el selector sea uno. Filtrar por `ROLE` acá descartaba exactamente
 * los selectores frágiles que hay que marcar.
 */
const ALREADY_STABLE = 'TESTID'

export function analyzeDocument(source: string, options: AnalyzeOptions = {}): Finding[] {
  const { reportCases = [], liveLint = true, customTestIds } = options
  const selectors = findSelectors(source)
  const findings: Finding[] = []

  // Índice por selector: un mismo selector roto puede aparecer más de una vez en el archivo,
  // y las dos ocurrencias merecen la marca.
  const brokenBySelector = new Map<string, ReportCase>()
  for (const c of reportCases) {
    if (c.status === 'healed' || c.status === 'review') {
      brokenBySelector.set(c.selector, c)
    }
  }

  for (const found of selectors) {
    const reported = brokenBySelector.get(found.value)

    if (reported) {
      findings.push(fromReport(found, reported))
      continue
    }

    if (liveLint) {
      const lint = fromLint(found, customTestIds)
      if (lint) findings.push(lint)
    }
  }

  return findings
}

/**
 * Finding de nivel `error`: este selector se rompió de verdad en la última corrida.
 *
 * El `fix` solo se adjunta con `verified: true`. Un caso `review` (confianza media, sin
 * verificar) se marca igual —es información útil— pero sin acción: que el usuario mire.
 */
function fromReport(found: FoundSelector, reported: ReportCase): Finding {
  const verified = reported.verified === true && Boolean(reported.fixedSelector)

  const message = verified
    ? `Se rompió en la última corrida. Healify lo encontró en la página como ${reported.fixedSelector}.`
    : `Se rompió en la última corrida. Healify no pudo confirmar un reemplazo contra la página real.`

  return {
    level: 'error',
    message,
    start: found.start,
    end: found.end,
    selector: found.value,
    fix: verified ? reported.fixedSelector : undefined,
  }
}

/**
 * Finding de nivel `warning`: el selector todavía no falló, pero tiene una forma frágil.
 *
 * Usa `analyzeAndHeal` **sin contexto de DOM**, así que se queda solo con el diagnóstico
 * (`detectedIssue`) y descarta el `fixedSelector` que el motor propone igual. Ese descarte es
 * deliberado, no un olvido.
 */
function fromLint(found: FoundSelector, customTestIds?: string[]): Finding | null {
  let heal
  try {
    heal = analyzeAndHeal({ selector: found.value, customTestIds })
  } catch {
    return null
  }

  if (heal.selectorType === ALREADY_STABLE) return null

  // El motor devuelve el mismo selector cuando no tiene nada mejor que ofrecer (por ejemplo
  // un `[aria-label="Cerrar"]`, que ya es accesible). Sin cambio propuesto no hay nada que
  // advertir.
  if (heal.fixedSelector === found.value) return null

  const issue = heal.technicalDetails?.detectedIssue
  if (!issue) return null

  return {
    level: 'warning',
    message: `${issue} Corré los tests para que Healify vea la página y pueda proponer un reemplazo real.`,
    start: found.start,
    end: found.end,
    selector: found.value,
  }
}
