/** Marca del reporter de Playwright en el config — cómo se detecta que Healify está conectado. */
export const PLAYWRIGHT_MARKER = '@healify/test-runner/reporter'
/** Marca del plugin de Cypress en el config — cómo se detecta que Healify está conectado. */
export const CYPRESS_MARKER = '@healify/cypress-plugin'

export type EditStatus = 'already-wired' | 'edited' | 'unsupported-shape'
export interface EditResult {
  status: EditStatus
  content?: string
}

/**
 * Inserta el reporter de Healify en un playwright.config.*. Solo toca la forma canónica
 * (`reporter: [...]` o ningún `reporter:` todavía) — si el reporter ya existe en otra
 * forma (ej. `reporter: 'list'`), no adivina: devuelve unsupported-shape para no corromper
 * el archivo del usuario con una key duplicada.
 */
export function wirePlaywrightConfig(content: string): EditResult {
  if (content.includes(PLAYWRIGHT_MARKER)) return { status: 'already-wired' }

  const reporterArrayMatch = content.match(/reporter:\s*\[/)
  if (reporterArrayMatch) {
    const idx = reporterArrayMatch.index! + reporterArrayMatch[0].length
    const edited = content.slice(0, idx) + `['${PLAYWRIGHT_MARKER}'], ` + content.slice(idx)
    return { status: 'edited', content: edited }
  }

  if (content.includes('reporter:')) return { status: 'unsupported-shape' }

  const defineConfigMatch = content.match(/defineConfig\(\{/)
  if (!defineConfigMatch) return { status: 'unsupported-shape' }

  const idx = defineConfigMatch.index! + defineConfigMatch[0].length
  const edited = content.slice(0, idx) + `\n  reporter: [['list'], ['${PLAYWRIGHT_MARKER}']],` + content.slice(idx)
  return { status: 'edited', content: edited }
}

/**
 * Registra HealifyCypressPlugin dentro de setupNodeEvents. Se inserta como la primera
 * sentencia del cuerpo (efecto secundario vía on(...), no cambia el return existente) —
 * así no pisa nada que el usuario ya tenga ahí, sea lo que sea.
 */
export function wireCypressConfig(content: string): EditResult {
  if (content.includes(CYPRESS_MARKER)) return { status: 'already-wired' }

  const setupMatch = content.match(/setupNodeEvents\s*(?:\([^)]*\)\s*\{|:\s*\([^)]*\)\s*=>\s*\{)/)
  if (!setupMatch) return { status: 'unsupported-shape' }

  const importLine = `import { HealifyCypressPlugin } from '${CYPRESS_MARKER}'\n`
  const insertIdx = setupMatch.index! + setupMatch[0].length
  const call = `\n      HealifyCypressPlugin(on, config)`
  const edited = importLine + content.slice(0, insertIdx) + call + content.slice(insertIdx)
  return { status: 'edited', content: edited }
}
