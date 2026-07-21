# Healify v2 — evaluación de herramientas complementarias de gobernanza

**Fecha:** 2026-07-21
**Estado:** Aprobado, pendiente de implementación (solo §3 `gate`)
**Autor:** Claude (arquitecto v2, sesión de solo-lectura — no se modificó código)

## 0. Cómo leer este documento

El pedido original era diseñar 6 herramientas (`gate`, `tribunal`, `farm`, `score`, `audit`, `cli`) inspiradas en patrones de proyectos externos (`codeArbiter`, `healenium`, `playwright-smart-reporter`). Ese pedido era un brainstorm de ideas, no un plan ya validado — el propio autor lo aclaró a mitad de la sesión.

Antes de diseñar arquitectura para las 6, se hizo una evaluación crítica de cada una contra el estado real del código (no contra lo deseable en abstracto). Resultado: **una** de las seis (`gate`) tiene caso de negocio inmediato y costo bajo; las otras cinco quedan documentadas con su evaluación y diferidas. §2 tiene el detalle de esa evaluación. §3 tiene el diseño completo de `gate`, que es lo único que pasa a plan de implementación.

## 1. Contexto de partida

Confirmado por lectura directa del código en `C:\Proyectos\QA\Healify` (no asumido):

- Las 11 tareas del plan `2026-07-20-test-reporter-packages` están completas en `main` (`reporter-core`, `test-runner`, `cypress-plugin`). Los commits `d3c4d79` y `fb7adaf` resolvieron el backlog que el `EXECUTION-LOG.md` dejaba pendiente (timeout, ANSI, empaquetado con esbuild, bugs de `/docs`/`/connect`), sin que el log se actualizara. Detalle completo en `CONTEXT_DUMP_PARA_META_AI.md`.
- `Project.autoHealThreshold` (`Float @default(0.85)`, `prisma/schema.prisma:148`) existe desde el modelo original pero **no lo lee ningún caller**. El umbral real usado hoy es `0.95` hardcodeado en tres lugares independientes: `src/app/api/v1/report/route.ts:137`, `src/workers/lib/healing-ops.ts:99`, `src/lib/github/auto-pr.ts:10` (`AUTO_PR_CONFIDENCE_THRESHOLD`).
- `SelectorAnalyzer` (`src/lib/selector-analyzer.ts`) ya calcula un score 0–1 con penalización por `nth-child`, xpath absoluto y clases hasheadas, y bonificación por `data-testid`/`aria-*`. Se usa desde exactamente un endpoint, `src/app/api/selectors/route.ts`. Ese endpoint **no tiene ningún consumidor** — `src/lib/api.ts:166` define `getSelectors()` pero no hay ningún componente de dashboard que lo llame. Confirmado por grep completo de `src/app`.
- `/api/v1/report` (el endpoint que consumen `test-runner`/`cypress-plugin`) **no dispara `tryOpenAutoPR()`**. El auto-PR real solo se dispara desde dos rutas: `src/app/api/test-runs/[id]/heal/route.ts:218` y `src/app/api/demo/run/route.ts:104`.
- El hallazgo crítico 🔴 del `qa-reports/Informe-Dev-Healify.md` (scope de OAuth de GitHub insuficiente para auto-PR) tiene su fix de scope aplicado (`d3c4d79`), pero el propio informe deja como verificación pendiente genuina si el error original ("Bad credentials") era *solo* el scope o si además había un `access_token` corrupto — no hay evidencia en el repo de un re-login real posterior al fix que lo confirme.
- `git log` muestra `aa4aa76 feat(pricing): disable checkout and hide pricing nav link` — el checkout está deshabilitado al momento de este spec. No hay evidencia de clientes pagos activos.
- Directorios excluidos de esta sesión por instrucción explícita del autor: `reporter-core/`, `test-runner/`, `cypress-plugin/`, `src/workers/` (el worker). Todo lo diseñado abajo respeta esa exclusión.

## 2. Evaluación de las 6 ideas originales

