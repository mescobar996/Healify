import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

export interface HealifyConfig {
  /** Atributos de test-id adicionales del proyecto. Solo se aceptan los que empiecen con "data-". */
  customTestIds?: string[]
  /** Sinónimos adicionales de acciones/campos, se mergean con los built-in EN/ES. */
  customSynonyms?: { actions?: Record<string, string>; fields?: Record<string, string> }
  /**
   * Apaga el sanado sin desinstalar nada: los fallos se siguen reportando, pero no se propone
   * ninguna corrección. Equivalente al `heal-enabled` de Healenium. Default: `true`.
   */
  healEnabled?: boolean
  /**
   * Confianza mínima para que un caso salga como `healed` — el estado que habilita a `fix` a
   * tocar tus archivos. Equivalente al `score-cap` de Healenium. Default: `0.90`.
   */
  minConfidence?: number
  /**
   * Confianza mínima para que un caso salga como `review` (abajo de eso, `unresolved`).
   * Nunca puede ser mayor que `minConfidence`. Default: `0.80`.
   */
  reviewConfidence?: number
  /**
   * Cuántas alternativas guarda el motor además de la principal. Equivalente al
   * `recovery-tries` de Healenium. Default: `3`.
   */
  maxAlternatives?: number
}

/** Umbrales ya resueltos: todo presente, todo saneado. Lo que consume el motor. */
export interface HealifyThresholds {
  healEnabled: boolean
  minConfidence: number
  reviewConfidence: number
  maxAlternatives: number
}

export const DEFAULT_THRESHOLDS: HealifyThresholds = {
  healEnabled: true,
  minConfidence: 0.9,
  reviewConfidence: 0.8,
  maxAlternatives: 3,
}

/**
 * Carga la config de Healify. Orden: `healify.config.js` → `healify.config.cjs` →
 * `healify.config.json` → key `healify` en `package.json`. Gana el primero que exista Y parsee.
 *
 * Si no hay config, devuelve un objeto vacío. Si hay un archivo inválido, devuelve un objeto
 * vacío sin tirar error — Healify funciona sin config, y un archivo mal escrito nunca debe
 * hacer fallar la corrida de tests de nadie.
 *
 * `cwd` inyectable para tests.
 */
export function loadConfig(cwd: string = process.cwd()): HealifyConfig {
  const fromJs = loadFromModule(cwd, 'healify.config.js') ?? loadFromModule(cwd, 'healify.config.cjs')
  if (fromJs) return withEnvOverrides(validateConfig(fromJs))

  const fromJson = loadFromHealifyConfigJson(cwd)
  if (fromJson) return withEnvOverrides(validateConfig(fromJson))

  const fromPkg = loadFromPackageJson(cwd)
  if (fromPkg) return withEnvOverrides(validateConfig(fromPkg))

  return withEnvOverrides({})
}

/**
 * `healify.config.js` / `.cjs` en CommonJS (`module.exports = {...}`).
 *
 * `createRequire` y no `import()` porque toda la cadena de carga es sincrónica: los adapters
 * corren dentro de callbacks del runner (`onTestEnd` de Playwright, `after:run` de Cypress) que
 * no esperan una promesa. Se construye desde una ruta del proyecto (no desde `import.meta`) para
 * que el mismo código sirva en el bundle ESM y en el CJS.
 *
 * Un `.js` que en realidad sea ESM tira `ERR_REQUIRE_ESM` en Node < 22: se captura y se sigue con
 * el siguiente candidato, igual que con un JSON corrupto.
 */
function loadFromModule(cwd: string, filename: string): HealifyConfig | null {
  const path = join(cwd, filename)
  if (!existsSync(path)) return null
  try {
    const require = createRequire(join(cwd, 'healify-config-loader.cjs'))
    delete require.cache[require.resolve(path)]
    const loaded = require(path)
    const config = loaded?.default ?? loaded
    return config && typeof config === 'object' ? (config as HealifyConfig) : null
  } catch {
    return null
  }
}

