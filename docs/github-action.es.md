[← Documentación](README.es.md) · [Healify](../README.es.md) · [English](github-action.md)

---

# GitHub Action

> Comenta los selectores rotos en la PR. Nunca modifica archivos.

Comenta los selectores rotos directo en la PR. Corre `doctor` + `fix --dry-run`: **nunca modifica archivos**.

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
      - uses: mescobar996/Healify@v2.3.0
```

Se referencia un tag exacto. `@v2` funciona como alias móvil de la última `2.x`, y ya está publicado.

| Input | Default | Qué hace |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token para comentar. Necesita `pull-requests: write`. |
| `project-path` | `.` | Directorio donde correr Healify (monorepos). |

El comentario se **actualiza** en cada push en vez de apilar uno nuevo. Cero dependencias de runtime: la action habla con la API de GitHub por `fetch`, nada más.
