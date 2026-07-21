# Informe Técnico (Dev/QA) — Healify
**Fecha:** 2026-07-20
**Fuente:** auditoría estática de solo lectura sobre `C:\Proyectos\QA\Healify` (working tree local, sin ejecutar el server ni el worker) + `worklog.md` + `git log`
**Alcance:** arquitectura del healing pipeline, tests, seguridad, deuda técnica, CI/CD, modelo de datos

---

## 0. Hallazgo crítico 🔴 — el scope de GitHub OAuth no permite escribir repos (auto-PR roto para TODO usuario)

**Dónde:** `src/app/api/auth/[...nextauth]/route.ts:19-30` (`GitHubProvider`)

El proveedor de GitHub en NextAuth se configura sin especificar `scope` explícito:
```ts
GitHubProvider({
  clientId: GITHUB_ID,
  clientSecret: GITHUB_SECRET,
  profile(profile) { ... },
})
```
El scope por defecto de `next-auth/providers/github` es `read:user user:email` — alcanza para saber quién sos, pero **no incluye `repo`**, que es imprescindible para crear ramas, commits o Pull Requests vía la API de GitHub. Consecuencia: **el auto-PR (la propuesta de valor central del producto) no puede funcionar para ningún usuario real** que se loguee con la configuración actual, sin importar cuán bien funcione el motor de IA.

**Cómo se confirmó (2026-07-20, prueba real end-to-end):**
1. Se conectó un proyecto real (`mescobar996/Healify`) con sesión de GitHub real.
2. Se disparó `POST /api/test-runs/:id/heal` con un fallo de selector simulado pero realista.
3. El motor de IA (Ollama + `qwen2.5-coder:7b`) devolvió `confidence: 0.95` → `status: HEALED_AUTO` → se disparó `tryOpenAutoPR` automáticamente. **El motor de IA funcionó perfecto.**
4. La creación de la rama en GitHub falló: `[Smart PR] Error: Error [HttpError]: Bad credentials`. `healingEvent.prUrl` quedó `null`.

**Nota:** por decisión explícita, no se corrigió el scope en esta sesión (el usuario prefirió no re-loguearse ahora). Queda pendiente:
1. Agregar `authorization: { params: { scope: 'repo read:user user:email' } }` al `GitHubProvider`.
2. Verificar además si el "Bad credentials" es *solo* un problema de scope insuficiente (normalmente GitHub devuelve 403/404 para eso) o si el `access_token` guardado en `Account` está vacío/corrupto para este usuario — revisar tras el fix de scope con un re-login real.

---

## 1. Hallazgo crítico 🔴 — el PR de "curación" destruía el archivo de test original — ✅ CORREGIDO (2026-07-20)

**Dónde:** `src/workers/lib/healing-ops.ts:116` (contenido subido) → `src/lib/github/repos.ts:103-111` (`createOrUpdateFileContents`)

El worker de producción (Railway), al detectar un selector roto con confianza ≥95%, no aplicaba un patch/diff sobre el archivo de test real. En su lugar subía como contenido completo del archivo:

```js
`// Healed by Healify\nconst selector = '${suggestion.newSelector}';`
```

Es decir, el PR que Healify abría **reemplazaba el archivo de test del usuario entero** por dos líneas dummy, borrando el resto del test. Esto es el corazón del producto (curación automática vía PR) y, si se ejecutaba, rompía el repo del cliente en cada "fix" aplicado automáticamente (recordar: ≥95% de confianza = auto-merge implícito según el propio README). Fue el hallazgo de mayor severidad de esta auditoría — bloqueante para cualquier uso real en producción.

**Impacto:** confianza del producto (su propuesta de valor central) + riesgo directo para repos de clientes reales.

**Causa raíz:** el worker ya clona el repo completo en `workDir` (`job-processor.ts:46`) y ese directorio sigue vivo durante todo el healing (`cleanupWorkDir` corre recién en el `finally`), pero ni `healTestFailure` ni `createHealingPR` leían ese archivo del disco — el parámetro `_workDir` de `healTestFailure` estaba prefijado con `_` porque nunca se usaba, y `createHealingPR` ni siquiera lo recibía como argumento. Quedó como un placeholder de demo que nunca se conectó al contenido real del repo.

**Fix aplicado:**
- Nueva función `buildHealedFileContent(workDir, failure, newSelector)` en `healing-ops.ts`: lee el archivo real (`fs.readFile(path.join(workDir, failure.testFile))`) y reemplaza **solo la ocurrencia citada exacta** del selector (`'#btn-login'` o `"#btn-login"`, vía regex con comillas capturadas) por el nuevo selector, preservando el resto del archivo byte a byte.
- Salvaguarda anti-adivinanza: si el selector no aparece como literal citado, o aparece más de una vez (ambiguo), la función devuelve `null` y `createHealingPR` **aborta el auto-PR** en vez de arriesgar una corrupción — el evento queda como `NEEDS_REVIEW`, el mismo camino seguro que ya existía para baja confianza.
- `createHealingPR` ahora recibe `workDir` como parámetro (propagado desde `job-processor.ts:130`) y usa el contenido parchado real en vez del string dummy.
- Verificado: `npx tsc --noEmit` limpio tras el cambio. La suite de vitest del repo está rota globalmente por una dependencia faltante no relacionada (`@testing-library/jest-dom` en `src/test/setup.ts`, ya conocida — ver `worklog.md`), así que la lógica se validó además con un script aislado (`tsx`) cubriendo los 4 casos: reemplazo único correcto, selector no encontrado, selector ambiguo (2+ ocurrencias) y archivo inexistente — los 4 se comportan como se espera. Se agregaron tests unitarios equivalentes en `src/workers/__tests__/worker-functions.test.ts` (bloqueados hoy por el mismo problema de `jest-dom`, correrán en cuanto se resuelva esa dependencia).

**Pendiente relacionado (no corregido en este cambio, ver hallazgos 2.1/2.2):** la rama base sigue hardcodeada a `'main'` y el nombre de rama persistido en DB puede no coincidir con el creado en GitHub.

## 2. Hallazgos altos 🟠

### 2.1 Rama base hardcodeada a `'main'`
`healing-ops.ts:114` llama `createPullRequest(..., 'main', ...)` con literal fijo. En repos cuya rama por defecto sea `master`/`develop`/etc., el PR fallará (con catch genérico que probablemente lo trague silenciosamente).

### 2.2 Nombre de rama del PR no coincide con lo persistido en DB
`job-processor.ts:129` genera `healify-fix-${Date.now()}` y lo guarda en `HealingEvent.prBranch`, pero `repos.ts:68` (`createPullRequest`) genera **su propio** nombre con otro timestamp al crear la rama real en GitHub. El dato persistido puede no corresponder a la rama real creada — rompe trazabilidad (ej. el dashboard podría linkear a una rama que no existe).

### 2.3 Dos motores de healing paralelos, uno de ellos sin IA
- **Camino real (worker Railway):** `src/lib/ai/healing-service.ts` → Claude Sonnet 4 vía `@anthropic-ai/sdk`, con fallback determinístico si la IA falla.
- **Camino paralelo (`POST /api/heal`):** `src/lib/engine/healing-engine.ts`, ~450 líneas, **100% basado en reglas/regex, sin IA** (comentario propio: "toda la lógica es determinística").

Ambos coexisten sin unificar. Riesgo: confusión para nuevos devs, y si algún cliente/integración usa `/api/heal` directamente pensando que invoca el motor de IA "real" del marketing, está recibiendo otro producto.

### 2.4 CI de e2e probablemente roto — proyectos Playwright inexistentes
`.github/workflows/ci.yml` corre `playwright test --project=api` y `--project=api --project=chromium --project=mobile` (jobs `e2e-api`, `e2e-browser`), pero `playwright.config.ts` **solo define el proyecto `chromium`**. Ejecutar esos comandos tal cual el config actual del repo debería fallar con `Project(s) "api"/"mobile" not found`. O bien el CI está roto, o hay un `playwright.config.ts` distinto no versionado en este working tree (drift a verificar).

## 3. Hallazgos medios 🟡

### 3.1 Suite Playwright sin tests reales del producto
`tests/example.spec.ts` (único spec real) es scaffolding de práctica: busca "iPhone" en `http://opencart.abstracta.us/` (demo público de OpenCart, sin relación con Healify) y termina en `await page.pause()`. No existe cobertura E2E real del flujo de negocio (login, conectar repo, disparar healing, ver PR). El workflow `.github/workflows/playwright.yml` corre este test de OpenCart en cada push a `main`/`master` — ruido, no valor.