| Herramienta | Veredicto | Por qué |
|---|---|---|
| **gate** | Construir ahora (§3) | Costo casi cero: cierra una inconsistencia ya existente (`autoHealThreshold` sin usar) en vez de agregar una feature nueva desde cero. |
| **score** | No construir un tool nuevo | La lógica (`SelectorAnalyzer`) y el endpoint (`/api/selectors`) ya existen y están sin usar. El problema real no es "falta la herramienta", es que la que ya se construyó nunca se conectó a una página de dashboard. Construir un CLI/paquete nuevo antes de resolver eso duplica trabajo. Recomendación fuera de este spec: conectar `/api/selectors` a una página existente del dashboard; si después de eso queda demanda real de acceso vía CLI, ahí sí amerita su propio diseño. |
| **audit** | Diferido | `HealingEvent` ya es, de hecho, un log de decisiones append-only (error, DOM, selector viejo/nuevo, confidence, `appliedBy`; ningún campo histórico se pisa). No hay señal en el repo de que algún usuario lo haya pedido, y no hay clientes pagos (checkout deshabilitado). Es un pedido típico de comprador enterprise ya evaluando el producto, no un problema activo hoy. |
| **tribunal** | Diferido, y separado conceptualmente | Es análisis estático del repo del cliente (selectores duplicados, `waitForTimeout`, `cy.wait()`) — no tiene relación con el motor de healing con IA, que es el corazón de Healify. Meterlo en "v2 de gobernanza" diluye foco. Podría tener valor como lead magnet standalone en el futuro, pero es una decisión de producto separada de este spec. |
| **farm** | Diferido — invierte el orden de prioridades | El propio informe QA deja abierto si el auto-PR funciona de punta a punta hoy (posible token corrupto post-fix de scope, nunca reconfirmado con un re-login real). Construir una "verification farm" que ponga un sello `verified-by-farm` de confianza sobre un mecanismo de PR cuya fiabilidad de base no está reconfirmada es blindar algo que no se sabe si funciona. |
| **cli** | Diferido, depende de las anteriores | Si `gate` queda server-side puro y `score`/`audit` no se construyen como herramientas separadas, no hay ≥2 subcomandos reales que unificar. Se reevalúa si en el futuro se construye alguna de las diferidas. |

**Recomendación fuera de alcance de este spec, para una sesión aparte:** el trabajo de mayor leverage detectado durante esta evaluación no es ninguna herramienta nueva — es reconfirmar con un re-login real si el fix de scope de OAuth resolvió también el "Bad credentials", ya que hoy es una duda genuinamente abierta sobre si el producto central (auto-PR) funciona.

## 3. Diseño: `@healify/gate` (server-side, sin paquete npm nuevo)

### 3.1 Problema

Hoy existen tres implementaciones independientes y duplicadas del mismo chequeo ("¿esta sugerencia de healing es suficientemente confiable para actuar sola?"), todas hardcodeadas a `0.95`, sin considerar la fragilidad del selector propuesto ni si matchea de forma única en el DOM capturado. `Project.autoHealThreshold` existe en el schema para permitir que cada cliente ajuste ese umbral, pero no lo usa nadie.

### 3.2 No objetivos

- No se toca `src/workers/lib/healing-ops.ts` ni ningún otro archivo bajo `src/workers/`, `reporter-core/`, `test-runner/`, `cypress-plugin/` — excluidos por instrucción explícita. El path de auto-heal del worker (webhook → Railway) queda con su `0.95` hardcodeado intacto. Esto es una inconsistencia real que sobrevive a este spec, documentada acá para que no se pierda.
- No se publica ningún paquete npm. `gate` es código del monorepo (`src/lib/gate/`), no un producto standalone — no tiene sentido como CLI porque la decisión de abrir un PR la toma el servidor, no el cliente.
- No se reimplementa el scoring de fragilidad — se reusa `SelectorAnalyzer.calculateScore()` tal cual.
- No se agrega `jsdom` (u otro parser DOM completo) como dependencia de producción para el chequeo de unicidad — ver 3.4.

