# Corre coverage (v8) por workspace e imprime una línea de resumen por paquete con el
# porcentaje de líneas cubiertas. Equivalente PowerShell de coverage.sh.
$ErrorActionPreference = "Stop"

$packages = @("reporter-core", "test-runner", "cypress-plugin", "cli", "selenium-plugin", "webdriverio-plugin")
$results = @()
$failed = 0

foreach ($pkg in $packages) {
  Push-Location $pkg
  $out = npx vitest run --coverage --coverage.provider=v8 --coverage.include='src/**' --coverage.reporter=text 2>&1
  Pop-Location

  if ($LASTEXITCODE -ne 0) {
    $results += "❌ $pkg (coverage failed)"
    $failed = 1
    continue
  }

  $clean = $out -replace '\x1b\[[0-9;]*m', ''
  $allFilesLine = $clean | Where-Object { $_ -match '^All files' }
  $lines = "?"
  if ($allFilesLine) {
    $nums = [regex]::Matches($allFilesLine, '[0-9]+(\.[0-9]+)?')
    if ($nums.Count -ge 4) {
      $lines = $nums[3].Value
    }
  }
  $results += "✅ $pkg ($lines% líneas)"
}

$line = $results[0]
for ($i = 1; $i -lt $results.Count; $i++) {
  $line = "$line / $($results[$i])"
}
Write-Output $line

exit $failed
