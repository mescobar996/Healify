[← Documentación](README.es.md) · [Healify](../README.es.md) · [English](jira.md)

---

# Reporte de defectos: Jira, GitHub Issues, webhook

> Opt-in y apagado por default. Tus credenciales contra tu instancia — Healify no tiene servidor propio.

Cierra el loop "selector roto → ticket". Con la misma seriedad que **Cadena de custodia**, tres reglas que no se negocian:

1. **Opt-in, off por default.** Sin `agile.enabled: true` Healify nunca toca la red.
2. **Tus credenciales contra TU instancia.** El token lo ponés vos, se lee del entorno para no commitearlo, y solo se usa para autenticarte contra **tu** Jira o **tu** repo. Jamás se loguea.
3. **Cero datos fuera de tu máquina.** La única salida es el POST hacia tu gestor. No hay nube de Healify, no hay API key nuestra, no hay tracking.

## Elegí el destino

| Provider | Para quién | Qué necesita |
|---|---|---|
| `jira` | Equipos con Jira Cloud | `baseUrl`, `email`, `apiToken`, `project` |
| `github` | Cualquiera con el código en GitHub | `repository`, `apiToken` |
| `webhook` | Zapier, n8n, o un gestor que no está en la lista | `webhookUrl` |

### GitHub Issues

Lo más rápido de poner en marcha: si tu código está en GitHub, ya tenés todo.

```js
module.exports = {
  agile: {
    enabled: true,
    provider: 'github',
    repository: 'tu-usuario/tu-repo',
    apiToken: process.env.HEALIFY_GITHUB_TOKEN,
    labels: ['healify', 'selector-roto'],
  },
}
```

En un workflow alcanza con el token que GitHub ya te da:

```yaml
permissions:
  issues: write        # ← sin esto el token no puede crear issues

steps:
  - run: npx playwright test
    continue-on-error: true
  - run: npx healify report
    env:
      HEALIFY_AGILE_ENABLED: 'true'
      HEALIFY_AGILE_PROVIDER: github
      HEALIFY_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> El token se lee de `HEALIFY_GITHUB_TOKEN` y **no** de `GITHUB_TOKEN` a secas, aunque el runner exporte esa variable en todo workflow. Tomarla sola convertiría un `healify report` mal configurado en un intento silencioso de escribir en tu repo: activarlo tiene que ser una decisión escrita.

### Jira Cloud

```js
module.exports = {
  agile: {
    enabled: true,
    provider: 'jira',
    baseUrl: 'https://tu-equipo.atlassian.net',
    email: 'qa@tu-equipo.com',
    apiToken: process.env.JIRA_API_TOKEN,
    project: 'QA',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: ['healify'],

    attachEvidence: true,          // sube el screenshot del fallo al ticket
    transitionOnHealed: 'Done',    // cierra el ticket cuando Healify resuelve el selector
  },
}
```

## Todas las opciones

| Opción | Default | Qué hace |
|---|---|---|
| `agile.enabled` | `false` | Activa el reporte. Sin esto, no-op. |
| `agile.provider` | `jira` | `jira`, `github` o `webhook`. |
| `agile.baseUrl` | — | Jira: tu instancia. GitHub: solo para GitHub Enterprise. |
| `agile.email` | — | Solo Jira. |
| `agile.apiToken` | — | Jira: token de API. GitHub: token con scope `repo`. |
| `agile.repository` | `GITHUB_REPOSITORY` | Solo GitHub, formato `owner/repo`. |
| `agile.project` | — | Solo Jira. Key del proyecto, ej. `QA`. |
| `agile.issueType` | `Bug` | Solo Jira. |
| `agile.priorityBySeverity` | `blocker→Highest, major→High, minor→Medium` | Mapeo severidad→prioridad. |
| `agile.labels` | `[]` | Labels del ticket. |
| `agile.attachEvidence` | `false` | Sube screenshots y traces al ticket. Solo Jira. |
| `agile.transitionOnHealed` | — | Estado al que mover el ticket cuando Healify resuelve y **verifica** el selector. Solo Jira. |
| `agile.webhookUrl` | — | Solo webhook. |

Env para CI: `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_GITHUB_TOKEN`, `HEALIFY_GITHUB_REPOSITORY`, `HEALIFY_WEBHOOK_URL`.

## Correlo

```bash
healify report                 # reporta healify-report.json
healify report --dry-run       # qué se reportaría, sin tocar la red
```

## Por qué no te llena el backlog

Cada defecto lleva un `defectId` estable (`HLF-XXXXXXXX`, sha1 de archivo + selector): el mismo selector roto devuelve el mismo ID en cada corrida.

Antes de crear nada, Healify pregunta si ese defecto ya existe. Si existe, **comenta en el ticket que ya está** en vez de abrir otro. Sin esto, un selector roto que nadie arregla generaría un ticket por cada corrida de CI, y el backlog sería inservible en una semana.

Un 503 de tu gestor no pierde el reporte local: falla ese defecto, no la corrida.

Con `provider: 'webhook'` el dedupe queda de tu lado — Healify POSTea el payload con el `defectId` adentro, y es tu automatización la que decide crear o actualizar.

## Dos detalles que solo aparecen usándolo

**La evidencia.** Sin `attachEvidence`, el ticket lista el screenshot como un link a `test-results/checkout/fallo.png` — una ruta en el disco de quien corrió los tests, que para el que abre el ticket no existe. Con la opción activada, el archivo se sube de verdad. Es opt-in aparte de `enabled` porque una captura de un entorno de prueba puede tener datos reales adentro, y esa decisión no la toma Healify.

**La transición.** `transitionOnHealed` solo dispara cuando el caso viene `healed` **y** `verified`: o sea cuando Healify encontró el elemento en la página, no cuando dedujo un nombre plausible. Si el workflow de tu proyecto no tiene esa transición disponible, el ticket queda creado igual y no se rompe nada.
