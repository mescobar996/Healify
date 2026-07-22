import { execFileSync } from 'node:child_process'

/**
 * true si el archivo tiene cambios sin commitear. Si no estamos dentro de un repo git
 * (o git no está disponible), no bloquea — devuelve false, no se puede verificar así que
 * no se le niega el uso a alguien que no usa git.
 */
export function isGitDirty(filePath: string): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', filePath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}
