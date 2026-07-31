import { analyzeAndHeal, domContextFromProbeResult, resolveLocatorStrategy, readRepertoire } from '@healify/reporter-core'

/**
 * `healify heal` — el motor expuesto como comando que habla JSON, para que cualquier
 * lenguaje que pueda spawnear un subproceso lo use sin reescribir la heurística.
 *
 * La lógica vive acá, separada de `index.ts` (que solo lee stdin y escribe stdout) — mismo
 * patrón que `commands/doctor.ts`/`commands/init.ts`: testeable sin tocar streams reales.
 */

export interface HealCommandInput {
  selector: string
  testFile?: string
  errorMessage?: string
  /** El mismo array que devuelve BROWSER_PROBE_SCRIPT al correr en el browser — de cualquier
   * lenguaje, vía su propio driver.execute_script()/executeScript() equivalente. Sin validar
   * acá: viene de JSON externo, `domContextFromProbeResult` es quien de verdad lo verifica. */
  pageElements?: unknown
  /** Atributos de test-id adicionales del proyecto, para extender los 5 built-in. */
  customTestIds?: string[]
}

export interface HealCommandOutput {
  fixedSelector: string
  confidence: number
  verified: boolean
  fromRepertoire: boolean
  needsReview: boolean
  explanation: string
  selectorType: string
  /** Lo que un driver de cualquier lenguaje puede ejecutar de verdad — ya resuelto, no hace
   * falta que el cliente sepa nada sobre la sintaxis role(...) de Playwright. */
  locator: { strategy: 'css' | 'xpath' | 'unsupported'; value: string | null }
}

export type HealCommandResult = { ok: true; output: HealCommandOutput } | { ok: false; error: string }

function isValidInput(value: unknown): value is HealCommandInput {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.selector === 'string' && candidate.selector.length > 0
}

/**
 * `cwd` inyectable para tests (evita depender de `.healify/history.jsonl` real del proceso).
 * El repertorio se consulta acá, del lado del servidor — el cliente no necesita saber nada
 * sobre su formato ni su ubicación.
 */
export function runHeal(rawInput: unknown, cwd: string = process.cwd()): HealCommandResult {
  if (!isValidInput(rawInput)) {
    return { ok: false, error: "Input inválido: se espera un JSON con al menos { \"selector\": string }." }
  }

  try {
    // domContextFromProbeResult valida la forma real (no confiar a ciegas en JSON que vino de
    // otro lenguaje) además de formatear — mismo criterio que ya usan los plugins JS con lo
    // que devuelve executeScript().
    const htmlContext = domContextFromProbeResult(rawInput.pageElements)
    const repertoire = readRepertoire(cwd)

    const heal = analyzeAndHeal({
      selector: rawInput.selector,
      testFile: rawInput.testFile,
      errorMessage: rawInput.errorMessage,
      htmlContext,
      repertoire,
      customTestIds: rawInput.customTestIds,
    })

    return {
      ok: true,
      output: {
        fixedSelector: heal.fixedSelector,
        confidence: heal.confidence,
        verified: heal.verified,
        fromRepertoire: heal.fromRepertoire,
        needsReview: heal.needsReview,
        explanation: heal.explanation,
        selectorType: heal.selectorType,
        locator: resolveLocatorStrategy(heal.fixedSelector),
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
