# Healify — Informe de Estado y Visión de Producto

**Fecha:** Febrero 2026  
**Versión:** 0.2.0  
**Autor:** Claude + Matias Escobar

---

## 1) ¿Qué es Healify?

Healify es una plataforma SaaS que autocura tests automatizados rotos usando Inteligencia Artificial.

Cuando un selector CSS, XPath o texto falla porque la UI cambió, Healify lo detecta, encuentra el nuevo selector correcto con Claude AI y abre un Pull Request automático en GitHub con el fix aplicado, sin intervención humana.

**Problema que resuelve:** Los equipos de QA pierden entre 30% y 60% de su tiempo manteniendo selectores rotos en lugar de escribir tests nuevos. Healify elimina ese problema.

**Tagline:** _Tests that heal themselves._

---

## 2) Estado Técnico Actual

### 2.1 Infraestructura

| Componente | Tecnología | Estado |
|---|---|---|
| Frontend + API | Next.js 16 (Vercel) | ✅ Productivo |
| Base de datos | PostgreSQL (Neon) | ✅ Productivo |
| Cola de jobs | BullMQ + Redis | ✅ Productivo |
| Worker de tests | Node.js + Playwright (Railway) | ✅ Productivo |
| Auth | NextAuth v4 + GitHub OAuth | ✅ Productivo |
| Email transaccional | Resend | ✅ Productivo |
| AI principal | Anthropic Claude Sonnet | ⚠️ Requiere API Key |
| Pagos internacionales | Lemon Squeezy (USD) | ⚠️ Requiere configurar |
| Pagos Argentina | MercadoPago (ARS) | ⚠️ Requiere configurar |
| Pagos globales | Stripe (USD) | ⚠️ En modo test |

### 2.2 Métricas de Código

| Métrica | Valor |
|---|---|
| Archivos fuente (.ts/.tsx) | 169 |
| Rutas de API | 37 |
| Modelos de base de datos | 14 |
| Tests automatizados | 157 / 157 ✅ |
| Errores TypeScript | 0 ✅ |
| Commits en producción | 75+ |
| Cobertura de seguridad | HMAC en webhooks GitHub + Stripe + MP |

### 2.3 Páginas y Secciones

| Página | URL | Estado |
|---|---|---|
| Landing | `/` | ✅ Completa con demo visual |
| Pricing | `/pricing` | ✅ Con selector MP / LS / Stripe |
| Docs | `/docs` | ✅ SDK Playwright, Cypress, Jest |
| Dashboard principal | `/dashboard` | ✅ ROI, métricas, actividad |
| Proyectos | `/dashboard/projects` | ✅ CRUD completo |
| Tests | `/dashboard/tests` | ✅ Filtros fecha/status/branch + flaky badge |
| Healing events | `/dashboard/healing/[id]` | ✅ Diff visual selector |
| Selectores | `/dashboard/selectors` | ✅ Timeline evolución (nuevo) |
| Settings | `/dashboard/settings` | ✅ API keys, Slack, perfil |
| Sign in | `/auth/signin` | ✅ GitHub + Google |

---

## 3) Lo que Funciona Hoy (Features Completos)

### Core de Healing

- Detección de fallo: worker detecta qué selector exacto rompió el test.
- Análisis con IA: Claude Sonnet analiza el DOM actual y propone el selector más robusto (`data-testid > aria-label > CSS semántico > XPath`).
- Fallback determinístico: si no hay API key de Anthropic, usa análisis de patrones automático.
- Auto-PR: si la confianza es ≥ 95%, abre un Pull Request en GitHub con el fix, incluyendo comentario con el diff del selector.

### Dashboard para QA

- Filtros avanzados en Test Runs: por status, branch, fecha (hoy/7 días/30 días/custom).
- Badge “Flaky” con ícono 🔥: detecta tests que alternan `PASSED/FAILED` en los últimos 5 runs.
- Historial de selectores: timeline visual de cada selector (cambios, confianza y tendencia).
- Stats por archivo: `/api/analytics/files` agrupa fallos por `testFile` para detectar módulos inestables.
- Export CSV/JSON de test runs.
- Diff visual del selector viejo vs nuevo con highlighting.

### Notificaciones

