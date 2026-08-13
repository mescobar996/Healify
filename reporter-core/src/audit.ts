import { createHash } from 'node:crypto'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HealResponse, SelectorType } from './healing-engine'

export interface AuditEntry {
  timestamp: string
  testName: string
  testFile?: string
  line?: number
  originalSelector: string
  fixedSelector: string
  selectorType: SelectorType
  confidence: number
  verified: boolean
  fromRepertoire: boolean
  errorMessage: string
  domSnippet?: string
  domHash?: string
  screenshotPath?: string
  alternatives: { selector: string; confidence: number }[]
  technicalDetails: {
    detectedIssue: string
    proposedSolution: string
    accessibilityCompliant: boolean
    stableAgainstDOMChanges: boolean
  }
}

export interface FailureContext {
  errorMessage: string
  domSnippet?: string
  screenshotPath?: string
  line?: number
}

export interface AuditReport {
  project: string
  framework: string
  generatedAt: string
  totalCases: number
  entries: AuditEntry[]
}

function hashDom(domSnippet: string | undefined): string | undefined {
  if (!domSnippet) return undefined
  return createHash('sha256').update(domSnippet).digest('hex')
}

/** Normaliza un evento de healing a una entrada de auditoría (misma forma en todos los adapters). */
export function buildAuditEntry(
  response: HealResponse,
  request: { selector: string; testName?: string; testFile?: string },
  context: FailureContext
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    testName: request.testName ?? 'unknown',
    testFile: request.testFile,
    line: context.line,
    originalSelector: request.selector,
    fixedSelector: response.fixedSelector,
    selectorType: response.selectorType,
    confidence: response.confidence,
    verified: response.verified,
    fromRepertoire: response.fromRepertoire,
    errorMessage: context.errorMessage,
    domSnippet: context.domSnippet,
    domHash: hashDom(context.domSnippet),
    screenshotPath: context.screenshotPath,
    alternatives: response.alternatives ?? [],
    technicalDetails: response.technicalDetails,
  }
}

/** Escribe healify-audit.json en disco — best-effort, nunca rompe la corrida si falla. */
export function writeAuditReport(
  entries: AuditEntry[],
  outputDir: string,
  project: string,
  framework: string
): string {
  const report: AuditReport = {
    project,
    framework,
    generatedAt: new Date().toISOString(),
    totalCases: entries.length,
    entries,
  }

  const fullPath = join(outputDir, 'healify-audit.json')
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8')
  return fullPath
}

/** Agrega una entrada al audit acumulado y persiste el archivo. */
export function appendAuditEntry(entry: AuditEntry, outputDir: string): void {
  const fullPath = join(outputDir, 'healify-audit.jsonl')
  mkdirSync(dirname(fullPath), { recursive: true })
  appendFileSync(fullPath, JSON.stringify(entry) + '\n', 'utf-8')
}
