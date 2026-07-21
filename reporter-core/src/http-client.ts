import type { HealifyConfig } from './config'

export interface ReportPayload {
  testName: string
  testFile?: string
  selector: string
  error: string
  context?: string
  selectorType?: 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'UNKNOWN'
  branch?: string
  commitSha?: string
}

const TIMEOUT_MS = 60_000
const MAX_CONTEXT_CHARS = 8000

/** Attachment name used by fixtures to store captured DOM for the reporter to read. */
export const ATTACHMENT_NAME = 'healify-dom'

// Module-level flag: warn at most once per process (one process = one test run).
let hasWarned = false

const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

/**
 * Reports a test failure to Healify. Never throws — a failure here must
 * never break or slow down the caller's real test run. Any error is logged
 * once via console.warn and then swallowed.
 */
export async function reportFailure(config: HealifyConfig, payload: ReportPayload): Promise<void> {
  const body: ReportPayload = {
    ...payload,
    error: stripAnsi(payload.error),
    context: payload.context?.slice(0, MAX_CONTEXT_CHARS),
    branch: payload.branch ?? config.branch,
    commitSha: payload.commitSha ?? config.commitSha,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${config.apiUrl}/api/v1/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) warnOnce(`Healify report failed (HTTP ${res.status})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnOnce(`could not reach Healify (${message})`)
  } finally {
    clearTimeout(timeout)
  }
}

function warnOnce(message: string): void {
  if (hasWarned) return
  hasWarned = true
  console.warn(`[healify] ${message} — your tests are unaffected`)
}

/** Test-only: resets the module-level warn-once flag between test cases. Not part of the public API surface consumers should rely on. */
export function __resetWarnStateForTests(): void {
  hasWarned = false
}
