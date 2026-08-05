import { resolve } from 'node:path'
import { runTests } from '@vscode/test-electron'

/**
 * Levanta un VS Code de verdad, le instala esta extensión y corre la suite de `suite/`.
 *
 * No es ceremonia. La extensión decide QUÉ marcar en `core/` (eso se testea con vitest, sin
 * editor), pero que esas decisiones lleguen a la pantalla depende de la API de vscode:
 * activación, rangos, DiagnosticCollection, CodeActionProvider. Mockear esa API probaría el
 * mock. Los cuatro bugs que tuvo Healify esta semana los encontraron los ejemplos al correr
 * de verdad, no los tests unitarios.
 */
async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = resolve(__dirname, '../../')
    const extensionTestsPath = resolve(__dirname, './suite/index')
    // Workspace mínimo y propio, para no depender del estado de ningún ejemplo del repo.
    const workspace = resolve(__dirname, '../../test-fixtures/workspace')

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspace, '--disable-extensions', '--disable-gpu'],
    })
  } catch (error) {
    console.error('Fallaron los tests de integración:', error)
    process.exit(1)
  }
}

void main()
