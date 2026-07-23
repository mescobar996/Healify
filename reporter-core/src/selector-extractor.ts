const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

interface SelectorPattern {
  pattern: RegExp
  /**
   * Qué grupo de captura tiene el selector real — default 1. Los patrones que delimitan
   * por comillas usan backreference (grupo 1 = qué tipo de comilla abrió) y necesitan
   * grupo 2 para el contenido real. Ver comentario en QUOTED_CONTENT más abajo.
   */
  group?: number
  /** Transforma el texto capturado antes de devolverlo — ej. envolver texto citado de Cypress como `text=...`. */
  transform?: (raw: string) => string
}

/**
 * Bug real encontrado escaneando un timeout de Playwright de verdad contra un selector
 * `[data-testid="..."]`: el patrón viejo `["']([^"']+)["']` EXCLUYE ambos tipos de comilla
 * del contenido capturado. Pero el selector más común y de mayor confianza del motor
 * (TESTID, confidence 0.95) es justo `[data-testid="x"]` — comillas dobles adentro,
 * envuelto en comillas simples por Playwright (`locator('[data-testid="x"]')`). El regex
 * viejo cortaba la captura en la primera comilla doble interna y nunca volvía a matchear
 * → 'Unknown selector' → 'unresolved' SIEMPRE para el caso más común del motor. Fix: la
 * comilla de apertura queda en el grupo 1 (vía backreference \1 en un lookahead negativo),
 * así el grupo 2 puede contener comillas del OTRO tipo sin cortar la captura.
 */
const QUOTED_CONTENT = '(["\'])((?:(?!\\1).)+)\\1'

const SELECTOR_PATTERNS: SelectorPattern[] = [
  { pattern: new RegExp(`Waiting for selector ${QUOTED_CONTENT}`), group: 2 },
  // (.+) en vez de (\S+): un selector descendiente real puede tener espacios (".card .title").
  { pattern: /Element not found: (.+)/ },
  { pattern: /Unable to locate element: (.+)/ },
  { pattern: new RegExp(`selector ${QUOTED_CONTENT} not found`), group: 2 },
  { pattern: new RegExp(` locator\\(${QUOTED_CONTENT}\\)`), group: 2 },
  // Locators modernos de Playwright (getByRole/getByText/getByLabel/getByPlaceholder/getByTestId).
  { pattern: /waiting for (getBy(?:Role|Text|Label|Placeholder|TestId)\([^\n]*\))/ },
  { pattern: /Expected to find element: `([^`]+)`/ },
  // Cypress .contains() falla con texto citado, no con un selector CSS — lo envolvemos como
  // selector de texto (`text=...`) para que analyzeSelector lo clasifique como TEXT sin cambios.
  { pattern: new RegExp(`Expected to find content: ${QUOTED_CONTENT}`), group: 2, transform: (raw) => `text=${raw}` },
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
  for (const { pattern, transform, group } of SELECTOR_PATTERNS) {
    const match = clean.match(pattern)
    if (match) {
      const captured = match[group ?? 1]
      return transform ? transform(captured) : captured
    }
  }
  return 'Unknown selector'
}