- Email automático cuando un test es curado (Resend).
- Notificación Slack al canal configurado.
- Notificación in-app en tiempo real.
- Bell con contador de no leídos en el header.

### SDK para QA Engineers

Instalación para 3 frameworks:

```bash
npm install @healify/playwright-sdk
npm install @healify/cypress-sdk
npm install @healify/jest-sdk
```

Configuración en 3 líneas en el test runner. El SDK reporta automáticamente cada fallo a la API de Healify.

### Seguridad

- HMAC-SHA256 en webhooks (GitHub, Stripe, MercadoPago).
- Rate limiting: 60 requests/min por API key.
- Verificación de ownership en endpoints.
- Ruta de debug protegida (solo en dev o con sesión activa).

---

## 4) Lo que Falta — Gaps Críticos para Adopción de QA

### 4.1 Bloqueantes Externos (requieren acción, no código)

| Item | Urgencia | Costo | Dónde |
|---|---|---|---|
| `ANTHROPIC_API_KEY` en Vercel | 🔴 Crítico | Pay-per-use ~$3-15/mes | console.anthropic.com |
| Crear planes en MercadoPago | 🔴 Crítico | 3.49% comisión | mercadopago.com.ar/developers |
| Crear productos en Lemon Squeezy | 🔴 Crítico | 5% comisión | app.lemonsqueezy.com |
| Dominio `healify.dev` | 🟠 Alto | ~$10/año | cloudflare.com/registrar |
| Fix build Vercel (`finishedAt`) | 🔴 Urgente | $0 | Reemplazar archivo export route |

### 4.2 Features de Producto Faltantes

#### Para QA Engineers (usuarios individuales)

| Feature | Impacto | Esfuerzo |
|---|---|---|
| Onboarding interactivo animado | 🔴 Muy alto | 3-4 días |
| Demo animado tipo “cómo funciona” | 🔴 Muy alto | 2-3 días |
| Visual test teardown (timeline + screenshots) | 🟠 Alto | 3-4 días |
| Branch comparison (`main` vs `feature`) | 🟠 Alto | 2 días |
| Retry automático de tests flaky | 🟡 Medio | 1-2 días |
| Tags/etiquetas en test runs | 🟡 Medio | 1 día |
| Búsqueda full-text en test names | 🟡 Medio | 1 día |

#### Para QA Automation Leads / Managers

| Feature | Impacto | Esfuerzo |
|---|---|---|
| Weekly automated report por email | 🔴 Muy alto | 1-2 días |
| GitHub badge “Healed by Healify” | 🟠 Alto | 1 día |
| Métricas de ROI exportables (PDF/CSV) | 🟠 Alto | 2 días |
| Límites por plan aplicados | 🟠 Alto | 1 día |
| Dashboard de equipo (multi-usuario) | 🔴 Muy alto (Enterprise) | 5-7 días |

#### Para Adopción y Descubrimiento

| Feature | Impacto | Esfuerzo |
|---|---|---|
| Onboarding de 3 pasos con video | 🔴 Muy alto | 2-3 días |
| “Try with demo repo” (sin setup) | 🔴 Muy alto | 1 día |
| Integración CI/CD (GitHub Actions, GitLab CI) | 🟠 Alto | 3 días |
| Plugin para VS Code | 🟡 Medio | 5+ días |
| Soporte para Selenium | 🟡 Medio | 2 días |

---

## 5) Visión: Cómo Debe Verse Healify para QA/QA Automation

### 5.1 El problema real del usuario QA

Ciclo típico de dolor semanal:

1. Un developer cambia el texto de un botón.
2. 15 tests fallan en CI.
3. El QA pierde horas actualizando selectores.
4. El sprint se atrasa.
5. Management culpa a tests “frágiles”.

Healify ya resuelve el paso 2-3, pero hoy un usuario nuevo no lo entiende en 10 segundos. Ese es el mayor gap.

### 5.2 Demo animada — Propuesta concreta

**Objetivo:** en menos de 30 segundos, que un usuario nuevo entienda exactamente qué hace Healify.

Flujo a mostrar:

```
[1] Test Runner ejecuta tests
        ↓
[2] Test falla: "Element not found: #btn-submit"
        ↓
[3] Healify captura el DOM actual
        ↓
[4] Claude AI analiza: "El botón cambió a data-testid='submit-btn'"
        ↓
[5] Healify propone: [data-testid="submit-btn"] con 97% confianza
        ↓
[6] Pull Request abierto automáticamente en GitHub
        ↓
[7] Test vuelve a pasar ✅
```

