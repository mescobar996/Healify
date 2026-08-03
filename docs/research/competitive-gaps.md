# Healify vs. la competencia — gap analysis

**Fecha:** 2026-08-03 · **Healify:** v1.5.0 (538 tests, 7 paquetes)
**Método:** búsqueda GitHub (`gh api search/repositories`, orden por stars) + docs oficiales + web (ventana ~90 días de actividad).

> Restricción de diseño no negociable: Healify es **100% local, sin IA, sin nube, sin API key, sin telemetría**.
> Todo gap se evalúa contra esa restricción — lo que exige backend, DB o LLM queda descartado por definición,
> no por falta de valor.

---

## 1. Panorama de la competencia

| # | Proyecto | Stars | Último push | Qué resuelve | Cómo lo resuelve | DX |
|---|---|---:|---|---|---|---|
| 1 | [healenium/healenium-web](https://github.com/healenium/healenium-web) | 200 | 2026-03-05 | Self-healing de locators Selenium (referente del rubro) | Intercepta `NoSuchElementException`, compara el DOM actual contra el árbol histórico guardado en Postgres (algoritmo de subsecuencia LCS + scoring), genera CSS nuevo | `SelfHealingDriver.create(driver)` + `healenium.properties` (`score-cap`, `recovery-tries`, `heal-enabled`) + anotación `@DisableHealing` |
| 2 | [healenium/healenium](https://github.com/healenium/healenium) | 160 | 2026-03-31 | Backend del anterior (hlm-backend + Postgres + imitator) | Docker Compose, servicio HTTP `:7878` que guarda DOM/locators/screenshots | `docker-compose up`; reporte HTML servido en `/healenium/report/{id}` |
| 3 | [healenium/healenium-appium](https://github.com/healenium/healenium-appium) | 39 | 2026-07-30 | Mismo motor para mobile | Igual, driver wrapper | Igual |
| 4 | healenium/hlm-idea (plugin JetBrains) | — | activo | **Escribir el locator curado de vuelta en el código** | Plugin IDE que lee del backend y reescribe `@FindBy` en los page objects | Botón en el IDE |
| 5 | [SeleniumHQ/selenium-ide](https://github.com/SeleniumHQ/selenium-ide) | 3105 | 2026-02-06 | Record & playback | Guarda **múltiples estrategias por elemento** (id, name, css, xpath, linkText) y cae en cascada al reproducir | Extensión de browser, cero código |
| 6 | [microsoft/playwright](https://github.com/microsoft/playwright) | 93893 | 2026-08-03 | Baseline de la industria | Auto-waiting, locators semánticos (`getByRole`), **piercing automático de shadow DOM abierto**, `frameLocator`, retries + trace viewer | `npx playwright test`, `--ui`, `--last-failed`, `--repeat-each` |
| 7 | [cypress-io/cypress](https://github.com/cypress-io/cypress) | 50655 | 2026-08-03 | Runner + detección de flake | `cy.prompt()` (self-healing por NL, cloud), Cypress Cloud: score de flakiness por test, tendencia histórica, alertas ([issue #30805](https://github.com/cypress-io/cypress/issues/30805)) | Dashboard SaaS |
| 8 | [sclavijosuero/cypress-flaky-test-audit](https://github.com/sclavijosuero/cypress-flaky-test-audit) | 8 | 2026-01-01 | Diagnóstico de flakiness local | Instrumenta cada comando: orden, timing, retries, pass/fail | Plugin + reporte por comando |
| 9 | [DeploySentinel/cypress-quarantine](https://github.com/DeploySentinel/cypress-quarantine) | 8 | 2023-02-15 | Cuarentena de tests inestables | Skip dinámico por lista | Plugin (abandonado) |
| 10 | [ShantanuVr/playwright-self-healing-framework](https://github.com/ShantanuVr/playwright-self-healing-framework) | 2 | 2026-04-24 | **El competidor conceptual más cercano** | Fingerprint semántico del elemento + scoring contra el DOM vivo, reescritura al vuelo. **Zero LLM, zero API key** | Framework completo (TS + Vitest), no librería |
| 11 | [rundom-tech/testergizer-open-core](https://github.com/rundom-tech/testergizer-open-core) | 12 | 2026-04-30 | Framework Playwright con healing + snapshots DOM | Open-core (features pagas arriba) | Framework |
| 12 | [SanjayPG/autoheal-locator](https://github.com/SanjayPG/autoheal-locator) (+ [python](https://github.com/SanjayPG/autoheal-locator-python)) | 13 / 7 | 2025-10 / 2026-02 | Healing Selenium + Playwright | DOM analysis + reconocimiento visual + fallback, **con LLM** (OpenAI/Claude/Gemini) y caché por selector | Wrapper de locator; requiere API key |
| 13 | [headout/autoheal](https://github.com/headout/autoheal) | 2 | 2026-01-18 | Ídem | Ídem (fork del anterior) | Ídem |
| 14 | [testomatio/check-tests](https://github.com/testomatio/check-tests) | 20 | 2026-07-28 | Análisis estático de tests en CI | GitHub Action que parsea AST de los specs y comenta en el PR | **`uses: testomatio/check-tests@stable`** en el workflow |
| 15 | BrowserStack Automate self-heal / Applitools / Testim / mabl | — | — | Healing comercial | Visual AI + ML en la nube | SaaS, requiere cuenta |

### Lecturas del panorama

1. **Nadie tiene el nicho de Healify.** El único proyecto realmente comparable (10) tiene 2 stars y es un framework, no una librería instalable. Healenium es el rey del rubro pero **exige Docker + Postgres**: ese es exactamente el costo que Healify elimina.
2. **La feature que Healenium tiene y todos copian es el _write-back al código_** (hlm-idea): curar en runtime sirve una vez; escribir el locator nuevo en el page object sirve para siempre. Healify ya tiene `fix`/`fix-ast` — pero **solo mira el archivo de test**, no los page objects (ver gap G3).
3. **La superficie de configuración es un diferenciador de adopción.** `healenium.properties` con `score-cap`/`recovery-tries`/`heal-enabled` es lo primero que cualquier tutorial muestra. Healify tiene config, pero sin ningún umbral.
4. **Shadow DOM es la frontera técnica de 2026.** Playwright lo pierce solo; Selenium/Cypress no. Cualquier app con web components (Salesforce Lightning, Ionic, Vaadin, Lit) es terreno donde el probe de Healify hoy devuelve cero elementos.
5. **CI-as-DX:** `uses: org/action@stable` es el formato en el que la gente consume herramientas de QA hoy (14). Healify ya tiene `gh-action/action.yml` — el gap acá es de distribución/documentación, no de código.

---

## 2. Tabla de gaps

> **Estado al 2026-08-03 (v1.6.0):** G1, G2, G3, G4, G5 y G6 cerrados. Sigue abierto G7
> (dashboard histórico), G8 (flakiness), G9 (`--watch`).

| # | Feature | Healenium | Otros | Healify hoy | ¿Gap? | Prioridad |
|---|---|---|---|---|---|---|
| G1 | **Shadow DOM / web components** | ❌ (Selenium no pierce) | ✅ Playwright (auto), ❌ Cypress | ❌ `BROWSER_PROBE_SCRIPT` usa `document.querySelectorAll` plano → 0 elementos en apps con web components; el motor cae a heurística ciega justo donde más falta hace | **SÍ, funcional** | **P0** |
| G2 | **iframes** | ⚠️ manual | ✅ `frameLocator` | ❌ el probe solo ve el documento top-level | **SÍ, funcional** | **P0** (mismo archivo que G1) |
| G3 | **Page Object Model — write-back** | ✅ vía hlm-idea | ⚠️ ninguno OSS lo hace bien | ❌ `fix()` busca el selector **solo en `case.testFile`**; en cualquier proyecto POM el selector vive en `pages/*.page.ts` → **todo se saltea como `not-found`** | **SÍ, funcional (silencioso)** | **P0** |
| G4 | **Umbrales configurables** (`score-cap`, `heal-enabled`, `recovery-tries`) | ✅ `healenium.properties` | ✅ casi todos | ⚠️ solo `customTestIds` + `customSynonyms` en `healify.config.json`; el 0.90 de "healed" y el 0.80 de `needsReview` están **hardcodeados** | **SÍ, DX** | **P1** |
| G5 | **Config en `.js`/`.mjs`** | n/a (properties) | ✅ estándar JS | ❌ solo JSON o key en `package.json` | SÍ, menor | P2 |
| G6 | **GitHub Action oficial** | ❌ | ✅ `testomatio/check-tests@stable` | ⚠️ `gh-action/action.yml` existe (node20, doctor + fix --dry-run + comentario en PR) pero no está versionado/publicado ni documentado en el README | Parcial — distribución | P1 |
| G7 | **Dashboard/histórico de healings** | ✅ reporte servido por el backend | ✅ Cypress Cloud | ⚠️ `healify history` es texto plano en consola; el HTML lindo (`healify-report.html`) es solo de la **última** corrida | SÍ, DX | P1 |
| G8 | **Detección de flakiness** | ❌ | ✅ Cypress Cloud, cypress-flaky-test-audit | ⚠️ `computeRebroken()` es una aproximación cercana | Parcial | P2 |
| G9 | **Modo `--watch`** | ❌ | ✅ Playwright `--ui` | ❌ | Menor (el runner ya lo da) | P3 |
| G10 | **Screenshots/video en el reporte** | ✅ (guarda screenshots en la DB) | ✅ trace viewer | ✅ `AuditEntry.screenshotPath` + attachments de Playwright ya se leen | NO | — |
| G11 | **Multi-locator / estrategias en cascada** | ✅ `recovery-tries` | ✅ selenium-ide | ✅ `alternatives[]` en `HealResponse` | NO | — |
| G12 | **Memoria entre corridas** | ✅ Postgres | ❌ | ✅ `.healify/history.jsonl` + repertorio | NO (y sin DB) | — |
| G13 | **testId custom (`data-qa`, `data-cy`…)** | ❌ | ⚠️ parcial | ✅ 5 built-in + `customTestIds` | NO | — |
| G14 | **Multi-lenguaje (Python/Java/C#)** | ✅ nativo Java | ❌ | ✅ `healify heal` (JSON stdin/stdout) + carpetas `python/`, `java/` | NO | — |
| G15 | **Telemetría local / stats** | ✅ backend | ✅ SaaS | ❌ a propósito (no hay tracking) | NO — contradice el pitch | ❌ descartado |
| G16 | **Backend/DB para el histórico** | ✅ | ✅ | ❌ a propósito | NO — contradice el pitch | ❌ descartado |
| G17 | **LLM para elegir el locator** | ⚠️ ML propio | ✅ autoheal-locator, cy.prompt | ❌ a propósito | NO — contradice el pitch | ❌ descartado |

---

## 3. TOP 3 elegidos (mayor ROI, cero cloud/IA/dependencias)

### ① G1 + G2 — Probe que atraviesa shadow DOM e iframes
**Por qué:** es el único gap **funcional puro** de la lista: hoy, en una app con web components, Healify no falla ruidosamente — devuelve `undefined` y silenciosamente degrada a la heurística ciega (`verified: false`). El usuario no se entera de que perdió la mitad del valor del producto. Playwright ya lo resuelve solo; Selenium, WebdriverIO y Cypress —tres de los cuatro adapters de Healify— dependen de `BROWSER_PROBE_SCRIPT`, y ese script no ve nada dentro de un `shadowRoot`.
**Costo:** un archivo (`reporter-core/src/browser-probe.ts`), JS ES5 dentro del string del probe, cero dependencias.

### ② G3 — `fix` que encuentra el selector en page objects
**Por qué:** es un bug de alcance disfrazado de límite de diseño. POM es *la* arquitectura estándar de e2e; en un proyecto POM, el 100% de las curaciones de `healify fix` se reporta como `saltado: ya no se encontró en el archivo`. Es la feature que Healenium resuelve con un plugin de IntelliJ y un backend — Healify puede resolverla con un walker de directorios acotado.
**Costo:** nuevo módulo en `cli/`, sin dependencias (walker propio, no `glob`).

### ③ G4 + G5 — Umbrales configurables y config en `.js`
**Por qué:** paridad de DX con el `healenium.properties` que todo tutorial del rubro muestra. Hoy el `0.90` que decide si algo es `healed` está clavado en el código; un equipo conservador no puede subirlo a `0.95`, y uno agresivo no puede bajarlo. Además habilita `healEnabled: false` para apagar Healify en una corrida sin desinstalarlo.
**Costo:** extender `reporter-core/src/config.ts` + wiring en `cli`, cero dependencias.

**Descartados conscientemente:** G7 (dashboard) y G6 (publicar la action) son valiosos pero son *empaquetado*, no capacidad nueva; G8/G9 los cubre razonablemente el runner. G15–G17 rompen el pitch.

---

## Fuentes

- https://github.com/healenium/healenium-web · https://healenium.io/docs/download_and_install/hlm_web
- https://github.com/healenium/healenium · https://github.com/healenium/healenium-appium
- https://github.com/SeleniumHQ/selenium-ide · https://github.com/microsoft/playwright
- https://github.com/cypress-io/cypress/issues/30805 · https://docs.cypress.io/cloud/features/flaky-test-management
- https://github.com/sclavijosuero/cypress-flaky-test-audit · https://github.com/DeploySentinel/cypress-quarantine
- https://github.com/ShantanuVr/playwright-self-healing-framework · https://github.com/rundom-tech/testergizer-open-core
- https://github.com/SanjayPG/autoheal-locator · https://github.com/headout/autoheal
- https://github.com/testomatio/check-tests
- https://www.browserstack.com/docs/automate-self-hosted/playwright/self-healing
