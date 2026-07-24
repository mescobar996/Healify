#!/usr/bin/env bash
# Corre coverage (v8) por workspace e imprime una línea de resumen por paquete con el
# porcentaje de líneas cubiertas. Mismo espíritu que verify.sh.
set -uo pipefail

packages=(reporter-core test-runner cypress-plugin cli selenium-plugin webdriverio-plugin)
results=()
failed=0

for pkg in "${packages[@]}"; do
  out=$(cd "$pkg" && npx vitest run --coverage --coverage.provider=v8 --coverage.include='src/**' --coverage.reporter=text 2>&1)
  if [ $? -ne 0 ]; then
    results+=("❌ $pkg (coverage failed)")
    failed=1
    continue
  fi

  clean=$(sed 's/\x1b\[[0-9;]*m//g' <<<"$out")
  # De la fila "All files" del reporte text, el 4º valor numérico es % Lines.
  # (captura enteros y decimales: un valor como funcs=70 no tiene punto).
  lines=$(grep -E '^All files' <<<"$clean" | grep -oE '[0-9]+(\.[0-9]+)?' | sed -n '4p')
  results+=("✅ $pkg (${lines:-?}% líneas)")
done

line="${results[0]}"
for r in "${results[@]:1}"; do
  line="$line / $r"
done
echo "$line"

exit $failed
