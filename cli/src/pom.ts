import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Listado de archivos de código del proyecto, para poder buscar un selector fuera del spec
 * que reportó el fallo.
 *
 * Existe porque en un proyecto con Page Object Model el selector roto casi nunca está en el
 * archivo de test: está en `pages/login.page.ts`. Sin esto, `fix` saltea absolutamente todo
 * con "ya no se encontró en el archivo" — ver `docs/superpowers/plans/2026-08-03-page-object-fix.md`.
 *
 * Walker propio y no `glob`: `@healify/cli` no tiene dependencias de runtime y no vale la pena
 * agregar una para recorrer directorios. Iterativo y no recursivo para que la profundidad no
 * dependa del stack, con topes duros: en un monorepo enorme preferimos degradar a "no lo
 * encontré" antes que quedarnos colgados recorriendo medio disco.
 */

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

/** Ni fuente del usuario ni nada donde tenga sentido reescribir un selector. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  '__pycache__',
  'test-results',
  'playwright-report',
])

export interface CollectOptions {
  /** Niveles de directorio por debajo de cada raíz. Default: 8. */
  maxDepth?: number
  /** Corte duro de archivos devueltos. Default: 3000. */
  maxFiles?: number
}

function isCodeFile(name: string): boolean {
  return CODE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Archivos de código bajo `roots`, en orden determinístico (las entradas de cada directorio se
 * ordenan): dos corridas sobre el mismo árbol devuelven la misma lista, que es lo que hace
 * reproducible la decisión de `fix`.
 *
 * Los directorios ocultos (`.git`, `.next`, `.healify`, `.turbo`…) se saltean todos por regla
 * general, así no hay que mantener una lista de nombres que crece con cada herramienta nueva.
 */
export function collectCodeFiles(roots: string[], options: CollectOptions = {}): string[] {
  const maxDepth = options.maxDepth ?? 8
  const maxFiles = options.maxFiles ?? 3000

  const files: string[] = []
  const seenDirs = new Set<string>()
  const stack: { dir: string; depth: number }[] = roots.map((dir) => ({ dir, depth: 0 }))

  while (stack.length > 0) {
    if (files.length >= maxFiles) break
    const { dir, depth } = stack.pop() as { dir: string; depth: number }
    if (seenDirs.has(dir)) continue
    seenDirs.add(dir)

    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      // Permisos, symlink roto, directorio borrado entre el listado y la lectura: una entrada
      // ilegible no puede abortar la búsqueda entera.
      continue
    }

    // Descendente porque el stack es LIFO: así se visita en orden alfabético y, si se llega al
    // tope de archivos, siempre se recorta por el mismo lado.
    const sorted = [...entries].sort((a, b) => b.name.localeCompare(a.name))
    for (const entry of sorted) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || depth >= maxDepth) continue
        stack.push({ dir: join(dir, entry.name), depth: depth + 1 })
      } else if (entry.isFile() && isCodeFile(entry.name)) {
        files.push(join(dir, entry.name))
        if (files.length >= maxFiles) break
      }
    }
  }

  return files.sort()
}