### 3.3 Arquitectura

```
src/lib/gate/
  evaluate-gate.ts       (CREATE) — función pura evaluateGate(), sin DB ni red
  evaluate-gate.test.ts  (CREATE) — unit tests, vitest

src/lib/github/auto-pr.ts        (MODIFY) — tryOpenAutoPR() llama evaluateGate() antes de tocar la API de GitHub
src/app/api/v1/report/route.ts   (MODIFY) — reemplaza `confidence >= 0.95` hardcodeado por evaluateGate()
```

`healing-ops.ts` (worker) queda fuera, ver 3.2.

### 3.4 `evaluateGate()` — contrato

```ts
export interface GateInput {
  confidence: number
  selector: string
  selectorType: SelectorType
  threshold: number        // viene de project.autoHealThreshold, con fallback a 0.85 si es null/undefined
  domSnapshot?: string      // oldDomSnapshot o newDomSnapshot, ya truncado a 8000 chars por el caller
}

export type GateFailureReason =
  | { code: 'low_confidence'; confidence: number; threshold: number }
  | { code: 'fragile_selector'; score: number }
  | { code: 'not_unique'; matches: number }

export interface GateResult {
  pass: boolean
  blockedBy: GateFailureReason[]   // vacío si pass === true
}

export function evaluateGate(input: GateInput): GateResult
```

Tres chequeos, todos evaluados (no short-circuit) para que `blockedBy` reporte todas las razones a la vez — relevante para lo que en el futuro sea `audit`, aunque ese tool no se construya ahora, conviene que el dato quede disponible desde el día uno:

1. **`low_confidence`** — `confidence < threshold`. Reemplaza el `0.95` hardcodeado por el valor real de `project.autoHealThreshold`.
2. **`fragile_selector`** — `SelectorAnalyzer.calculateScore(selector, selectorType) < 0.40` (el mismo corte que `getRecommendation()` ya usa para "Critical risk" en `selector-analyzer.ts:47`). No se inventa un umbral nuevo.
3. **`not_unique`** — solo se evalúa si `domSnapshot` está presente. Conteo aproximado por regex para los tres casos simples y verificables sin parser (`#id`, `.clase-simple`, `[data-testid="..."]`/`[aria-*="..."]`); para cualquier otro selector (combinadores, pseudo-clases, xpath) el resultado es indeterminado y **no bloquea** por esta razón — evita falsos positivos por un snapshot truncado a 8000 chars que puede cortar el HTML a mitad de un tag. Si el conteo da 0 matches, tampoco bloquea (0 es tan probablemente "truncado" como "realmente ausente" — no hay forma barata de distinguir sin parser real). Solo bloquea cuando el conteo da **estrictamente más de 1** con un patrón que sí pudo contarse con confianza.

### 3.5 Integración

**`tryOpenAutoPR()` (`src/lib/github/auto-pr.ts`):** justo después de cargar `event` (línea ~70), antes de cualquier llamada a la API de GitHub:

```ts
const gate = evaluateGate({
  confidence: event.confidence ?? 0,
  selector: event.newSelector ?? event.failedSelector,
  selectorType: event.newSelectorType ?? event.selectorType,
  threshold: event.testRun.project.autoHealThreshold,
  domSnapshot: event.newDomSnapshot ?? event.oldDomSnapshot ?? undefined,
})
if (!gate.pass) {
  return { opened: false, reason: `gate:${gate.blockedBy.map(b => b.code).join(',')}` }
}
```

Esto requiere que la query de `event` en `tryOpenAutoPR` incluya `project.autoHealThreshold` en el `include` (hoy ya incluye `project` para otros campos — se agrega el select del campo, no un nuevo join).

**`/api/v1/report/route.ts`:** el `status: confidence >= 0.95 ? 'HEALED_AUTO' : 'NEEDS_REVIEW'` (línea 137) pasa a `evaluateGate(...).pass`. Este endpoint no llama `tryOpenAutoPR` hoy (ver §1), así que este cambio solo afecta el *label* de estado que ve el dashboard, no si se abre un PR — pero es la misma inconsistencia de umbral duplicado, vale la pena resolverla en el mismo cambio ya que toca el mismo concepto.

