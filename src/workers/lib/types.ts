/**
 * Shared types for the Railway worker pipeline.
 */

export interface TestFailure {
  testName: string
  testFile: string
  failedSelector: string
  errorMessage: string
  stackTrace?: string
  domSnapshot?: string
}

export interface TestResult {
  passed: number
  failed: number
  failures: TestFailure[]
  duration: number
  rawOutput: string
}

export interface ProcessJobResult {
  success: boolean
  passed: number
  failed: number
  healed: number
  error?: string
}
