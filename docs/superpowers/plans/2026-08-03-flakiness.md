# Plan — Detección de flakiness (gap G8)

**Origen:** `docs/research/competitive-gaps.md` § 2 (G8, P2)
**Goal:** distinguir, sobre las corridas repetidas, el test **flaky** (verde en unas corridas,
rojo en otras) del test **siempre roto** — hoy el historial no puede, porque solo guarda lo que
se rompió. Cypress Cloud y cypress-flaky-test-audit dan el score por test; Healify tiene la
fuente de datos (el reporter ve **cada** test) pero no la captura.
**Restricción:** cero dependencias; captura y análisis separados (reporter → archivo local; cli
→ lectura pura testeable); `.healify/` ya está en `.gitignore` (línea 93).

## Problema

`history.jsonl` guarda solo los selectores rotos (casos), nunca los tests que pasaron. Por eso
`computeRebroken()`/dashboard solo pueden decir "este selector apareció roto N veces" — no
pueden responder "¿es flaky o está muerto?". Un test que falla 1 de 5 corridas es un problema
distinto (y más grave de ignorar) que uno que falla 5 de 5: el primero es aleatorio, el segundo
es un defecto real. El runner de Playwright ve `onTestEnd` de cada test y el plugin de Cypress ve
`results.tests[].state` en `after:spec` — ambos descartan hoy todo lo que no falla.

## Diseño

### `reporter-core/src/runs.ts` — registro de corridas (nuevo)

Misma tolerancia y patrón que `history.jsonl` (`parseHistoryLines`): archivo JSONL,
lectura tolerante línea a línea, complemento que nunca bloquea una corrida.

- `RunOutcome`: `{ testName, testFile?, passed }` — un test de la corrida (skipped/interrupted
  NO se registran: no aportan ni pass ni fail).
- `RunRecord`: `{ type: 'run', runId, timestamp, project, framework, total, passed, failed,
  durationMs?, tests: RunOutcome[] }`. `runId` = timestamp ISO (identifica la corrida para
  agrupar resultados a lo largo del tiempo).
- `serializeRunRecord(run)` → línea JSON.
- `parseRunLines(raw): RunRecord[]` — línea corrupta se ignora.
- `appendRunRecord(run, cwd)` → appendea a `.healify/runs.jsonl` (mkdir recursive, try/catch con
  `console.warn`).
- `readRunRecords(cwd): RunRecord[]` → `[]` si no existe.

### `reporter-core/src/flake.ts` — análisis puro (nuevo)

- `FlakeVerdict = 'healthy' | 'flaky' | 'always-failing' | 'insufficient-data'`.
- `FlakyTest`: `{ testName, testFile?, runs, passed, failed, flakeRate, verdict }` —
  `flakeRate` = failed/runs (0..1).
- `detectFlakyTests(runs: RunRecord[], opts?: { minRuns?: number }): FlakyTest[]`:
  - Agrupa por `testFile` + `testName` (mismo criterio que `defectId`).
  - `runs < minRuns` (default 2) → `insufficient-data`.
  - `failed === 0` → `healthy`; `failed === runs` → `always-failing`; si no → `flaky`.
  - Orden: `flaky` primero (flakeRate desc), luego `always-failing` (failed desc), luego
    `healthy` (testName asc) — `insufficient-data` queda al final (el comando lo puede filtrar).

### `test-runner/src/reporter.ts` — captura (Playwright)

- Nuevo array `outcomes: RunOutcome[]`. En `onTestEnd`, para todo `result.status` distinto de
  skipped/interrupted, pushear `{ testName, testFile, passed: status === 'passed' }` (el
  `testFile` relativo ya existe en el método).
- En `onEnd`: armar `RunRecord` y `appendRunRecord(runRecord, process.cwd())` en el mismo
  try/catch que los reportes — es un complemento, un fallo ahí no rompe nada.

### `cypress-plugin/src/plugin.ts` — captura (Cypress)

- Nuevo array `outcomes: RunOutcome[]`. En `after:spec`, para cada `results.tests` con
  `state === 'passed' | 'failed'`, pushear `{ testName: test.title.join(' > '),
  testFile: spec.relative, passed: state === 'passed' }` (los campos ya se usan para los fallos).
- En `after:run`: armar `RunRecord` y `appendRunRecord(...)`.

### `cli/src/commands/flake.ts` — comando (nuevo)

`runFlake(args: string[], cwd): FlakeCommandResult` (patrón `commands/history.ts`):
- `readRunRecords(cwd)`; sin corridas → `ok: true` con mensaje "Todavía no hay corridas
  registradas — corré tus tests con Playwright o Cypress (reporter de Healify) al menos 2 veces."
- `detectFlakyTests(...)`, imprime tabla de `flaky` + `always-failing` (omite `healthy` y
  `insufficient-data`) con `runs`, `failed/runs` y `flakeRate`; línea de resumen: "X flaky de
  Y tests · N corridas".
- Devuelve `{ ok, lines, tests, runs }`; `index.ts` solo imprime.

### `cli/src/index.ts`

Dispatch `flake` + línea de help; fila en la tabla de comandos del README.

## Archivos

| Archivo | Cambio |
|---|---|
| `reporter-core/src/runs.ts` | nuevo: RunRecord + parse/append/read tolerante |
| `reporter-core/src/flake.ts` | nuevo: detectFlakyTests + tipos |
| `reporter-core/src/__tests__/runs.test.ts` | nuevo |
| `reporter-core/src/__tests__/flake.test.ts` | nuevo |
| `reporter-core/src/index.ts` | exports nuevos |
| `test-runner/src/reporter.ts` | captura de outcomes + RunRecord en onEnd |
| `test-runner/src/__tests__/reporter.test.ts` | tests de captura |
| `cypress-plugin/src/plugin.ts` | captura en after:spec + RunRecord en after:run |
| `cypress-plugin/src/__tests__/plugin.test.ts` | tests de captura |
| `cli/src/commands/flake.ts` | nuevo: comando |
| `cli/src/__tests__/flake-command.test.ts` | nuevo |
| `cli/src/index.ts` | dispatch + help |
| `README.md`, `CHANGELOG.md`, `docs/research/competitive-gaps.md` | docs |

## Verificación

- [x] `runs.ts`: round-trip append/read, parse tolerante, mkdir, `[]` sin archivo.
- [x] `detectFlakyTests`: agrupa por testFile+testName, verdicos (healthy/flaky/always-failing/
      insufficient-data), `minRuns`, orden, entrada vacía → `[]`.
- [x] test-runner: tras `onEnd` quedó `.healify/runs.jsonl` con los outcomes (skipped excluido).
- [x] cypress-plugin: tras `after:run` quedó `.healify/runs.jsonl` con los outcomes.
- [x] `healify flake`: sin corridas lo dice y no revienta; con corridas imprime flaky +
      always-failing y el resumen.
- [x] Build + lint + `npm test` en verde (674 tests, +21 nuevos).
- [x] README documenta `healify flake`; CHANGELOG 1.9.0; G8 pasa a cerrado en gaps.

**Fuera de alcance (posible follow-up):** sección de flakiness en el dashboard; flake por
Selenium/WebdriverIO (curan en vivo, sin concepto de suite — no pueden aportar outcomes).
