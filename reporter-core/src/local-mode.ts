import { analyzeAndHeal, type HealResponse } from './healing-engine'
import { extractSelectorFromError } from './selector-extractor'
import { buildDefectId, severityFor, type Severity } from './qa-report'
import type { HistoryEntry } from './repertoire'

/** Evidencia que el framework ya generó por su cuenta (screenshot, video, trace). Se
 * enlaza por ruta, nunca se copia ni se embebe: el reporte apunta al archivo real. */
export interface CaseAttachment {
  name: string
  path: string
  contentType?: string
}

export interface LocalCaseInput {
  testName: string
  testFile?: string
  errorMessage: string
  domContext?: string
  /** Repertorio ya leído por el adapter (`.healify/history.jsonl`) — se consulta solo cuando
   * esta corrida no pudo verificar nada por su cuenta. Ver `repertoire.ts`. */
  repertoire?: HistoryEntry[]
  /** Datos del reporte QA que solo el adapter conoce. Todos opcionales: el adapter que no
   * los tenga (Selenium/WebdriverIO no tienen concepto de suite) simplemente los omite y el
   * render los saltea — nunca se rellenan con un placeholder. */
  line?: number
  durationMs?: number
  steps?: string[]
  attachments?: CaseAttachment[]
}

export type LocalCaseStatus = 'healed' | 'review' | 'unresolved'

export interface LocalCaseResult {
  testName: string
  testFile?: string
  selector: string
  errorMessage: string
  status: LocalCaseStatus
  fixedSelector: string
  confidence: number
  explanation: string
  selectorType: string
  /** true si la sugerencia se confrontó contra el árbol real de la página capturado al fallar
   * el test. false o ausente = heurística sobre el texto del selector, sin comprobar. */
  verified?: boolean
  /** true si `verified` viene del repertorio (una corrida anterior), no de esta corrida. */
  fromRepertoire?: boolean
  /** Identificador estable del defecto: el mismo selector roto en el mismo archivo devuelve
   * siempre el mismo ID, corrida tras corrida. */
  defectId: string
  severity: Severity
  expected?: string
  actual?: string
  line?: number
  durationMs?: number
  steps?: string[]
  attachments?: CaseAttachment[]
  /** Respuesta completa del motor de healing — los adapters la pasan directo a
   * `buildAuditEntry()` sin reconstruir manualmente. */
  healResponse?: HealResponse
}

const HEALED_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.8

/** Primera línea del error, que es la que describe qué pasó realmente. El resto suele ser
 * call log y stack — útil en el detalle, ruido en el campo "resultado obtenido". */
function firstLine(errorMessage: string): string {
  return errorMessage.split('\n')[0].trim()
}

/** Campos del input que el adapter aporta tal cual, sin que el motor los toque. */
function passthrough(input: LocalCaseInput) {
  return {
    line: input.line,
    durationMs: input.durationMs,
    steps: input.steps,
    attachments: input.attachments,
  }
}

/** Corre la heurística de sanado en el mismo proceso, sin red. */
export function runLocalHealing(input: LocalCaseInput): LocalCaseResult {
  const selector = extractSelectorFromError(input.errorMessage)

  if (selector === 'Unknown selector') {
    return {
      testName: input.testName,
      testFile: input.testFile,
      selector,
      errorMessage: input.errorMessage,
      status: 'unresolved',
      fixedSelector: '',
      confidence: 0,
      explanation: 'No se pudo extraer un selector del mensaje de error.',
      selectorType: 'UNKNOWN',
      defectId: buildDefectId(input.testFile, selector),
      severity: severityFor('unresolved'),
      expected: `El test "${input.testName}" termina sin errores.`,
      actual: firstLine(input.errorMessage),
      ...passthrough(input),
    }
  }

  const heal = analyzeAndHeal({
    selector,
    htmlContext: input.domContext,
    testName: input.testName,
    errorMessage: input.errorMessage,
    testFile: input.testFile,
    repertoire: input.repertoire,
  })

  const status: LocalCaseStatus =
    heal.confidence >= HEALED_THRESHOLD ? 'healed' : heal.confidence >= REVIEW_THRESHOLD ? 'review' : 'unresolved'

  return {
    testName: input.testName,
    testFile: input.testFile,
    selector,
    errorMessage: input.errorMessage,
    status,
    fixedSelector: heal.fixedSelector,
    confidence: heal.confidence,
    explanation: heal.explanation,
    selectorType: heal.selectorType,
    verified: heal.verified,
    fromRepertoire: heal.fromRepertoire,
    defectId: buildDefectId(input.testFile, selector),
    severity: severityFor(status),
    expected: `El selector ${selector} encuentra un elemento en la página.`,
    actual: firstLine(input.errorMessage),
    ...passthrough(input),
    healResponse: heal,
  }
}
