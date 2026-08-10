[← Documentación](README.es.md) · [Healify](../README.es.md) · [English](github-action.md)

---

# GitHub Action

> Comenta los selectores rotos en la PR. Nunca modifica archivos.

Corre `doctor` + `fix --dry-run` y comenta el resultado directo en la PR: **nunca modifica archivos**.

```yaml
# .github/workflows/healify.yml
name: Healify
on: pull_request

permissions:
  contents: read
  pull-requests: write   # sin esto la API devuelve 403 al comentar

jobs:
  healify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright test
        continue-on-error: true   # queremos el reporte aunque la suite falle
      - uses: mescobar996/Healify@v2
```

`@v2` es un alias móvil de la última `2.x`, actualizado en cada release. Pinéá un tag exacto
(`@v2.5.0`) si querés una versión congelada.

## Inputs

| Input | Default | Qué hace |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token para comentar. Necesita `pull-requests: write`. |
| `project-path` | `.` | Directorio donde correr Healify (monorepos). |
| `history-cache` | `true` | Mantener `.healify/history.jsonl` entre corridas (vía `actions/cache`) para que Healify sepa qué selectores se siguen rompiendo. `false` lo desactiva. |
| `test-log-path` | `test-output.log` | Ruta (relativa a `project-path`) al log de tests fallidos, leído en corridas `workflow_dispatch`/`schedule`. |
| `auto-pr` | `true` | En corridas `workflow_dispatch`/`schedule`, abrir una PR con los fixes aplicados. `false` aplica los fixes sin abrir PR. |
| `fail-on-unsupported` | `false` | Falla el job cuando Healify no puede analizar el log (archivo faltante, sin selectores, o error de CLI). |
| `labels` | `''` | Labels separadas por coma para la PR auto-generada. |

## Modo auto-PR (workflow_dispatch / schedule)

En `pull_request` la action solo comenta (los inputs de arriba no tienen efecto). En corridas
manuales o programadas puede **abrir una PR con los fixes aplicados**: el workflow corre tus tests
redirigiendo la salida a un archivo de log, y la action parsea ese log, extrae los selectores
rotos, aplica los fixes en una rama y abre una PR. Una plantilla de workflow lista para copiar
vive en `examples/github-action-auto-pr/healify.yml` (en `examples/`, no en `.github/workflows/`,
para que no corra dentro del propio repo Healify).

El comentario se **actualiza** en cada push en vez de apilar uno nuevo. Cero dependencias de runtime: la action habla con la API de GitHub por `fetch`, nada más.
