import { extractSelectorFromError } from './selector-extractor'

/**
 * Clasificación de la causa de un fallo, previa a cualquier intento de sanado.
 *
 * Por qué existe: medir el alcance real de esta herramienta. En suites de producción los
 * selectores rotos explican alrededor de un cuarto de los fallos; el resto son timing, datos
 * de prueba inválidos, errores de runtime, cambios visuales y cambios de interacción. Un
 * sanador que trata todo fallo como si fuera un selector roto no es más útil, es más
 * peligroso: proponer un selector nuevo para un `expect()` que falló puede hacer que el test
 * pase tapando el defecto que acababa de encontrar. Eso es un falso verde, y es peor que un
 * rojo.
 *
 * Por eso el motor primero pregunta *por qué* falló y recién después decide si tiene algo que
 * proponer. Cuando la causa no es un selector, la respuesta correcta es decirlo y no tocar
 * nada.
 *
 * Regla de diseño que ordena todo lo de abajo: **solo se clasifica como no-selector cuando hay
 * una señal positiva**. Ante la duda gana el comportamiento de siempre. Un clasificador que se
 * equivoca hacia "no es un selector" deja de curar cosas que sí podía curar; uno que se
 * equivoca hacia "es un selector" produce falsos verdes. La asimetría es intencional.
 */
export type FailureCause = 'selector' | 'assertion' | 'timing' | 'navigation' | 'runtime' | 'unknown'

export interface FailureDiagnosis {
  cause: FailureCause
  /** true solo para `selector`: es el único caso donde proponer otro locator tiene sentido. */
  healable: boolean
  /** El fragmento del error que disparó la clasificación — para poder auditar el veredicto. */
  signal?: string
  /** Explicación en prosa, la que termina viendo el usuario cuando el motor se abstiene. */
  rationale: string
}

interface CauseRule {
  cause: Exclude<FailureCause, 'selector' | 'unknown'>
  pattern: RegExp
  rationale: string
}

/**
 * Cypress usa "Expected to find element/content" para un selector que nunca apareció. Es
 * fraseo de aserción, pero la causa es un selector — y `selector-extractor.ts` ya lo trata
 * como tal. Se excluye antes de evaluar la regla de aserción para no robarle esos casos.
 */
const CYPRESS_SELECTOR_PHRASING = /Expected to find (?:element|content)/

/**
 * Orden deliberado: las reglas de más arriba ganan sobre la extracción de selector.
 *
 * El caso que obliga a este orden es `expect(page.locator('#total')).toHaveText('99')`. El
 * mensaje contiene `locator('#total')`, así que el extractor devuelve `#total` y sin esta
 * capa el motor propondría un selector nuevo. Pero el elemento SÍ se encontró: lo que falló
 * fue el valor. Cambiarle el selector a ese test es exactamente el falso verde descrito arriba.
 */
const CAUSE_RULES: CauseRule[] = [
  {
    cause: 'runtime',
    pattern: /\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b|Cannot read propert(?:y|ies)|is not a function|is not defined/,
    rationale:
      'El test falló por un error de runtime en el código, no porque un selector dejara de encontrar su elemento. Healify no propone corrección: cambiar el selector no arreglaría esto y podría tapar el error real.',
  },
  {
    cause: 'navigation',
    pattern:
      /net::ERR_|NS_ERROR_|ECONNREFUSED|ENOTFOUND|ECONNRESET|ERR_CONNECTION|Target (?:page|closed)|Target page, context or browser has been closed|page\.goto:/,
    rationale:
      'El test falló antes de llegar a la página: problema de red, de entorno o de navegación. No hay selector que corregir; revisá que la aplicación bajo prueba esté levantada y accesible.',
  },
  {
    cause: 'assertion',
    pattern:
      /AssertionError|\bexpect\(.*\)\.(?:to|not)\b|Expected:.*\n?.*Received:|toHaveText|toHaveValue|toHaveCount|toEqual|toStrictEqual|deepStrictEqual|expected .+ to (?:equal|be|deep\.equal)/,
    rationale:
      'El test falló en una aserción: el elemento se encontró, lo que no coincidió fue el valor esperado. Healify no propone corrección porque cambiar el selector acá haría pasar el test tapando el defecto que acaba de encontrar.',
  },
  {
    cause: 'timing',
    pattern:
      /waitForLoadState|waitForNavigation|waitForTimeout|waitForFunction|waitForResponse|waitForRequest|Navigation timeout|networkidle/,
    rationale:
      'El test falló esperando una navegación, una carga o una respuesta, no un elemento. No hay selector que corregir: revisá las esperas explícitas o la condición que nunca se cumplió.',
  },
]

/** Recorte del fragmento que disparó la regla, para dejarlo legible en el reporte. */
function signalFrom(match: RegExpMatchArray): string {
  return match[0].replace(/\s+/g, ' ').trim().slice(0, 120)
}

/**
 * Determina por qué falló un test a partir del mensaje de error.
 *
 * No mira el DOM ni la página: es clasificación de texto sobre evidencia que el framework ya
 * escribió. Determinista, sin red y sin IA, igual que el resto del motor.
 */
export function diagnoseFailure(errorMessage: string): FailureDiagnosis {
  const isCypressSelectorPhrasing = CYPRESS_SELECTOR_PHRASING.test(errorMessage)

  for (const rule of CAUSE_RULES) {
    if (rule.cause === 'assertion' && isCypressSelectorPhrasing) continue
    const match = errorMessage.match(rule.pattern)
    if (match) {
      return { cause: rule.cause, healable: false, signal: signalFrom(match), rationale: rule.rationale }
    }
  }

  if (extractSelectorFromError(errorMessage) !== 'Unknown selector') {
    return {
      cause: 'selector',
      healable: true,
      rationale: 'El fallo corresponde a un selector que no encontró su elemento.',
    }
  }

  return {
    cause: 'unknown',
    healable: false,
    rationale: 'No se pudo determinar la causa del fallo a partir del mensaje de error.',
  }
}

/** Etiqueta corta para reportes y dashboards. */
export const FAILURE_CAUSE_LABEL: Record<FailureCause, string> = {
  selector: 'Selector roto',
  assertion: 'Aserción',
  timing: 'Timing / espera',
  navigation: 'Navegación / entorno',
  runtime: 'Error de runtime',
  unknown: 'Indeterminada',
}
