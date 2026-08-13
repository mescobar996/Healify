import * as vscode from 'vscode'
import { spawn } from 'node:child_process'
import { analyzeDocument, type Finding } from './core/diagnostics'
import { readReportCases, type ReportCase } from './core/report'

/**
 * Capa de VS Code. Todo lo que decide QUÉ marcar vive en `core/` y se testea sin editor; acá
 * solo queda traducir eso a la API de vscode y manejar el ciclo de vida.
 *
 * Si este archivo empieza a tomar decisiones sobre selectores, están en el lugar equivocado.
 */

const LANGUAGES = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']
const DEBOUNCE_MS = 300
const SOURCE = 'Healify'

/** Un solo pipeline de análisis, compartido entre el evento de tipeo y el del reporte. */
let diagnostics: vscode.DiagnosticCollection
let debounceTimer: NodeJS.Timeout | undefined

/**
 * Cache del reporte por carpeta de workspace. Sin esto se leería el JSON del disco en cada
 * tecla; se invalida cuando el watcher ve que el archivo cambió.
 */
const reportCache = new Map<string, ReportCase[]>()

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('healify')
  context.subscriptions.push(diagnostics)

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        scheduleRefresh(event.document)
      }
    }),
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) refresh(editor.document)
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri))
  )

  // El reporte lo escribe el reporter al terminar una corrida de tests. Cuando aparece, los
  // warnings del archivo abierto pasan a errores con Quick Fix sin que nadie toque nada.
  const watcher = vscode.workspace.createFileSystemWatcher('**/healify-report.json')
  const invalidate = () => {
    reportCache.clear()
    for (const editor of vscode.window.visibleTextEditors) refresh(editor.document)
  }
  watcher.onDidCreate(invalidate)
  watcher.onDidChange(invalidate)
  watcher.onDidDelete(invalidate)
  context.subscriptions.push(watcher)

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(LANGUAGES, new HealifyActions(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('healify.refresh', () => {
      reportCache.clear()
      if (vscode.window.activeTextEditor) refresh(vscode.window.activeTextEditor.document)
    }),
    vscode.commands.registerCommand('healify.openPanel', () => openDashboard(context)),
    vscode.commands.registerCommand('healify.applyStructuralFix', applyStructuralFix)
  )

  for (const editor of vscode.window.visibleTextEditors) refresh(editor.document)
}

export function deactivate(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
}

function scheduleRefresh(document: vscode.TextDocument): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => refresh(document), DEBOUNCE_MS)
}

function refresh(document: vscode.TextDocument): void {
  if (!LANGUAGES.includes(document.languageId)) return

  const folder = vscode.workspace.getWorkspaceFolder(document.uri)
  const config = vscode.workspace.getConfiguration('healify')

  const findings = analyzeDocument(document.getText(), {
    reportCases: folder ? cachedReport(folder.uri.fsPath, config.get<string>('reportPath')) : [],
    liveLint: config.get<boolean>('liveLint', true),
  })

  diagnostics.set(
    document.uri,
    findings.map((finding) => toDiagnostic(document, finding))
  )
}

function cachedReport(root: string, explicitPath?: string): ReportCase[] {
  const cached = reportCache.get(root)
  if (cached) return cached

  const cases = readReportCases(root, explicitPath || undefined)
  reportCache.set(root, cases)
  return cases
}

function toDiagnostic(document: vscode.TextDocument, finding: Finding): vscode.Diagnostic {
  const range = new vscode.Range(document.positionAt(finding.start), document.positionAt(finding.end))

  const diagnostic = new vscode.Diagnostic(
    range,
    finding.message,
    finding.level === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
  )

  diagnostic.source = SOURCE
  // El fix viaja en `code` para que el CodeActionProvider no tenga que volver a analizar el
  // documento entero solo para saber qué proponer sobre este rango.
  if (finding.fix) diagnostic.code = { value: finding.fix, target: vscode.Uri.parse('https://github.com/mescobar996/Healify') }

  return diagnostic
}

/**
 * Ofrece el reemplazo verificado como Quick Fix.
 *
 * Solo actúa sobre diagnostics que ya traen `fix`, y eso solo pasa cuando el reporte marcó el
 * caso como verificado contra la página real (ver core/diagnostics.ts). Acá no se decide nada
 * de eso: si el diagnostic no trae fix, no hay acción.
 */
class HealifyActions implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== SOURCE) continue
      const fix = typeof diagnostic.code === 'object' && diagnostic.code ? String(diagnostic.code.value) : undefined
      if (!fix) continue

      actions.push(buildAction(document, diagnostic, fix))
    }

    return actions
  }
}

