# BLOCK 4 — Release Go/No-Go Checklist

## Objetivo
Asegurar cierre completo con criterio explícito de liberación y rollback rápido.

## Go/No-Go
| ID | Criterio | Evidencia requerida | Estado |
|---|---|---|---|
| GNG-001 | CI verde en `main` (lint, unit, build, SCA, e2e-api) | Workflow `CI` exitoso | ☐ |
| GNG-002 | Contrato de error homogéneo en endpoints críticos | Respuestas incluyen `error`, `code`, `requestId` | ☐ |
| GNG-003 | Regresión API crítica ejecutada | `e2e/api.spec.ts` pasando | ☐ |
| GNG-004 | Flujo UI crítico usable en móvil | Validación manual: Landing → Sign in → Proyectos → Connect | ☐ |
| GNG-005 | Seguridad mínima activa | Webhooks firmados + SCA sin críticos | ☐ |
| GNG-006 | Estrategia de rollback definida | `docs/BLOCK3_DEVOPS_SECOPS.md` | ☐ |

## Smoke tests pre-release
1. `GET /api/projects` sin auth -> 401 + `code=AUTH_REQUIRED`
2. `POST /api/webhook/github` sin firma -> 401 + `code=WEBHOOK_UNAUTHORIZED`
3. `POST /api/webhook/stripe` sin signature -> 400 + `code=STRIPE_SIGNATURE_MISSING`
4. `GET /api/search` sin auth -> 401 + `requestId`
5. UI: Dashboard Projects carga y permite retry si backend falla

## Condición de Go
- Todos los criterios GNG-001..006 en ✅.

## Condición de No-Go
- Cualquier fallo en seguridad crítica, contrato de error crítico, o pruebas API en rutas core.
