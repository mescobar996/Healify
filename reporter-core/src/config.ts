import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface HealifyConfig {
  /** Atributos de test-id adicionales del proyecto. Solo se aceptan los que empiecen con "data-". */
  customTestIds?: string[]
  /** Sinónimos adicionales de acciones/campos, se mergean con los built-in EN/ES. */
  customSynonyms?: { actions?: Record<string, string>; fields?: Record<string, string> }
}

/**
 * Carga la config de Healify desde healify.config.json o desde la key "healify" en package.json.
 * Si no hay config, devuelve un objeto vacío. Si hay un archivo inválido, devuelve un objeto
 * vacío sin tirar error — Healify funciona sin config.
 *
 * `cwd` inyectable para tests.
 */
export function loadConfig(cwd: string = process.cwd()): HealifyConfig {
  const fromJson = loadFromHealifyConfigJson(cwd)
  if (fromJson) return validateConfig(fromJson)

  const fromPkg = loadFromPackageJson(cwd)
  if (fromPkg) return validateConfig(fromPkg)

  return {}
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

  return result
}
