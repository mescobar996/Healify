# Build + test los workspaces, imprime un resumen de una línea por paquete.
# Equivalente PowerShell de verify.sh para entornos Windows.
$packages = @("reporter-core", "test-runner", "cypress-plugin", "cli", "selenium-plugin", "webdriverio-plugin", "ai-local", "dashboard-web")
$results = @()
$failed = 0

foreach ($pkg in $packages) {
  $buildOut = npm run build --workspace=$pkg 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $results += "❌ $pkg (build failed)"
    $failed = 1
    continue
  }

  $testOut = npm test --workspace=$pkg --if-present 2>&1
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

$line = $results[0]
for ($i = 1; $i -lt $results.Count; $i++) {
  $line = "$line / $($results[$i])"
}
Write-Output $line

exit $failed
