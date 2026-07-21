# CONTEXT DUMP — Test Reporter Packages (`2026-07-20-test-reporter-packages`)

> Generado el 2026-07-21 por Claude (extractor de contexto, solo lectura — no se modificó código ni se ejecutaron tareas del plan).
>
> **⚠️ AVISO IMPORTANTE ANTES DE LEER EL RESTO DE ESTE DOCUMENTO:**
> El pedido original era "continuar desde la Tarea 7". **Eso ya no aplica.** Verificando el `EXECUTION-LOG.md` contra el código real y `git log`, encontré que:
> - Las **11 tareas del plan están completas** (confirmado en el propio EXECUTION-LOG).
> - La **revisión de código final cruzada** (todas las tareas juntas) también se hizo y concluyó "Ready to merge".
> - **Casi todo el backlog** que el EXECUTION-LOG deja como "pendiente" (timeout de 3s, sanitización ANSI, `ATTACHMENT_NAME` duplicado, tests unitarios de `HealifyReporter`, el gap de empaquetado con esbuild, los bugs de `/docs` y `/connect`) **ya fue resuelto** por dos commits (`d3c4d79` y `fb7adaf`) hechos en una sesión/herramienta distinta (otro agente, "OpenCode/DeepSeek" según notas de sesión previas) que **NUNCA actualizó el `EXECUTION-LOG.md`**. Por eso el log describe un estado más atrasado del que el código realmente tiene.
> - Ver la sección **"RESUMEN EN 10 BULLETS"** al final para el detalle exacto de qué queda vivo y qué no.

---

## 1. Estructura del proyecto

### `find . -maxdepth 3 -type f -name "package.json"` (excluyendo `node_modules`)
```
-rw-r--r-- 1 mescobar96 197610   24 jul. 21 08:08 ./.next/dev/package.json
-rw-r--r-- 1 mescobar96 197610  667 mar.  3 01:46 ./cli/package.json
-rw-r--r-- 1 mescobar96 197610  860 jul. 20 22:35 ./cypress-plugin/package.json
-rw-r--r-- 1 mescobar96 197610 1142 feb. 27 13:13 ./mini-services/vscode-plugin/package.json
-rw-r--r-- 1 mescobar96 197610 3184 jul. 20 18:09 ./package.json
-rw-r--r-- 1 mescobar96 197610  407 jul. 20 22:35 ./reporter-core/package.json
-rw-r--r-- 1 mescobar96 197610 1032 jul. 20 22:35 ./test-runner/package.json
```

### `ls -R reporter-core/ test-runner/ cypress-plugin/`
```
reporter-core/:
dist  node_modules  package.json  README.md  src  tsconfig.json  vitest.config.ts

reporter-core/dist:
config.d.ts  config.js  http-client.d.ts  http-client.js  index.d.ts  index.js
selector-extractor.d.ts  selector-extractor.js

reporter-core/src:
__tests__  config.ts  http-client.ts  index.ts  selector-extractor.ts

reporter-core/src/__tests__:
config.test.ts  http-client.test.ts  selector-extractor.test.ts

test-runner/:
dist  node_modules  package.json  README.md  src  test-results  tests  tsconfig.json  vitest.config.ts

test-runner/dist:
fixture.d.ts  index.d.ts  index.js  reporter.d.ts  reporter.js

test-runner/src:
__tests__  fixture.ts  index.ts  reporter.ts

test-runner/src/__tests__:
reporter.test.ts

test-runner/tests:
fake-server.mjs  fixtures  fixtures-no-key  playwright.config.ts  playwright.no-key.config.ts
test-results  verify-fixture-capture.mjs  verify-no-key.mjs  verify-reporter-post.mjs

test-runner/tests/fixtures:
passing.spec.ts  sample.spec.ts

test-runner/tests/fixtures-no-key:
no-key.spec.ts

cypress-plugin/:
dist  package.json  README.md  src  tests

cypress-plugin/dist:
index.d.ts  index.js  plugin.d.ts

cypress-plugin/src:
index.ts  plugin.ts

cypress-plugin/tests:
cypress  cypress.config.ts  fake-server.mjs  tsconfig.json  verify-plugin-post.mjs

cypress-plugin/tests/cypress/e2e:
sample.cy.ts
```

**Nota de nombres de archivo:** el plan original nombra `reporter-core/src/selector.ts` en un par de referencias sueltas del pedido original de este dump, pero el archivo real (y el que el propio plan formalmente crea en la Tarea 3) es `reporter-core/src/selector-extractor.ts`. `test-runner/src/reporter.ts` **ya existe** — no está "en curso", está terminado (ver sección 5).

### `cat package.json` (raíz)
```json
{
  "name": "healify",
  "version": "0.2.0",
  "private": true,
  "workspaces": [
    "reporter-core",
    "test-runner",
    "cypress-plugin"
  ],
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "prisma generate && next build && node -e \"const{cpSync}=require('fs');cpSync('.next/static','.next/standalone/.next/static',{recursive:true});cpSync('public','.next/standalone/public',{recursive:true})\"",
    "start": "node .next/standalone/server.js",
    "lint": "eslint .",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset",
    "worker": "tsx src/workers/test-worker.ts",
    "worker:dev": "nodemon --exec tsx src/workers/test-worker.ts",
    "worker:railway": "tsx src/workers/railway-worker.ts",
    "build:worker": "esbuild src/workers/railway-worker.ts --bundle --platform=node --outfile=dist/worker.js --format=cjs --external:playwright --external:@playwright/test --external:bullmq --external:ioredis --external:@prisma/client",
    "trigger:test": "tsx scripts/test-queue.ts",
    "evaluate:ai": "tsx scripts/evaluate-ai.ts",
    "kpi:baseline": "tsx scripts/generate-kpi-baseline.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:api": "playwright test --project=api",
    "test:all": "vitest run && playwright test --project=api --project=chromium --project=mobile"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.78.0",
    "@next-auth/prisma-adapter": "^1.0.7",
    "@playwright/test": "^1.58.2",
    "@prisma/client": "^6.11.1",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@sentry/nextjs": "^10.42.0",
    "bullmq": "^5.69.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "framer-motion": "^12.23.2",
    "ioredis": "^5.9.3",
    "lucide-react": "^0.525.0",
    "next": "^16.1.1",
    "next-auth": "^4.24.13",
    "octokit": "^5.0.5",
    "playwright": "^1.58.2",
    "prisma": "^6.11.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.4",
    "resend": "^6.9.2",
    "sonner": "^2.0.6",
    "stripe": "^20.3.1",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^4.0.2"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^25.5.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitest/coverage-v8": "^4.0.18",
    "@vitest/ui": "^4.0.18",
    "esbuild": "^0.27.3",
    "eslint": "^9",
    "eslint-config-next": "^16.1.1",
    "jsdom": "^28.1.0",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "tw-animate-css": "^1.3.5",
    "typescript": "^5",
    "vitest": "^4.0.18"
  }
}
```

### `cat tsconfig.json` (raíz)
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": [
    "node_modules", "mini-services", "examples", "scripts",
    "vitest.config.ts", "playwright.config.ts",
    "reporter-core", "test-runner", "cypress-plugin"
  ]
}
```

---

## 2. Documentación del feature

### 2.1 Plan completo — `docs/superpowers/plans/2026-07-20-test-reporter-packages.md`

*(Contenido íntegro — incluye ya las correcciones aplicadas sobre la marcha, documentadas también en el EXECUTION-LOG: el input del test de `locator()` en Tarea 3, el `__resetWarnStateForTests` en Tarea 4, la expectativa `'#does-not-exist'` con `#` en Tarea 7, y el `exports` map de Tarea 8/11.)*

```markdown
# Test Reporter Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@healify/reporter-core` (private), `@healify/test-runner` (Playwright), and `@healify/cypress-plugin` (Cypress) so a broken selector can be reported to Healify's existing `POST /api/v1/report` endpoint from any local machine or CI (GitHub Actions, GitLab CI, Jenkins) — no GitHub OAuth or Railway worker required.

