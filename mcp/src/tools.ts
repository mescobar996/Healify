import { readFileSync, existsSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import {
  analyzeAndHeal,
  diagnoseFailure,
  readRepertoire,
  computeChronic,
  FAILURE_CAUSE_LABEL,
  type LocalCaseResult,
} from '@healify/reporter-core'
import { adaptSelectorText, isTestFramework, TEST_FRAMEWORKS } from './framework'
import { analyzeBatchSelectors, type BatchDeps } from './batch'
import { cacheKey, getCached, setCached, DEFAULT_TTL_MS, DEFAULT_CACHE_PATH } from './cache'
import type { ToolDefinition } from './protocol'

/**
 * Las herramientas que Healify le ofrece a un agente.
 *
 * El punto de este servidor no es que un agente maneje un browser — para eso ya está el MCP
 * oficial de Playwright. Es el complemento: que el agente pueda PREGUNTAR y recibir una
 * respuesta determinista, calculada sobre evidencia que ya está en la máquina.
 *
 * De ahí sale la regla que ordena todo lo de abajo, la misma que rige la extensión de VS Code:
 * **sin haber visto la página no se propone un nombre concreto**. Un agente que recibe
 * `role('button', { name: 'Submit' })` inventado lo aplica con total confianza, y el resultado
 * es un test que sigue roto y encima parece arreglado. Cuando no hay evidencia del DOM, la
 * respuesta correcta es "este selector es frágil, y esto es lo que NO sé".
 */

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Resuelve una ruta relativa contra el cwd del servidor, que es el proyecto del usuario. */
function resolvePath(path: string): string {
  return isAbsolute(path) ? path : join(process.cwd(), path)
}

export interface SelectorToolDeps {
  cachePath?: string
  ttlMs?: number
  now?: number
}

const NOTE_SIN_FRAMEWORK =
  'Análisis estático, sin ver la página. Alcanza para decir si el selector es frágil y por qué, ' +
  'pero NO para proponer un reemplazo concreto: cualquier nombre accesible saldría de un ' +
  'diccionario, no de la pantalla. Para obtener un reemplazo verificado hay que correr los ' +
  'tests y leer el healify-report.json con healify_report_summary.'

const NOTE_CON_FRAMEWORK = (framework: string) =>
  `Análisis estático, sin ver la página. La sugerencia adaptada a ${framework} es la mejor ` +
  'heurística del motor (verified: false): NO es un reemplazo confirmado contra la página. ' +
  'Para un reemplazo verificado hay que correr los tests y leer el healify-report.json con healify_report_summary.'

function isAnalyzeOutput(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.selector === 'string' && typeof candidate.selectorType === 'string'
}

export function analyzeSelector(args: Record<string, unknown>, deps: SelectorToolDeps = {}): string {
  const selector = args.selector
  if (typeof selector !== 'string' || !selector.trim()) {
    throw new Error('Falta el argumento "selector" (string).')
  }

  const framework = args.framework
  if (framework !== undefined && !isTestFramework(framework)) {
    throw new Error('framework inválido: se espera playwright | cypress | selenium | webdriverio.')
  }
  const pageUrl = typeof args.pageUrl === 'string' && args.pageUrl ? args.pageUrl : undefined

  // El análisis es determinista: cachear el output completo por (selector, pageUrl, framework)
  // es seguro. El cache vive en ~/.healify/mcp-cache.json y se invalida a los 5 minutos.
  const cachePath = deps.cachePath ?? DEFAULT_CACHE_PATH
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS
  const now = deps.now ?? Date.now()
  const key = cacheKey(selector, pageUrl, framework, 'analyze')
  const cached = getCached(cachePath, key, ttlMs, now)
  // Guarda de forma: solo se sirve un valor que tenga la forma de esta herramienta. Un valor
  // huérfano con la forma de otra herramienta se ignora y se computa fresco.
  if (isAnalyzeOutput(cached)) return json(cached)

  const heal = analyzeAndHeal({ selector })

  const output = {
    selector,
    selectorType: heal.selectorType,
    fragile: heal.robustnessImprovement > 0,
    detectedIssue: heal.technicalDetails.detectedIssue,
    stableAgainstDOMChanges: heal.technicalDetails.stableAgainstDOMChanges,
    accessibilityCompliant: heal.technicalDetails.accessibilityCompliant,
    verifiedReplacementAvailable: false,
    ...(framework
      ? {
          framework,
          suggestion: adaptSelectorText(heal.fixedSelector, framework),
          note: NOTE_CON_FRAMEWORK(framework),
        }
      : { note: NOTE_SIN_FRAMEWORK }),
  }

  setCached(cachePath, key, output, ttlMs, now)
  return json(output)
}

export async function batchAnalyzeSelectorsTool(args: Record<string, unknown>, deps: BatchDeps = {}): Promise<string> {
  const selectors = args.selectors
  if (!Array.isArray(selectors) || selectors.length === 0 || !selectors.every((s) => typeof s === 'string')) {
    throw new Error('Falta el argumento "selectors" (array de strings, no vacío).')
  }

  const framework = args.framework
  if (framework !== undefined && !isTestFramework(framework)) {
    throw new Error('framework inválido: se espera playwright | cypress | selenium | webdriverio.')
  }
  const pageUrl = typeof args.pageUrl === 'string' && args.pageUrl ? args.pageUrl : undefined

  const result = await analyzeBatchSelectors(selectors as string[], pageUrl, framework, deps)
  return json(result)
}

export function diagnoseFailureTool(args: Record<string, unknown>): string {
  const errorMessage = args.errorMessage
  if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
    throw new Error('Falta el argumento "errorMessage" (string).')
  }

  const diagnosis = diagnoseFailure(errorMessage)
  return json({
    cause: diagnosis.cause,
    causeLabel: FAILURE_CAUSE_LABEL[diagnosis.cause],
    selectorHealingApplies: diagnosis.healable,
    signal: diagnosis.signal,
    rationale: diagnosis.rationale,
  })
}

