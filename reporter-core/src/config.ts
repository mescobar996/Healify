import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { Severity } from './qa-report'

export type AgileProvider = 'jira' | 'github' | 'webhook'

/** Bloque `agile` de la config — reporte de defectos a herramientas ágiles. Siempre opt-in. */
export interface HealifyAgileConfig {
  /**
   * Activa el reporte. Default: `false` — sin esto Healify nunca toca la red. La única salida
   * de datos cuando está activo es el POST del usuario contra SU instancia (Jira/webhook) con
   * SUS credenciales; nada pasa por una nube de Healify.
   */
  enabled?: boolean
  /**
   * `jira` (REST Cloud), `github` (Issues del repo) o `webhook` (genérico: Zapier/n8n o una
   * automatización de Jira hacen el create-or-update). Default: `jira`.
   */
  provider?: AgileProvider
  /**
   * Base de la API. Jira: la instancia, ej. `https://acme.atlassian.net`. GitHub: solo hace
   * falta con GitHub Enterprise; contra github.com se resuelve a `https://api.github.com`.
   */
  baseUrl?: string
  /** Email del usuario de Jira (credencial del usuario contra su instancia). */
  email?: string
  /**
   * Credencial del USUARIO. Jira: token de API (`JIRA_API_TOKEN`). GitHub: un token con scope
   * `repo` — en un workflow alcanza el `GITHUB_TOKEN` si el job declara `issues: write`.
   */
  apiToken?: string
  /** `owner/repo` para el provider `github`. En CI se toma de `GITHUB_REPOSITORY`. */
  repository?: string
  /** Key del proyecto de Jira, ej. `QA`. */
  project?: string
  /** Tipo de issue. Default: `Bug`. */
  issueType?: string
  /** Mapeo severidad de Healify → prioridad de Jira. Default: blocker→Highest, major→High, minor→Medium. */
  priorityBySeverity?: Partial<Record<Severity, string>>
  /** Labels extra para el ticket (ej. `healify`). */
  labels?: string[]
  /** URL del webhook (provider `webhook`). */
  webhookUrl?: string
  /**
   * Sube la evidencia del fallo (screenshot, trace) como adjunto del ticket, en vez de dejarla
   * como un link a una ruta local que solo existe en la máquina que corrió los tests.
   *
   * Default: `false`. Es opt-in aparte de `enabled` porque un screenshot puede contener datos
   * de un entorno de prueba con información real, y esa decisión no la toma Healify.
   * Solo aplica al provider `jira`: la API de GitHub no permite adjuntar archivos a un issue.
   */
  attachEvidence?: boolean
  /**
   * Nombre de la transición (o del estado destino) a la que mover el ticket cuando Healify
   * resolvió el selector y lo verificó contra la página. Ej. `'Done'`, `'Listo para revisar'`.
   *
   * Sin esto los tickets quedan abiertos para siempre, aunque el problema ya esté resuelto.
   * Vacío = no transicionar. Solo aplica al provider `jira`.
   */
  transitionOnHealed?: string
}

/** Config agile ya resuelta: todo presente, todo saneado. */
export interface ResolvedAgileConfig {
  enabled: boolean
  provider: AgileProvider
  baseUrl?: string
  email?: string
  apiToken?: string
  repository?: string
  project?: string
  issueType: string
  priorityBySeverity: Record<Severity, string>
  labels: string[]
  webhookUrl?: string
  attachEvidence: boolean
  transitionOnHealed?: string
}

export const DEFAULT_AGILE_PRIORITIES: Record<Severity, string> = {
  blocker: 'Highest',
  major: 'High',
  minor: 'Medium',
}

export function defaultAgile(): ResolvedAgileConfig {
  return {
    enabled: false,
    provider: 'jira',
    issueType: 'Bug',
    priorityBySeverity: { ...DEFAULT_AGILE_PRIORITIES },
    labels: [],
    attachEvidence: false,
  }
}

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
  /** Reporte de defectos a herramientas ágiles. Opt-in, off por default. */
  agile?: HealifyAgileConfig
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

  if (raw.agile && typeof raw.agile === 'object') {
    const agile = validateAgile(raw.agile)
    if (Object.keys(agile).length > 0) result.agile = agile
  }

  return result
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Sanea el bloque `agile` igual que el resto de la config: lo que no tiene la forma esperada
 * se descarta en vez de romper. Un `agile` vacío termina descartado (no se vuelve al config),
 * que es la misma política de "config parcial funciona".
 */
