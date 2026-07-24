import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lee la versión del package.json del propio paquete. En producción el bundle vive en
 * dist/, así que __dirname/.. apunta a la raíz del paquete (donde está package.json).
 * baseDir es inyectable solo para tests. Si algo falla (archivo movido, JSON roto), no
 * revienta: devuelve 'desconocida'.
 */
export function getVersion(baseDir: string = __dirname): string {
  try {
    const pkg = JSON.parse(readFileSync(join(baseDir, '..', 'package.json'), 'utf-8'))
    return typeof pkg.version === 'string' ? pkg.version : 'desconocida'
  } catch {
    return 'desconocida'
  }
}