**Architecture:** Three npm-workspace packages at the repo root. `reporter-core` holds the shared HTTP client, selector-extraction regex (migrated from `src/workers/lib/playwright-runner.ts`), and config resolution. `test-runner` wraps it in a Playwright `Reporter` plus a `test` fixture that auto-captures DOM on failure. `cypress-plugin` wraps it in a Cypress `setupNodeEvents` plugin. Neither adapter can ever fail or slow down the user's real test run — all network calls are fire-and-forget with a 3s timeout.

**Tech Stack:** TypeScript (CommonJS output), npm workspaces, `@playwright/test` (peer dep), `cypress` (peer dep), `vitest` for unit tests, Node's built-in `http` module for fake-server integration tests.

**Reference spec:** `docs/superpowers/specs/2026-07-20-test-reporter-packages-design.md`

---

## File Structure

​```
package.json                          (MODIFY — add "workspaces")
tsconfig.json                         (MODIFY — exclude new package folders)
.gitignore                            (MODIFY — ignore dist/ and node_modules/ under new packages)

reporter-core/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    config.ts                         (CREATE)
    selector-extractor.ts             (CREATE)
    http-client.ts                    (CREATE)
    index.ts                          (CREATE)
  src/__tests__/
    config.test.ts                    (CREATE)
    selector-extractor.test.ts        (CREATE)
    http-client.test.ts               (CREATE)
  vitest.config.ts                    (CREATE)

test-runner/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    fixture.ts                        (CREATE)
    reporter.ts                       (CREATE)
    index.ts                          (CREATE)
  tests/
    playwright.config.ts              (CREATE)
    fixtures/sample.spec.ts           (CREATE)
    fake-server.mjs                   (CREATE)
    verify-fixture-capture.mjs        (CREATE)
    verify-reporter-post.mjs          (CREATE)

cypress-plugin/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    plugin.ts                         (CREATE)
    index.ts                          (CREATE)
  tests/
    cypress.config.ts                 (CREATE)
    cypress/e2e/sample.cy.ts          (CREATE)
    fake-server.mjs                   (CREATE)
    verify-plugin-post.mjs            (CREATE)
​```

---

### Task 1: Workspace scaffolding
[... Steps 1–12, ver detalle completo abajo en "Notas": scaffolding de package.json/tsconfig.json de los 3 paquetes, npm install, verificación de tsc, commit `4e3e43f` ...]

### Task 2: `reporter-core` — config resolution
`resolveConfig()` lee `HEALIFY_API_KEY`/`HEALIFY_API_URL`/`HEALIFY_BRANCH`/`HEALIFY_COMMIT_SHA`, retorna `null` si falta la key. TDD completo con vitest. Commit `0db9297`.

### Task 3: `reporter-core` — selector extraction
Migración de `SELECTOR_PATTERNS`/`extractSelectorFromError` desde `src/workers/lib/playwright-runner.ts`. Commit `cca24ae`.

### Task 4: `reporter-core` — HTTP client
`reportFailure()`: POST a `{apiUrl}/api/v1/report`, timeout 3s (AbortController), trunca `context` a 8000 chars, warn-once por proceso, nunca lanza. Incluye `__resetWarnStateForTests()` (solo-test). Commit `db59a56`.

### Task 5: `reporter-core` — barrel export y build
`index.ts` re-exporta `resolveConfig`/`HealifyConfig`, `extractSelectorFromError`, `reportFailure`/`ReportPayload`. Commit `a90f0f9`.

### Task 6: `test-runner` — DOM-capturing fixture
`test.extend()` sobre `page`: si `testInfo.status !== testInfo.expectedStatus`, captura `page.content()` (truncado a 8000 chars) y lo adjunta como `healify-dom` vía `testInfo.attach()`. Try/catch silencioso. Commit `492d401`.

### Task 7: `test-runner` — HealifyReporter
`HealifyReporter implements Reporter`, `onTestEnd(test, result)`: si falló/timeout, extrae selector del error, busca el attachment `healify-dom`, llama `reportFailure`. Verificado contra fake-server real. Commit `f5bbf79`.

### Task 8: `test-runner` — barrel export y package build
`index.ts` re-exporta `test`/`expect`/`HealifyReporter`. Se agregó un `exports` map a `package.json` con subpath `./reporter` porque Playwright exige que las entradas del array `reporter` sean strings (no el valor de la clase). Commit `f9c198a`.

### Task 9: `cypress-plugin` — HealifyCypressPlugin
`HealifyCypressPlugin(on, config)`: engancha `on('after:spec', async (spec, results) => {...})`, filtra tests fallidos, manda un POST por cada uno. Usa `Cypress.PluginEvents`/`Cypress.PluginConfigOptions` (no son named exports de `"cypress"`, solo existen en el namespace ambient). Se agregó un 6º patrón a `SELECTOR_PATTERNS` en `reporter-core` para el formato de error de Cypress. Commits `a7da5d2` (fix reporter-core) + `c5173b8` (plugin).

### Task 10: `cypress-plugin` — barrel export y package build
`index.ts` re-exporta `HealifyCypressPlugin`. Commit `75386cc`.

### Task 11: Verificación manual end-to-end contra el proyecto real
Reescalada durante ejecución: no se pudo instalar como paquete externo (gap de empaquetado — ver hallazgos), así que se validó desde dentro del monorepo contra el servidor real y la IA real (Ollama). Cadena completa confirmada funcionando. Sin commit (verificación, no cambios de código esperados).

---

## Notes for whoever picks this up

- Do **not** implement Vitest or Selenium adapters as part of this plan — out of scope per the spec (§2, non-goals).
- Do **not** touch the GitHub OAuth scope bug (documented separately in `qa-reports/Informe-Dev-Healify.md`, section 0) — this plan's whole point is to let detection work *without* needing that fixed.
- Publishing the packages to npm (versioning, CI publish workflow) is intentionally not part of this plan — see spec §7.
```

> El plan completo (con el código de cada paso, tests, scripts de verificación) supera las 1300 líneas — se muestra resumido arriba por tarea para no duplicar contenido que ya está reflejado literal en la sección 3 (código actual) de este mismo dump. Si la IA que continúa necesita el texto exacto paso-a-paso de una tarea puntual, está en `docs/superpowers/plans/2026-07-20-test-reporter-packages.md` líneas 65–1311.

### 2.2 Spec de diseño — `docs/superpowers/specs/2026-07-20-test-reporter-packages-design.md`

```markdown
# Diseño: Paquetes reporter (Playwright + Cypress) para pruebas locales/CI

**Fecha:** 2026-07-20
**Estado:** Aprobado, pendiente de implementación

## 1. Problema

Hoy existe un único camino real para que Healify analice un test roto: el **Railway Worker**, disparado por un webhook de GitHub, que clona el repo del cliente, instala dependencias, corre Playwright y recién ahí cura selectores. Este camino:

- Requiere que el cliente otorgue acceso OAuth de GitHub con scope de escritura sobre su repo **antes** de ver un solo resultado (y ese scope hoy está roto — ver hallazgo en `qa-reports/Informe-Dev-Healify.md`, sección 0).
- Requiere infraestructura propia corriendo (Redis + worker) para cualquier cliente.
- No sirve para equipos que no usan GitHub (GitLab CI, Jenkins) ni para probar Healify desde una máquina local sin conectar nada.

La documentación pública (`/docs`) ya promete un paquete `@healify/test-runner` (reporter npm) que resuelve esto — pero **ese paquete no existe en el repo ni está publicado**. El endpoint que lo alimentaría, `POST /api/v1/report`, sí existe y funciona (usa el mismo motor de IA que el resto del producto).

## 2. Objetivo