/**
 * Una sugerencia `role('button', { name: 'X' })` no es un valor de selector pegable: hay que
 * reescribir la llamada entera (`page.click(sel)` → `page.getByRole(...).click()`). Eso ya lo
 * sabe hacer `healify fix` con ts-morph (cli/src/fix-ast.ts), así que para ese caso se delega
 * en el CLI del proyecto en vez de duplicar la reescritura acá — dos copias de esa lógica se
 * desincronizan seguro.
 */
function isStructural(fix: string): boolean {
  return fix.startsWith('role(')
}

function buildAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, fix: string): vscode.CodeAction {
  if (isStructural(fix)) {
    const action = new vscode.CodeAction(`Healify: reescribir con ${fix}`, vscode.CodeActionKind.QuickFix)
    action.diagnostics = [diagnostic]
    action.command = {
      command: 'healify.applyStructuralFix',
      title: 'Healify: aplicar',
      arguments: [document.uri],
    }
    return action
  }

  const action = new vscode.CodeAction(`Healify: reemplazar por ${fix}`, vscode.CodeActionKind.QuickFix)
  action.kind = vscode.CodeActionKind.QuickFix
  action.diagnostics = [diagnostic]
  action.isPreferred = true

  const edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, diagnostic.range, fix)
  action.edit = edit

  return action
}

/**
 * Corre `healify fix` del proyecto. `--force` porque el usuario ya dijo que sí apretando el
 * Quick Fix, y el chequeo de git limpio del CLI está pensado para una corrida desatendida en
 * CI, no para una acción explícita dentro del editor (donde además siempre se puede deshacer
 * con Ctrl+Z).
 */
async function applyStructuralFix(uri: vscode.Uri): Promise<void> {
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  if (!folder) {
    vscode.window.showErrorMessage('Healify: el archivo no está dentro de una carpeta del workspace.')
    return
  }

  await vscode.workspace.save(uri)

  const result = await runCli(folder.uri.fsPath, ['fix', '--force'])

  if (result.code !== 0) {
    vscode.window.showErrorMessage(`Healify: el fix falló. ${result.stderr || result.stdout}`.trim())
    return
  }

  reportCache.clear()
  for (const editor of vscode.window.visibleTextEditors) refresh(editor.document)
  vscode.window.showInformationMessage('Healify aplicó la corrección.')
}

function runCli(cwd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // `npx --no-install` usa el healify del proyecto y nunca baja nada de la red: si no está
    // instalado, el mensaje tiene que decir eso, no instalar un binario a espaldas del usuario.
    const child = spawn('npx', ['--no-install', 'healify', ...args], { cwd, shell: process.platform === 'win32' })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: error.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

/**
 * Panel con el dashboard del histórico. El HTML lo genera `healify dashboard`, que ya existe
 * — acá solo se lo muestra, sin reimplementar la vista.
 */
async function openDashboard(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (!folder) {
    vscode.window.showErrorMessage('Healify: abrí una carpeta para ver el panel.')
    return
  }

  const panel = vscode.window.createWebviewPanel('healifyDashboard', 'Healify', vscode.ViewColumn.Beside, {
    enableScripts: false,
  })
  context.subscriptions.push(panel)

  panel.webview.html = '<p style="font-family: sans-serif; padding: 2rem">Generando el panel…</p>'

  const dashboardPath = vscode.Uri.joinPath(folder.uri, 'healify-dashboard.html')
  const result = await runCli(folder.uri.fsPath, ['dashboard'])

  if (result.code !== 0) {
    panel.webview.html = errorHtml(result.stderr || result.stdout)
    return
  }

  try {
    const bytes = await vscode.workspace.fs.readFile(dashboardPath)
    panel.webview.html = Buffer.from(bytes).toString('utf-8')
  } catch {
    panel.webview.html = errorHtml('No se pudo leer healify-dashboard.html después de generarlo.')
  }
}

const ENTITY_ESCAPES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;' }

function errorHtml(detail: string): string {
  const safe = detail.replace(/[<>&]/g, (c) => ENTITY_ESCAPES[c])
  return `<div style="font-family: sans-serif; padding: 2rem">
    <h2>No se pudo generar el panel</h2>
    <p>Healify necesita estar instalado en el proyecto (<code>npm i -D @healify/cli</code>) y haber corrido los tests al menos una vez.</p>
    <pre style="white-space: pre-wrap; opacity: .7">${safe}</pre>
  </div>`
}