### 3.2 Migraciones Prisma: una sola, gestión vía `db push`
Solo existe la migración `add_api_key_hash`; el resto del schema parece gestionado con `prisma db push` (confirmado por su uso en CI en vez de `migrate deploy`). Riesgo estándar: sin historial de migraciones versionado, drift de schema difícil de auditar entre entornos (dev/staging/prod).

### 3.3 `worklog.md` ya documenta deuda propia sin resolver
El propio equipo registró (2026-02-28): `tsc --noEmit` global falla por resolución de `vitest` en tests existentes, y el setup E2E falla por `Unauthorized` en `e2e/global.setup.ts` — ambos catalogados como "preexistentes" y no resueltos. Coincide con el hallazgo 2.4.

**Confirmado y precisado (2026-07-20):** `npx vitest run` falla para **toda** la suite (no solo E2E) con `Failed to resolve import "@testing-library/jest-dom" from "src/test/setup.ts"` — el paquete no está en `package.json` ni instalado en `node_modules`, pero `setupFiles` en `vitest.config.ts` lo importa globalmente. Esto bloquea correr **cualquier** test unitario (incluyendo los 18 archivos de `src/lib/__tests__/` mencionados como punto fuerte en la sección 4) hasta que se agregue la dependencia o se quite el import de `setup.ts`.

## 4. Puntos positivos (seguridad y calidad) ✅

- **`/api/seed`** correctamente bloqueado en producción (`NODE_ENV === 'development'` + rol ADMIN + guard temprano `403`).
- **Webhook de GitHub**: valida `x-hub-signature-256` con HMAC-SHA256 y `timingSafeEqual` (resistente a timing attacks); si falta `GITHUB_WEBHOOK_SECRET`, **rechaza** en vez de bypassear.
- **API keys de usuario**: generadas con `crypto.randomBytes(32)`, almacenadas hasheadas (SHA-256), con migración automática de keys legacy en texto plano al primer uso.
- **Rutas admin** con doble verificación sesión + rol.
- Código muy limpio de TODOs/FIXMEs (0 en `src/`), pocos `any` (3) y pocos catch vacíos (5, todos en UI no crítica, best-effort sobre `localStorage`).
- Modelo de datos Prisma bien normalizado, cascadas `onDelete` consistentes.
- Vitest cubre lógica de negocio real (18 archivos: api-key-service, healing-service, payment-webhooks, rate-limit, security-utils, etc.) con thresholds de cobertura configurados (60% líneas/funciones, 50% ramas).
- CI con separación de jobs (lint/test/build/security-sca/e2e) y `npm audit` en el pipeline.

## 5. Recomendaciones priorizadas

1. ~~**Bloqueante:** corregir `healing-ops.ts` para que el PR aplique un patch real sobre el selector específico dentro del archivo (no un reemplazo total del contenido).~~ ✅ **Corregido el 2026-07-20** — ver sección 1.
2. **Alto:** obtener la default branch real del repo vía API de GitHub en vez de hardcodear `'main'`; unificar el nombre de rama generado entre `job-processor.ts` y `repos.ts` (generarlo en un solo lugar y pasarlo como parámetro).
3. **Alto:** decidir el destino de `healing-engine.ts` (motor determinístico) — deprecar/eliminar `/api/heal` si no está en uso, o documentar claramente que es un modo "sin IA" distinto del pipeline principal.
4. **Alto:** alinear `playwright.config.ts` con lo que `ci.yml` espera (definir proyectos `api`, `chromium`, `mobile`) o corregir el workflow para que solo referencie proyectos existentes.
5. **Medio:** reemplazar `tests/example.spec.ts` por specs E2E reales del flujo de negocio de Healify; retirar o repropositar `playwright.yml`.
6. **Medio:** introducir migraciones versionadas (`prisma migrate`) en lugar de `db push` para tener trazabilidad de schema entre entornos.
7. **Medio (nuevo):** agregar `@testing-library/jest-dom` a `package.json` (o quitar el import de `src/test/setup.ts` si no se usa) — hoy bloquea ejecutar toda la suite de vitest, incluida la nueva cobertura de `buildHealedFileContent`.

---
*Auditoría de solo lectura sobre el repo, con una excepción: se implementó el fix del hallazgo #1 (bloqueante) a pedido explícito, incluyendo tests unitarios nuevos. El resto de los hallazgos no fue modificado.*
