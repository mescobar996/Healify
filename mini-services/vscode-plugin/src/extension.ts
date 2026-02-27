import * as vscode from 'vscode'

function getAppUrl(): string {
  const config = vscode.workspace.getConfiguration('healify')
  const configured = (config.get<string>('appUrl') || '').trim()
  const fallback = 'https://healify-sigma.vercel.app'
  return configured.length > 0 ? configured.replace(/\/$/, '') : fallback
}

function toSafeUrl(pathname: string): vscode.Uri {
  const baseUrl = getAppUrl()
  return vscode.Uri.parse(`${baseUrl}${pathname}`)
}

async function openLatestRun(): Promise<void> {
  const runId = await vscode.window.showInputBox({
    prompt: 'Optional: paste a Test Run ID to open exact details. Leave empty to open latest list.',
    placeHolder: 'e.g. cmm51w1lc0003ic040gza5k3h',
    ignoreFocusOut: true,
  })

  const runPath = runId?.trim()
    ? `/dashboard/tests/${encodeURIComponent(runId.trim())}`
    : '/dashboard/tests'

  const jobPath = runId?.trim()
    ? `/api/job-status/${encodeURIComponent(runId.trim())}`
    : null

  await vscode.env.openExternal(toSafeUrl(runPath))

  if (jobPath) {
    const choice = await vscode.window.showQuickPick(['Yes', 'No'], {
      title: 'Open worker status endpoint too?',
      placeHolder: 'This can help debug queue/job progress',
    })

    if (choice === 'Yes') {
      await vscode.env.openExternal(toSafeUrl(jobPath))
    }
  }

  vscode.window.showInformationMessage('Healify run opened in browser.')
}

function openDashboardPanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'healifyDashboardPanel',
    'Healify Dashboard',
    vscode.ViewColumn.One,
    { enableScripts: true }
  )

  const appUrl = getAppUrl()
  const testsUrl = `${appUrl}/dashboard/tests`
  const dashboardUrl = `${appUrl}/dashboard`

  panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
        .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px; }
        a { color: var(--vscode-textLink-foreground); text-decoration: none; }
        .row { margin-top: 12px; }
        .hint { margin-top: 14px; opacity: 0.8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Healify</h2>
        <p>Open dashboard and latest test runs quickly.</p>
        <div class="row"><a href="${dashboardUrl}">Open Dashboard</a></div>
        <div class="row"><a href="${testsUrl}">Open Test Runs</a></div>
        <p class="hint">Tip: Use command "Healify: Open Latest Test Run" for direct run links.</p>
      </div>
    </body>
  </html>`

  panel.webview.onDidReceiveMessage(() => {}, undefined, context.subscriptions)
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('healify.openLatestRun', openLatestRun),
    vscode.commands.registerCommand('healify.openDashboardPanel', () => openDashboardPanel(context))
  )
}

export function deactivate(): void {}
