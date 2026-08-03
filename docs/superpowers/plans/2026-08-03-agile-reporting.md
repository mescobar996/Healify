# Plan — Reporte de defectos a herramientas ágiles (gap G18)

**Origen:** `docs/research/competitive-gaps.md` § 4 (G18, P1, en curso)
**Goal:** cerrar el loop "selector roto → ticket en Jira (o webhook)" sin romper el pitch de
Healify: 100% local, sin IA, sin nube intermedia. El reporte es **opt-in, off por default**; la
única salida de datos es el POST del usuario contra **su propia** instancia con **sus**
credenciales.
**Restricción:** cero dependencias (fetch puro, patrón `gh-action/github-api.js`), todo testeable
con `fetch` inyectable.

## Problema

`healify-report.md` cierra con "listo para pegar en un ticket de Jira/Redmine". Ese pegado es
manual: el defecto sale del motor y muere en un archivo. La investigación de campo (G18) muestra
que el dolor real de los equipos no es generar el reporte sino el **ruido**: tickets duplicados
por el mismo fallo, cascadas que inundan el backlog, y cero traceability del hallazgo a la
resolución. El patrón que la competencia ya estableció es "webhook → JQL lookup por clave estable
→ crear si no existe / comentar si existe", y los test managers SaaS lo cobran con nube y API key
— justo lo que Healify no quiere ser.

El `defectId` de Healify (`HLF-XXXXXXXX`, sha1 estable de archivo+selector, ya existente en
`qa-report.ts`) es la clave de dedupe perfecta: el mismo selector roto devuelve el mismo ID en
cada corrida, así que un JQL `text ~ "HLF-XXXXXXXX"` lo encuentra igual siempre.

## Diseño

### Config — `reporter-core/src/config.ts`

Bloque nuevo `agile` en `HealifyConfig`, **opt-in por defecto** (el silencio nunca reporta nada):

| Campo | Default | Notas |
|---|---|---|
| `agile.enabled` | `false` | Opt-in explícito |
| `agile.provider` | `'jira'` | `'jira'` \| `'webhook'` |
| `agile.baseUrl` | — | `https://<site>.atlassian.net` (Jira) |
| `agile.email` | — | usuario Jira |
| `agile.apiToken` | — | token API Jira (credencial del usuario) |
| `agile.project` | — | key del proyecto (ej. `QA`) |
| `agile.issueType` | `'Bug'` | tipo de issue |
| `agile.priorityBySeverity` | `{blocker:'Highest', major:'High', minor:'Medium'}` | mapeo severidad→prioridad |
| `agile.labels` | `[]` | labels extra (ej. `healify`) |
| `agile.webhookUrl` | — | URL de webhook (Zapier/n8n/automatización Jira) |

- **Env overrides** (para CI y para no commitear secretos):
  `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`,
  `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_WEBHOOK_URL`.
  El token **solo** se lee de env o config — jamás se loguea.
- `validateConfig` (que hoy descarta campos desconocidos) debe **admitir el bloque `agile`**
  saneado; un `provider` inválido cae a `'jira'`.
- `resolveAgile(config)` devuelve la config resuelta con defaults.

### `reporter-core/src/agile.ts` — payload y orquestador

- `interface AgileDefect`: `defectId, severity, title, description, priority, labels,
  selector, testFile, expected?, actual?, steps[], environmentRows[], suggestion?`
- `buildAgileDefects(run: LocalRun): AgileDefect[]` — traduce cada `LocalCaseResult` a un
  defecto. El **título** incluye el `defectId` (`[HLF-XXXXXXXX] <testName>`); la **descripción**
  reusa el markdown de `qa-report.ts` (expected/actual/steps/selector/evidencia). La **sugerencia**
  (fixedSelector + confidence + verified + explanation + alternatives) viaja como
  **comentario/contexto del ticket**, nunca borra el rastro del hallazgo.
