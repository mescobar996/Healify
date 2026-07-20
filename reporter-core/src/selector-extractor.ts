const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright/Cypress error
 * message. Kept in sync with src/workers/lib/playwright-runner.ts so the
 * Railway worker and the reporter packages parse errors identically.
 */
export function extractSelectorFromError(errorMessage: string): string {
  for (const pattern of SELECTOR_PATTERNS) {
    const match = errorMessage.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}
