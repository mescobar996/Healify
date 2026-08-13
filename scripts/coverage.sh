#!/usr/bin/env bash
# Corre coverage (v8) por workspace e imprime una línea de resumen por paquete con el
# porcentaje de líneas cubiertas. Mismo espíritu que verify.sh.
#
# Cada paquete tiene su propio umbral mínimo de líneas (`--coverage.thresholds.lines`):
# si la cobertura baja del umbral, vitest falla y el job de CI se pone en rojo. Los
# paquetes que ya pasan 80% exigen 80%; los que aún no llegan (cypress-plugin, cli,
# test-runner) quedan en su nivel actual para no romper el CI de un día para otro — la
# regla es anti-regresión: no puede bajar de donde está hoy.
set -uo pipefail

# Detectar WSL: `bash` del PATH de Windows puede resolver a C:\WINDOWS\system32\bash.exe (WSL),
# que usa un Node de Linux contra los node_modules de Windows — los binarios nativos de rollup/v8
# no existen para esa combinación y vitest crashea con MODULE_NOT_FOUND. En ese caso delegamos al
# equivalente PowerShell nativo de Windows (mismos umbrales, mismo formato de salida).
if [ -r /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
  script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  ps1_path=$(wslpath -w "$script_dir/coverage.ps1" 2>/dev/null || echo "$script_dir/coverage.ps1")
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps1_path" "$@"
fi

packages=(reporter-core test-runner cypress-plugin cli selenium-plugin webdriverio-plugin ai-local mcp dashboard-web)
# Umbral mínimo de líneas por paquete. Mantener en sintonía con la realidad: si un paquete
# llega a 80%, súbelo a 80 acá (y en coverage.ps1). Los que todavía no llegan (ai-local,
# dashboard-web) conservan un piso por debajo de su nivel actual — anti-regresión.
declare -A thresholds=(
  [reporter-core]=80
  [test-runner]=79
  [cypress-plugin]=80
  [cli]=80
  [selenium-plugin]=80
  [webdriverio-plugin]=80
  [ai-local]=30
  [mcp]=80
  [dashboard-web]=70
)
results=()
failed=0

for pkg in "${packages[@]}"; do
  threshold="${thresholds[$pkg]:-0}"
  out=$(cd "$pkg" && npx vitest run --coverage --coverage.provider=v8 --coverage.include='src/**' --coverage.reporter=text --coverage.thresholds.lines="$threshold" 2>&1)
  status=$?
  clean=$(sed 's/\x1b\[[0-9;]*m//g' <<<"$out")
  # De la fila "All files" del reporte text, el 4º valor numérico es % Lines.
  # (captura enteros y decimales: un valor como funcs=70 no tiene punto).
  lines=$(grep -E '^All files' <<<"$clean" | grep -oE '[0-9]+(\.[0-9]+)?' | sed -n '4p')

  if [ $status -ne 0 ]; then
    results+=("❌ $pkg (${lines:-?}% < $threshold%)")
    failed=1
    continue
  fi
  results+=("✅ $pkg (${lines:-?}% líneas)")
done

line="${results[0]}"
for r in "${results[@]:1}"; do
  line="$line / $r"
done
echo "$line"

exit $failed