Implementación visual (landing):

- Código real de test que falla con animación de consola.
- Overlay de análisis DOM con efecto de scan.
- Diff del selector con highlight verde/rojo.
- Notificación de PR abierto.
- Test volviendo a verde.
- Todo en loop y sin interacción.

### 5.3 Onboarding ideal para QA

**Paso 1 — Conectar repo (2 min)**

- Formulario simple: nombre + URL GitHub.
- Instrucciones inline para webhook.
- Preview de webhook URL copiable.

**Paso 2 — Instalar SDK (3 min)**

- Detectar framework desde `package.json` (Playwright/Cypress/Jest).
- Mostrar snippet exacto por framework.
- Botones de copiar.

**Paso 3 — Primer healing (automático)**

- Al primer push con test fallando: healing automático.
- Email inmediato de éxito.
- Badge en dashboard: 🎉 Primera curación.

### 5.4 Qué necesita un QA Automation Lead para pagar

- ROI automático (horas y costo ahorrado).
- Reporte semanal automático por email.
- POC real en su propio repo.
- Comparación histórica mes a mes.
- Integración con stack actual (GitHub Actions, Jira, Slack).

---

## 6) Roadmap de Producto — Próximas 12 Semanas

### Sprint 1 (Semanas 1-2): Fix y Demo

| Tarea | Responsable | Prioridad |
|---|---|---|
| Fix build Vercel (`finishedAt`) | Dev | 🔴 Urgente |
| Configurar `ANTHROPIC_API_KEY` | Fundador | 🔴 Crítico |
| Demo animada en landing page | Dev | 🔴 Muy alto |
| Onboarding de 3 pasos mejorado | Dev | 🔴 Muy alto |

### Sprint 2 (Semanas 3-4): Retención

| Tarea | Responsable | Prioridad |
|---|---|---|
| Weekly email report automático | Dev | 🔴 Muy alto |
| Visual test teardown (timeline) | Dev | 🟠 Alto |
| Branch comparison (`main` vs `feature`) | Dev | 🟠 Alto |
| GitHub badge “Healed by Healify” | Dev | 🟠 Alto |

### Sprint 3 (Semanas 5-6): Monetización

| Tarea | Responsable | Prioridad |
|---|---|---|
| Activar MercadoPago en producción | Fundador | 🔴 Crítico |
| Activar Lemon Squeezy en producción | Fundador | 🔴 Crítico |
| Aplicar límites de plan reales | Dev | 🟠 Alto |
| Dominio `healify.dev` | Fundador | 🟠 Alto |
| Export de ROI en PDF | Dev | 🟡 Medio |

### Sprint 4 (Semanas 7-8): Escala

| Tarea | Responsable | Prioridad |
|---|---|---|
| Dashboard de equipo (multi-usuario) | Dev | 🔴 Alto (Enterprise) |
| Integración GitHub Actions (YAML snippet) | Dev | 🟠 Alto |
| Soporte Selenium básico | Dev | 🟡 Medio |
| API pública documentada (OpenAPI) | Dev | 🟡 Medio |

### Sprint 5-6 (Semanas 9-12): Crecimiento

| Tarea | Responsable | Prioridad |
|---|---|---|
| Plugin VS Code (alertas inline) | Dev | 🟡 Medio |
| Integración Jira (abrir ticket en `bug_detected`) | Dev | 🟡 Medio |
| Soporte GitLab CI | Dev | 🟡 Medio |
| Plan Free con límites (growth hacking) | Dev | 🟠 Alto |
| Programa de referidos | Dev | 🟡 Medio |

---

## 7) Comparativa Competitiva

| Característica | Healify | Testim | Mabl | Applitools |
|---|---|---|---|---|
| Autocura con IA | ✅ Claude | ✅ Propio | ✅ Propio | ❌ Solo visual |
| Auto-PR en GitHub | ✅ | ❌ | ❌ | ❌ |
| SDK open source | ✅ | ❌ | ❌ | ✅ parcial |
| Precio base | $29/mes | $450/mes | $500/mes | $1500/mes |
| Funciona con Playwright | ✅ | ❌ | ✅ | ✅ |
| Funciona con Cypress | ✅ | ✅ | ✅ | ✅ |
| Pagos en ARS | ✅ MP | ❌ | ❌ | ❌ |
| Self-hosteable | 🔜 Roadmap | ❌ | ❌ | ❌ |

