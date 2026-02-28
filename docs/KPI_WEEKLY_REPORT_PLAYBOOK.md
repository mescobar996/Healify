# Healify — KPI Weekly Report Playbook

Objetivo: estandarizar la ejecución semanal de KPI sin depender de tareas manuales ad-hoc.

## 1) Generar baseline

Ejecutar:

`npx tsx scripts/generate-kpi-baseline.ts`

Salida:
- `docs/KPI_BASELINE_LATEST.md`

## 2) Verificar metas

Comparar KPI actual vs target canónico:
- `activation24hPct > 60%`
- `timeToFirstHealingMinutes < 15`
- `autoPrRatePct > 35%`

Fuente canónica de definiciones:
- `docs/METRICAS_Y_KPIS_2026.md`

## 3) Acciones correctivas sugeridas

Cuando `activation24hPct` cae:
- revisar onboarding de conexión de repo
- reducir fricción de primer run

Cuando `timeToFirstHealingMinutes` sube:
- priorizar sandbox + demo flow
- revisar tiempos de ejecución de primer test

Cuando `autoPrRatePct` cae:
- auditar calidad de eventos `HEALED_AUTO`
- revisar cobertura de selectors + confidence thresholds

## 4) Cadencia

- Lunes: generar baseline y publicar snapshot.
- Miércoles: revisión intermedia de desvíos.
- Viernes: cierre semanal con foco en 1–2 acciones de impacto.