/** Forma mínima de un reporte, para no confiar en que el JSON en disco esté completo. */
interface ReportLike {
  cases?: LocalCaseResult[]
}

export function reportSummary(args: Record<string, unknown>): string {
  const rutaArg = typeof args.reportPath === 'string' && args.reportPath ? args.reportPath : 'healify-report.json'
  const ruta = resolvePath(rutaArg)

  if (!existsSync(ruta)) {
    throw new Error(
      `No existe ${rutaArg}. Corré tus tests con el reporter de Healify para generarlo (el reporte se escribe siempre, incluso con todo en verde).`
    )
  }

  let report: ReportLike
  try {
    report = JSON.parse(readFileSync(ruta, 'utf-8'))
  } catch (error) {
    throw new Error(`${rutaArg} no es JSON válido: ${error instanceof Error ? error.message : String(error)}`)
  }

  const cases = Array.isArray(report.cases) ? report.cases : []
  if (cases.length === 0) return json({ reportPath: rutaArg, total: 0, cases: [], note: 'El reporte no tiene casos.' })

  return json({
    reportPath: rutaArg,
    total: cases.length,
    // `verified` es la diferencia entre una corrección comprobada contra el árbol de
    // accesibilidad real y una deducida a ciegas. Un agente tiene que poder distinguirlas
    // antes de tocar un archivo, así que va primero y sin adornos.
    cases: cases.map((c) => ({
      testName: c.testName,
      testFile: c.testFile,
      selector: c.selector,
      status: c.status,
      cause: c.cause,
      flakeVerdict: c.flakeVerdict,
      verified: c.verified === true,
      confidence: c.confidence,
      suggestedSelector: c.fixedSelector || null,
      safeToApply: c.status === 'healed' && c.verified === true,
      explanation: c.explanation,
    })),
    note:
      'safeToApply combina dos condiciones: la corrección se confrontó contra la página real (verified) ' +
      'y superó el umbral de confianza (status healed). Un caso en review puede ser correcto, pero ' +
      'necesita ojo humano — típicamente porque el test es intermitente.',
  })
}

