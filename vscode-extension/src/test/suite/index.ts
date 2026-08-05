import * as path from 'node:path'
import Mocha from 'mocha'

/**
 * Runner que VS Code invoca desde adentro. Mocha y no vitest: esto corre en el proceso de
 * extensiones del editor, donde `require('vscode')` existe — vitest no puede levantar ahí.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20000 })
  mocha.addFile(path.resolve(__dirname, './extension.test.js'))

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) reject(new Error(`${failures} test(s) fallaron`))
        else resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}
