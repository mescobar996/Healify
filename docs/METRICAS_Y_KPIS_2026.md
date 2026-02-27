# Healify — Métricas y KPIs (fuente única)

Fecha de referencia: 2026-02-27

## Definiciones canónicas

- `registered`: usuarios creados en la ventana analizada.
- `repoConnected`: usuarios con al menos 1 proyecto conectado.
- `firstHealing`: usuarios con al menos 1 evento `HEALED_AUTO` o `HEALED_MANUAL`.
- `paid`: usuarios con suscripción activa y plan distinto de `FREE`.
- `activation24hPct`: `%` de usuarios que conectan repo dentro de 24h de registro.
- `timeToFirstHealingMinutes`: minutos promedio desde registro hasta primer healing.
- `autoPrRatePct`: `%` de healings con `prUrl` no nula.

## Objetivos KPI semanales

- `activation24hPct > 60%`
- `timeToFirstHealingMinutes < 15`
- `autoPrRatePct > 35%`

## Endpoints de referencia

- OpenAPI: `/api/openapi`
- Conversión/KPI: `/api/analytics/conversion?days=30`
- ROI export: `/api/analytics/export?format=csv|pdf`

## Nota de consistencia

README, dashboard y docs deben usar estas definiciones para evitar desalineación de métricas entre vistas.
