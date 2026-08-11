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

packages=(reporter-core test-runner cypress-plugin cli selenium-plugin webdriverio-plugin)
# Umbral mínimo de líneas por paquete. Mantener en sintonía con la realidad: si un paquete
# llega a 80%, súbelo a 80 acá (y en coverage.ps1).
declare -A thresholds=(
  [reporter-core]=80
  [test-runner]=79
  [cypress-plugin]=57
  [cli]=63
  [selenium-plugin]=80
  [webdriverio-plugin]=80
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
