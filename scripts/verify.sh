#!/usr/bin/env bash
# Build + test los workspaces, imprime un resumen de una línea por paquete.
set -uo pipefail

packages=(reporter-core test-runner cypress-plugin cli selenium-plugin webdriverio-plugin ai-local mcp dashboard-web)
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

# vscode-extension NO es workspace (private:true, fuera del array de workspaces del root):
# se construye y testea en su propio working-directory, igual que en el job de CI.
if ! out=$(cd vscode-extension && npm run build 2>&1); then
  results+=("❌ vscode-extension (build failed)")
  failed=1
elif ! out=$(cd vscode-extension && npm test 2>&1); then
  results+=("❌ vscode-extension (tests failed)")
  failed=1
else
  clean=$(sed 's/\x1b\[[0-9;]*m//g' <<<"$out")
  count=$(grep -oE 'Tests +[0-9]+ passed' <<<"$clean" | grep -oE '[0-9]+' | head -1)
  results+=("✅ vscode-extension (${count:-0})")
fi

line="${results[0]}"
for r in "${results[@]:1}"; do
  line="$line / $r"
done
echo "$line"

exit $failed
