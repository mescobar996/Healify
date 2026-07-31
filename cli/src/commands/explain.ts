import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeAndHeal, loadConfig, type HealResponse } from '@healify/reporter-core'

/**
 * `healify explain` — analiza POR QUÉ un selector es frágil y qué propone el motor.
 *
 * Tres modos de uso:
 * 1. `healify explain '[data-testid="btn-123"]'` → analiza ese string directo
 * 2. `healify explain` (sin args) → lee healify-report.json y explica el último fallo
 * 3. `healify explain --json` → output machine-readable para el puente Python/Java/C#
 */

export interface ExplainInput {
  selector?: string
  json?: boolean
  cwd?: string
}

export interface ExplainOutput {
  selector: string
  classification: string
  confidence: number
  issue: string
  fixProposed: string
  explanation: string
  verified: boolean
  alternatives?: { selector: string; confidence: number }[]
}

export type ExplainResult =
  | { ok: true; output: ExplainOutput; humanText: string }
  | { ok: false; error: string }

const SELECTOR_TYPE_LABELS: Record<string, string> = {
  TESTID: 'TESTID (estable)',
  ROLE: 'ROLE (accesibilidad)',
  TEXT: 'TEXT (texto visible)',
  CSS: 'CSS',
  XPATH: 'XPATH (frágil)',
  MIXED: 'MIXED',
}

function classifySelector(heal: HealResponse): string {
  return SELECTOR_TYPE_LABELS[heal.selectorType] ?? heal.selectorType
}

function buildHumanText(output: ExplainOutput): string {
  const lines = [
    `Selector: ${output.selector}`,
    `Clasificación: ${output.classification}`,
    `Confidence: ${output.confidence}`,
    `Issue: ${output.issue}`,
    `Fix propuesto: ${output.fixProposed}`,
  ]

  if (output.verified) {
    lines.push('Verificado: sí (confirmado contra la página real)')
  }

  if (output.alternatives && output.alternatives.length > 0) {
    lines.push('\nAlternativas:')
    for (const alt of output.alternatives) {
      lines.push(`  ${alt.selector} (${Math.round(alt.confidence * 100)}%)`)
    }
  }

  return lines.join('\n')
}

function findLastReportCase(cwd: string): { selector: string } | null {
  const candidates = ['.healify/healify-report.json', 'healify-report.json']
  for (const rel of candidates) {
    const fullPath = join(cwd, rel)
    if (!existsSync(fullPath)) continue
    try {
      const report = JSON.parse(readFileSync(fullPath, 'utf-8'))
      // Formato Healify: { cases: [...] }
      if (report.cases && Array.isArray(report.cases) && report.cases.length > 0) {
        const lastCase = report.cases[report.cases.length - 1]
        if (lastCase.selector) return { selector: lastCase.selector }
      }
    } catch {
      continue
    }
  }
  return null
}

export function runExplain(args: string[]): ExplainResult {
  const cwd = process.cwd()
  const jsonFlag = args.includes('--json')
  const selectorArg = args.find((a) => !a.startsWith('--'))

  let selector: string | undefined = selectorArg

  if (!selector) {
    const lastCase = findLastReportCase(cwd)
    if (!lastCase) {
      return {
        ok: false,
        error:
          'No hay selector para analizar. Pasá un selector como argumento o corré healify fix primero para generar un reporte.',
      }
    }
    selector = lastCase.selector
  }

  const config = loadConfig(cwd)
  const heal = analyzeAndHeal({ selector, customTestIds: config.customTestIds })

  const output: ExplainOutput = {
    selector,
    classification: classifySelector(heal),
    confidence: heal.confidence,
    issue: heal.technicalDetails.detectedIssue,
    fixProposed: heal.fixedSelector,
    explanation: heal.explanation,
    verified: heal.verified,
    alternatives: heal.alternatives,
  }

  const humanText = buildHumanText(output)

  if (jsonFlag) {
    return { ok: true, output, humanText: JSON.stringify(output, null, 2) }
  }

  return { ok: true, output, humanText }
}
