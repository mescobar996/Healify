/**
 * Cache local para las herramientas de análisis, sin red ni telemetría.
 *
 * El análisis es determinista (el motor de Healify no tiene random), así que cachear el
 * resultado completo por `selector + pageUrl + framework` es seguro y no puede devolver algo
 * distinto de lo que devolvería un análisis en frío. El único costo de un hit incorrecto sería
 * leer heurística vieja de un archivo que el usuario no pidió — por eso la clave incluye todo
 * lo que define la salida y el TTL invalida solo.
 *
 * Regla de hierro: el cache nunca puede romper una herramienta. Archivo corrupto, permisos,
 * disco lleno → se ignora y se computa fresco. Escribir es best-effort: un análisis que no se
 * puede persistir no es un análisis perdido.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

/** Cinco minutos: suficiente para amortizar un batch sin volverse veneno. */
export const DEFAULT_TTL_MS = 5 * 60 * 1000
export const DEFAULT_CACHE_PATH = join(homedir(), '.healify', 'mcp-cache.json')

export interface CacheEntry {
  /** El resultado completo de la herramienta, tal cual se le devolvería al agente. */
  value: unknown
  /** Epoch ms de cuando se guardó. */
  timestamp: number
}

/** `clave` → `{ value, timestamp }`. Solo se aceptan string como clave y objetos con timestamp numérico. */
export type CacheStore = Record<string, CacheEntry>

/**
 * Clave del cache: hash de los tres inputs que definen la salida, con un namespace por
 * herramienta. `pageUrl` y `framework` ausentes van como string vacío, así el mismo selector
 * sin contexto y con contexto NO comparten entrada. Y `kind` separa la entrada de
 * `healify_analyze_selector` de la de `healify_batch_analyze_selectors`: las dos guardan
 * valores de forma distinta, y una herramienta nunca debe leer el valor de la otra.
 */
export function cacheKey(selector: string, pageUrl?: string, framework?: string, kind: string = 'analyze'): string {
  return createHash('sha256')
    .update(`${kind}\u0000${selector}\u0000${pageUrl ?? ''}\u0000${framework ?? ''}`)
    .digest('hex')
}

/**
 * Lee el cache sin importar lo que haya en disco: ausente → vacío, JSON roto → vacío,
 * entradas con forma inesperada → se descartan. Nunca tira.
 */
export function readCache(path: string): CacheStore {
  try {
    if (!existsSync(path)) return {}
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const store: CacheStore = {}
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof entry === 'object' && entry !== null && typeof (entry as CacheEntry).timestamp === 'number') {
        store[key] = entry as CacheEntry
      }
    }
    return store
  } catch {
    return {}
  }
}

/** Escribe el cache, podando las entradas vencidas para que no crezca sin límite. Best-effort. */
export function writeCache(path: string, store: CacheStore, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): void {
  try {
    const vivas: CacheStore = {}
    for (const [key, entry] of Object.entries(store)) {
      if (now - entry.timestamp <= ttlMs) vivas[key] = entry
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(vivas), 'utf-8')
  } catch {
    // sin permisos o disco lleno: el análisis vale más que su persistencia.
  }
}

/** `null` en miss o en hit vencido — nunca el valor en sí. */
export function getCached(path: string, key: string, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): unknown | null {
  const entry = readCache(path)[key]
  if (!entry) return null
  if (now - entry.timestamp > ttlMs) return null
  return entry.value
}

/** Guarda (o reemplaza) una entrada y persiste el cache completo. Best-effort. */
export function setCached(path: string, key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): void {
  const store = readCache(path)
  store[key] = { value, timestamp: now }
  writeCache(path, store, ttlMs, now)
}
