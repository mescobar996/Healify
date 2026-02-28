# Healify — Guía Paso a Paso (primero sin pago, pago al final)

Objetivo: ejecutar todo lo posible ahora y dejar pagos/credenciales externas para el cierre final.

## Fase 1 — Ejecutar ya (sin pagos)

### Paso 1) Validación técnica local

1. Abrir terminal en el repo.
2. Ejecutar:

```bash
npm install
npx tsc --noEmit
```

Resultado esperado:
- Sin errores de compilación.

### Paso 2) Baseline KPI (si hay DB)

1. Verificar que exista `DATABASE_URL`.
2. Ejecutar:

```bash
npm run kpi:baseline
```

Si estás en PowerShell y querés probar rápido sin editar archivos:

```powershell
$env:DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"
npm run kpi:baseline
```

Resultado esperado:
- Se actualiza `docs/KPI_BASELINE_LATEST.md` con valores reales.

Si falta DB:
- El script genera reporte en modo pendiente (ya soportado).

### Paso 3) QA manual de UX (cross-browser)

Navegar en `Chromium`, `Firefox` y `WebKit`:

1. Dashboard header:
   - barra de búsqueda amplia y legible
   - `Ctrl+K` abre búsqueda
2. Search global:
   - buscar proyecto/test
   - click en resultado abre destino correcto (deep-link)
3. Demo interactivo:
   - landing y docs muestran selector de escenarios
   - el escenario elegido persiste al recargar
4. Notificaciones:
   - abrir panel
   - links internos navegan dentro de app
   - PR externo abre nueva pestaña

Registro recomendado:
- Crear evidencia con capturas por navegador y check ✅/❌.

### Paso 4) Validación mínima E2E

Ejecutar:

```bash
npm run test:e2e:api
```

Opcional (si hay entorno listo para auth/UI):

```bash
npm run test:e2e
```

## Fase 2 — Operación semanal (sin pagos)

### Paso 5) Revisión KPI semanal

1. Generar baseline (`npm run kpi:baseline`).
2. Comparar contra metas canónicas:
   - `activation24hPct > 60%`
   - `timeToFirstHealingMinutes < 15`
   - `autoPrRatePct > 35%`
3. Definir 1–2 acciones de mejora semanal.

Referencia:
- `docs/KPI_WEEKLY_REPORT_PLAYBOOK.md`
- `docs/METRICAS_Y_KPIS_2026.md`

## Fase 3 — Dejar para el final (pago/manual externo)

> Ejecutar solo cuando la fase sin pagos esté validada.

### Paso 6) Configurar IA productiva

- Setear `ANTHROPIC_API_KEY` en Vercel (Production).

### Paso 7) Activar pagos

1. Elegir gateway principal (Stripe / MercadoPago / Lemon).
2. Cargar llaves live y price IDs en Vercel.
3. Configurar webhook productivo.
4. Probar compra real + cancelación + webhook recibido.

Referencia inicial:
- `docs/STRIPE_SETUP.md`

### Paso 8) Dominio productivo

1. Configurar `healify.dev`.
2. Apuntar DNS al deployment productivo.
3. Validar SSL, callback auth, webhooks y links públicos.

---

## Checklist rápido de ejecución

- [x] `npx tsc --noEmit` limpio
- [ ] `npm run kpi:baseline` generado con datos reales
- [x] QA de búsqueda/demo/notificaciones en 3 navegadores
- [x] E2E API OK
- [ ] Solo al final: IA live + pagos + dominio

## Estado de avance (2026-02-28)

- QA manual UX cross-browser: OK ✅
- `npm run test:e2e:api`: 14/14 passing ✅
- Baseline KPI: ejecutado en modo pendiente por falta de `DATABASE_URL` en entorno local.

Última actualización: 2026-02-28
