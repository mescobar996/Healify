# Healify — To-Do Restante (según informe Feb 2026)

Estado base: [`docs/INFORME_ESTADO_VISION_PRODUCTO_2026-02.md`](docs/INFORME_ESTADO_VISION_PRODUCTO_2026-02.md)

## 1) Ya completado ✅

- [x] Demo animada en landing (`HealingDemo`) en loop automático.
- [x] Onboarding de 3 pasos MVP en conexión de proyecto (webhook + SDK + primer healing).
- [x] Weekly report automático por email (cron semanal + endpoint protegido).
- [x] Estado del weekly report visible en dashboard.
- [x] Trigger manual “Enviar ahora” en dashboard (solo `admin`).

## 2) Pausado por decisión (depende de pagos/credenciales) ⏸️

> No avanzar hasta confirmación explícita.

- [ ] Configurar `ANTHROPIC_API_KEY` en Vercel.
- [ ] Activar MercadoPago producción (planes + credenciales).
- [ ] Activar Lemon Squeezy producción (productos + credenciales).
- [ ] Stripe salir de test mode (cuando decidas).
- [ ] Comprar/configurar dominio `healify.dev`.

## 3) Prioridad alta no bloqueada (siguiente ejecución) 🔴

### Sprint operativo inmediato (1–2 semanas)

- [x] Visual test teardown (timeline de pasos + screenshots).
- [x] Branch comparison (`main` vs `feature`) con tests fallados por branch.
- [x] GitHub badge “Healed by Healify” para repos.
- [x] Aplicar límites de plan reales (hoy parcialmente hardcodeado en el informe).
- [x] “Try with demo repo” sin configuración (flow guiado de prueba rápida).

## 4) Retención y monetización (no pagos directos) 🟠

- [x] Export de ROI en PDF/CSV.
- [x] Tags/etiquetas en test runs.
- [x] Búsqueda full-text por nombre de test.
- [x] Retry automático para flaky tests.
- [x] Dashboard de equipo (multi-usuario por proyecto).

## 5) Integraciones de adopción 🟡

- [x] Integración GitHub Actions (snippet YAML + guía).
- [x] Integración GitLab CI.
- [x] Soporte Selenium básico.
- [x] API pública documentada (OpenAPI).
- [x] Integración Jira (crear ticket en `BUG_DETECTED`).
- [ ] Plugin VS Code (fase posterior, pausado por alcance actual).

## 6) Checklist de calidad y GTM (recomendado)

- [x] Normalizar métricas visibles (README/dashboard/docs) para evitar desalineación.
- [x] Definir objetivo KPI semanal: `time-to-first-healing`, `% auto-PR`, activación < 24h.
- [x] Instrumentar eventos de onboarding (paso 1/2/3 completado).
- [x] Crear reporte interno de conversión: `registro -> repo conectado -> primer healing -> pago`.

## 7) Orden sugerido de ejecución (sin pagos) ✅ completado

1. ✅ Visual test teardown
2. ✅ Branch comparison
3. ✅ GitHub badge
4. ✅ Try with demo repo
5. ✅ Límites por plan reales
6. ✅ ROI export (PDF/CSV)

## 8) Siguiente ejecución recomendada (operativo)

- [ ] Decidir si avanzamos ahora con Plugin VS Code (bloque 5 pendiente) o lo dejamos para sprint dedicado.
- [x] Consolidar release y deploy en Vercel (`main`) para validar todo en web.
- [ ] Validar en producción: landing demo, dashboard equipo, branch comparison, exports ROI, weekly report status.
	- [x] Smoke público OK: `/` (200), `/docs` (200), `/api/openapi` (200).
	- [x] Auth gate OK: `/dashboard`, `/dashboard/team`, `/dashboard/tests` redirigen a `/auth/signin`.
	- [x] Endpoints privados OK (protegidos): `branch-comparison`, `exports ROI`, `weekly-report/status` responden `401` sin sesión.
	- [ ] Verificación manual con sesión: demo landing visible y métricas internas en dashboard (team/branch/export/weekly status).
- [ ] Si todo está OK, cortar release note corto en `worklog.md`.

---

Última actualización: 2026-02-27 (smoke test producción + validación auth gate)