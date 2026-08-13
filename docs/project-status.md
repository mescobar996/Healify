# Estado del proyecto — Healify 2.8.0

Fecha: 2026-08-13 · Rama: `main` · CI: ✅ verde.

## Estado actual

| Área | Estado |
|---|---|
| Tests | **1,164** en verde (10 paquetes) |
| Cobertura | 9 paquetes medidos, todos sobre su umbral anti-regresión |
| Lint | Limpio (`eslint .`) |
| Verificación | `npm run verify:win` verde · `npm run build --workspaces` compila |
| Versión | 2.8.0 (alineada en los 11 package.json) |

## Últimas features

### 002 — Dashboard de eficacia (v2.7.1, publicada)

- Sección **🎯 Eficacia** en el dashboard (`/efficacy`): donut aceptados/rechazados/sin
  confirmar, tasa por framework, tendencia 7/30 días y desglose por causa de fallo.
- `HistoryEntry.framework` (opcional, back-compat). Publicada en npm 2.7.1 (8 paquetes).

### 003 — Onboarding: `healify init` en 2 minutos (v2.8.0, lista para release)

- Output por pasos (detección con evidencia → instalación → config → scripts npm).
- Verificación instantánea con `healify doctor` al cierre + siguiente paso único.
- Scripts idempotentes en package.json (`healify`, `healify:dry`, `healify:dashboard`).
- `healify init --dry-run` (plan sin side effects).
- Diseño completo en `docs/onboarding-design.md`; regla "cero inventos" intacta (init no
  genera tests).
- Verificado con el binario real en un proyecto Playwright (dry-run + real).

## Cobertura por paquete (umbral → actual)

reporter-core 80→93.4 · test-runner 79→79.5 · cypress-plugin 80→94.8 · cli 80→92.8 ·
selenium-plugin 80→98.8 · webdriverio-plugin 80→87.6 · ai-local 30→33.8 · mcp 80→88.6 ·
dashboard-web 70→76.8

## Cómo verificar

```bash
npm run verify:win   # build + tests de los 10 paquetes
npm run coverage:win # umbrales anti-regresión
npm run lint         # eslint sin warnings
```

## Próximo release

Publicar los paquetes en npm (`npm publish` por workspace, en orden de dependencias:
reporter-core → adapters → ai-local → mcp → cli) y etiquetar `v2.8.0` en GitHub. El usuario
lo hace manualmente; acá queda el checklist.
