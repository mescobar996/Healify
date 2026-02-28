# Healify — TODO Activo Post-Rollout (2026-02-27)

## Estado actual

Implementación UX/producto solicitada completada en `main`.

Guía de ejecución (sin pago primero): `docs/GUIA_PASO_A_PASO_MANUAL_Y_PAGOS_2026-02-27.md`

Últimos ajustes aplicados:
- Barra de búsqueda global ampliada visualmente en header dashboard.
- Demo de video reemplazada por demo interactivo seleccionable.
- Demo interactivo reutilizado en landing y docs.

## Lo que queda por hacer (real)

Orden recomendado de ejecución:
1. B + C (todo lo no-pago)
2. A (pago/externo) al final

### A) Cierre externo de negocio (bloqueadores)
- [ ] Configurar `ANTHROPIC_API_KEY` en Vercel de producción.
- [ ] Definir y activar pasarela de pago principal en producción (MercadoPago/Lemon/Stripe).
- [ ] Configurar dominio productivo `healify.dev`.

### B) Validación funcional en producción (manual)
- [x] QA visual cross-browser de la barra de búsqueda ampliada (desktop tablet).
- [x] QA de demo interactivo en landing/docs (escenarios, animación, copy, responsive).
- [x] Confirmar que el flujo de notificaciones accionables abre links internos y PR externos correctamente.

### B.1) Validación automatizada API
- [x] `npm run test:e2e:api` passing (14/14).

### C) KPI y operación semanal
- [x] Ejecutar baseline de KPI con `/api/analytics/conversion?days=30`.
- [x] Revisar metas: `activation24hPct`, `timeToFirstHealingMinutes`, `autoPrRatePct` con datos reales del baseline.
- [x] Preparar reporte semanal para dirección con acciones correctivas.

Resultado baseline (2026-02-28):
- `activation24hPct`: 0% (objetivo > 60%)
- `timeToFirstHealingMinutes`: 6559.1 (objetivo < 15)
- `autoPrRatePct`: 100% (objetivo > 35%)

Foco inmediato (no-pago):
- Reducir tiempo a primer healing con flujo sandbox + primer run más guiado.
- Reforzar activación <24h en onboarding y CTA de conexión inicial.

### D) Mejoras opcionales de producto (siguiente sprint)
- [x] Persistir el último escenario elegido del demo interactivo en `localStorage`.
- [x] Añadir telemetría del uso de búsqueda global (`Ctrl+K` open, query, click result).
- [x] Añadir deep-link directo por resultado de búsqueda (navegar a item exacto cuando exista ruta dedicada).

### Entregables de soporte creados
- [x] Script de baseline: `scripts/generate-kpi-baseline.ts`.
- [x] Playbook semanal: `docs/KPI_WEEKLY_REPORT_PLAYBOOK.md`.
- [x] Archivo de salida estándar: `docs/KPI_BASELINE_LATEST.md` (modo pendiente o real según entorno).

---

Última actualización: 2026-02-28