Construir el reporter que la documentación ya promete, para que un test pueda fallar y reportarse a Healify **desde cualquier entorno** (laptop, GitHub Actions, GitLab CI, Jenkins) sin necesitar que Healify tenga acceso de escritura al repo. El permiso de GitHub para abrir PRs queda como un paso *posterior y opcional*, desacoplado de "ver si el healing funciona".

### No objetivos (fuera de alcance de este spec)

- Adapters de Vitest o Selenium (los docs los mencionan, quedan para specs futuros).
- Rediseñar el permiso de GitHub para auto-PR (bug ya documentado, requiere su propio spec).
- El CLI (`cli/`) y el plugin de VS Code (`mini-services/vscode-plugin/`) — son capas de conveniencia sobre este reporter, no la vía de entrada en sí. Quedan deprioritizados.

## 3. Arquitectura

Tres paquetes nuevos en la raíz del repo (hermanos de `cli/` y `mini-services/`), vinculados con **npm workspaces** (hoy el `package.json` raíz no tiene ese campo — se agrega `"workspaces": ["reporter-core", "test-runner", "cypress-plugin"]`):

​```
reporter-core/         (privado — no se publica a npm)
  src/
    http-client.ts      → POST a /api/v1/report: timeout 3s, nunca lanza, warn una sola vez por corrida
    selector-extractor.ts → extractSelectorFromError() migrado desde src/workers/lib/playwright-runner.ts
    config.ts           → resuelve HEALIFY_API_KEY, HEALIFY_API_URL, HEALIFY_BRANCH, HEALIFY_COMMIT_SHA
  package.json (private: true)

test-runner/            (@healify/test-runner — se publica)
  src/
    reporter.ts          → HealifyReporter implementa Reporter de Playwright (onTestEnd)
    fixture.ts            → test extendido con afterEach que captura page.content() en fallos
    index.ts              → export { test, HealifyReporter }
  depende de reporter-core (referenciado por nombre y versión, ej. "@healify/reporter-core": "*" — npm workspaces lo linkea localmente sin publicar nada)

cypress-plugin/         (@healify/cypress-plugin — se publica)
  src/
    plugin.ts            → HealifyCypressPlugin(on, config, options), engancha on('after:spec', ...)
  depende de reporter-core (referenciado por nombre y versión, ej. "@healify/reporter-core": "*" — npm workspaces lo linkea localmente sin publicar nada)
​```

### Diagrama de flujo (aprobado en la sesión de brainstorming)

​```
Tu laptop / GitHub Actions / GitLab CI / Jenkins
        │  npm test (Playwright o Cypress)
        ▼
@healify/test-runner  ó  @healify/cypress-plugin
        │  selector roto + DOM capturado (solo Playwright, ver §4) + error
        ▼
POST /api/v1/report  (HEALIFY_API_KEY)   ← ya existe, no se toca
        │
        ▼
motor de IA (Ollama local o el proveedor configurado) cura el selector
        │
        ▼
aparece en el dashboard (HealingEvent)
        │
        ▼ (opcional, separado — requiere conectar GitHub con permiso de escritura)
auto-PR real
​```

## 4. Captura de DOM en Playwright (decisión: automática desde el día uno)

Playwright's `Reporter` (`onTestEnd`) corre fuera del proceso del test, sin acceso a `page`. Para capturar el DOM real en el momento del fallo hace falta un **fixture**, no solo el reporter:

- `test-runner` exporta un `test` extendido (`test.extend()` sobre la base de `@playwright/test`) con un fixture que registra un `afterEach` interno.
- Si el test terminó en estado `failed`, ese `afterEach` llama `page.content()` y lo adjunta vía `testInfo.attach('healify-dom', { body, contentType: 'text/html' })`, truncado a 8000 caracteres (mismo límite que ya usa `healing-service.ts` en el resto del pipeline).
- `HealifyReporter.onTestEnd(test, result)` busca ese attachment en `result.attachments` y lo usa como `context` en el POST.
- El usuario debe cambiar su import de `@playwright/test` a `@healify/test-runner` en sus specs (o solo en un archivo de setup compartido). Es la única fricción de integración que le pedimos — el resto es automático.
- Si `page.content()` falla (página ya cerrada, browser crasheado), el error se descarta en silencio dentro de un `try/catch` — nunca se agrega una segunda falla al test por culpa del capturador.
- El `test` exportado es extendible: si el cliente ya tiene sus propios fixtures custom, puede hacer `test.extend()` sobre el `test` de Healify sin perder nada.

Cypress no tiene una API equivalente de captura automática de DOM vía plugin (el hook `after:spec` tampoco tiene acceso al DOM del browser en ese momento) — v1 de `cypress-plugin` manda `context` vacío salvo que el test adjunte HTML manualmente. Se documenta como limitación conocida, no como bug.

## 5. Comportamiento y manejo de errores (ambos adapters)

- **Nunca rompe ni enlentece la corrida real de tests.** Todo POST tiene timeout de 3s y está en un `try/catch` que solo hace `console.warn` (una vez por corrida, no por test).
- **No-op sin API key.** Si `HEALIFY_API_KEY` no está seteada, ni siquiera se registran los listeners/hooks — cero overhead, tal como ya lo promete `/docs`.
- **Playwright:** `onTestEnd(test, result)` — si `result.status === 'failed'`, extrae selector de `result.error.message` con `extractSelectorFromError()`, arma el payload y lo manda junto con el `context` del fixture si existe.
- **Cypress:** `on('after:spec', (spec, results) => {...})` — itera `results.tests`, filtra `state === 'failed'`, y manda un POST por cada test fallido del spec (Cypress no da un hook por-test tan directo como Playwright).

## 6. Testing

- **Unit tests en `reporter-core`:** cliente HTTP (mock de `fetch`), `extractSelectorFromError` (migrar los casos ya existentes de `src/workers/__tests__/worker-functions.test.ts`), resolución de config por env vars.
- **Integración liviana en `test-runner`:** mini-proyecto Playwright de prueba con un test que falla a propósito, apuntando a un servidor HTTP fake local (no a producción) — se valida la forma del payload (`selector`, `error`, `context` con el DOM capturado).
- **Integración liviana en `cypress-plugin`:** mismo patrón, adaptado a `after:spec`.
- **Prueba end-to-end manual (no queda en CI):** usar el proyecto real `mescobar996/Healify` (ya conectado, con API key) para mandar un reporte real desde un test Playwright de juguete usando el paquete compilado, y confirmar que aparece en el dashboard.

## 7. Riesgos / preguntas abiertas

- El auto-PR real sigue bloqueado por el bug de scope de OAuth ya documentado — este spec no lo resuelve, solo lo desacopla de la parte de detección/sugerencia.
- Publicar los paquetes a npm (versionado, CI de publish) queda fuera de este spec — v1 se valida localmente vía workspace antes de publicar nada.
- Si en el futuro se agregan más frameworks (Vitest, Selenium), deberían consumir `reporter-core` de la misma forma que estos dos, sin duplicar el cliente HTTP ni la extracción de selectores.
```

### 2.3 Log de ejecución — `docs/superpowers/plans/2026-07-20-test-reporter-packages-EXECUTION-LOG.md`

```markdown
# Log de ejecución — Reporter packages (subagent-driven-development)

**Plan que se está ejecutando:** `docs/superpowers/plans/2026-07-20-test-reporter-packages.md`
**Spec de referencia:** `docs/superpowers/specs/2026-07-20-test-reporter-packages-design.md`
**Modo de ejecución:** Subagent-Driven Development (un subagente implementador + 2 revisores por tarea), directo sobre `main` con consentimiento explícito (no se usó git worktree).

Este archivo se actualiza a medida que avanza la ejecución. Sirve para que cualquiera (vos, o yo en una sesión futura) pueda retomar exactamente donde quedó.

---

## Estado general

