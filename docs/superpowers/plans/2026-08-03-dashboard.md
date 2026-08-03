# Plan — Dashboard/histórico de healings (gap G7)

**Origen:** `docs/research/competitive-gaps.md` § 2 (G7, P1)
**Goal:** que el "HTML lindo" (`healify-report.html`), que hoy es solo de la **última** corrida,
cubra también el histórico: un dashboard HTML offline de `.healify/history.jsonl` — el mismo
estándar visual de dark/light que el reporte, sin tocar la red, sin dependencias nuevas.
**Restricción:** cero dependencias; lógica pura testeable separada del I/O, mismo patrón que
`renderLocalReportHtml` (reporter-core) + comando fino (cli).

## Problema

`healify history` muestra texto plano en consola (top recurrentes + re-rotos), y el HTML que un
QA puede abrir en el browser (`healify-report.html`) es solo de la última corrida. El histórico
ya existe (`history.jsonl` graba todos los casos desde 1.2.0) pero nadie lo puede *ver* de forma
visual: no hay tendencia (¿está mejorando o empeorando la salud de los selectores?), no hay una
vista consolidada de recurrentes/re-rotos que un lead pueda abrir en una daily.

## Diseño

### `reporter-core/src/dashboard.ts` — stats puras + render (nuevo)

- **Mover** `computeTopRecurrent` / `computeRebroken` + tipos `RecurrentSelector` /
  `RebrokenSelector` desde `cli/src/history.ts` acá (una sola implementación canónica, como
  `parseHistoryLines`). `cli/src/history.ts` los re-exporta → `healify history` y sus tests
  quedan intactos.
- `buildDashboardStats(entries: HistoryEntry[]): DashboardStats`:
  - `total`, `healed`, `review`, `unresolved`, `healedRate` (healed/total, 0..1)
  - `firstSeen` / `lastSeen` (timestamp ISO de la primera/última entrada, o `null`)
  - `topRecurrent` (vía `computeTopRecurrent`), `rebroken` (vía `computeRebroken`)
  - `timeline: TimelinePoint[]` — agrupa por día (fecha UTC `YYYY-MM-DD`, determinista para
    tests) con `healed/review/unresolved`, orden ascendente.
- `renderDashboardHtml(stats: DashboardStats): string` — HTML autocontenido offline, misma
  paleta de variables CSS de `renderLocalReportHtml` (dark/light vía `prefers-color-scheme` y
  toggle `data-theme`): masthead + tarjetas de resumen + timeline de barras (CSS puro, sin
  librerías) + lista de top recurrentes + lista de re-rotos. Escapa todo lo que viene del
  historial (selectores, fixedSelectors).

### `cli/src/history.ts` — re-export

Quitar las definiciones movidas; importar y re-exportar desde `@healify/reporter-core`. El
contrato público del módulo (y de `healify history`) no cambia.

### `cli/src/commands/dashboard.ts` — comando (nuevo)

`runDashboard(args: string[], cwd): DashboardCommandResult` (patrón `commands/history.ts`):
- `--out <path>` para el archivo de salida (default `healify-dashboard.html`).
- Lee `readHistory(cwd)`, `buildDashboardStats`, `renderDashboardHtml`, escribe con
  `writeFileSync`.
- Sin historial → `ok: true` con mensaje "Todavía no hay historial — corré healify fix..." y no
  escribe archivo.
- Devuelve `{ ok, outPath, stats, lines }`; `index.ts` solo imprime las `lines`.

### `cli/src/index.ts`

Dispatch `dashboard` + línea de help, y el comando en la tabla de comandos del README.

## Archivos

| Archivo | Cambio |
|---|---|
| `reporter-core/src/dashboard.ts` | nuevo: stats + render + funciones movidas |
| `reporter-core/src/__tests__/dashboard.test.ts` | nuevo: stats + render (puro) |
| `reporter-core/src/index.ts` | exports nuevos |
| `cli/src/history.ts` | sacar funciones movidas, re-exportar |
| `cli/src/commands/dashboard.ts` | nuevo: comando |
| `cli/src/__tests__/dashboard-command.test.ts` | nuevo: comando + `--out` |
| `cli/src/index.ts` | dispatch + help |
| `README.md`, `CHANGELOG.md`, `docs/research/competitive-gaps.md` | docs |

## Verificación

- [x] `healify history` sigue igual tras mover las funciones (tests existentes verdes).
- [x] `buildDashboardStats`: totales, `healedRate`, `firstSeen`/`lastSeen`, agrupación por día.
- [x] `buildDashboardStats([])` → `total: 0`, `healedRate: 0`, `timeline: []` (no revienta).
- [x] `renderDashboardHtml`: incluye el título, las cifras de las tarjetas, timeline y listas;
      escapa selectores (`<`/`>`/`&`); dark/light presente.
- [x] `healify dashboard` escribe el archivo y reporta las cifras; sin historial no escribe y
      lo dice.
- [x] `--out` respeta el path pedido.
- [x] Build + lint + `npm test` en verde (638 + nuevos → 662).
- [x] README documenta `healify dashboard`; CHANGELOG 1.8.0; G7 pasa a cerrado en gaps.

## Ejecución

- `reporter-core/src/dashboard.ts` + `reporter-core/src/__tests__/dashboard.test.ts` (11 tests).
- `cli/src/history.ts` re-exporta `computeTopRecurrent`/`computeRebroken`/tipos desde reporter-core.
- `cli/src/commands/dashboard.ts` + `cli/src/__tests__/dashboard-command.test.ts` (4 tests).
- Smoke test real: `node cli/dist/index.js dashboard` sobre un fixture de 3 entradas →
  `healify-dashboard.html` (8.5 KB) con "3 entradas · 67% curadas · 1 re-rotos"; `--out otro.html` funciona.
