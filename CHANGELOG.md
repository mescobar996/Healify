# Changelog

Todas las versiones notables del proyecto. El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el versionado [SemVer](https://semver.org/lang/es/).

## [2.6.0] — 2026-08-13

Release de presentación: calidad, cobertura y una cara nueva para el mundo.

### Added

- **Cobertura de los huecos del CLI**: `ai.ts` e `index.ts` pasaron de 0% a ~96% (56 tests nuevos); el paquete `cli` de 63% a 91.8%.
- **Cobertura de `cypress-plugin`**: el flujo de curación en vivo de `support.ts` (sondeo, heal por css/xpath, shadow-DOM finder, no-suggestion/failed) — de 55.97% a 94.8%.
- **Medición de cobertura para 9 paquetes** (`ai-local`, `mcp`, `dashboard-web` incluidos) con umbrales anti-regresión en `scripts/coverage.sh`/`.ps1`; `cypress-plugin` y `cli` ahora exigen 80%.
- **Verificación de umbrales en CI**: el job `coverage` imprime los umbrales vigentes con fuente única en los scripts.
- **JSDoc en 38 exports sin documentar** de reporter-core y cli.
- **Informes**: `docs/final-review.md`, `docs/project-evaluation.md`, `docs/project-status.md`.
- **Landing rediseñada**: minimalista, glassmorphism verde-cian-azul, logos oficiales animados (Playwright, Cypress, Selenium, WebdriverIO, Python, Java, .NET), CTA ámbar, cero CDN. Lighthouse: Performance 99 · Accesibilidad 95 · Best Practices 100.
- **Captura del dashboard** (`landing/report-screenshot.png`) generada con Playwright, usada en landing y READMEs.

### Changed

- **Refactor de funciones largas**: `healing-engine.ts` (870 líneas) y `local-report.ts` (779) divididos en módulos cohesivos — ninguna función supera las 80 líneas.
- **Refactor de `dashboard-serve.ts`** (329 líneas) en 6 módulos: data, routes, static, middleware, app y entry.
- **`index.ts` del CLI**: `runCli(args)` exportable + guard `require.main === module` (testeable sin efectos al importar).
- **README EN/ES reescritos**: storytelling, badges, stats y ejemplo rápido.
- **Versión alineada a 2.6.0** en los 11 `package.json` del repo.

### Removed

- **0 usos de `any`/`as`/`!` en producción** (auditoría de tipos de la tarea 5: 15 hallazgos, todos corregidos con type guards y validación runtime).
- **CDN de Tailwind y Alpine de la landing**: no se usaban clases de Tailwind (compilador de ~350KB de peso muerto) y los contadores quedaron como valores estáticos con fallback.

### Fixed

- Rutas relativas de assets en la landing que rompían `/es/` (404) — ahora rutas absolutas.
- Regresión de cobertura de `cypress-plugin` detectada al medir por primera vez con umbrales.

### Security

- Sin cambios; el CI corre `npm audit --omit=dev --audit-level=critical` en cada push.

## Antes de 2.6.0

El proyecto tiene 531+ commits previos (desde 2025). Ver el historial completo en `git log` — los hitos principales incluyen el motor heurístico (`reporter-core`), los adapters Playwright/Cypress/Selenium/WebdriverIO, el CLI (`fix`/`init`/`doctor`/`history`/`heal`), el servidor MCP, la extensión de VS Code, el GitHub Action, los ejemplos con browser real y los scripts de CI multi-entorno (Windows/WSL).

[2.6.0]: https://github.com/mescobar996/Healify/compare/v2.5.0...v2.6.0
