#!/usr/bin/env bash
# Build + test los 5 workspaces, imprime un resumen de una línea por paquete.
set -uo pipefail

packages=(reporter-core test-runner cypress-plugin cli selenium-plugin)
results=()
failed=0

for pkg in "${packages[@]}"; do
  if ! out=$(npm run build --workspace="$pkg" 2>&1); then
    results+=("❌ $pkg (build failed)")
    failed=1
    continue
  fi

  if ! out=$(npm test --workspace="$pkg" --if-present 2>&1); then
    results+=("❌ $pkg (tests failed)")
    failed=1
    continue
  fi

  clean=$(sed 's/\x1b\[[0-9;]*m//g' <<<"$out")
  count=$(grep -oE 'Tests +[0-9]+ passed' <<<"$clean" | grep -oE '[0-9]+' | head -1)
  results+=("✅ $pkg (${count:-0})")
done

line="${results[0]}"
for r in "${results[@]:1}"; do
  line="$line / $r"
done
echo "$line"

exit $failed