function validateAgile(raw: HealifyAgileConfig): HealifyAgileConfig {
  const result: HealifyAgileConfig = {}
  if (typeof raw.enabled === 'boolean') result.enabled = raw.enabled
  if (raw.provider === 'jira' || raw.provider === 'webhook') result.provider = raw.provider
  if (isNonEmptyString(raw.baseUrl)) result.baseUrl = raw.baseUrl
  if (isNonEmptyString(raw.email)) result.email = raw.email
  if (isNonEmptyString(raw.apiToken)) result.apiToken = raw.apiToken
  if (isNonEmptyString(raw.project)) result.project = raw.project
  if (isNonEmptyString(raw.issueType)) result.issueType = raw.issueType
  if (raw.priorityBySeverity && typeof raw.priorityBySeverity === 'object') {
    const priorities: Partial<Record<Severity, string>> = {}
    for (const severity of ['blocker', 'major', 'minor'] as const) {
      if (isNonEmptyString(raw.priorityBySeverity[severity])) priorities[severity] = raw.priorityBySeverity[severity] as string
    }
    if (Object.keys(priorities).length > 0) result.priorityBySeverity = priorities
  }
  if (Array.isArray(raw.labels)) {
    const labels = raw.labels.filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
    if (labels.length > 0) result.labels = labels
  }
  if (isNonEmptyString(raw.webhookUrl)) result.webhookUrl = raw.webhookUrl
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

  // Bloque agile: las credenciales Jira viven acá (JIRA_EMAIL/JIRA_API_TOKEN) para que jamás
  // se commiteen en un archivo de config. El token no se loguea en ningún punto.
  const agile: HealifyAgileConfig = { ...(config.agile ?? {}) }
  let agileChanged = false

  const agileEnabled = parseBooleanEnv(env.HEALIFY_AGILE_ENABLED)
  if (agileEnabled !== undefined) {
    agile.enabled = agileEnabled
    agileChanged = true
  }
  if (env.HEALIFY_AGILE_PROVIDER === 'jira' || env.HEALIFY_AGILE_PROVIDER === 'github' || env.HEALIFY_AGILE_PROVIDER === 'webhook') {
    agile.provider = env.HEALIFY_AGILE_PROVIDER
    agileChanged = true
  }
  // El token de GitHub se lee de HEALIFY_GITHUB_TOKEN y no de GITHUB_TOKEN a secas: esa
  // variable la exporta el runner en TODO workflow, y tomarla sola convertiría un `healify
  // report` sin configurar en un intento silencioso de escribir issues en el repo. Activarlo
  // tiene que ser una decisión escrita.
  //
  // `repository` sí sale de GITHUB_REPOSITORY, que el runner ya define como `owner/repo` y no
  // es una credencial: ahorra repetir en la config algo que el entorno ya sabe.
  const githubToken = env.HEALIFY_GITHUB_TOKEN ?? ''
  const agileStringFields: [keyof HealifyAgileConfig, string][] = [
    ['baseUrl', env.JIRA_BASE_URL ?? ''],
    ['email', env.JIRA_EMAIL ?? ''],
    ['apiToken', isNonEmptyString(githubToken) && agile.provider === 'github' ? githubToken : (env.JIRA_API_TOKEN ?? '')],
    ['repository', env.HEALIFY_GITHUB_REPOSITORY ?? env.GITHUB_REPOSITORY ?? ''],
    ['project', env.JIRA_PROJECT ?? ''],
    ['issueType', env.JIRA_ISSUE_TYPE ?? ''],
    ['webhookUrl', env.HEALIFY_WEBHOOK_URL ?? ''],
  ]
  for (const [field, value] of agileStringFields) {
    if (isNonEmptyString(value)) {
      ;(agile as Record<string, unknown>)[field] = value
      agileChanged = true
    }
  }

  if (agileChanged) result.agile = agile

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

/**
 * Config `agile` lista para consumir: defaults + lo que haya configurado el proyecto, saneado.
 * `priorityBySeverity` parcial mergea con los defaults (una severidad sin mapear nunca queda
 * sin prioridad).
 */
export function resolveAgile(config: HealifyConfig = {}): ResolvedAgileConfig {
  const raw = config.agile ?? {}
  const defaults = defaultAgile()
  return {
    enabled: raw.enabled ?? defaults.enabled,
    provider: raw.provider ?? defaults.provider,
    baseUrl: raw.baseUrl ?? defaults.baseUrl,
    email: raw.email ?? defaults.email,
    apiToken: raw.apiToken ?? defaults.apiToken,
    repository: raw.repository ?? defaults.repository,
    project: raw.project ?? defaults.project,
    issueType: raw.issueType ?? defaults.issueType,
    priorityBySeverity: { ...defaults.priorityBySeverity, ...(raw.priorityBySeverity ?? {}) },
    labels: raw.labels ?? defaults.labels,
    webhookUrl: raw.webhookUrl ?? defaults.webhookUrl,
    attachEvidence: raw.attachEvidence ?? defaults.attachEvidence,
    transitionOnHealed: raw.transitionOnHealed ?? defaults.transitionOnHealed,
  }
}