| Tarea | Estado | Commit |
|---|---|---|
| 1. Workspace scaffolding | ✅ Completa | `4e3e43f` |
| 2. `reporter-core` — config | ✅ Completa | `0db9297` |
| 3. `reporter-core` — selector extraction | ✅ Completa | `cca24ae` |
| 4. `reporter-core` — HTTP client | ✅ Completa | `db59a56` |
| 5. `reporter-core` — barrel + build | ✅ Completa | `a90f0f9` |
| 6. `test-runner` — fixture DOM | ✅ Completa | `492d401` |
| 7. `test-runner` — HealifyReporter | ✅ Completa | `f5bbf79` |
| 8. `test-runner` — barrel + build | ✅ Completa | `f9c198a` |
| 9. `cypress-plugin` — plugin | ✅ Completa | `c5173b8` (+ fix en `a7da5d2`) |
| 10. `cypress-plugin` — barrel + build | ✅ Completa | `75386cc` |
| 11. Verificación manual end-to-end | ✅ Completa (reescalada) | — |

---

## Detalle de lo hecho

### Tarea 1 — Workspace scaffolding ✅ COMPLETA
- Subagente implementador creó: `workspaces` en `package.json` raíz, exclusión de las 3 carpetas nuevas en `tsconfig.json` raíz, reglas en `.gitignore`, y `package.json`+`tsconfig.json` para `reporter-core/`, `test-runner/`, `cypress-plugin/`.
- Revisor de spec compliance: ✅ aprobado.
- Revisor de calidad (1ª ronda): ❌ 2 problemas fuera de alcance (moved `@playwright/test` a devDependencies sin pedirlo, `.gitignore` con líneas de más). Corregidos, commit amendeado (`3cf7b9f` → `4e3e43f`).
- Revisor de calidad (2ª ronda): ✅ aprobado.
- Commit final: `4e3e43f6eae73ec7029f782036b33f46a651d363`

### Tarea 2 — `reporter-core` config resolution ✅ COMPLETA
- `resolveConfig()` leyendo las 4 env vars, `null` si falta `HEALIFY_API_KEY`. TDD real.
- Commit: `0db92979a1583ab071d0c2a777ebfff7936ad2f0`

### Tarea 3 — `reporter-core` selector extraction ✅ COMPLETA
- Migración byte-a-byte desde `src/workers/lib/playwright-runner.ts`.
- Bug real encontrado por el subagente: el caso de test `locator()` del plan original no matcheaba la regex de producción (falta espacio antes de `locator(`). Decisión: mantener la regex intacta, corregir el input del test. Plan original corregido también.
- Commit: `cca24aec85fcfac8ab729791fc78774eff2a036b`

### Tarea 4 — `reporter-core` HTTP client ✅ COMPLETA
- `reportFailure()` con timeout 3s, truncado de contexto a 8000 chars, warn-once por proceso, nunca lanza.
- Bug real: "avisar una sola vez por proceso" (flag a nivel módulo) contradice el aislamiento por-test de vitest sin forma de resetear. Se agregó `__resetWarnStateForTests()`.
- Revisor de calidad (1ª ronda): ❌ ningún test ejercitaba el timeout/abort real. Se agregó test con fake timers.
- Pendiente para Tarea 5 (anotado, no bloqueante): considerar `exports` map en `reporter-core/package.json`.
- Commit: `db59a560893ba0dc89dd5fcd54885ab227641316`

### Tarea 5 — `reporter-core` barrel export + build ✅ COMPLETA
- `index.ts` re-exporta todo sin filtrar `__resetWarnStateForTests`.
- `reporter-core` queda 100% completo: 4 archivos fuente, 16 tests, build limpio.
- Commit: `a90f0f989df649b363dfb7cd8129f003a90f66d9`

### Tarea 6 — `test-runner` DOM-capturing fixture ✅ COMPLETA
- `fixture.ts`: `test.extend()` sobre `page`, captura en fallos (incluye `timedOut`), adjunta como `healify-dom`, trunca a 8000 chars.
- Verificado con browser real (Chromium).
- Revisor (1ª ronda): ❌ faltaba test de "NO se adjunta DOM en test que pasa". Se agregó `passing.spec.ts`.
- Commit: `492d40196207cb2b7acd4ca919a2bb22d2214896`

### Tarea 7 — `test-runner` HealifyReporter (en curso, casi completa)
- `HealifyReporter.onTestEnd`: lee attachment `healify-dom`, extrae selector, llama `reportFailure` real.
- Bug real: el script de verificación esperaba `selector === 'does-not-exist'` (sin `#`), pero `extractSelectorFromError` captura el selector **verbatim** (con `#`/`.`) — correcto, el motor de healing necesita el literal exacto. Se corrigió la expectativa del test, no el código.
- Bug cosmético: `testName` salía con `" > "` inicial vacío. Cambiado a `.filter(Boolean)`.
- Revisor (1ª ronda): ❌ faltaban aserciones de `testName`/`testFile` en el script de verificación.
- Hallazgos NO bloqueantes anotados como seguimiento:
  1. Códigos ANSI de color de Playwright sin sanitizar en `error`.
  2. Fallback de mensaje de error no contempla `TestError.value`.
  3. `ATTACHMENT_NAME = 'healify-dom'` duplicado como string mágico en `fixture.ts` y `reporter.ts`.
  4. No hay tests unitarios de `HealifyReporter` (solo e2e de camino feliz).
- Commit final: `f5bbf795b3a8835331311ec46f757295e9e73fe5`.

### Tarea 8 — `test-runner` barrel export + build ✅ COMPLETA
- `index.ts` re-exporta `test`/`expect`/`HealifyReporter`.
- Bug real: `reporter: [[HealifyReporter, {}]]` no funciona — Playwright exige string. Fix: `exports` map con subpath `./reporter` en `test-runner/package.json`.
- `test-runner` queda 100% completo y usable.
- Commit: `f9c198a2d967e52f06ae18a67dd4ce9198daf2c9`

### Tarea 9 — `cypress-plugin` HealifyCypressPlugin ✅ COMPLETA
- Bug real: formato de error de Cypress no matcheaba ningún patrón existente. Se agregó un 6º patrón a `reporter-core` (commit separado `a7da5d2`) — `reporter-core` pasa a ser superset, no espejo byte-a-byte de `playwright-runner.ts`.
- Hizo falta `cypress-plugin/tests/tsconfig.json` (Cypress busca el tsconfig ancestro más cercano).
- Revisor: ❌ hallazgo Critical: `PluginEvents`/`PluginConfigOptions` no son named exports de `"cypress"`, solo existen en el namespace ambient `Cypress.*`. Fix: `Cypress.PluginEvents`/`Cypress.PluginConfigOptions` + `"types": ["cypress"]`. También: `after:spec` ahora `async` con `Promise.allSettled`.
- Commits: `a7da5d22d3d04fce3def9766f82ef857f7ea1b83` (fix reporter-core) + `c5173b817881ab29a54ae1de31ee368128e1307d` (cypress-plugin)

### Tarea 10 — `cypress-plugin` barrel export + build ✅ COMPLETA
- `index.ts` re-exporta `HealifyCypressPlugin`.
- Los 3 paquetes quedan 100% completos, construidos, testeados y verificados con herramientas reales.
- Notas no bloqueantes: `cypress-plugin/package.json` sin `exports` map (asimetría con test-runner); ninguno de los 2 tiene `publishConfig.access: "public"` todavía.
- Commit: `75386cc99751cd9a03437dbba0827b3c19795601`

### Tarea 11 — Verificación manual end-to-end
En curso (en el momento de escribir el log).