export function chronicSelectors(args: Record<string, unknown>): string {
  const minBreakages = typeof args.minBreakages === 'number' ? args.minBreakages : undefined
  // `readRepertoire` lee `.healify/history.jsonl` y parsea; el nombre viene del uso original
  // (el repertorio de curaciones), pero devuelve el historial entero, que es lo que hace falta.
  const entries = readRepertoire(process.cwd())

  if (entries.length === 0) {
    return json({
      total: 0,
      chronic: [],
      note: 'Todavía no hay historial. Se escribe al correr healify fix (o healify fix --dry-run --record-history en CI).',
    })
  }

  const chronic = computeChronic(entries, minBreakages ? { minBreakages } : undefined)
  return json({
    historyEntries: entries.length,
    total: chronic.length,
    chronic: chronic.map((c) => ({
      selector: c.selector,
      testFile: c.testFile,
      breakages: c.breakages,
      spanDays: c.spanDays,
      causes: c.causes,
      recommendation: c.recommendation,
    })),
  })
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'healify_analyze_selector',
    description:
      'Clasifica qué tan frágil es un selector de test (CSS, XPath, testid, role) con heurística determinista y local. ' +
      'Responde por qué se va a romper, no con qué reemplazarlo: sin ver la página, cualquier nombre accesible sería inventado.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'El selector a analizar, ej. "#add-to-cart-btn" o "//div[3]/button".' },
        pageUrl: { type: 'string', description: 'URL de la página, opcional. Forma parte de la clave del cache, no del análisis.' },
        framework: {
          type: 'string',
          enum: TEST_FRAMEWORKS,
          description: 'Sintaxis objetivo de la sugerencia: playwright | cypress | selenium | webdriverio. Sin este argumento no se devuelve sugerencia.',
        },
      },
      required: ['selector'],
    },
    handler: analyzeSelector,
  },
  {
    name: 'healify_diagnose_failure',
    description:
      'Dice por qué falló un test a partir de su mensaje de error: selector roto, aserción, timing, navegación o runtime. ' +
      'Sirve para no perder tiempo buscando un selector nuevo cuando el problema es otro.',
    inputSchema: {
      type: 'object',
      properties: {
        errorMessage: { type: 'string', description: 'El mensaje de error tal cual lo escribió el framework.' },
      },
      required: ['errorMessage'],
    },
    handler: diagnoseFailureTool,
  },
  {
    name: 'healify_report_summary',
    description:
      'Lee un healify-report.json y devuelve los selectores rotos con su corrección propuesta, marcando cuáles se ' +
      'verificaron contra la página real y cuáles son seguros de aplicar.',
    inputSchema: {
      type: 'object',
      properties: {
        reportPath: { type: 'string', description: 'Ruta al reporte. Por defecto healify-report.json en el directorio actual.' },
      },
    },
    handler: reportSummary,
  },
  {
    name: 'healify_chronic_selectors',
    description:
      'Los selectores que se vienen rompiendo una y otra vez según .healify/history.jsonl, con la recomendación de qué ' +
      'hacer con cada uno. Útil para decidir dónde vale la pena agregar un data-testid en vez de seguir parcheando.',
    inputSchema: {
      type: 'object',
      properties: {
        minBreakages: { type: 'number', description: 'Cuántas roturas hacen a un selector crónico. Por defecto 3.' },
      },
    },
    handler: chronicSelectors,
  },
  {
    name: 'healify_batch_analyze_selectors',
    description:
      'Analiza varios selectores de una vez: procesa hasta 5 en paralelo, cachea el resultado localmente por 5 minutos y corta cada análisis a los 30s. ' +
      'Devuelve por cada selector la sugerencia adaptada al framework elegido y su confianza; los que no se pudieron analizar van a "errors" con su código, sin tumbar el lote.',
    inputSchema: {
      type: 'object',
      properties: {
        selectors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Los selectores a analizar, ej. ["#add-to-cart-btn", "[data-testid=\'buy\']"].',
        },
        pageUrl: { type: 'string', description: 'URL de la página, opcional. Forma parte de la clave del cache.' },
        framework: {
          type: 'string',
          enum: TEST_FRAMEWORKS,
          description: 'Sintaxis objetivo de las sugerencias: playwright | cypress | selenium | webdriverio.',
        },
      },
      required: ['selectors'],
    },
    handler: batchAnalyzeSelectorsTool,
  },
]
