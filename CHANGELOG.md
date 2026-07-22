# Changelog

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