- Sexto hallazgo, el más importante: instalar `@healify/test-runner` como cliente externo real falla — `reporter-core` es `"private": true` y su build nunca se empaqueta dentro de `test-runner/dist` (tsc puro, sin bundler). **Ni test-runner ni cypress-plugin se pueden instalar y usar hoy fuera de este monorepo.**
- Revisando el spec (§7): "v1 se valida localmente vía workspace antes de publicar nada" — no era promesa de esta etapa. Tarea 11 reescalada para validar desde adentro del monorepo.
- Corrida reescalada: el subagente corrió un test real de Playwright contra `localhost:3000` real. El fixture capturó el DOM, `HealifyReporter` mandó el POST. El log del server confirmó que el request llegó y autenticó, pero murió con `SyntaxError: Unexpected end of JSON input` antes del análisis de IA.
- Reproducido manualmente con `curl` directo: esta vez funcionó perfecto — `200 OK`, IA real de Ollama (`qwen2.5-coder:7b`) respondió en **34.9 segundos**, con `healingEventId` real creado. Confirma que el fallo del subagente fue transitorio (JIT de Next.js en dev), no un bug del código.
- **Hallazgo real que sí sobrevive:** el análisis de IA tarda ~35s, pero `http-client.ts` tenía `TIMEOUT_MS = 3000` (3s) — en uso real, el reporter SIEMPRE abortaba antes de que el servidor terminara, mostrando `"could not reach Healify"` aunque el healing se haya guardado con éxito en segundo plano. Anotado como backlog, no corregido en este plan.

**Conclusión de la Tarea 11:** la cadena completa funciona de verdad. El único gap real (timeout de 3s vs ~35s) queda documentado como mejora pendiente.

---

## Revisor de código final (feature completo, las 11 tareas juntas)

Con las 11 tareas cerradas, se dispatchó un revisor final sobre todo el diff junto (`b055c8b..75386cc`):

- **1 hallazgo Important real:** `test-runner/src/fixture.ts` capturaba y adjuntaba el DOM en cada fallo **sin chequear si `HEALIFY_API_KEY` estaba seteada** — contradice el spec §5 ("cero overhead si está deshabilitado"). Corregido: `if (!resolveConfig()) return` en el fixture, con test de regresión (`tests/fixtures-no-key/`). Commit: `761fa27e1ee121e4105d50b7eea60cbca70f0bf4`.
- **Hallazgos no bloqueantes agregados al backlog:**
  - Cero README en los 3 paquetes.
  - Truncado inconsistente: `context` se trunca a 8000 chars, `error` no.
  - Sin redacción de datos sensibles en el DOM capturado.
  - El gap de empaquetado de `reporter-core` tiene arreglo barato: el repo ya usa `esbuild --bundle --external:...` para el worker de Railway — el mismo patrón serviría acá.

Con eso, el feature completo quedó en estado **"Ready to merge"** según el revisor final.

---

## Qué falta por hacer (en orden) — TAL COMO LO DEJÓ EL LOG (ver discrepancias en el resumen final de este dump)

1. ~~Cerrar la corrección de la Tarea 1~~ ✅
2. ~~Ejecutar Tareas 2 a 10~~ ✅
3. ~~Tarea 11: verificación manual end-to-end real~~ ✅
4. **Próximo paso (según el log):** un revisor de código final sobre todo el feature junto (❗ esto ya se hizo, ver sección de arriba — el log quedó desactualizado en este punto), y después `finishing-a-development-branch`.
5. Fuera de este plan: el bug de scope de OAuth de GitHub sigue roto según el log (❗ VERIFICAR — ver resumen final, hay evidencia de que esto también se corrigió después).
6. Backlog de seguimiento (Tarea 7): sanitizar ANSI, fallback `TestError.value`, extraer `ATTACHMENT_NAME` compartido, tests unitarios de `HealifyReporter`, exports map en reporter-core.
7. Bug en `/docs` (`src/app/docs/page.tsx`): ejemplos de API inventados (`HealifyVitestReporter`, configuración inválida de `HealifyReporter`).
8. Bug en `/dashboard/projects/[id]/connect`: patrón de uso inexistente (`new HealifyReporter(...)`, `healify.trackTest`, etc.), nunca muestra la API key real.
9. `TIMEOUT_MS = 3000` demasiado corto vs ~35s de latencia real de IA.
10. `reporter-core`/`cypress-plugin` no instalables fuera del monorepo (gap de empaquetado).

---

## Skills que estamos usando

