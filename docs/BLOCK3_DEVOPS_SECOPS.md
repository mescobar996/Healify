# BLOCK 3 — DevOps / SecOps Baseline

## Pipeline YAML (resumen)

### [Etapa] Lint & Type Check
- [Script] `npm ci`, `prisma generate`, `prisma validate`, `tsc --noEmit`, `npm run lint`
- [Artefactos] N/A
- [Condiciones de Fallo] Cualquier error de tipado/lint/schema

### [Etapa] Unit Tests
- [Script] `npm test -- --reporter=verbose`
- [Artefactos] N/A
- [Condiciones de Fallo] Tests unitarios fallando

### [Etapa] Build
- [Script] `npx prisma generate && npx next build`
- [Artefactos] N/A
- [Condiciones de Fallo] Build/compilación fallida

### [Etapa] Security SCA
- [Script] `npm audit --omit=dev --audit-level=critical`
- [Artefactos] N/A
- [Condiciones de Fallo] Vulnerabilidades críticas en dependencias de producción

### [Etapa] E2E API
- [Script] `npx playwright test --project=api --reporter=github`
- [Artefactos] `playwright-report/`, `test-results/`
- [Condiciones de Fallo] Cualquier prueba API fallida

## Estabilidad operativa
- Concurrency habilitada para cancelar pipelines obsoletos en la misma rama.
- `timeout-minutes` por job para evitar ejecución colgada.
- Artefactos Playwright siempre disponibles para diagnóstico post-fallo.

## Rollback

### Estrategia recomendada
1. Si falla `main` tras merge, identificar commit con `git log`.
2. Crear rollback seguro con:
   - `git revert <sha>` para revertir cambios puntuales.
   - Revertir en PR para mantener trazabilidad.
3. Verificar pipeline completo antes de redeploy.
4. En Vercel/Railway, redeployar desde commit estable previo si es urgente.

### Criterio de activación
- Error crítico en endpoint de producción.
- Falla de seguridad crítica detectada en SCA.
- Regresión funcional en pruebas API críticas.

## Observabilidad mínima
- Correlación por `requestId` en respuestas de error de APIs críticas.
- Healthcheck worker en Railway (`/health`) con restart policy `ON_FAILURE`.
- Logs de workflow + artefactos API E2E como evidencia de incidentes.

## Seguridad de secretos
- No hardcodear credenciales ni tokens.
- Mantener secretos en GitHub Actions/Vercel/Railway env vars.
- Rotar secretos críticos en incidentes (NextAuth, webhook secrets, Redis, DB credentials).
