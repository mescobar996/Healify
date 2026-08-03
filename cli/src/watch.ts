import { statSync } from 'node:fs'

/**
 * Detección de "el reporte cambió" para `healify fix --watch`.
 *
 * Polling con `mtime + size` en vez de `fs.watch`: `fs.watch` tiene semántica distinta en cada
 * sistema operativo (en algunos dispara dos veces por escritura, en otros no dispara si el
 * archivo se reemplaza por `rename`, que es justo como un runner escribe un reporte nuevo).
 * Un stamp comparado a intervalo fijo es aburrido, predecible y no depende de ninguna
 * dependencia nueva — que es lo que queremos en un loop que va a correr durante horas.
 *
 * Todo lo de acá es puro y sincrónico a propósito: el loop de verdad vive en
 * `commands/watch.ts`, y así esta lógica se puede testear sin timers ni disco.
 */

export interface FileStamp {
  mtimeMs: number
  size: number
}

/**
 * Stamp del archivo, o `null` si no existe o no se puede leer.
 *
 * Que "no existe" y "no se puede leer" colapsen en el mismo `null` es deliberado: para el loop
 * son el mismo caso — todavía no hay nada que aplicar — y distinguirlos solo agregaría ramas
 * que nadie sabría qué hacer con ellas.
 */
export function stampOf(path: string): FileStamp | null {
  try {
    const stats = statSync(path)
    return { mtimeMs: stats.mtimeMs, size: stats.size }
  } catch {
    return null
  }
}

/**
 * ¿Cambió el archivo entre dos observaciones?
 *
 * `size` además de `mtimeMs` porque hay sistemas de archivos con resolución de mtime de 1
 * segundo: dos corridas muy seguidas pueden compartir mtime, y ahí el tamaño distinto es lo
 * único que delata que el reporte se regeneró.
 */
export function hasChanged(prev: FileStamp | null, next: FileStamp | null): boolean {
  if (prev === null && next === null) return false
  if (prev === null || next === null) return true
  return prev.mtimeMs !== next.mtimeMs || prev.size !== next.size
}

export interface ChangeDetector {
  /** `true` si hay que aplicar ahora. Guarda el stamp como referencia para la próxima. */
  shouldApply(next: FileStamp | null): boolean
}

/**
 * Detector con memoria de una observación.
 *
 * La primera llamada siempre devuelve `true`, incluso con `null`: arrancar el watch tiene que
 * hacer una pasada inmediata en vez de esperar al primer cambio — si ya hay un reporte, se
 * aplica; si no hay, el caller avisa que está esperando. Sin eso, `fix --watch` arrancado
 * sobre un reporte ya existente se quedaría mudo hasta la próxima corrida de tests.
 */
export function makeChangeDetector(): ChangeDetector {
  let seen = false
  let prev: FileStamp | null = null

  return {
    shouldApply(next: FileStamp | null): boolean {
      if (!seen) {
        seen = true
        prev = next
        return true
      }
      const changed = hasChanged(prev, next)
      prev = next
      return changed
    },
  }
}
