# Corre coverage (v8) por workspace e imprime una línea de resumen por paquete con el
# porcentaje de líneas cubiertas. Equivalente PowerShell de coverage.sh.
#
# Cada paquete tiene su propio umbral mínimo de líneas (`--coverage.thresholds.lines`):
# si la cobertura baja del umbral, vitest falla y el job de CI se pone en rojo. Los
# paquetes que ya pasan 80% exigen 80%; los que aún no llegan (cypress-plugin, cli,
# test-runner) quedan en su nivel actual para no romper el CI — anti-regresión.
$ErrorActionPreference = "Stop"

$packages = @("reporter-core", "test-runner", "cypress-plugin", "cli", "selenium-plugin", "webdriverio-plugin")
# Umbral mínimo de líneas por paquete. Mantener en sintonía con coverage.sh.
$thresholds = @{
  "reporter-core"     = 80
  "test-runner"       = 79
  "cypress-plugin"    = 57
  "cli"               = 63
  "selenium-plugin"   = 80
  "webdriverio-plugin" = 80
}
$results = @()
$failed = 0

foreach ($pkg in $packages) {
  $threshold = $thresholds[$pkg]
  Push-Location $pkg
  $out = npx vitest run --coverage --coverage.provider=v8 --coverage.include='src/**' --coverage.reporter=text --coverage.thresholds.lines=$threshold 2>&1
  $status = $LASTEXITCODE
  Pop-Location

  $clean = $out -replace '\x1b\[[0-9;]*m', ''
  $allFilesLine = $clean | Where-Object { $_ -match '^All files' }
  $lines = "?"
  if ($allFilesLine) {
    $nums = [regex]::Matches($allFilesLine, '[0-9]+(\.[0-9]+)?')
    if ($nums.Count -ge 4) {
      $lines = $nums[3].Value
    }
  }

  if ($status -ne 0) {
    $results += "❌ $pkg ($lines% < $threshold%)"
    $failed = 1
    continue
  }
  $results += "✅ $pkg ($lines% líneas)"
}

$line = $results[0]
for ($i = 1; $i -lt $results.Count; $i++) {
  $line = "$line / $($results[$i])"
}
Write-Output $line

exit $failed
