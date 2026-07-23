# Changelog

## 0.6.0 - 2026-07-23

**Cambio de comportamiento pedido explícitamente por el usuario, probando 0.5.1 en
producción real:** `init` ya NO genera ningún archivo de test. En 0.5.0/0.5.1, para cada
framework `init` creaba un test con un selector inventado a propósito
(`demo-boton-roto-healify`, `boton-viejo-12345678`) solo para mostrar un primer
`healify-report.html`. Probándolo en un proyecto real, sintió que se le mostraba algo
falso como si fuera una prueba genuina de la herramienta. Decisión: nada de demos, nunca
más — `init` deja la config real conectada y nada más; el primer selector roto que
Healify cure tiene que ser uno de verdad, escrito por el QA sobre su propia app.

- `cli/src/scaffold.ts`: sacadas las constantes `DEMO_*` y las funciones que generaban
  `e2e/healify.demo.spec.*`, `cypress/e2e/healify.demo.cy.*` y `healify.selenium.demo.*`.
  `scaffoldPlaywright` ahora devuelve solo `playwright.config.*`. `scaffoldCypress`
  devuelve config + `cypress/support/e2e.*` (ese sí es real: Cypress lo exige para e2e
  testing, no es un extra de Healify). `scaffoldSelenium` devuelve solo
  `healify.selenium.example.ts` (documentación de referencia que nunca se ejecuta, se
  mantiene sin cambios).
- `cli/src/index.ts`: el mensaje final de `init` ya no dice "Corré `npx playwright test`"
  (implicaba que ya había algo armado para correr) — ahora dice honestamente que hay que
  escribir el primer test real. Sacados `RUN_COMMAND`/`runCommandFor`.
- `cli/README.md` y `README.md` raíz actualizados: sin ningún bloque mostrando un demo,
  con la aclaración explícita de que `init` no genera tests.
- 2 bugs reales encontrados en una auditoría completa del motor, no relacionados con los
  demos — ver detalle abajo.

**Bug real — `healing-engine.ts`: selectores CSS-in-JS compuestos no se detectaban como
volátiles.** `analyzeSelector` solo entraba a la rama de clase volátil si el selector
completo empezaba con `.` — un selector real como `.btn.css-1a2b3c4d5e` (clase semántica +
hash de CSS-in-JS pegados, muy común con styled-components) o con combinador
(`.container > .css-1a2b3c4d`) nunca se detectaba como dinámico, y caía al fallback
genérico en vez de proponer una alternativa estable. Arreglado: la detección ahora busca
el patrón volátil en cualquier posición del selector, no solo desde el inicio del string.

**Bug real — `cli/src/fix.ts`: podía reemplazar un selector dentro de un comentario en vez
del código real.** El conteo de ocurrencias no distinguía código de comentarios — si el
selector roto quedaba mencionado solo en un comentario (`// TODO: reemplazar '#btn-x'`) y
ya no existía en el código real, `fix` lo reemplazaba ahí igual y reportaba `applied` con
confianza total, sin cambiar nada funcional. Arreglado: las líneas de comentario se
filtran antes de contar ocurrencias; si la única mención real está en un comentario, se
trata como `not-found`.

`reporter-core`/`test-runner`/`cypress-plugin`/`cli`/`selenium-plugin` a `0.6.0` — los 4
paquetes publicables bundlean `reporter-core`, así que el fix de `healing-engine.ts`
necesita republicar los 5, no solo `cli`.

## 0.5.1 - 2026-07-23

**Fix crítico encontrado probando 0.5.0 en producción real (`sgo-pzbp`), no en tests:**
un `npx playwright test` (sin especificar archivo) escaneó todo `e2e/` y encontró
`e2e/selenium.demo.test.ts` — matchea el patrón de descubrimiento de tests por defecto de
Playwright (`*.test.ts` dentro del `testDir`). Playwright lo cargó como si fuera un test
suyo y, como el script corre `main()` apenas se importa (no espera a que lo invoquen),
se disparó como efecto secundario: abrió una sesión de Chrome de más (vía ChromeDriver) y
mezcló su log de curado con la salida del test real de Playwright. Confirmado real,
copia exacta del output del usuario.

**Fix:** el demo de Selenium (`scaffoldSelenium` en `cli/src/scaffold.ts`) ya no vive en
`e2e/` ni usa sufijo `.spec.`/`.test.` — se mueve a la raíz como `healify.selenium.demo.ts`
(al lado de `healify.selenium.example.ts`). `cli/src/index.ts` ajustado para armar el
comando de "Listo. Corré..." leyendo el nombre real generado (TS o JS) en vez de asumir
`.ts` a mano. Verificado real: `npx playwright test` en `sgo-pzbp` ya no dispara Chrome de
más, y `npx tsx healify.selenium.demo.ts` sigue curando y clickeando bien por separado.

**Bug secundario encontrado en el propio mensaje del demo:** el comentario JSDoc explicando
por qué el archivo no debía llamarse `.test.ts` contenía literalmente `*.spec.*/*.test.*`
— ese `*/` cerraba el comentario `/** ... */` antes de tiempo, dejando el resto del texto
como código real y rompiendo el parseo (`esbuild` tiraba `Unexpected "*"` al intentar
correr el demo con `npx tsx`). Reescrito sin la secuencia `*/` literal. Test de regresión
nuevo: los 3 templates (Playwright/Cypress/Selenium) ahora se validan parseando con
`esbuild.transformSync` en vez de solo revisar substrings — así un futuro comentario mal
escrito rompe el test en vez de llegar a producción.

162 tests (antes 160). `cli` a `0.5.1` — único paquete tocado, `test-runner`/
`cypress-plugin`/`reporter-core` sin cambios desde 0.5.0.

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

**chore:** `npm audit fix --force` — `esbuild` 0.27.7 → 0.28.1 (bump breaking, quedaba
pendiente desde 0.4.1). Verificado real: build de los 5 workspaces sin cambios de
comportamiento (tamaños de bundle casi idénticos), 160 tests siguen verdes, `cli/dist/index.js`
probado a mano (`--help`, `doctor`) sin diferencias. `npm audit` → 0 vulnerabilidades.

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
