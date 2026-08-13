---

description: "Task list para el Dashboard de Eficacia"
---

# Tasks: Dashboard de Eficacia

**Input**: Design documents from `/specs/002-efficacy-dashboard/`

**Prerequisites**: plan.md (done), spec.md (done)

**Tests**: Obligatorios â€” constituciÃ³n V (tests + cobertura â‰¥80%).

**Organization**: Tasks agrupadas por user story; US1 es el MVP.

## Formato: `[ID] [P?] [Story] DescripciÃ³n`

- **[P]**: paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1/US2/US3

## Criterio de Ã©xito por tarea

Cada tarea estÃ¡ completa cuando: implementaciÃ³n hecha, tests unit/contract asociados pasan, y lint limpio en los archivos tocados.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estado del repo y disciplina de verificaciÃ³n

- [x] T001 Verificar que el repo estÃ¡ limpio y sin cambios pendientes (git status), y que `npm run verify` pasa antes de tocar nada. Criterio: verify verde en `main`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**âš ï¸ CRITICAL**: Sin esto, ninguna user story funciona. BLOCKS US1-US3.

- [x] T002 Extender `HistoryEntry` en `reporter-core/src/repertoire.ts:17-36` con campo opcional `framework?: string`. Criterio: TS compila; historiales existentes sin el campo siguen parseando (test back-compat).
- [x] T003 [P] Escribir `framework` en `appendHistory` de `cli/src/history.ts:26-54` (tomar `LocalRun.framework`; default 'unknown' si no existe). Criterio: una corrida `healify fix` graba entrada con framework; test unit nuevo.
- [x] T004 [P] Propagar `framework` en `cli/src/commands/fix-pr.ts:164` y `:225` al llamar `appendHistory`. Criterio: tests existentes de fix-pr pasan.
- [x] T005 Crear tipo `EfficacyReport` (totals, byFramework, trend, byCause) y funciÃ³n `computeEfficacyReport(entries, window)` en `cli/src/commands/dashboard-data.ts`. Criterio: unit tests con fixture conocida (3 aceptados / 1 rechazado â†’ rate 75%).

**Checkpoint**: Foundation ready â€” `npm run verify` pasa; comienzan las user stories.

---

## Phase 3: User Story 1 - Eficacia global de fixes (Priority: P1) ðŸŽ¯ MVP

**Goal**: Donut aceptaciÃ³n/rechazo + tasa global con datos reales de history.jsonl.

**Independent Test**: Fixture con 3 aceptados + 1 rechazado â†’ UI muestra 75%; sin historial â†’ ceros sin error.

### Tests para US1 âš ï¸ (escribir ANTES de implementar, deben fallar)

- [x] T006 [P] [US1] Unit test de `computeEfficacyReport` con fixture: totals correctos, rate = 75%, entradas sin `accepted` â†’ pending. En `cli/src/commands/dashboard-data.test.ts`.
- [x] T007 [P] [US1] Contract test del endpoint `/api/stats`: response incluye `efficacy.totals` con valores de la fixture. En `cli/src/commands/dashboard-routes.test.ts` (o test existente ampliado).

### ImplementaciÃ³n para US1

- [x] T008 [US1] Integrar `computeEfficacyReport` en `buildDashboardStats`/respuesta de `/api/stats` en `cli/src/commands/dashboard-routes.ts:10-26`. Criterio: `GET /api/stats` devuelve `efficacy` con totals y trend (ventana 30d default).
- [x] T009 [US1] AÃ±adir tipos `EfficacyReport`, `EfficacyTotals`, `TrendPoint` a `dashboard-web/src/types.ts` y tipar la llamada en `dashboard-web/src/api.ts`.
- [x] T010 [US1] Crear pÃ¡gina `dashboard-web/src/dashboard/EfficacyDashboard.tsx` con donut (Doughnut de react-chartjs-2) de aceptados/rechazados/pendientes + tarjeta de tasa global. Criterio: hover muestra valores; sin datos muestra "â€”" y estado vacÃ­o.
- [x] T011 [US1] Registrar ruta `/efficacy` en `dashboard-web/src/App.tsx:12-17` y enlace "Eficacia" en `dashboard-web/src/dashboard/DashboardLayout.tsx`.

**Checkpoint**: US1 funcional de forma independiente â€” dashboard sirve y la secciÃ³n muestra datos reales.

---

## Phase 4: User Story 2 - Eficacia por framework (Priority: P2)

**Goal**: Barras horizontales con tasa por framework (incl. "unknown").

**Independent Test**: Fixture mixta Playwright 3/4 y Cypress 1/2 â†’ barras 75% y 50%; entradas sin framework en "unknown".

### Tests para US2 âš ï¸

