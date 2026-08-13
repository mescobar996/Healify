# Estado del proyecto — Healify 2.7.1

Fecha: 2026-08-13 · Rama: `main` · CI: ✅ verde.

## Estado actual

| Área | Estado |
|---|---|
| Tests | **1,153** en verde (10 paquetes) |
| Cobertura | 9 paquetes medidos, todos sobre su umbral anti-regresión |
| Lint | Limpio (`eslint .`) |
| Verificación | `npm run verify:win` verde · `npm run build --workspaces` compila |
| Versión | 2.7.1 (alineada en los package.json) |

## Última feature: Dashboard de eficacia (002)

- Sección **🎯 Eficacia** en el dashboard (`/efficacy`): donut aceptados/rechazados/sin
  confirmar, tasa por framework, tendencia 7/30 días y desglose por causa de fallo.
- `HistoryEntry.framework` (opcional, back-compat) registrado en cada entrada nueva.
- Agregación server-side en el CLI; UI React con Chart.js (sin dependencias nuevas).
- Artefactos Spec-Driven en `specs/002-efficacy-dashboard/` (spec, plan, tasks).
- Verificado con el binario real (`healify dashboard --serve` + fixture de historial):
  totals 75% (3/1), desglose por framework y causa correctos, ventanas 7/30 ok.

## Cobertura por paquete (umbral → actual)

reporter-core 80→93.4 · test-runner 79→79.5 · cypress-plugin 80→94.8 · cli 80→92.7 ·
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
reporter-core → adapters → ai-local → mcp → cli) y etiquetar `v2.7.1` en GitHub. El usuario
lo hace manualmente; acá queda el checklist.
