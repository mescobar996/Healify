# Changelog

## 0.5.0 - 2026-07-23

**Fix crítico (`reporter-core`, republicado vía `test-runner`/`cypress-plugin`):**
`extractSelectorFromError()` usaba un patrón `["']([^"']+)["']` que EXCLUÍA ambos tipos de
comilla del contenido capturado. El selector de mayor confianza del motor —
`[data-testid="x"]`, comillas dobles adentro de las comillas simples que pone Playwright
alrededor de `locator('...')` — nunca se extraía completo: el regex cortaba en la primera
comilla interna y no volvía a matchear nunca. Resultado real, confirmado corriendo
`npx playwright test` contra un selector `data-testid` roto de verdad: `status: 'unresolved'`
siempre, para el caso más común y de mayor confianza del motor (TESTID, 0.95). Arreglado con
un backreference de comilla (`(["'])((?:(?!\1).)+)\1`, grupo 2 = contenido) que permite
comillas del otro tipo adentro. Verificado real: mismo test, mismo selector, ahora
`Healed: 1 | Review: 0 | Unresolved: 0`. Afecta a cualquier proyecto Playwright real que use
`data-testid`/`data-cy` — que es la recomendación estándar de selector estable. 6 tests de
regresión nuevos en `reporter-core` (`selector-extractor.test.ts`).

**Feature (`@healify/cli`): `init` universal — funciona en cualquier proyecto, no solo en uno
que ya tiene el framework instalado.**

- Si no detecta ningún framework de e2e, pregunta cuál armar (Playwright/Cypress/Selenium,
  default Playwright) y scaffoldea todo desde cero: config con el reporter/plugin ya
  wireado, un test demo con selector roto a propósito, y (Playwright/Cypress) los archivos
  de soporte necesarios
- Si el framework ya está instalado pero sin archivo de config (bug real encontrado en un
  proyecto Vite-only: `@playwright/test` instalado, `playwright.config.*` nunca creado) —
  scaffoldea el config automáticamente en vez de solo avisar
- Si ya hay config sin Healify, sigue igual que antes (inyecta el marcador, idempotente)
- baseURL automático: primero el script `"dev"` de `package.json` (`vite --port=3000` — el
  caso real más común, confirmado auditando un proyecto Vite donde el puerto nunca está en
  `vite.config.*`), después `server.port` de `vite.config.*`/`next.config.*`, si no 5173/3000
- TS vs JS y ESM vs CJS detectados solos (`tsconfig.json`, `package.json` `"type"`)
- Prompt interactivo sin dependencias nuevas (`fs.readSync` sobre el fd 0), con fallback
  determinístico al framework default si stdin no es TTY (nunca cuelga en CI)
- Selenium: el demo (`e2e/selenium.demo.test.ts`) navega a una página HTML autocontenida
  (`data:` URL) en vez de depender del DOM real del proyecto — no necesitás tu app corriendo.
  Usa un selector de ID dinámico (no testid) a propósito: la estrategia de "cura" de testid
  solo normaliza comillas, que para el navegador es el MISMO selector — así que si el
  original no encuentra nada, el reintento con el "fix" tampoco encontraría nada nunca
  (confirmado corriendo el demo real antes del cambio: la cura se detecta, confidence 0.93,
  pero el reintento vuelve a tirar `NoSuchElementError`). Con la estrategia de ID
  dinámico → clase estable (`#boton-viejo-12345678` → `.boton-viejo`, confidence 0.82) y un
  botón real con esa clase en la página autocontenida, el reintento sí encuentra un elemento
  distinto y el click funciona de verdad. `confidenceThreshold` bajado a 0.75 solo en el
  demo (0.82 < el default de producción 0.9) — comentado en el propio archivo generado.

**Fix (`doctor`):** mensaje de "no detectamos framework" ahora manda a `npx @healify/cli init`
en vez de "instalá Playwright/Cypress/Selenium primero" — con `init` universal ya no hace
falta instalar nada a mano antes.

**Tests:** 22 tests nuevos (`init.test.ts` ampliado + `scaffold.test.ts` nuevo + 6 de
regresión en `reporter-core`) — 160 tests en verde (36+8+7+80+29), antes 138.

**Validación real (no solo tests) contra `sgo-pzbp` (proyecto Vite real, sin ningún e2e
armado todavía):**

- **Playwright** (bug real de CASO B: `@playwright/test`+`@healify/test-runner` ya
  instalados, `playwright.config.ts` nunca existió) → `init` lo creó con
  `baseURL: 'http://localhost:3000'` (correcto — el puerto real vive en el script `dev`, no
  en `vite.config.ts`, que en este proyecto no lo menciona) → `npx playwright test` con la
  app corriendo → `Healed: 1 | Review: 0 | Unresolved: 0` real → `doctor` 100% verde
- **Cypress** (`cypress` no es dependency declarada en `sgo-pzbp` — validado en un proyecto
  descartable aparte para no forzar una dependencia nueva en un repo de producción real, sin
  tocar `sgo-pzbp`) → mismo resultado: `npx cypress run` → `Healed: 1 | Review: 0 |
  Unresolved: 0` real → `doctor` 100% verde