- [x] T012 [P] [US2] Unit test de `computeEfficacyReport.byFramework` con fixture mixta + entradas sin framework â†’ grupo "unknown", total no cambia.

### ImplementaciÃ³n para US2

- [x] T013 [US2] Implementar agregaciÃ³n `byFramework` en `dashboard-data.ts` (agrupar por `entry.framework ?? 'unknown'`, calcular rate por grupo).
- [x] T014 [US2] AÃ±adir grÃ¡fico de barras horizontales (Bar, indexAxis 'y') en `EfficacyDashboard.tsx` con tasas por framework.

**Checkpoint**: US1 + US2 funcionan juntas.

---

## Phase 5: User Story 3 - Tendencia y desglose por causa (Priority: P3)

**Goal**: LÃ­nea de tendencia 7/30 dÃ­as + barras por causa de fallo.

**Independent Test**: Entradas repartidas en 40 dÃ­as â†’ ventana 7d filtra bien; desglose por causa suma el total.

### Tests para US3 âš ï¸

- [x] T015 [P] [US3] Unit test de ventanas de tendencia: entradas fuera del rango se excluyen; timestamps futuros ignorados.
- [x] T016 [P] [US3] Unit test de `byCause`: agrupa por `cause` con etiquetas de `FAILURE_CAUSE_LABEL`; sin cause â†’ "Indeterminada".

### ImplementaciÃ³n para US3

- [x] T017 [US3] Agregar ventanas 7/30 en `computeEfficacyReport` (parÃ¡metro `window`), resuelto server-side vÃ­a query param `?efficacy-window=7|30` en `dashboard-routes.ts`.
- [x] T018 [US3] Agregar `byCause` en `dashboard-data.ts` mapeando a `FAILURE_CAUSE_LABEL` (importar de `reporter-core/src/failure-cause.ts:124`).
- [x] T019 [US3] GrÃ¡fico Line de tendencia con toggle 7/30 dÃ­as + grÃ¡fico Bar de causas en `EfficacyDashboard.tsx`.

**Checkpoint**: Las 3 user stories funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Calidad global, docs y gates

- [x] T020 [P] Tests de UI: `dashboard-web/src/dashboard/EfficacyDashboard.test.tsx` (render con fixture, estado vacÃ­o, hover tooltip configurado).
- [x] T021 [P] Ampliar fixture de verificaciÃ³n manual: correr `healify fix` + `healify confirm --accepted/--rejected` y `healify dashboard --serve` (verificaciÃ³n de verdad â€” constituciÃ³n V).
- [x] T022 [P] Docs: secciÃ³n "Eficacia" en README.md (EN) y README.es.md (ES); nota del comando `confirm` y del campo framework.
- [x] T023 CHANGELOG.md: entrada para la feature (Dashboard de Eficacia, vX.Y.Z).
- [x] T024 docs/project-status.md: actualizar estado y mÃ©tricas.
- [x] T025 [P] Gate final: `npm run verify`, `npm run coverage` (â‰¥80%), `npm run lint`, `npm run build --workspaces` â€” todos verdes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias.
- **Foundational (T002-T005)**: BLOCKS todas las user stories.
- **US1 (T006-T011)**: depende de Phase 2; entrega MVP.
- **US2 (T012-T014)**: depende de Phase 2 + US1 (reutiliza la pÃ¡gina).
- **US3 (T015-T019)**: depende de Phase 2 + US1 (misma pÃ¡gina y endpoint).
- **Polish (T020-T025)**: depende de todas las user stories.

### Parallel Opportunities

- T003 âˆ¥ T004 (archivos distintos).
- T006 âˆ¥ T007 (tests en archivos distintos).
- T020 âˆ¥ T021 âˆ¥ T022 âˆ¥ T025.
- T015 âˆ¥ T016 (tests distintos).

### Within Each User Story

- Tests primero (deben fallar) â†’ implementaciÃ³n â†’ lint â†’ commit.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001-T005 (Setup + Foundational)
2. T006-T011 (US1) â†’ **STOP y VALIDATE**: fixture real, `healify dashboard --serve`
3. Deploy/demo si estÃ¡ listo

### Incremental Delivery

1. Foundation â†’ US1 (MVP: donut + tasa) â†’ test independiente
2. US2 (barras por framework) â†’ test independiente
3. US3 (tendencia + causas) â†’ test independiente
4. Polish (docs + gates)

## Notes

- El campo `framework` es OPCIONAL (back-compat, constituciÃ³n IV y V).
- No se aÃ±aden dependencias npm nuevas (Chart.js ya existe).
- `rate` es `number | null` cuando no hay confirmados (evita 0/0).
- Commit tras cada tarea o grupo lÃ³gico.
