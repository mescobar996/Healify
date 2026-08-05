import * as assert from 'node:assert'
import * as path from 'node:path'
import * as vscode from 'vscode'

/**
 * Tests contra un VS Code real. Verifican que lo que `core/` decide efectivamente llegue a la
 * pantalla: activación, rangos, severidades y Quick Fix.
 */

const WORKSPACE = path.resolve(__dirname, '../../../test-fixtures/workspace')
const SPEC = path.join(WORKSPACE, 'checkout.spec.ts')

/**
 * `executeCodeActionProvider` puede rechazar con `Canceled`: VS Code descarta la petición en
 * vuelo cuando los diagnostics se vuelven a publicar mientras la resuelve. No es un fallo del
 * proveedor —la siguiente llamada devuelve lo mismo— pero sin reintento el test falla de a
 * ratos según cómo caiga el timing de la máquina.
 */
async function getCodeActions(uri: vscode.Uri, range: vscode.Range, intentos = 5): Promise<vscode.CodeAction[]> {
  for (let i = 0; i < intentos; i++) {
    try {
      return (await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', uri, range)) ?? []
    } catch (error) {
      const cancelado = error instanceof Error && /cancel/i.test(error.message)
      if (!cancelado || i === intentos - 1) throw error
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  return []
}

/**
 * Los diagnostics se publican de forma asíncrona, después de que la extensión activa y
 * analiza. Se espera a que aparezcan en vez de dormir un rato fijo, que es la receta para un
 * test flaky en la máquina de otro.
 */
async function waitForDiagnostics(uri: vscode.Uri, timeoutMs = 15000): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const found = vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'Healify')
    if (found.length > 0) return found
    await new Promise((r) => setTimeout(r, 200))
  }

  return vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'Healify')
}

suite('Healify · extensión', () => {
  let document: vscode.TextDocument
  let diagnostics: vscode.Diagnostic[]

  suiteSetup(async () => {
    document = await vscode.workspace.openTextDocument(SPEC)
    await vscode.window.showTextDocument(document)
    diagnostics = await waitForDiagnostics(document.uri)
  })

  test('la extensión activa y publica diagnostics', () => {
    assert.ok(diagnostics.length > 0, 'no se publicó ningún diagnostic de Healify')
  })

  test('el selector del reporte sale como Error', () => {
    const found = diagnostics.find((d) => document.getText(d.range) === '#buy-btn-a1b2c3')

    assert.ok(found, 'no marcó el selector que el reporte da por roto')
    assert.strictEqual(found.severity, vscode.DiagnosticSeverity.Error)
  })

  test('el rango cae exactamente sobre el selector, sin comillas', () => {
    const found = diagnostics.find((d) => d.severity === vscode.DiagnosticSeverity.Error)
    assert.ok(found)
    assert.strictEqual(document.getText(found.range), '#buy-btn-a1b2c3')
  })

  test('el XPath posicional sale como Warning', () => {
    const found = diagnostics.find((d) => document.getText(d.range) === '//div[3]/button')

    assert.ok(found, 'no marcó el XPath — puede haberse comido el // como comentario')
    assert.strictEqual(found.severity, vscode.DiagnosticSeverity.Warning)
  })

  test('el data-testid no se marca', () => {
    const found = diagnostics.find((d) => document.getText(d.range) === '[data-testid="confirmar"]')
    assert.strictEqual(found, undefined, 'marcó un selector que ya es estable')
  })

  test('el selector verificado ofrece Quick Fix', async () => {
    const target = diagnostics.find((d) => document.getText(d.range) === '#buy-btn-a1b2c3')
    assert.ok(target)

    const actions = await getCodeActions(document.uri, target.range)

    const healifyAction = actions?.find((a) => a.title.startsWith('Healify:'))
    assert.ok(healifyAction, 'no ofreció ninguna acción para un selector verificado')
    assert.ok(healifyAction.edit, 'la acción no trae edición')
  })

  /**
   * La propiedad central de la extensión, verificada del lado del editor y no solo en la
   * unidad: sobre un warning del lint no puede haber acción. Sin evidencia de la página, el
   * reemplazo que el motor propone es un nombre plausible, y un Ctrl+. distraído lo aplicaría
   * sin que nadie lo lea.
   */
  test('un warning del lint NO ofrece Quick Fix', async () => {
    const target = diagnostics.find((d) => d.severity === vscode.DiagnosticSeverity.Warning)
    assert.ok(target, 'no hay ningún warning para probar')

    const actions = await getCodeActions(document.uri, target.range)

    const healifyAction = actions?.find((a) => a.title.startsWith('Healify:'))
    assert.strictEqual(healifyAction, undefined, 'ofreció aplicar una sugerencia sin verificar')
  })

  test('el Quick Fix reemplaza el selector en el archivo', async () => {
    const target = diagnostics.find((d) => document.getText(d.range) === '#buy-btn-a1b2c3')
    assert.ok(target)

    const actions = await getCodeActions(document.uri, target.range)
    const action = actions?.find((a) => a.title.startsWith('Healify:'))
    assert.ok(action?.edit)

    await vscode.workspace.applyEdit(action.edit)

    const texto = document.getText()
    assert.ok(texto.includes("[data-testid='comprar']"), 'no aplicó el reemplazo verificado')
    assert.ok(!texto.includes(`page.click('#buy-btn-a1b2c3')`), 'la llamada quedó con el selector roto')

    // El selector SÍ sigue apareciendo en el comentario de cabecera del fixture, y tiene que
    // seguir: es la prueba de que el enmascarado de comentarios funciona. Si esta cuenta
    // llegara a 0, sería porque se reemplazó también adentro del comentario.
    assert.strictEqual(texto.split('#buy-btn-a1b2c3').length - 1, 1, 'tocó la mención del comentario')

    // Se revierte en memoria: el fixture está versionado y tiene que quedar como estaba.
    await vscode.commands.executeCommand('undo')
  })
})
