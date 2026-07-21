import { analyzeAndHeal } from './healing-engine'
import { extractSelectorFromError } from './selector-extractor'

/** Sin HEALIFY_API_KEY: no hay cuenta ni servidor — el reporter corre en modo local. */
export function isLocalMode(): boolean {
  return !process.env.HEALIFY_API_KEY
}

export interface LocalCaseInput {
  testName: string
  testFile?: string
  errorMessage: string
  domContext?: string
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
}

const HEALED_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.8

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
    }
  }

  const heal = analyzeAndHeal({ selector, htmlContext: input.domContext, testName: input.testName, errorMessage: input.errorMessage })

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
  }
}
