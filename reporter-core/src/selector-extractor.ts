const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
  /Expected to find element: `([^`]+)`/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright/Cypress error
 * message. The first 5 patterns are kept in sync with
 * src/workers/lib/playwright-runner.ts (Playwright's own error phrasing).
 * The last pattern additionally covers Cypress's `cy.get()`/`cy.find()`
 * timeout phrasing ("Expected to find element: `...`"), which
 * playwright-runner.ts never needs since it only parses Playwright output.
 */
export function extractSelectorFromError(errorMessage: string): string {
  const clean = stripAnsi(errorMessage)
  for (const pattern of SELECTOR_PATTERNS) {
    const match = clean.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}