function loadFromHealifyConfigJson(cwd: string): HealifyConfig | null {
  const path = join(cwd, 'healify.config.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function loadFromPackageJson(cwd: string): HealifyConfig | null {
  const path = join(cwd, 'package.json')
  if (!existsSync(path)) return null
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf-8'))
    return pkg.healify ?? null
  } catch {
    return null
  }
}

/**
 * Valida y filtra la config leída. Los customTestIds que no empiecen con "data-" se
 * descartan silenciosamente. No tira errores — Healify funciona con config parcial.
 */
function validateConfig(raw: HealifyConfig): HealifyConfig {
  const result: HealifyConfig = {}

  if (Array.isArray(raw.customTestIds)) {
    const valid = raw.customTestIds.filter((id): id is string => typeof id === 'string' && id.startsWith('data-'))
    if (valid.length > 0) result.customTestIds = valid
  }

  if (raw.customSynonyms && typeof raw.customSynonyms === 'object') {
    result.customSynonyms = raw.customSynonyms
  }

  if (typeof raw.healEnabled === 'boolean') result.healEnabled = raw.healEnabled
  if (isProbability(raw.minConfidence)) result.minConfidence = raw.minConfidence
  if (isProbability(raw.reviewConfidence)) result.reviewConfidence = raw.reviewConfidence
  if (typeof raw.maxAlternatives === 'number' && Number.isFinite(raw.maxAlternatives) && raw.maxAlternatives >= 0) {
    result.maxAlternatives = Math.min(Math.floor(raw.maxAlternatives), 10)
  }

  return result
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

/**
 * Variables de entorno por sobre el archivo — el análogo del `-Dheal-enabled=false` de Healenium,
 * que es como se apaga el sanado en un job de CI puntual sin tocar el repo.
 *
 * Un valor que no parsea se ignora (se queda lo del archivo): una env var mal escrita no puede
 * cambiar en silencio el criterio con el que `fix` toca archivos.
 */
function withEnvOverrides(config: HealifyConfig, env: NodeJS.ProcessEnv = process.env): HealifyConfig {
  const result = { ...config }

  const healEnabled = parseBooleanEnv(env.HEALIFY_HEAL_ENABLED)
  if (healEnabled !== undefined) result.healEnabled = healEnabled

  const min = parseProbabilityEnv(env.HEALIFY_MIN_CONFIDENCE)
  if (min !== undefined) result.minConfidence = min

  const review = parseProbabilityEnv(env.HEALIFY_REVIEW_CONFIDENCE)
  if (review !== undefined) result.reviewConfidence = review

  const maxAlternatives = env.HEALIFY_MAX_ALTERNATIVES !== undefined ? Number(env.HEALIFY_MAX_ALTERNATIVES) : NaN
  if (Number.isFinite(maxAlternatives) && maxAlternatives >= 0) {
    result.maxAlternatives = Math.min(Math.floor(maxAlternatives), 10)
  }

  return result
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'false' || normalized === '0') return false
  if (normalized === 'true' || normalized === '1') return true
  return undefined
}

function parseProbabilityEnv(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return isProbability(parsed) ? parsed : undefined
}

/**
 * Umbrales listos para usar: defaults + lo que haya configurado el proyecto, saneado.
 *
 * `reviewConfidence` nunca puede quedar por encima de `minConfidence`: con esa combinación no
 * existiría el estado `review` y un caso apenas por debajo del corte de `healed` desaparecería
 * como `unresolved`, que es lo contrario de lo que quiso el que subió el umbral.
 */
export function resolveThresholds(config: HealifyConfig = {}): HealifyThresholds {
  const minConfidence = config.minConfidence ?? DEFAULT_THRESHOLDS.minConfidence
  const reviewConfidence = Math.min(config.reviewConfidence ?? DEFAULT_THRESHOLDS.reviewConfidence, minConfidence)

  return {
    healEnabled: config.healEnabled ?? DEFAULT_THRESHOLDS.healEnabled,
    minConfidence,
    reviewConfidence,
    maxAlternatives: config.maxAlternatives ?? DEFAULT_THRESHOLDS.maxAlternatives,
  }
}
