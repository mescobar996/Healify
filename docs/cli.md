[← Documentación](README.md) · [Healify](../README.md)

---

# Comandos

> Todo lo que hace el CLI. Nada acá manda datos a ningún lado.

| Comando | Qué hace |
|---|---|
| `healify init` | Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin. No genera tests. |
| `healify doctor` | Verifica que Healify esté instalado y bien configurado. |
| `healify fix [reporte.json]` | Aplica las sugerencias de mayor confianza directo en tus archivos de test. |
| `healify history` | Muestra selectores recurrentes y re-rotos de `.healify/history.jsonl`. |
| `healify report [reporte.json]` | Reporta los defectos de la corrida a tu Jira (o webhook). Dedupe por `defectId`, opt-in. |
| `healify dashboard [--out <path>]` | Genera `healify-dashboard.html`, la vista offline del histórico (misma estética que `healify-report.html`). |
| `healify flake [--min-runs <n>]` | Detecta tests flaky (verde en unas corridas, rojo en otras) sobre `.healify/runs.jsonl`, lo que registran los reporters de Playwright/Cypress en cada corrida. |
| `healify heal` | Motor vía JSON por stdin/stdout, para usar desde Python/Java/C#/etc. |
| `healify probe-script` | Imprime el script para sondear el DOM con `execute_script()` (insumo de `heal`). |
| `healify explain [selector]` | Explica por qué un selector es frágil y qué propone el motor. |
| `healify ai <setup\|status\|explain\|chat\|models>` | IA local opcional via Ollama. |

## Flags de `healify fix`

| Flag | Efecto |
|---|---|
| `--dry-run` | Muestra qué se curaría sin modificar archivos. |
| `--force` | Aplica aunque el archivo tenga cambios sin commitear. |
| `--pr` | Crea branch + commit + PR automáticamente (requiere `gh` CLI). |
| `--no-ast` | Desactiva la reescritura de sugerencias `role(...)` (sustitución simple). |
| `--no-pom` | No busca el selector en los page objects cuando no está en el archivo de test. |
| `--watch` | Se queda vigilando el reporte y re-aplica en cada corrida nueva. `--interval <ms>` para ajustar (default 1000). |
| `--interactive` | Pregunta caso por caso antes de aplicar. |

### Modo watch

```bash
npx @healify/cli@latest fix --watch
```

Se queda escuchando: cada vez que tus tests escriben un reporte nuevo, aplica solo. El equivalente
del `--ui` de Playwright pero del lado de Healify — dejás la terminal abierta y no tenés que
acordarte de nada.

Si todavía no hay reporte, avisa una vez y espera. La primera pasada es inmediata, así que si ya
había uno cuando arrancaste, lo aplica al toque. `--pr` y `--interactive` no aplican acá (crear
una PR por cada corrida, o preguntarte algo mientras mirás otra cosa, no tiene sentido).

### Page Object Model

Si el selector roto no está en el spec (lo normal con POM: vive en `pages/login.page.ts`), `fix`
lo busca en el resto del código del proyecto y aplica el cambio ahí, diciéndote en qué archivo lo
tocó. Conservador: solo aplica si hay **un único** archivo con **una única** ocurrencia; con dos
candidatos reporta ambiguo y no toca nada. Se apaga con `--no-pom`.

## `healify heal` (para adapters)

```bash
echo '{"testFile":"test.py","testName":"test_login","selector":"#old-btn","errorMessage":"..."}' | npx @healify/cli@latest heal
# -> {"fixedSelector":"[data-testid='login']","confidence":0.95,"verified":true,...}
```
