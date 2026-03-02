# BLOCK 2 — Plan de Pruebas (Backend + QA)

## Objetivo
Validar consistencia de errores HTTP, robustez de input sanitization y comportamiento end-to-end del flujo de proyectos y webhook.

## Matriz de Trazabilidad
| ID | Escenario | Datos de Entrada | Resultado Esperado | Tipo de Prueba |
|---|---|---|---|---|
| B2-TC-001 | GET `/api/projects` sin sesión | Request sin cookie de sesión | `401`, `error`, `code=AUTH_REQUIRED`, `requestId` | Funcional/Negativa |
| B2-TC-002 | POST `/api/projects` con nombre vacío | `{ "name": "   " }` | `400`, `code=INVALID_NAME` | Validación/Negativa |
| B2-TC-003 | PATCH `/api/projects/:id` sin campos | `{}` | `400`, `code=NO_UPDATE_FIELDS` | Validación/Negativa |
| B2-TC-004 | GET `/api/projects/:id` inexistente | `id` inválido | `404`, `code=PROJECT_NOT_FOUND` | Funcional/Negativa |
| B2-TC-005 | Webhook GitHub sin firma válida | Header `x-hub-signature-256` ausente/inválido | `401`, `code=WEBHOOK_UNAUTHORIZED` | Seguridad/Negativa |
| B2-TC-006 | Webhook GitHub JSON inválido | Body no parseable | `400`, `code=INVALID_JSON` | Robustez/Negativa |
| B2-TC-007 | Webhook GitHub payload incompleto | Sin `repository` o sin `ref` | `400`, `code=INVALID_WEBHOOK_PAYLOAD` | Validación/Negativa |
| B2-TC-008 | Contrato de error homogéneo | Cualquier error API crítico | Siempre incluye `error`, `code`, `requestId` | Integración/Contrato |
| B2-TC-009 | POST `/api/ingest` API key inválida | Header/body con key inválida | `401`, `code=INVALID_API_KEY`, `requestId` | Seguridad/Negativa |
| B2-TC-010 | POST `/api/ingest` branch inválido | `branch` malformado | `400`, `code=INVALID_BRANCH` | Validación/Negativa |
| B2-TC-011 | POST `/api/projects/:id/run` sin sesión | Request anónimo | `401`, `code=AUTH_REQUIRED`, `requestId` | Funcional/Negativa |

## Checklist de Evidencia
- Captura de request/response (status, body, headers)
- Valor de `requestId` presente en body y header
- Logs backend correlacionados por `requestId`
- Resultado esperado vs real por caso

## Criterio de salida Bloque 2
- 0 casos críticos fallando (B2-TC-001..008)
- 100% de errores críticos con contrato homogéneo
- Sin regresión en endpoints de proyectos y webhook
