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

```
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
```

### Diagrama de flujo (aprobado en la sesión de brainstorming)

```
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
```

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