- `reportDefects(run, config, deps): Promise<AgileReportResult>` — orquestador:
  - `agile.enabled !== true` → `{ enabled: false, outcomes: [] }` (no-op, cero fetch).
  - Por cada defecto:
    - **Jira**: `searchByDefectId` (JQL `text ~ "<defectId>" AND project = <project>`) →
      si existe, outcome `'existing'` (no se crea nada, no se duplica); si no existe,
      `createIssue` + `addComment` (la sugerencia) → outcome `'created'` con key.
    - **Webhook**: `POST` del payload JSON al `webhookUrl` — el create-or-update lo hace el
      receptor (Zapier/n8n/automatización de Jira con su lookupIssues). Outcome `'sent'`.
  - Un fallo de red/4xx/5xx por defecto → outcome `'failed'` con mensaje; **no tira** la corrida
    completa (el reporte local nunca se pierde por un 503 de Jira).

### Cliente Jira — `reporter-core/src/jira.ts`

Mismo patrón que `gh-action/github-api.js`: `createJiraClient(config, fetchImpl =
globalThis.fetch)`, cero deps. Basic auth `Authorization: Basic base64(email:token)`.
Endpoints mínimos de la API Cloud v3:
- `searchByDefectId(project, defectId)` → GET `/rest/api/3/search?jql=...` (escapado), primera
  página, devuelve `issues[0].key` o `null`.
- `createIssue({project, issueType, summary, description, priority, labels})` →
  POST `/rest/api/3/issue` → devuelve `key`.
- `addComment(issueKey, body)` → POST `/rest/api/3/issue/{key}/comment`.
- Error no-2xx → throw con status + snippet del cuerpo (el cuerpo de Jira explica permisos, como
  el 403 de GitHub en `github-api.js`).

### Webhook — `reporter-core/src/webhook.ts`

`postJson(url, body, fetchImpl)` → POST `application/json`, no-2xx → throw con status.

### CLI — `healify report`

`healify report [reporte.json] [--dry-run]` — lógica testeable en `cli/src/commands/report.ts`
(patrón `commands/history.ts`/`heal.ts`), `index.ts` solo parsea args.
- Lee el `LocalRun` JSON (default `healify-report.json`), carga `loadConfig(cwd)`, llama
  `reportDefects`.
- `--dry-run`: imprime qué se crearía/encontraría **sin tocar la red**.
- Salida: resumen `N creados · M ya existían · K fallidos`; si `agile` está off, lo dice y no hace
  nada.

## Archivos

| Archivo | Cambio |
|---|---|
| `reporter-core/src/config.ts` | bloque `agile` + env overrides + `resolveAgile` |
| `reporter-core/src/agile.ts` | nuevo: `AgileDefect`, `buildAgileDefects`, `reportDefects` |
| `reporter-core/src/jira.ts` | nuevo: `createJiraClient` (fetch puro) |
| `reporter-core/src/webhook.ts` | nuevo: `postJson` |
| `reporter-core/src/index.ts` | exports nuevos |
| `cli/src/commands/report.ts` | nuevo: lógica del comando |
| `cli/src/index.ts` | dispatch `report` + help |
| `reporter-core/src/__tests__/config.test.ts` | tests bloque `agile` + env |
| `reporter-core/src/__tests__/agile.test.ts` | nuevo: payload + orquestador (fetch mock) |
| `reporter-core/src/__tests__/jira.test.ts` | nuevo: cliente Jira (fetch mock) |
| `cli/src/__tests__/report-command.test.ts` | nuevo: comando + `--dry-run` |

## Verificación

- [x] `agile` ausente o `enabled: false` → `reportDefects` no hace ningún fetch.
- [x] `agile.enabled: true` + Jira: defecto nuevo → crea issue + comentario con la sugerencia.
- [x] Mismo `defectId` en otra corrida → `existing`, no se duplica el ticket (0 POSTs de create).
- [x] Severidad→prioridad: `blocker→Highest`, `major→High`, `minor→Medium`; `priorityBySeverity`
      custom la pisa.
- [x] Webhook: POST del payload JSON; no-2xx → outcome `failed` sin romper la corrida.
- [x] Jira: header `Authorization` es `Basic base64(email:token)`; JQL escapa el `defectId`.
- [x] El token Jira jamás aparece en logs/salida (ni en `--dry-run`).
- [x] `healify report --dry-run` no toca la red.
- [x] Sin config `agile`, `healify report` avisa que está desactivado y no hace nada.
- [x] Build + lint + `npm test` en verde (601 + 37 = 638).
- [x] README documenta la modalidad tan explícita como "Cadena de custodia": opt-in, credenciales
      del usuario contra su instancia, cero datos fuera de la máquina del usuario.
