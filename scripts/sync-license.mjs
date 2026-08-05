#!/usr/bin/env node
/**
 * Copia el LICENSE de la raíz al paquete que se está por empaquetar.
 *
 * npm incluye automáticamente un `LICENSE` en el tarball, pero solo si está en la raíz **del
 * paquete** — y el nuestro vive en la raíz del *repo*. Resultado: los 7 paquetes declaraban
 * `"license": "MIT"` sin llevar el texto adentro, que es justo lo que alguien necesita leer
 * cuando su equipo legal le pregunta bajo qué términos puede usar esto.
 *
 * Se engancha a `prepack`, que npm corre para el paquete que empaqueta, tanto en `npm pack`
 * como en `npm publish`. Las copias quedan gitignoradas: el original sigue siendo uno solo,
 * así que no pueden divergir.
 *
 * El chequeo que importa está en CI (`npm pack --dry-run` tiene que listar LICENSE en los 7).
 * Sin eso, este script podría dejar de correr y nadie se enteraría hasta que fuera tarde:
 * un tarball publicado no se corrige, se quema una versión nueva.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(repoRoot, 'LICENSE')

if (!existsSync(source)) {
  console.error(`sync-license: no encuentro ${source}`)
  process.exit(1)
}

// `npm publish --workspace=X` corre el prepack con el cwd en el paquete, así que el destino
// sale de ahí y no de una lista hardcodeada que habría que actualizar con cada paquete nuevo.
const target = join(process.cwd(), 'LICENSE')

if (resolve(target) === resolve(source)) {
  process.exit(0) // corriendo desde la raíz: no hay nada que copiar
}

copyFileSync(source, target)
