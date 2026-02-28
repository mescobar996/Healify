# Healify — To-Do Restante (según informe Feb 2026)

Estado base: [`docs/INFORME_ESTADO_VISION_PRODUCTO_2026-02.md`](docs/INFORME_ESTADO_VISION_PRODUCTO_2026-02.md)

## 1) Ya completado ✅

- [x] Demo animada en landing (`HealingDemo`) en loop automático.
- [x] Onboarding de 3 pasos MVP en conexión de proyecto (webhook + SDK + primer healing).
- [x] Weekly report automático por email (cron semanal + endpoint protegido).
- [x] Estado del weekly report visible en dashboard.
- [x] Trigger manual “Enviar ahora” en dashboard (solo `admin`).

## 2) Bloqueadores externos (depende de pagos/credenciales) ⏸️

> Requiere acceso a cuentas externas (Vercel/Stripe/MercadoPago/LemonSqueezy/registrar de dominio). No es ejecutable 100% desde este repo.

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
- [x] Plugin VS Code MVP (comandos + panel + setting `healify.appUrl`).

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

- [x] Decidir si avanzamos ahora con Plugin VS Code (bloque 5 pendiente) o lo dejamos para sprint dedicado. (Decisión: avanzar ahora, sin pagos)
- [x] Consolidar release y deploy en Vercel (`main`) para validar todo en web.
- [x] Validar en producción: landing demo, dashboard equipo, branch comparison, exports ROI, weekly report status.
	- [x] Smoke público OK: `/` (200), `/docs` (200), `/api/openapi` (200).
	- [x] Auth gate OK: `/dashboard`, `/dashboard/team`, `/dashboard/tests` redirigen a `/auth/signin`.
	- [x] Endpoints privados OK (protegidos): `branch-comparison`, `exports ROI`, `weekly-report/status` responden `401` sin sesión.
	- [x] Verificación manual con sesión: demo landing visible, branch comparison, export ROI y weekly status OK.
	- [x] Fix UX: botón `Equipo` agregado en dashboard para usuarios autenticados (antes visible solo para `admin`).
- [x] Si todo está OK, cortar release note corto en `worklog.md`.

## 9) Próximo sprint activo (solo no-pago) 🟢

- [x] Plugin VS Code MVP (local): comando para abrir último test run y su estado.
- [x] Plugin VS Code MVP: panel simple con link al dashboard/tests.
- [x] Plugin VS Code MVP: configuración de `HEALIFY_APP_URL` en settings del plugin.
- [x] Worker: validar `GITHUB_TOKEN` en Railway para clone de repos privados.
- [x] Re-test end-to-end: ejecutar run manual y confirmar `jobId` + progreso de cola.

## 10) UI Refresh Dashboard (Linear-style) ✅ completado

- [x] Base de design tokens semánticos globales.
- [x] Normalización de componentes base (`button`, `input`, `badge`).
- [x] Rediseño del shell de dashboard (`/dashboard/layout`).
- [x] Rediseño de Dashboard home (`/dashboard`).
- [x] Rediseño de Test Runs (`/dashboard/tests`).
- [x] Rediseño de Settings (`/dashboard/settings`).
- [x] Registro de release note en `worklog.md`.

## 11) Estado final del TODO (ejecutable en repo)

- ✅ Completado: 100% del alcance técnico no-pago y de UI ejecutable en código.
- ⏸️ Pendiente manual externo: activación de credenciales de pago, Anthropic en Vercel y dominio productivo.
- 🎯 Siguiente paso para cierre total de negocio: resolver los 5 ítems de la sección 2 y validar checkout en producción.

## 12) Cierre de implementaciones pedidas (confirmación explícita) ✅

- [x] Fase 2: Dashboard por tabs (Overview, Análisis, Funciones).
- [x] Fase 3: Empty state/onboarding guiado con progreso de 3 pasos.
- [x] Fase 4: Notification center accionable con apertura de links/PR.
- [x] Fase 5: Quick search global real para proyectos, test runs y curaciones.
- [x] Fase 6: Salud de proyectos en sidebar con indicadores visuales.
- [x] Fase 7: Sandbox demo interactivo por usuario (setup + seed inicial).
- [x] Fase 8: Video 90s en web y docs.

### Verificación técnica
- [x] Typecheck global sin errores (`npx tsc --noEmit`).
- [x] Cambios publicados en `main` (commit `d5aafef`).
- [x] Estado de git limpio post-push.

---

Última actualización: 2026-02-27 (fases UX 2-8 completadas; pendientes solo externos de credenciales/pagos/dominio)