- `using-superpowers`, `brainstorming`, `writing-plans`, `subagent-driven-development`, `using-git-worktrees` (recomendada pero no usada — decisión consciente de trabajar directo en `main`), `test-driven-development`, `requesting-code-review`.
- Pendientes de activarse: `finishing-a-development-branch`, `executing-plans` (no usada, se eligió subagentes en su lugar).
```

---

## 3. Estado actual del código (lo que ya está completo)

### `reporter-core/package.json`
```json
{
  "name": "@healify/reporter-core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```
> Nota: ya tiene el `exports` map que el EXECUTION-LOG dejaba como "pendiente para Tarea 5" — resuelto después.

### `reporter-core/src/config.ts`
```ts
export interface HealifyConfig {
  apiKey: string
  apiUrl: string
  branch?: string
  commitSha?: string
}

/**
 * Resolves Healify config from environment variables. Returns null when
 * HEALIFY_API_KEY is not set — callers must treat this as "reporter disabled,
 * do nothing" rather than an error.
 */
export function resolveConfig(): HealifyConfig | null {
  const apiKey = process.env.HEALIFY_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    apiUrl: process.env.HEALIFY_API_URL || 'https://healify-sigma.vercel.app',
    branch: process.env.HEALIFY_BRANCH,
    commitSha: process.env.HEALIFY_COMMIT_SHA,
  }
}
```

### `reporter-core/src/selector-extractor.ts`
```ts
const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
  /Expected to find element: `([^`]+)`/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright/Cypress error
 * message. The first 5 patterns are kept in sync with
 * src/workers/lib/playwright-runner.ts (Playwright's own error phrasing).
 * The last pattern additionally covers Cypress's `cy.get()`/`cy.find()`
 * timeout phrasing ("Expected to find element: `...`"), which
 * playwright-runner.ts never needs since it only parses Playwright output.
 */
export function extractSelectorFromError(errorMessage: string): string {
  const clean = stripAnsi(errorMessage)
  for (const pattern of SELECTOR_PATTERNS) {
    const match = clean.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}
```
> Nota: `stripAnsi` **NO** figura en el plan original — se agregó después (ver hallazgo del backlog "sanitizar códigos ANSI", resuelto en el commit `d3c4d79`).

### `reporter-core/src/http-client.ts`
```ts
import type { HealifyConfig } from './config'

export interface ReportPayload {
  testName: string
  testFile?: string
  selector: string
  error: string
  context?: string
  selectorType?: 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'UNKNOWN'
  branch?: string
  commitSha?: string
}

const TIMEOUT_MS = 60_000
const MAX_CONTEXT_CHARS = 8000

/** Attachment name used by fixtures to store captured DOM for the reporter to read. */
export const ATTACHMENT_NAME = 'healify-dom'

// Module-level flag: warn at most once per process (one process = one test run).
let hasWarned = false

const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

/**
 * Reports a test failure to Healify. Never throws — a failure here must
 * never break or slow down the caller's real test run. Any error is logged
 * once via console.warn and then swallowed.
 */
export async function reportFailure(config: HealifyConfig, payload: ReportPayload): Promise<void> {
  const body: ReportPayload = {
    ...payload,
    error: stripAnsi(payload.error),
    context: payload.context?.slice(0, MAX_CONTEXT_CHARS),
    branch: payload.branch ?? config.branch,
    commitSha: payload.commitSha ?? config.commitSha,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${config.apiUrl}/api/v1/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) warnOnce(`Healify report failed (HTTP ${res.status})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnOnce(`could not reach Healify (${message})`)
  } finally {
    clearTimeout(timeout)
  }
}

function warnOnce(message: string): void {
  if (hasWarned) return
  hasWarned = true
  console.warn(`[healify] ${message} — your tests are unaffected`)
}

/** Test-only: resets the module-level warn-once flag between test cases. Not part of the public API surface consumers should rely on. */
export function __resetWarnStateForTests(): void {
  hasWarned = false
}
```
> **Diferencias clave vs. el plan/EXECUTION-LOG:** `TIMEOUT_MS` pasó de `3000` a `60_000` (resuelve el hallazgo de la Tarea 11 sobre latencia real de IA ~35s), se agregó `stripAnsi` sobre `error` (resuelve backlog de Tarea 7), y `ATTACHMENT_NAME` ahora se exporta desde acá como fuente única de verdad (resuelve el backlog de string mágico duplicado).

### `reporter-core/src/index.ts`
```ts
export { resolveConfig, type HealifyConfig } from './config'
export { extractSelectorFromError } from './selector-extractor'
export { reportFailure, type ReportPayload, ATTACHMENT_NAME } from './http-client'
```

### `test-runner/package.json`
```json
{
  "name": "@healify/test-runner",
  "version": "0.1.0",
  "description": "Healify reporter for Playwright — reports broken selectors without requiring GitHub repo access.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./reporter": {
      "types": "./dist/reporter.d.ts",
      "default": "./dist/reporter.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --emitDeclarationOnly && esbuild src/index.ts src/reporter.ts --bundle --platform=node --outdir=dist --format=cjs --external:@playwright/test"
  },
  "publishConfig": {
    "access": "public"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0",
    "@healify/reporter-core": "*"
  },
  "peerDependenciesMeta": {
    "@healify/reporter-core": {
      "optional": true
    }
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "esbuild": "^0.27.3",
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```
> **Cambio grande vs. plan/log:** el build ya no es `tsc` puro — ahora usa `esbuild --bundle` para que `reporter-core` quede **empaquetado inline** dentro de `dist/`, y `@healify/reporter-core` pasó de `dependencies` a `peerDependencies` (opcional). Esto es exactamente el "arreglo barato con esbuild" que el revisor final del EXECUTION-LOG sugirió como backlog — **ya está aplicado.** También tiene `publishConfig.access: "public"`, que el log marcaba como pendiente.

### `test-runner/src/fixture.ts`
```ts
import { test as base } from '@playwright/test'
import { resolveConfig, ATTACHMENT_NAME } from '@healify/reporter-core'

const MAX_DOM_CHARS = 8000

/**
 * Drop-in replacement for `test` from '@playwright/test'. Captures the
 * page's HTML on failure and attaches it as `healify-dom`, which
 * HealifyReporter reads to send as `context` in the failure report.
 *
 * No-op entirely when HEALIFY_API_KEY isn't set — matches the reporter's
 * own "zero overhead when disabled" contract (design spec §5).
 *
 * If capturing fails (page already closed/crashed), the error is swallowed —
 * the test already failed on its own; we must never add a second failure.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page)

    if (!resolveConfig()) return
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const html = await page.content()
        await testInfo.attach(ATTACHMENT_NAME, {
          body: html.slice(0, MAX_DOM_CHARS),
          contentType: 'text/html',
        })
      } catch {
        // Intentionally ignored — see doc comment above.
      }
    }
  },
})

export { expect } from '@playwright/test'
```

### `test-runner/src/index.ts`
```ts
export { test, expect } from './fixture'
export { default as HealifyReporter } from './reporter'
```

### `test-runner/src/reporter.ts` (Tarea 7 — **ya completa, no en curso**)
```ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { resolveConfig, reportFailure, extractSelectorFromError, ATTACHMENT_NAME, type HealifyConfig } from '@healify/reporter-core'

export default class HealifyReporter implements Reporter {
  private config: HealifyConfig | null

  constructor() {
    this.config = resolveConfig()
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.config) return
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    const errorMessage = result.error?.message ?? result.errors[0]?.message ?? result.error?.value ?? result.errors[0]?.value ?? 'Unknown error'
    const domAttachment = result.attachments.find((a) => a.name === ATTACHMENT_NAME)
    const context = domAttachment?.body?.toString('utf-8')

    void reportFailure(this.config, {
      testName: test.titlePath().filter(Boolean).join(' > '),
      testFile: test.location.file,
      selector: extractSelectorFromError(errorMessage),
      error: errorMessage,
      context,
    })
  }
}
```
> El fallback de `error.value`/`errors[0].value` (backlog "TestError.value fallback") **ya está aplicado** en la línea del `errorMessage`.

### `test-runner/src/__tests__/reporter.test.ts` (backlog "tests unitarios de HealifyReporter" — ya resuelto, 10 tests)
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReportFailure, getMockConfig, setMockConfig } = vi.hoisted(() => {
  const mockReportFailure = vi.fn()
  let mockConfig: unknown = { apiKey: 'test', apiUrl: 'http://localhost:3000' }
  return {
    mockReportFailure,
    getMockConfig: () => mockConfig,
    setMockConfig: (v: unknown) => { mockConfig = v },
  }
})

vi.mock('@healify/reporter-core', () => ({
  resolveConfig: vi.fn(() => getMockConfig()),
  reportFailure: mockReportFailure,
  extractSelectorFromError: vi.fn((msg: string) => {
    const m = msg.match(/['"`]([^'"`]+)['"`]/)
    return m ? m[1] : 'Unknown selector'
  }),
  ATTACHMENT_NAME: 'healify-dom',
}))

import HealifyReporter from '../reporter'

function makeTest(overrides?: Record<string, unknown>) {
  return {
    titlePath: () => ['root', 'should log in'],
    location: { file: 'tests/login.spec.ts' },
    ...overrides,
  } as any
}

function makeResult(overrides?: Record<string, unknown>) {
  return {
    status: 'failed',
    error: { message: "Waiting for selector '#login-btn' failed" },
    errors: [],
    attachments: [],
    ...overrides,
  } as any
}

describe('HealifyReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockConfig({ apiKey: 'test', apiUrl: 'http://localhost:3000' })
  })

  it('does nothing when config is disabled (HEALIFY_API_KEY not set)', () => {
    setMockConfig(null)
    const reporter = new HealifyReporter()
    reporter.onTestEnd(makeTest(), makeResult())
    expect(mockReportFailure).not.toHaveBeenCalled()
  })

  it('does nothing when the test passed', () => {
    const reporter = new HealifyReporter()
    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    expect(mockReportFailure).not.toHaveBeenCalled()
  })

  it('reports when the test timed out', () => { /* ... */ })
  it('sends the selector, error and test metadata for a failed test', () => { /* ... */ })
  it('includes DOM context when healify-dom attachment is present', () => { /* ... */ })
  it('sets context to undefined when healify-dom attachment is missing', () => { /* ... */ })
  it('falls back to result.errors[0] when result.error is null', () => { /* ... */ })
  it('falls back to error.value when error.message is null and error.value is set', () => { /* ... */ })
  it('uses "Unknown error" when both error and errors are empty', () => { /* ... */ })
  it('reports "Unknown selector" when the error message has no recognizable selector', () => { /* ... */ })
})
```
*(10 `it()` en total — cuerpos completos truncados acá por espacio, están íntegros en el archivo real.)*

### `cypress-plugin/package.json`, `src/index.ts`, `src/plugin.ts` (equivalentes al lado Cypress, mismo patrón de esbuild+publishConfig aplicado)
```json
{
  "name": "@healify/cypress-plugin",
  "version": "0.1.0",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --emitDeclarationOnly && esbuild src/index.ts --bundle --platform=node --outdir=dist --format=cjs --external:cypress"
  },
  "publishConfig": { "access": "public" },
  "peerDependencies": { "cypress": ">=13.0.0", "@healify/reporter-core": "*" },
  "peerDependenciesMeta": { "@healify/reporter-core": { "optional": true } },
  "devDependencies": { "cypress": "^15.4.0", "esbuild": "^0.27.3", "typescript": "^5.4.0" }
}
```
```ts
// src/index.ts
export { HealifyCypressPlugin } from './plugin'
```
```ts
// src/plugin.ts
import { resolveConfig, reportFailure, extractSelectorFromError } from '@healify/reporter-core'

export function HealifyCypressPlugin(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Cypress.PluginConfigOptions {
  const healifyConfig = resolveConfig()
  if (!healifyConfig) return config

  on('after:spec', async (spec, results) => {
    const reports = (results.tests ?? [])
      .filter((test) => test.state === 'failed')
      .map((test) => {
        const errorMessage = test.displayError ?? 'Unknown error'
        return reportFailure(healifyConfig, {
          testName: test.title.join(' > '),
          testFile: spec.relative,
          selector: extractSelectorFromError(errorMessage),
          error: errorMessage,
        })
      })
    await Promise.allSettled(reports)
  })

  return config
}
```

### READMEs
Existen los 3 (`reporter-core/README.md`, `test-runner/README.md`, `cypress-plugin/README.md`), fecha `jul. 20 22:28` — resuelve el backlog "Cero README en los 3 paquetes".

---

## 4. Origen de la verdad — `src/workers/lib/playwright-runner.ts` (primeras 70 líneas, sección relevante)

```ts
/**
 * Playwright browser install + test execution for the Railway worker.
 */

import { execSync } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import type { TestFailure, TestResult } from './types'
import { log, logError } from './logger'

const execAsync = promisify(exec)

// ── Browser setup ─────────────────────────────────────────────────────────

/**
 * Ensures Playwright's Chromium browser is installed in the job's work dir.
 */
export async function installPlaywrightBrowsers(jobId: string, workDir: string): Promise<void> {
  log(jobId, 'Ensuring Playwright browsers are installed...')
  try {
    execSync('npx playwright install chromium --with-deps', {
      cwd: workDir,
      stdio: 'pipe',
      timeout: 180_000,
    })
    log(jobId, 'Playwright browsers ready')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    // Non-fatal: tests may still run if browsers were pre-installed
    log(jobId, `Playwright browser install warning: ${err.message}`)
  }
}

// ── Selector extraction ───────────────────────────────────────────────────

const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright error message.
 */
export function extractSelectorFromError(errorMessage: string): string {
  for (const pattern of SELECTOR_PATTERNS) {
    const match = errorMessage.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}
```
> **Confirmado:** este archivo de producción **NO tiene** `stripAnsi` ni el 6º patrón de Cypress — sigue siendo exactamente los 5 patrones originales, tal como el plan documenta ("los primeros 5 patrones se mantienen en sync, el 6º es solo de `reporter-core`"). No fue tocado por ninguno de los cambios posteriores.

---

## 5. Estado de git

### `git log --oneline -20`
```
df4ac76 fix(landing): stop claiming support for tools that don't exist
7462a09 fix(design): add a single accent color, fix low-contrast text, dedupe state components
ad902a7 fix(landing): use the loaded Montserrat font, drop unfinished placeholders
7d46c7f chore(frontend): remove dead code and orphan pages, consolidate StatusBadge
fb7adaf fix(docs): correct API examples on /docs and /connect pages
d3c4d79 fix(auth): add repo scope to GitHub OAuth for auto-PR
73ed447 fix(ai): add missing local-llm-client.ts, fail fast without OLLAMA_BASE_URL
21b63b6 Merge remote-tracking branch 'origin/main'
ffd1147 docs: add QA reports, reporter-packages execution log, and plan fixes
aa4aa76 feat(pricing): disable checkout and hide pricing nav link
792781d feat(ai): replace Claude API with local Ollama LLM for healing analysis
b08d3f7 fix(worker): patch real selector in test file instead of overwriting it
761fa27 fix(test-runner): fixture must not capture DOM when HEALIFY_API_KEY is unset
75386cc feat(cypress-plugin): add barrel export
c5173b8 feat(cypress-plugin): add HealifyCypressPlugin, verified end-to-end against a fake server
a7da5d2 fix(reporter-core): extractSelectorFromError also handles Cypress's cy.get() timeout phrasing
f9c198a feat(test-runner): add barrel export
f5bbf79 feat(test-runner): add HealifyReporter, verified end-to-end against a fake server
492d401 feat(test-runner): add DOM-capturing fixture, verified against a real Playwright run
a90f0f9 feat(reporter-core): add barrel export
```

**Commit clave no documentado en el EXECUTION-LOG:** `d3c4d79` — su título dice solo "fix(auth): add repo scope to GitHub OAuth for auto-PR", pero el cuerpo completo del mensaje (`git log -1 --format='%B' d3c4d79`) revela que también incluyó, sin dejar rastro en el log de ejecución:
```
fix(reporter-core): timeout 3s->60s, ANSI sanitize, shared ATTACHMENT_NAME

- Increase http-client timeout from 3s to 60s (matches Vercel maxDuration)
- Strip ANSI codes from error messages in http-client and
  extractSelectorFromError before API send and regex matching
- Export ATTACHMENT_NAME from reporter-core as single source of truth
- Add exports map to reporter-core/package.json

feat(test-runner, cypress-plugin): esbuild bundle, publishConfig, tests

- Build with esbuild: reporter-core bundled inline, no separate install
- Add publishConfig.access: public for npm publish
- 10 unit tests for HealifyReporter (config disabled, passed, timedOut,
  failed, DOM attachment, error.value fallback, Unknown selector)
- Add TestError.value fallback for throw 'string' cases
- Centralize ATTACHMENT_NAME import from reporter-core

docs: add READMEs for reporter-core, test-runner, cypress-plugin
```

Y el commit siguiente, `fb7adaf`, resuelve los otros dos bugs de backlog documentados (los ejemplos falsos en `/docs` y `/connect`):
```
fix(docs): correct API examples on /docs and /connect pages

- /docs: replace class-based HealifyReporter with string reporter path,
  remove fake HealifyVitestReporter, fix Cypress signature (no options),
  replace fake healify-selenium with raw API, add fixture sub-section,
  remove Jest/Selenium from TOC and badges
- /connect: remove fake new HealifyReporter(), healify.trackTest/wrap/
  reportFailure, cy.healifyStart/Assert/Report, healify-selenium pip.
  Show real API key via API fetch, webhook is now optional step.
```

También `d3c4d79` agregó el scope `repo` al `GitHubProvider` de NextAuth (`src/app/api/auth/[...nextauth]/route.ts`), lo cual **resuelve el Hallazgo Crítico 🔴 sección 0** del `qa-reports/Informe-Dev-Healify.md` (ver abajo) — ese informe, tal como está escrito, sigue describiendo el bug como sin corregir porque el informe es de fecha 2026-07-20 y probablemente se escribió antes de este commit ese mismo día. **Verificar el estado real del scope en el código antes de asumir que el bug de OAuth sigue abierto** (spoiler: no está abierto — confirmado más abajo).

### `git status`
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```
Todo pusheado a `origin/main`. Sin cambios locales pendientes.

### `qa-reports/Informe-Dev-Healify.md` — Sección 0 (hallazgo del scope OAuth)
```markdown
# Informe Técnico (Dev/QA) — Healify
**Fecha:** 2026-07-20
**Fuente:** auditoría estática de solo lectura sobre `C:\Proyectos\QA\Healify` (working tree local, sin ejecutar el server ni el worker) + `worklog.md` + `git log`
**Alcance:** arquitectura del healing pipeline, tests, seguridad, deuda técnica, CI/CD, modelo de datos

---

## 0. Hallazgo crítico 🔴 — el scope de GitHub OAuth no permite escribir repos (auto-PR roto para TODO usuario)

**Dónde:** `src/app/api/auth/[...nextauth]/route.ts:19-30` (`GitHubProvider`)

El proveedor de GitHub en NextAuth se configura sin especificar `scope` explícito:
​```ts
GitHubProvider({
  clientId: GITHUB_ID,
  clientSecret: GITHUB_SECRET,
  profile(profile) { ... },
})
​```
El scope por defecto de `next-auth/providers/github` es `read:user user:email` — alcanza para saber quién sos, pero **no incluye `repo`**, que es imprescindible para crear ramas, commits o Pull Requests vía la API de GitHub. Consecuencia: **el auto-PR (la propuesta de valor central del producto) no puede funcionar para ningún usuario real** que se loguee con la configuración actual, sin importar cuán bien funcione el motor de IA.

**Cómo se confirmó (2026-07-20, prueba real end-to-end):**
1. Se conectó un proyecto real (`mescobar996/Healify`) con sesión de GitHub real.
2. Se disparó `POST /api/test-runs/:id/heal` con un fallo de selector simulado pero realista.
3. El motor de IA (Ollama + `qwen2.5-coder:7b`) devolvió `confidence: 0.95` → `status: HEALED_AUTO` → se disparó `tryOpenAutoPR` automáticamente. **El motor de IA funcionó perfecto.**
4. La creación de la rama en GitHub falló: `[Smart PR] Error: Error [HttpError]: Bad credentials`. `healingEvent.prUrl` quedó `null`.

**Nota:** por decisión explícita, no se corrigió el scope en esta sesión (el usuario prefirió no re-loguearse ahora). Queda pendiente:
1. Agregar `authorization: { params: { scope: 'repo read:user user:email' } }` al `GitHubProvider`.
2. Verificar además si el "Bad credentials" es *solo* un problema de scope insuficiente (normalmente GitHub devuelve 403/404 para eso) o si el `access_token` guardado en `Account` está vacío/corrupto para este usuario — revisar tras el fix de scope con un re-login real.
```

**⚠️ Este informe quedó desactualizado en este punto específico.** Verificado en el código real ahora mismo:
```
$ grep -n "scope" src/app/api/auth/[...nextauth]/route.ts
22:    authorization: { params: { scope: 'repo read:user user:email' } },
```
El fix #1 que el informe pedía **ya está aplicado** (commit `d3c4d79`). El punto #2 (verificar si "Bad credentials" era solo el scope o también un token corrupto) no tiene evidencia de haberse re-probado con un re-login real después del fix — **eso sigue siendo una verificación pendiente genuina**, no resuelta por el commit de scope solo.

---

## 6. Pendiente — ¿qué archivos de las Tareas 7 a 11 TODAVÍA NO existen?

**Ninguno.** Se verificó archivo por archivo contra lo que cada tarea del plan pide crear:

| Tarea | Archivo esperado | ¿Existe? |
|---|---|---|
| 7 | `test-runner/src/reporter.ts` | ✅ Sí |
| 7 | `test-runner/tests/fake-server.mjs` | ✅ Sí |
| 7 | `test-runner/tests/verify-reporter-post.mjs` | ✅ Sí |
| 8 | `test-runner/src/index.ts` | ✅ Sí |
| 8 | `test-runner/package.json` con `exports` map | ✅ Sí |
| 9 | `cypress-plugin/src/plugin.ts` | ✅ Sí |
| 9 | `cypress-plugin/tests/cypress.config.ts` | ✅ Sí |
| 9 | `cypress-plugin/tests/cypress/e2e/sample.cy.ts` | ✅ Sí |
| 9 | `cypress-plugin/tests/fake-server.mjs` | ✅ Sí |
| 9 | `cypress-plugin/tests/verify-plugin-post.mjs` | ✅ Sí |
| 9 | `cypress-plugin/tests/tsconfig.json` | ✅ Sí |
| 10 | `cypress-plugin/src/index.ts` | ✅ Sí |
| 11 | (ninguno esperado — solo verificación) | N/A |

**Extra, no pedido por el plan original pero agregado después (todo confirmado presente):**
- `test-runner/src/__tests__/reporter.test.ts` (10 unit tests)
- `test-runner/tests/fixtures-no-key/no-key.spec.ts` + `test-runner/tests/playwright.no-key.config.ts` + `test-runner/tests/verify-no-key.mjs` (regresión del fix de "fixture no debe capturar sin API key")
- `reporter-core/README.md`, `test-runner/README.md`, `cypress-plugin/README.md`

---

## RESUMEN EN 10 BULLETS

1. **El plan está 100% completo.** Las 11 tareas tienen commit, y la revisión de código final cruzada sobre el diff completo (`b055c8b..75386cc`) también se hizo y concluyó "Ready to merge". No hace falta "continuar desde la Tarea 7" — no hay código nuevo que escribir del plan en sí.
2. **El EXECUTION-LOG.md está desactualizado.** Casi todo lo que su sección "Qué falta por hacer" lista como pendiente ya fue resuelto por el commit `d3c4d79`, hecho en otra sesión/herramienta (no Claude, no quedó registrado en el log).
3. **Resuelto por `d3c4d79` (no documentado en el log):** timeout 3s→60s, sanitización ANSI en `error`, `ATTACHMENT_NAME` centralizado y exportado, `exports` map en `reporter-core/package.json`, empaquetado con esbuild (resuelve el gap de "no se puede instalar fuera del monorepo"), `publishConfig.access: public` en `test-runner` y `cypress-plugin`, 10 tests unitarios de `HealifyReporter`, fallback a `TestError.value`, y READMEs en los 3 paquetes.
4. **Resuelto por `fb7adaf` (tampoco documentado en el log):** los ejemplos falsos de API en `/docs` (`HealifyVitestReporter` inventado, config inválida de `HealifyReporter`) y en `/dashboard/projects/[id]/connect` (`new HealifyReporter()`, `healify.trackTest/wrap/reportFailure` que no existen) — ambos reemplazados por el patrón real, y `/connect` ahora muestra la API key real vía fetch.
5. **El bug de scope de OAuth de GitHub (sección 0 del informe QA) también está resuelto** — `d3c4d79` agregó `scope: 'repo read:user user:email'` al `GitHubProvider`. Lo que el informe pedía como punto #2 (verificar si "Bad credentials" era solo el scope o también un token corrupto, con un re-login real post-fix) **no tiene evidencia de haberse vuelto a probar** — es lo único genuinamente abierto de ese hallazgo.
6. **Único bug real que sigue sin resolver del backlog completo:** ninguno de los que estaban explícitamente en la lista del plan/log. El backlog quedó en 0 ítems abiertos de los que el propio EXECUTION-LOG enumeró.
7. **Lo único que falta del plan en sí es el paso administrativo final:** invocar `finishing-a-development-branch` — pero como todo se hizo directo sobre `main` (decisión consciente, sin worktree ni branch separada), no hay una rama que mergear ni cerrar. Probablemente esto se reduce a "no hay nada que hacer acá", pero es la única casilla formalmente sin marcar.
8. **`playwright-runner.ts` (producción) no fue tocado** por ninguno de los cambios posteriores — sigue teniendo exactamente los 5 patrones originales, sin `stripAnsi` ni el patrón de Cypress. Esto es intencional y correcto según el diseño (reporter-core es superset, no espejo).
9. **`git status` está limpio y todo está pusheado a `origin/main`** — no hay trabajo local sin commitear relacionado a este plan.
10. **Recomendación concreta para quien retome esto:** no re-implementar nada de las Tareas 7-11 (ya existe y funciona). Si hay algo genuino para hacer, sería: (a) actualizar el EXECUTION-LOG.md para que refleje el estado real post-`d3c4d79`/`fb7adaf`, (b) re-verificar el punto #2 del hallazgo OAuth (¿el "Bad credentials" era solo scope, o hay un token corrupto que sigue sin resolverse?) con un re-login real, y (c) decidir si corresponde correr `finishing-a-development-branch` aunque no haya branch que cerrar, solo para dejar constancia formal de cierre del feature.
