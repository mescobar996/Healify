# Implementation Plan: Dashboard de Eficacia

**Branch**: `002-efficacy-dashboard` | **Date**: 2026-08-13 | **Spec**: `docs/specs/002-efficacy-dashboard/spec.md`

**Input**: Feature specification from `docs/specs/002-efficacy-dashboard/spec.md`

## Summary

Añadir al dashboard de Healify una sección "Eficacia" que muestra, con datos reales de `.healify/history.jsonl`: aceptación vs rechazo de fixes (donut), tasa por framework (barras), tendencia 7/30 días (línea) y desglose por causa de fallo (barras). Requiere: (1) registrar `framework` en `HistoryEntry` (campo opcional, back-compat), (2) agregar agregaciones server-side en el CLI, (3) nueva página React con Chart.js.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js, React 18.3 + Vite 6

**Primary Dependencies**: chart.js ^4.4.7 + react-chartjs-2 ^5.2.0 (ya en dashboard-web), Express (dashboard-app.ts). Sin dependencias nuevas.

**Storage**: `.healify/history.jsonl` (JSONL, fuente de verdad); `~/.healify/stats.json` queda fuera de alcance.

**Testing**: Vitest (reporter-core, cli, dashboard-web), @vitest/coverage-v8, Testing Library.

**Target Platform**: CLI local + navegador (dashboard en `http://localhost:5173`).

**Project Type**: monorepo npm workspaces (reporter-core, cli, dashboard-web).

**Performance Goals**: agregación server-side; sección carga < 200ms con 1.000 entradas.

**Constraints**: 100% local, determinista, sin nuevas dependencias, back-compat total con historiales existentes (campos `cause`, `accepted` ya son opcionales; `framework` lo será también).

**Scale/Scope**: historial típico < 10k entradas; UI simple de 4 gráficos.

## Constitution Check

*GATE: passed.*

| Principio | Cumplimiento |
|---|---|
| I. 100% Local | Sí: todo se agrega localmente en el CLI; la UI consume solo endpoints locales. |
| II. Heurística, no IA | Sí: solo agrega datos ya recolectados; no añade generación ni IA. |
| III. Determinista | Sí: agregaciones puras sobre history.jsonl. |
| IV. Multi-Framework | Sí: se añade campo `framework` explícito a HistoryEntry (nunca inferido). |
| V. Calidad/Tests | Sí: tests de contrato para el reporte, unit para agregación; cobertura ≥80%. |
| VI. Docs EN/ES | Sí: README.md + README.es.md + CHANGELOG.md + project-status.md. |
| VII. Dashboard | Sí: es la feature misma; gráficos interactivos, datos reales, estado vacío manejado. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/002-efficacy-dashboard/
├── spec.md              # Done (Spec Kit Paso 4)
├── plan.md              # This file (Paso 5)
└── tasks.md             # Phase 2 output (Paso 6)
```

### Source Code (repository root)

```text
reporter-core/src/
├── repertoire.ts            # + HistoryEntry.framework?: string (opcional)
└── failure-cause.ts         # (sin cambios; reutiliza FAILURE_CAUSE_LABEL)

cli/src/
├── history.ts               # appendHistory: escribir framework (desde LocalRun.framework)
├── commands/
│   ├── fix-pr.ts            # pasar framework al escribir historial
│   ├── dashboard-data.ts    # + computeEfficacyReport: totals, byFramework, trend, byCause
│   ├── dashboard-routes.ts  # /api/stats incluye efficacy report
│   └── dashboard-serve.ts   # (sin cambios)
└── (test) dashboard-data.test.ts  # fixture con entradas conocidas

dashboard-web/src/
├── types.ts                 # + EfficacyReport y sub-tipos
├── api.ts                   # tipar response de /api/stats con efficacy
├── App.tsx                  # + ruta /efficacy
├── dashboard/
│   ├── DashboardLayout.tsx  # + enlace nav "Eficacia"
│   └── EfficacyDashboard.tsx  # NUEVO: donut + barras framework + línea tendencia + barras causa
└── (test) EfficacyDashboard.test.tsx
```

**Structure Decision**: Se mantiene la estructura existente del monorepo. El reporte de eficacia es un campo adicional del endpoint `/api/stats` ya existente (dashboard-routes.ts), evitando un endpoint nuevo. La UI es una página nueva siguiendo el patrón de `ChronicSelectors.tsx`.

## Data Model

```ts
// reporter-core/src/repertoire.ts (extensión)
interface HistoryEntry {
  // ...existentes
  framework?: string   // NUEVO: opcional, back-compat; 'playwright'|'cypress'|'selenium'|'webdriverio'|'unknown'
}

// cli/src/commands/dashboard-data.ts (nuevo tipo)
interface EfficacyReport {
  totals: { accepted: number; rejected: number; pending: number; rate: number | null }
  byFramework: Record<string, FrameworkEfficacy>
  trend: TrendPoint[]                    // diario, ventana seleccionable 7/30
  byCause: Record<string, CauseEfficacy>
}
interface FrameworkEfficacy { accepted: number; rejected: number; pending: number; rate: number | null }
interface TrendPoint { date: string; accepted: number; rejected: number }
interface CauseEfficacy { accepted: number; rejected: number; total: number }
```

- `rate = null` cuando no hay entradas confirmadas (evita 0/0 = NaN).
- Agregación: `computeEfficacyReport(entries: HistoryEntry[], windowDays: 7 | 30)`.
- Ventana de tendencia se calcula server-side y el toggle 7/30 se resuelve con un parámetro de consulta (`?efficacy-window=7|30`) para cumplir SC-003 (sin re-agregar en el navegador). Los 4 gráficos se alimentan del mismo reporte.

## Risks

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Historiales viejos sin `framework` distorsionan la tasa | Alta | Media | Agrupar en "unknown", documentado en spec (US2-AC2) y en UI (tooltip) |
| 0/0 produce NaN o división inválida | Media | Media | `rate: number \| null`, UI muestra "—" |
| JSONL corrupto rompe el dashboard | Baja | Alta | Reutilizar parse tolerante existente (`parseHistoryLines`); estado vacío en UI |
| Toggle 7/30 en cliente causa datos inconsistentes | Baja | Media | Ventana resuelta server-side por query param |
| Cambio de HistoryEntry rompe tests existentes | Media | Baja | Campo opcional; correr `npm run verify` completo |

## Estimation

| Área | Esfuerzo |
|---|---|
| reporter-core: campo `framework` + tests | 0.5h |
| cli: escritura framework + reporte de eficacia + tests | 1.5h |
| dashboard-web: tipos, API, página, ruta, nav + tests | 2h |
| Verificación (verify, coverage, lint, build) | 0.5h |
| Documentación (README EN/ES, CHANGELOG, project-status) | 0.5h |
| **Total** | **5h** |
