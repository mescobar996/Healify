/**
 * Análisis en lote con límite de concurrencia y timeout por análisis.
 *
 * `analyzeAndHeal` es síncrono y rápido, así que el motivo de estos helpers no es acelerar el
 * motor sino ponerle cinturón: si en el futuro el análisis se hace costoso (un subproceso, un
 * driver), el batch ya tiene las dos protecciones que un agente necesita — no abrir más de N
 * frentes a la vez y no colgarse nunca más de lo que un humano esperaría.
 */

import { analyzeAndHeal } from '@healify/reporter-core'
import { adaptSelectorText, type TestFramework } from './framework'
import { cacheKey, getCached, setCached, DEFAULT_TTL_MS, DEFAULT_CACHE_PATH } from './cache'

export const MAX_CONCURRENCY = 5
/** Treinta segundos por análisis: más que cualquier corrida local, menos que un cliente colgado. */
export const ANALYSIS_TIMEOUT_MS = 30_000

export interface BatchItemResult {
  original: string
  suggestions: string[]
  confidence: number
}

export interface BatchItemError {
  original: string
  code: string
  message: string
}

export interface BatchDeps {
  cachePath?: string
  ttlMs?: number
  now?: number
  timeoutMs?: number
}

/** Guarda de forma: una entrada de `healify_analyze_selector` jamás debe pasar por resultado de batch. */
function isBatchItemResult(value: unknown): value is BatchItemResult {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as BatchItemResult
  return (
    typeof candidate.original === 'string' &&
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.every((s) => typeof s === 'string') &&
    typeof candidate.confidence === 'number'
  )
}

export function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  return Promise.all(workers).then(() => results)
}

/** Resuelve el valor o rechaza con un error etiquetado (`code`) al vencer el plazo. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(message), { code })), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

export interface BatchResult {
  results: BatchItemResult[]
  errors: BatchItemError[]
}

/** Adapta la sugerencia principal y hasta dos alternativas al dialecto pedido (o las deja crudas). */
function buildSuggestions(selector: string, alternatives: { selector: string }[] | undefined, framework?: TestFramework): string[] {
  const primary = framework ? adaptSelectorText(selector, framework) : selector
  const rest = (alternatives ?? []).slice(0, 2).map((a) => (framework ? adaptSelectorText(a.selector, framework) : a.selector))
  return [primary, ...rest]
}

function analyzeOne(original: string, pageUrl: string | undefined, framework: TestFramework | undefined, deps: BatchDeps): Promise<BatchItemResult | BatchItemError> {
  const cachePath = deps.cachePath ?? DEFAULT_CACHE_PATH
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS
  const now = deps.now ?? Date.now()
  const timeoutMs = deps.timeoutMs ?? ANALYSIS_TIMEOUT_MS

  if (!original.trim()) {
    return Promise.resolve({ original, code: 'INVALID_INPUT', message: 'Selector vacío.' })
  }

  const key = cacheKey(original, pageUrl, framework, 'batch')
  const cached = getCached(cachePath, key, ttlMs, now)
  if (isBatchItemResult(cached)) return Promise.resolve(cached)

  const work = Promise.resolve().then((): BatchItemResult => {
    const heal = analyzeAndHeal({ selector: original })
    const result: BatchItemResult = {
      original,
      suggestions: buildSuggestions(heal.fixedSelector, heal.alternatives, framework),
      confidence: heal.confidence,
    }
    setCached(cachePath, key, result, ttlMs, now)
    return result
  })

  return withTimeout(work, timeoutMs, 'timeout', `El análisis de "${original}" excedió ${Math.round(timeoutMs / 1000)}s.`).catch(
    (error: Error & { code?: string }) => ({ original, code: error.code ?? 'ANALYSIS_ERROR', message: error.message })
  )
}

/**
 * Analiza una lista de selectores y devuelve, por cada uno, la sugerencia adaptada al
 * framework. Los que fallan (vacío, timeout, error interno) no tumban el lote: van a `errors`
 * con su código, y el resto se devuelve igual.
 */
export async function analyzeBatchSelectors(selectors: string[], pageUrl: string | undefined, framework: TestFramework | undefined, deps: BatchDeps): Promise<BatchResult> {
  const outcomes = await mapWithConcurrency(selectors, MAX_CONCURRENCY, (original) => analyzeOne(original, pageUrl, framework, deps))
  const results: BatchItemResult[] = []
  const errors: BatchItemError[] = []
  for (const outcome of outcomes) {
    if ('suggestions' in outcome) results.push(outcome as BatchItemResult)
    else errors.push(outcome as BatchItemError)
  }
  return { results, errors }
}