- **Selenium** (`selenium-webdriver`+`@healify/selenium-plugin` ya instalados) → `init`
  scaffoldeó el ejemplo + el demo → `npx tsx e2e/selenium.demo.test.ts` con ChromeDriver real
  → evento `healed` real (confidence 0.82, `.boton-viejo`) y el `.click()` final funcionó de
  verdad → `doctor` 100% verde

Todo lo agregado a `sgo-pzbp` para las pruebas (`playwright.config.ts`, `e2e/`,
`healify.selenium.example.ts`, `healify-report.html/json`) se borró al terminar — el repo
real queda exactamente como estaba (Vite-only), según lo pedido. Detalle completo en
`docs/audit-0.5.0.md`.

`reporter-core`/`test-runner`/`cypress-plugin`/`cli` a `0.5.0`. `selenium-plugin` sin
cambios de código, queda en `0.1.0`.

## 0.4.1 - 2026-07-23

- fix: `doctor` marcaba `❌ healify-report.json existe` en proyectos Selenium-only como si fuera un error — Selenium cura en vivo y nunca genera ese archivo, así que ese check nunca podía pasar. Ahora, si Selenium es el único framework, se reemplaza por un check informativo (`ℹ️ Selenium cura en vivo, no genera reporte`). Si convive con Playwright/Cypress, el check de reporte se mantiene (`cli/src/commands/doctor.ts`)
- fix: `--help`/`-h` ejecutaba el comando de verdad en vez de mostrar ayuda — confirmado corriendo el binario real: `healify init --help` instalaba paquetes y editaba configs. Ahora `--help` en cualquier posición corta antes de despachar a `init`/`doctor`/`fix` (`cli/src/index.ts`)
- docs: alineados `README.md` raíz y `cli/README.md` a `npx @healify/cli <comando>` en vez de `npx healify <comando>` (ambas formas funcionan una vez instalado, pero eran inconsistentes entre sí)
- docs: corregido el ejemplo de `doctor` en el README raíz — mostraba un flujo interactivo `[y/n]` que no existe; reemplazado por el output real del comando
- docs: badge y menciones de cantidad de tests actualizadas de 135 a 138 (64 tests en `cli`, +3 por el fix de `doctor`)
- chore: `npm audit fix` (sin `--force`) resolvió 5 de 6 vulnerabilidades de devDependencies (lodash, picomatch, postcss, vite, vitest — todas vía `cypress`/`vitest`, no llegan al tarball publicado). Queda `esbuild` (requiere bump breaking 0.27→0.28, usado en el build de los 4 paquetes) — no forzado, ver `docs/audit-0.4.1.md`
- `@healify/cli` a `0.4.1` (único paquete con cambios de comportamiento reales). `test-runner`/`cypress-plugin`/`reporter-core` quedan en `0.4.0`, `selenium-plugin` en `0.1.0`
- 138 tests en verde (`npm run verify`), verificado con el binario real contra un proyecto Playwright, uno Cypress y contra `sgo-pzbp` (Selenium real, ChromeDriver real)

## 0.4.0 - 2026-07-22

- feat: `@healify/cli init` — detecta el framework (Playwright/Cypress/Selenium) por `package.json` y archivos de config, instala el paquete de Healify que falte y wirea el `reporter`/plugin en el config automáticamente. Idempotente: no duplica si ya está instalado o configurado
- feat: `@healify/cli doctor` — checklist con ✅/❌ y fix sugerido: framework detectado, paquete instalado, config wireado, `healify-report.json` generado. No modifica nada
- feat: `healify` sin argumentos o con comando desconocido imprime help listando `init`/`doctor`/`fix`
- fix: instalación en Windows fallaba silenciosamente (`ENOENT`/`EINVAL` con `execFileSync` + `npm`/`.cmd`) — encontrado corriendo el binario real, corregido con `execSync`
- docs: sección "Para QA sin experiencia" en `cli/README.md` con los 3 comandos
- 61 tests nuevos en `cli` (135 totales en el monorepo)

## 0.3.1 - 2026-07-22

- fix: filtro de atributos volátiles (`css-`, `sc-`, hash largo) — el motor ya no propone una `.class` inestable como alternativa cuando el candidato sigue viéndose volátil o el selector original tiene más de 3 fragmentos tipo hash/número (`1998642`)
- fix: `healing-engine` ordena candidatos por escalera de prioridad de atributo estable (testid > id > name > aria-label/role > texto > clase) en vez de solo por confidence — ningún número de confianza cambió, solo qué candidato gana cuando compiten varios (`b41e0be`)
- docs: tabla de versiones, sección `npm run verify` y mención del `printSummary` nuevo en los READMEs de `test-runner`/`cypress-plugin`/raíz (`b657c39`)

## 0.3.0 - 2026-07-22

- feat: `printSummary()` en `local-report.ts` -> stdout `Healed | Review | Unresolved` en `onEnd()` de `test-runner` y `cypress-plugin`
- feat: `npm run verify` script de 33 líneas, resumen de 5 paquetes con dot reporter
- feat: diccionarios extraídos a `dictionaries/en.json` y `es.json` con `resolveJsonModule`
- breaking: eliminado modo nube completo (`http-client.ts`, `HEALIFY_API_KEY`, `config.ts`, `fake-server.mjs` y verifies). Main ahora 100% local sin red.
- chore: `.claudeignore` y `CLAUDE.md` para reducir consumo de tokens de Claude Code
