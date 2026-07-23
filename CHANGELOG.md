# Changelog

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
