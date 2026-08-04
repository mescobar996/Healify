[← Documentación](README.es.md) · [Healify](../README.es.md) · [English](jira.md)

---

# Reporte a Jira / webhook

> Opt-in y apagado por default. Tus credenciales contra tu instancia — Healify no tiene servidor propio.

Cierra el loop "selector roto → ticket en Jira". Con la misma seriedad que **Cadena de custodia**, tres reglas que no se negocian:

1. **Opt-in, off por default.** Sin `agile.enabled: true` Healify nunca toca la red. El silencio no reporta nada.
2. **Tus credenciales contra TU instancia.** El token Jira lo ponés vos, se lee de config o de `JIRA_API_TOKEN` (para no commitearlo), y solo se usa para autenticarte contra **tu** Jira. Jamás se loguea, y nunca sale hacia ningún lado que no sea tu servidor.
3. **Cero datos fuera de tu máquina.** La única salida de datos cuando activás el reporte es el POST hacia **tu** Jira (o **tu** webhook). No hay nube de Healify, no hay API key nuestra, no hay tracking.

Config en `healify.config.js`:

```js
module.exports = {
  agile: {
    enabled: true,          // ← sin esto, nada se reporta
    provider: 'jira',       // 'jira' | 'webhook'
    baseUrl: 'https://tu-equipo.atlassian.net',
    email: 'qa@tu-equipo.com',
    apiToken: process.env.JIRA_API_TOKEN,   // o solo JIRA_API_TOKEN en el entorno
    project: 'QA',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: ['healify'],
  },
}
```

| Opción | Default | Qué hace |
|---|---|---|
| `agile.enabled` | `false` | Activa el reporte. Sin esto, no-op. |
| `agile.provider` | `jira` | `jira` (REST Cloud) o `webhook` (Zapier/n8n/automatización Jira). |
| `agile.baseUrl` | — | Base de tu Jira Cloud, ej. `https://tu-equipo.atlassian.net`. |
| `agile.email` / `agile.apiToken` | — | Credenciales del usuario contra su instancia. |
| `agile.project` | — | Key del proyecto, ej. `QA`. |
| `agile.issueType` | `Bug` | Tipo de issue. |
| `agile.priorityBySeverity` | `blocker→Highest, major→High, minor→Medium` | Mapeo severidad→prioridad. |
| `agile.labels` | `[]` | Labels extra para el ticket. |
| `agile.webhookUrl` | — | URL del webhook (solo provider `webhook`). |

Env overrides para CI: `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_WEBHOOK_URL`.

Reportá la última corrida:

```bash
healify report                 # reporta healify-report.json a tu Jira
healify report --dry-run       # qué se reportaría, sin tocar la red
```

**Cómo funciona y por qué no genera ruido.** Cada defecto lleva un `defectId` estable (`HLF-XXXXXXXX`, sha1 de archivo+selector): el mismo selector roto devuelve el mismo ID en cada corrida. Antes de crear un ticket, Healify pregunta a tu Jira (`text ~ "HLF-XXXXXXXX" AND project = QA`) si ese defecto ya existe: si existe, **no crea nada nuevo** (outcome `ya existía`); si no, crea el issue **y** agrega como comentario la sugerencia del selector. La sugerencia viaja como contexto del ticket — nunca reemplaza el hallazgo. Un 503 de tu Jira no pierde el reporte local: falla ese defecto, no la corrida.

Con `provider: 'webhook'`, Healify POSTea el payload JSON (defecto + sugerencia + entorno) a tu URL y es el receptor quien decide crear-o-actualizar — el patrón que la competencia ya estableció ("webhook → JQL lookup por clave estable → crear si no existe / comentar si existe").
