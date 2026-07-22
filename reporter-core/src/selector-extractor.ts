const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

interface SelectorPattern {
  pattern: RegExp
  /** Transforma el texto capturado antes de devolverlo — ej. envolver texto citado de Cypress como `text=...`. */
  transform?: (raw: string) => string
}

const SELECTOR_PATTERNS: SelectorPattern[] = [
  { pattern: /Waiting for selector ["']([^"']+)["']/ },
  // (.+) en vez de (\S+): un selector descendiente real puede tener espacios (".card .title").
  { pattern: /Element not found: (.+)/ },
  { pattern: /Unable to locate element: (.+)/ },
  { pattern: /selector ["']([^"']+)["'] not found/ },
  { pattern: / locator\(["']([^"']+)["']\)/ },
  // Locators modernos de Playwright (getByRole/getByText/getByLabel/getByPlaceholder/getByTestId).
  { pattern: /waiting for (getBy(?:Role|Text|Label|Placeholder|TestId)\([^\n]*\))/ },
  { pattern: /Expected to find element: `([^`]+)`/ },
  // Cypress .contains() falla con texto citado, no con un selector CSS — lo envolvemos como
  // selector de texto (`text=...`) para que analyzeSelector lo clasifique como TEXT sin cambios.
  { pattern: /Expected to find content: ['"]([^'"]+)['"]/, transform: (raw) => `text=${raw}` },
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright/Cypress error
 * message. The first 5 patterns are kept in sync with
 * src/workers/lib/playwright-runner.ts (Playwright's own error phrasing).
 * The last 3 additionally cover: modern Playwright locators (getBy*), and
 * two Cypress timeout phrasings — `cy.get()`/`cy.find()`
 * ("Expected to find element: `...`") and `.contains()`
 * ("Expected to find content: '...'", transformed into a `text=...` selector).
 */
export function extractSelectorFromError(errorMessage: string): string {
  const clean = stripAnsi(errorMessage)
  for (const { pattern, transform } of SELECTOR_PATTERNS) {
    const match = clean.match(pattern)
    if (match) return transform ? transform(match[1]) : match[1]
  }
  return 'Unknown selector'
}