### 3.6 Riesgo de producto — decisión tomada

Pasar de `0.95` hardcodeado a `project.autoHealThreshold` (default actual en el schema: `0.85`) **aflojaría** el criterio de auto-heal para todo proyecto existente que no haya tocado ese campo — no lo endurecería. Hoy, de facto, todo proyecto necesita ≥95% de confianza para auto-PR.

**Decisión:** el default de `Project.autoHealThreshold` en `prisma/schema.prisma:148` sube de `0.85` a `0.95` como parte de este plan (`@default(0.95)`), preservando el comportamiento actual para todo proyecto existente y nuevo. El campo sigue siendo configurable hacia abajo — ese es el objetivo real de `gate`: que el umbral sea ajustable por proyecto, no que cambie el default sin que nadie lo pida. Esto agrega una migración de Prisma (`ALTER TABLE projects ALTER COLUMN "autoHealThreshold" SET DEFAULT 0.95` — no toca filas existentes, que ya tienen `0.85` explícito desde que se crearon; solo cambia el default para proyectos nuevos hacia adelante, así que además hace falta un backfill explícito a `0.95` para las filas existentes si se quiere comportamiento verdaderamente idéntico, no solo el mismo default nominal).

**Corrección post-implementación (encontrada por el code reviewer de Task 1, verificada):** `autoHealThreshold` **ya es editable por el usuario** vía `/api/projects/[id]/settings` (un slider en `src/app/dashboard/projects/[id]/settings/page.tsx`), algo que este spec no había chequeado al escribir el párrafo de arriba. El formulario de settings manda el config completo en cada guardado, así que un `WHERE autoHealThreshold = 0.85` no puede distinguir con certeza "nunca tocado" de "guardado con 0.85 puesto a propósito, o de rebote al guardar otra cosa". Se verificó el dataset real antes de aplicar el backfill (2026-07-21): 4 proyectos en total, 3 sin ningún guardado posterior a su creación (`createdAt == updatedAt`) y el 4º es el propio proyecto de prueba del desarrollador — sin evidencia de que alguna fila fuera una elección deliberada. Backfill aplicado con ese respaldo; ver el comentario correspondiente en `prisma/migrations/20260721131328_bump_auto_heal_threshold_default/migration.sql` para el detalle completo.

### 3.7 Testing

- **Unit (`evaluate-gate.test.ts`):** todas las combinaciones de los 3 chequeos en aislamiento — confidence exacto en el umbral (inclusive/exclusive), selector fragile puro, selector con 0/1/2+ matches en un snapshot de prueba, snapshot ausente, snapshot truncado a mitad de tag, selector complejo que debe dar "indeterminado" y no bloquear. Sin DB, sin red — `evaluateGate` es función pura.
- **Integración (`tryOpenAutoPR`):** mock de `evaluateGate` devolviendo `pass: false` → assert que no se llama ninguna función de `octokit`/GitHub. Test de regresión existente de auto-PR exitoso debe seguir pasando con un `event` cuya confidence supere el threshold real del proyecto de prueba.

### 3.8 Qué mirar de codeArbiter sin copiar (aplica solo a este diseño)

Patrón de inspiración válido: un gate que evalúa múltiples razones de bloqueo independientes y las reporta todas juntas (no falla en la primera), en vez de un simple `if confidence < X: block`. Eso es arquitectura, no código — implementado acá desde cero contra el modelo de datos real de Healify (`HealingEvent`, `SelectorAnalyzer`), sin mirar ni una línea de `commit-gate`. Prohibido: cualquier nombre de función, mensaje de error o estructura de archivo calcada de `codeArbiter` — no aplica en este diseño porque no se leyó su código fuente (repo es AGPLv3 desde v2.6.0, confirmado por el autor).
