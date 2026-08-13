# Feature Specification: Dashboard de Eficacia

**Feature Branch**: `002-efficacy-dashboard`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "El dashboard actual muestra estadísticas de healings (totales, por framework, selectores crónicos). La nueva feature añade una sección 'Eficacia' con: gráfico de aceptación vs rechazo de fixes (barras o donut), tasa de eficacia por framework, tendencia (7/30 días) y desglose por causa de fallo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver eficacia global de fixes (Priority: P1)

El usuario abre el dashboard y ve la sección "Eficacia" con un gráfico donut/barras de fixes aceptados vs rechazados, más la tasa de eficacia global (aceptados/total) sobre datos reales de history.jsonl.

**Why this priority**: Es el valor mínimo viable: responde a la pregunta "¿mis fixes están funcionando?" que motivó la feature (feedback de comunidad sobre validación de fixes). Solo requiere datos que ya existen (`HistoryEntry.accepted`).

**Independent Test**: Inicializar un historial con entradas aceptadas y rechazadas (`healify confirm --accepted/--rejected`), servir el dashboard (`healify dashboard --serve`), y verificar que la sección muestra el desglose y la tasa correcta. Entregable utilizable sin el resto de historias.

**Acceptance Scenarios**:

1. **Given** un history.jsonl con 3 fixes aceptados y 1 rechazado, **When** se abre la sección Eficacia, **Then** se muestran 3 aceptados, 1 rechazado y una tasa de 75%.
2. **Given** un history.jsonl sin entradas, **When** se abre la sección Eficacia, **Then** se muestran ceros y el gráfico vacío sin errores.
3. **Given** un history.jsonl con entradas sin campo `accepted` (historial viejo), **When** se abre la sección, **Then** se cuentan como "sin confirmar" y el total sigue siendo correcto.

### User Story 2 - Eficacia por framework (Priority: P2)

El usuario ve la tasa de eficacia desglosada por framework (Playwright, Cypress, Selenium, WebdriverIO) para detectar frameworks donde los fixes aciertan menos.

**Why this priority**: Alto valor de diagnóstico, pero requiere extender `HistoryEntry` con `framework` y backfill tolerante, por lo que depende de un cambio de datos (foundational).

**Independent Test**: Con historial mixto (entradas Playwright y Cypress con distintos aceptados/rechazados), la sección muestra una tasa por framework correcta; entradas sin framework se agrupan como "unknown" sin romper el total.

**Acceptance Scenarios**:

1. **Given** un historial con 4 entradas Playwright (3 aceptadas) y 2 Cypress (1 aceptada), **When** se consulta eficacia por framework, **Then** Playwright muestra 75% y Cypress 50%.
2. **Given** entradas históricas sin campo `framework`, **When** se desglosa por framework, **Then** aparecen bajo "unknown" y no se pierden del total.

### User Story 3 - Tendencia y desglose por causa (Priority: P3)

El usuario ve la evolución de aceptados/rechazados en ventanas de 7 y 30 días, y el desglose por causa de fallo (selector roto, aserción, timing, etc.) para priorizar qué mejorar.

**Why this priority**: Complementa el diagnóstico pero requiere agregaciones temporales nuevas; el valor incremental es menor que US1/US2.

**Independent Test**: Con historial de varias fechas, las ventanas 7d/30d muestran solo las entradas del rango; el desglose por causa suma exactamente el total.

**Acceptance Scenarios**:

1. **Given** entradas repartidas en los últimos 40 días, **When** se selecciona ventana 7 días, **Then** solo se muestran entradas de los últimos 7 días.
2. **Given** entradas con causa 'selector', 'assertion' y 'unknown', **When** se ve el desglose por causa, **Then** cada categoría muestra su total y la suma coincide con el total general.

---

### Edge Cases

- History.jsonl corrupto o vacío → sección muestra estado vacío, no rompe el dashboard.
- Entradas con `accepted` booleano pero sin `cause` → entran en "Indeterminada".
- Dashboard servido sin historial previo (`~/.healify/stats.json` existente pero sin history.jsonl en el proyecto).
- Muchas entradas (miles): la agregación se hace server-side, no en el navegador.
- Entradas futuras (timestamps > hoy) → se ignoran en ventanas de tendencia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El dashboard MUST tener una sección/pestaña "Eficacia" accesible desde la navegación.
- **FR-002**: La sección MUST mostrar aceptados, rechazados, sin confirmar y tasa global calculados de `history.jsonl` real (no de `stats.json`).
- **FR-003**: La sección MUST mostrar la tasa de eficacia desglosada por framework, tolerando entradas sin framework ("unknown").
- **FR-004**: La sección MUST mostrar tendencia de aceptados/rechazados en ventanas de 7 y 30 días con datos agregados server-side.
- **FR-005**: La sección MUST mostrar desglose por causa de fallo usando las etiquetas de `FAILURE_CAUSE_LABEL` ("Selector roto", "Aserción", etc.).
- **FR-006**: Los gráficos MUST ser interactivos (hover con detalle) — Chart.js ya está en el stack.
- **FR-007**: `HistoryEntry` MUST registrar `framework` en nuevas entradas, con tolerancia a historiales sin el campo.
- **FR-008**: La feature MUST documentarse en README.md (EN) y README.es.md (ES).

### Key Entities

- **HistoryEntry**: registro de un healing en `.healify/history.jsonl`. Atributos: timestamp, testName, selector, status, fixedSelector, selectorType, confidence, verified?, cause?, accepted? y (nuevo) framework?.
- **EfficacyReport**: agregado server-side para la sección Eficacia. Contiene totals, byFramework, trend (7d/30d) y byCause.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los datos mostrados en Eficacia coinciden exactamente con el contenido de history.jsonl (verificación con fixture conocida en test de contrato).
- **SC-002**: El campo `framework` se escribe en el 100% de las nuevas entradas de historial sin cambiar el formato (campo opcional, back-compat).
- **SC-003**: La sección carga en < 200ms con 1.000 entradas de historial (agregación server-side).
- **SC-004**: Cobertura de reporter-core y cli no baja del 80% tras la feature.

## Assumptions

- Los datos de aceptación ya existentes (`HistoryEntry.accepted` + `healify confirm`) son la fuente de verdad; `stats.json` queda fuera del alcance (contador sin timestamps ni accepted).
- El desglose por framework usa el campo nuevo `framework` en HistoryEntry; no se cruza con `runs.jsonl` (solo cubre Playwright/Cypress).
- Chart.js + react-chartjs-2 existentes cubren donut, barras y línea; no se añaden dependencias nuevas.
- La agregación vive en el CLI (server-side) y la UI consume el endpoint `/api/stats` existente, ampliado con el reporte de eficacia.
- El rango de tendencia por defecto es 30 días, con toggle 7/30.