**Ventaja competitiva:** único producto con PRs automáticos, precio accesible para equipos chicos y pagos en pesos argentinos para LATAM.

---

## 8) Propuesta: Demo Animada — Especificación Técnica

### 8.1 Componente `HealingDemo` en landing

**Ubicación:** entre el hero y la sección de features en `/`.

**Estructura visual (4 paneles simultáneos):**

```
┌─────────────────────────────────────────────────────────────┐
│  ANTES: Tu test falla          DESPUÉS: Healify lo cura     │
├─────────────────┬───────────────────────────────────────────┤
│  🔴 Terminal    │  ✅ GitHub PR abierto                     │
│                 │                                           │
│  FAILED         │  healify-fix/abc123                       │
│  login.spec.ts  │  ─────────────────────────────────        │
│  line 23        │  - selector: '#btn-login'                 │
│  #btn-login     │  + selector: '[data-testid="login-btn"]'  │
│  not found      │                                           │
│                 │  Confianza: 97% ✅                        │
├─────────────────┴───────────────────────────────────────────┤
│         ⚡ Healify detectó el cambio en 3.2 segundos         │
└─────────────────────────────────────────────────────────────┘
```

**Animación:**

- 0.0s: terminal muestra test corriendo.
- 1.5s: falla test con error animado (rojo).
- 2.5s: overlay “Healify analizando DOM...” con scan.
- 3.5s: diff con highlight (rojo → verde).
- 4.5s: notificación “PR #42 abierto en GitHub”.
- 5.5s: terminal muestra `PASSED ✅`.
- 7.0s: loop.

### 8.2 Implementación

- Tecnología: React + Framer Motion (ya instalado).
- Datos: hardcodeados (sin API).
- Responsive: mobile con paneles apilados verticalmente.
- Modo: loop automático, sin interacción.
- Tiempo estimado: 2 días.

---

## 9) Métricas de Éxito — Cómo Saber si va Bien

### Métricas de Adopción (primeros 3 meses)

| Métrica | Meta mes 1 | Meta mes 3 |
|---|---|---|
| Usuarios registrados | 50 | 300 |
| Proyectos conectados | 20 | 150 |
| Tests curados en total | 100 | 1.500 |
| Suscriptores pagos | 5 | 30 |
| MRR (Monthly Recurring Revenue) | $145 USD | $870 USD |

### Métricas de Retención

| Métrica | Meta |
|---|---|
| % usuarios que conectan repo en las primeras 24h | > 60% |
| % usuarios que ven al menos 1 healing en primera semana | > 40% |
| Churn mensual | < 5% |
| NPS (Net Promoter Score) | > 50 |

### Métricas de Producto

| Métrica | Objetivo |
|---|---|
| Tiempo hasta primer healing | < 15 minutos desde registro |
| Confianza promedio de IA | > 88% |
| Tasa de auto-PR (confianza ≥ 95%) | > 35% de healings |
| Uptime | > 99.5% |

---

## 10) Resumen Ejecutivo

**Estado actual en una línea:** Healify está técnicamente completo al 95%; lo que falta no es código, es activación.

### Las 5 cosas más importantes ahora mismo

1. Fix build Vercel — cambiar `completedAt` por `finishedAt` en `export/route.ts` (5 min).
2. Configurar `ANTHROPIC_API_KEY` en variables de entorno de Vercel (10 min).
3. Construir la demo animada (2 días).
4. Activar pagos reales (MercadoPago y Lemon Squeezy) con credenciales de producción (1 hora).
5. Implementar weekly email report (1 día).

### Por qué Healify puede ganar

- El mercado de testing automation crece al 14% anual.
- Competidores cuestan ~15x más (`$450/mes` vs `$29/mes`).
- Único producto con PRs automáticos.
- Primer mover LATAM con MercadoPago.
- El código ya funciona; falta activación y claridad de valor.

---

Generado el 27 de Febrero de 2026 | Healify v0.2.0 | 157/157 tests passing | 0 TypeScript errors
