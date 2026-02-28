# Healify — TODO Activo Post-Rollout (2026-02-27)

## Estado actual

Implementación UX/producto solicitada completada en `main`.

Últimos ajustes aplicados:
- Barra de búsqueda global ampliada visualmente en header dashboard.
- Demo de video reemplazada por demo interactivo seleccionable.
- Demo interactivo reutilizado en landing y docs.

## Lo que queda por hacer (real)

### A) Cierre externo de negocio (bloqueadores)
- [ ] Configurar `ANTHROPIC_API_KEY` en Vercel de producción.
- [ ] Definir y activar pasarela de pago principal en producción (MercadoPago/Lemon/Stripe).
- [ ] Configurar dominio productivo `healify.dev`.

### B) Validación funcional en producción (manual)
- [ ] QA visual cross-browser de la barra de búsqueda ampliada (desktop tablet).
- [ ] QA de demo interactivo en landing/docs (escenarios, animación, copy, responsive).
- [ ] Confirmar que el flujo de notificaciones accionables abre links internos y PR externos correctamente.

### C) KPI y operación semanal
- [ ] Ejecutar baseline de KPI con `/api/analytics/conversion?days=30` (pendiente de `DATABASE_URL` en entorno local/prod).
- [ ] Revisar metas: `activation24hPct`, `timeToFirstHealingMinutes`, `autoPrRatePct` con datos reales del baseline.
- [x] Preparar reporte semanal para dirección con acciones correctivas.

### D) Mejoras opcionales de producto (siguiente sprint)
- [x] Persistir el último escenario elegido del demo interactivo en `localStorage`.
- [x] Añadir telemetría del uso de búsqueda global (`Ctrl+K` open, query, click result).
- [x] Añadir deep-link directo por resultado de búsqueda (navegar a item exacto cuando exista ruta dedicada).

### Entregables de soporte creados
- [x] Script de baseline: `scripts/generate-kpi-baseline.ts`.
- [x] Playbook semanal: `docs/KPI_WEEKLY_REPORT_PLAYBOOK.md`.
- [x] Archivo de salida estándar: `docs/KPI_BASELINE_LATEST.md` (modo pendiente o real según entorno).

---

Última actualización: 2026-02-27
