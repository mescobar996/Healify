# Build + test los workspaces, imprime un resumen de una línea por paquete.
# Equivalente PowerShell de verify.sh para entornos Windows.
$packages = @("reporter-core", "test-runner", "cypress-plugin", "cli", "selenium-plugin", "webdriverio-plugin", "ai-local", "mcp", "dashboard-web")
$results = @()
$failed = 0

foreach ($pkg in $packages) {
  # cmd /c mezcla stdout+stderr como texto plano: la redirección nativa de PS 5.1 convierte
  # cada línea de stderr de npm/vitest en un NativeCommandError que ensucia el resumen.
  $buildOut = cmd /c "npm run build --workspace=$pkg 2>&1" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $results += "❌ $pkg (build failed)"
    $failed = 1
    continue
  }

  $testOut = cmd /c "npm test --workspace=$pkg --if-present 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $results += "❌ $pkg (tests failed)"
    $failed = 1
    continue
  }

  $clean = $testOut -replace '\x1b\[[0-9;]*m', ''
  $match = $clean | Select-String 'Tests\s+(\d+)\s+passed'
  $count = if ($match) { $match.Matches[0].Groups[1].Value } else { "0" }
  $results += "✅ $pkg ($count)"
}

# vscode-extension NO es workspace (private:true, fuera del array de workspaces del root):
# se construye y testea en su propio working-directory, igual que en el job de CI.
Push-Location vscode-extension
$vsBuild = cmd /c "npm run build 2>&1" | Out-Null
if ($LASTEXITCODE -ne 0) {
  $results += "❌ vscode-extension (build failed)"
  $failed = 1
} else {
  $vsTest = cmd /c "npm test 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $results += "❌ vscode-extension (tests failed)"
    $failed = 1
  } else {
    $clean = $vsTest -replace '\x1b\[[0-9;]*m', ''
    $match = $clean | Select-String 'Tests\s+(\d+)\s+passed'
    $count = if ($match) { $match.Matches[0].Groups[1].Value } else { "0" }
    $results += "✅ vscode-extension ($count)"
  }
}
Pop-Location

$line = $results[0]
for ($i = 1; $i -lt $results.Count; $i++) {
  $line = "$line / $($results[$i])"
}
Write-Output $line

exit $failed
