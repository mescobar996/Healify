/**
 * Parser de logs de tests fallidos, sin dependencias.
 *
 * La action no puede importar `@healify/reporter-core` (es TypeScript y acá vale la regla de
 * cero deps de runtime), así que los patrones de extracción de selectores viven duplicados
 * acá, portados de `reporter-core/src/selector-extractor.ts`. Mantenerlos en sync manualmente
 * es el costo aceptado — el archivo fuente dice en su docblock que sus patrones ya se mantienen
 * en sync con los phrasings reales de Playwright/Cypress, y acá el contrato es el mismo.
 */

const ANSI_RE = /\x1B\[[0-9;]*m/g

/** Misma lógica que QUOTED_CONTENT en selector-extractor.ts: la comilla de apertura queda en el
 * grupo 1 (backreference \1 en lookahead negativo) para que el contenido pueda tener comillas
 * del OTRO tipo sin cortar la captura — el caso real `locator('[data-testid="x"]')`. */
const QUOTED_CONTENT = '(["\'])((?:(?!\\1).)+)\\1'

const SELECTOR_PATTERNS = [
  { pattern: new RegExp(`Waiting for selector ${QUOTED_CONTENT}`), group: 2 },
  { pattern: /Element not found: (.+)/ },
  { pattern: /Unable to locate element: (.+)/ },
  { pattern: new RegExp(`selector ${QUOTED_CONTENT} not found`), group: 2 },
  { pattern: new RegExp(` locator\\(${QUOTED_CONTENT}\\)`), group: 2 },
  { pattern: /waiting for (getBy(?:Role|Text|Label|Placeholder|TestId)\([^\n]*\))/ },
  { pattern: /Expected to find element: `([^`]+)`/ },
  // Cypress .contains() cita texto, no un selector CSS — se envuelve como `text=...` para que
  // el motor lo trate como selector de texto (mismo criterio que reporter-core).
  { pattern: new RegExp(`Expected to find content: ${QUOTED_CONTENT}`), group: 2, transform: (raw) => `text=${raw}` },
]

export function extractSelectorFromError(errorMessage) {
  const clean = String(errorMessage).replace(ANSI_RE, '')
  for (const { pattern, transform, group } of SELECTOR_PATTERNS) {
    const match = clean.match(pattern)
    if (match) {
      const captured = match[group ?? 1]
      return transform ? transform(captured) : captured
    }
  }
  return 'Unknown selector'
}

/** Archivo de test citado en una línea — tanto en la cabecera numerada de Playwright
 * (`  1) e2e/login.spec.ts:15:3 › ...`) como en la línea `Running:` de Cypress
 * (`Running:  cypress/e2e/login.cy.ts ...`). */
const TEST_FILE_RE = /([\w./@-]+\.(?:spec|test|cy|e2e)\.[jt]sx?)/

/** Líneas que abren un bloque de error. Playwright escribe `Error: <msg>`; Cypress
 * `AssertionError: ...` o `CypressError: ...`. Solo los bloques que arrancan así se
 * interpretan como mensaje de error — el resto del log es ruido de runner. */
const ERROR_START_RE = /^\s*(Error:|AssertionError:|CypressError:|TimeoutError:|Uncaught|Timed out retrying|ReferenceError:|TypeError:)/

function detectFramework(logText) {
  if (/cypress|cy\.(get|contains|visit|should)|Expected to find element/i.test(logText)) return 'cypress'
  if (/selenium|Unable to locate element/i.test(logText)) return 'selenium'
  return 'playwright'
}

/**
 * Divide el log en bloques de error sin asumir un formato de runner único: cada línea que
 * abre un error (`Error:` / `AssertionError:` / `Timed out retrying` ...) arranca un bloque,
 * y se acumulan las líneas siguientes hasta la primera en blanco. El `testFile` se toma del
 * bloque cabecera/`Running:` más reciente. De ese modo sirve tanto para Playwright (cabeceras
 * `N) archivo.spec.ts:...`) como para Cypress (línea `Running:` con el spec).
 *
 * Los selectores que no se pueden extraer se descartan: sin selector no hay nada que curar, y
 * alimentar al motor con el literal "Unknown selector" produciría una sugerencia basura. Se
 * deduplica por `testFile::selector` — el mismo locator roto en dos tests no tiene sentido
 * curarlo dos veces en el mismo reporte.
 */
export function parseTestLog(logText) {
  const clean = String(logText ?? '').replace(ANSI_RE, '')
  const blocks = []
  let currentFile = undefined

  for (const rawLine of clean.split('\n')) {
    const line = rawLine.trimEnd()

    // Antes de mirar si abre error: el archivo se actualiza con cualquier línea que lo cite
    // (cabecera numerada o "Running:"). Un error a media línea no debe cambiar el archivo.
    const fileMatch = line.match(TEST_FILE_RE)
    if (fileMatch && !ERROR_START_RE.test(line)) {
      currentFile = fileMatch[1]
    }

    if (ERROR_START_RE.test(line)) {
      blocks.push({ testFile: currentFile, text: [line] })
      continue
    }
    if (blocks.length > 0 && line.trim() === '' && blocks[blocks.length - 1].text.length > 1) {
      blocks.push({ testFile: currentFile, text: [] })
      continue
    }
    if (blocks.length > 0 && blocks[blocks.length - 1].text.length > 0) {
      blocks[blocks.length - 1].text.push(line)
    }
  }

  const cases = []
  for (const block of blocks) {
    if (block.text.length === 0) continue
    const errorMessage = block.text.join('\n').trim()
    const selector = extractSelectorFromError(errorMessage)
    if (selector === 'Unknown selector') continue

    cases.push({
      testFile: block.testFile,
      testName: block.testFile ?? 'failed test',
      errorMessage,
      selector,
    })
  }

  const seen = new Set()
  const unique = cases.filter((c) => {
    const key = `${c.testFile ?? ''}::${c.selector}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { framework: detectFramework(clean), cases: unique }
}
