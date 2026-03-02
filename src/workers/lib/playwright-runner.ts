/**
 * Playwright browser install + test execution for the Railway worker.
 */

import { execSync } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import type { TestFailure, TestResult } from './types'
import { log, logError } from './logger'

const execAsync = promisify(exec)

// ── Browser setup ─────────────────────────────────────────────────────────

/**
 * Ensures Playwright's Chromium browser is installed in the job's work dir.
 */
export async function installPlaywrightBrowsers(jobId: string, workDir: string): Promise<void> {
  log(jobId, 'Ensuring Playwright browsers are installed...')
  try {
    execSync('npx playwright install chromium --with-deps', {
      cwd: workDir,
      stdio: 'pipe',
      timeout: 180_000,
    })
    log(jobId, 'Playwright browsers ready')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    // Non-fatal: tests may still run if browsers were pre-installed
    log(jobId, `Playwright browser install warning: ${err.message}`)
  }
}

// ── Selector extraction ───────────────────────────────────────────────────

const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright error message.
 */
export function extractSelectorFromError(errorMessage: string): string {
  for (const pattern of SELECTOR_PATTERNS) {
    const match = errorMessage.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}

// ── Test execution ────────────────────────────────────────────────────────

/**
 * Runs Playwright tests and returns structured results.
 * Never throws — failures are captured and returned in the result object.
 */
export async function runPlaywrightTests(
  jobId: string,
  workDir: string,
  packageManager: string,
  testCommand: string
): Promise<TestResult> {
  log(jobId, `Running Playwright tests: ${testCommand}`)

  const runCmd = `${packageManager} run ${testCommand} --reporter=json || true`

  const result: TestResult = {
    passed: 0,
    failed: 0,
    failures: [],
    duration: 0,
    rawOutput: '',
  }

  try {
    const { stdout, stderr } = await execAsync(runCmd, {
      cwd: workDir,
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    result.rawOutput = stdout + stderr

    // Try structured JSON report first
    try {
      const reportPath = path.join(workDir, 'test-results', 'report.json')
      const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'))

      for (const suite of reportData.suites ?? []) {
        for (const spec of suite.specs ?? []) {
          for (const test of spec.tests ?? []) {
            if (test.status === 'passed') {
              result.passed++
            } else if (test.status === 'failed') {
              result.failed++
              result.failures.push({
                testName: spec.title,
                testFile: suite.file ?? 'unknown',
                failedSelector: extractSelectorFromError(test.error?.message ?? ''),
                errorMessage: test.error?.message ?? 'Unknown error',
                stackTrace: test.error?.stack,
              })
            }
          }
        }
      }
    } catch {
      // Fall back to text parsing
      log(jobId, 'No JSON report found, parsing text output')

      const passedMatch = result.rawOutput.match(/(\d+) passed/)
      const failedMatch = result.rawOutput.match(/(\d+) failed/)

      if (passedMatch) result.passed = parseInt(passedMatch[1], 10)
      if (failedMatch) result.failed = parseInt(failedMatch[1], 10)

      // Use [\s\S] instead of dotAll flag for broader TS target compatibility
      const errorRegex = /Error:([\s\S]*?)(?=\n\n|\n  at|$)/g
      let match
      while ((match = errorRegex.exec(result.rawOutput)) !== null) {
        result.failures.push({
          testName: 'Unknown test',
          testFile: 'Unknown file',
          failedSelector: extractSelectorFromError(match[1]),
          errorMessage: match[1].trim(),
        })
      }
    }

    result.duration = Date.now()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Test execution error: ${err.message}`)

    const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    result.rawOutput = (execErr.stdout ?? '') + (execErr.stderr ?? '')
    result.failed = 1
    result.failures.push({
      testName: 'Test execution failed',
      testFile: 'System',
      failedSelector: '',
      errorMessage: err.message,
    })
  }

  log(jobId, `Tests completed: ${result.passed} passed, ${result.failed} failed`)
  return result
}

export type { TestFailure, TestResult }
