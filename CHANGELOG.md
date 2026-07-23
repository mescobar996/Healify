# Changelog

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
