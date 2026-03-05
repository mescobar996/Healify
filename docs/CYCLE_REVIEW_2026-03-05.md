# Healify — Revisión Completa del Ciclo de Desarrollo

> **Fecha:** 5 de marzo de 2026
> **Stack:** Next.js 16.1.6 · React 19 · TypeScript strict · Prisma 6 · Neon PostgreSQL · Redis (ioredis) · Vercel
> **Tests:** 264 passed, 0 failed (Vitest) | E2E: Playwright (requiere auth local)
> **Nota:** Falta integrar la API de Claude Code (AI engine usa `z-ai-web-dev-sdk` actualmente)

---

## [1] 🏗️ ARQUITECTO — Auditoría de Estructura

### Archivos y flujo de datos

```
src/
├── app/                          # Next.js App Router
│   ├── api/  (62 API routes)     # REST API — auth propio por ruta
│   ├── auth/ (signin + error)    # Páginas de auth
│   ├── dashboard/                # Rutas protegidas (middleware)
│   └── page.tsx                  # Landing (LandingPage component)
├── components/
│   ├── landing/  (6 secciones)   # Hero + Features + HowItWorks + Tools + Video + CTA
│   ├── dashboard/ (8 widgets)    # MetricCard, Charts, StatusBadge, etc.
│   └── ui/  (34 primitivos)      # shadcn/ui
├── lib/
│   ├── actions.ts (501 líneas)   # Server Actions — MONOLITO
│   ├── ai/                       # AI healing (ZAI SDK + prompts)
│   ├── auth/session.ts           # getSessionUser() / requireSessionUser()
│   ├── engine/                   # Motor determinístico de healing v2
│   ├── github/                   # Octokit: repos, auto-PR, auth
│   ├── payment/                  # MercadoPago + exchange-rate + types
│   └── [15 archivos raíz]       # Redis, DB, rate-limit, queue, etc.
├── workers/                      # BullMQ workers (Railway)
└── middleware.ts                 # withAuth — protege /dashboard/*
```

### Flujo de datos principal

```
[CI/GitHub] → POST /api/v1/report → rate-limit → validate API key → create TestRun
    → addTestJob(BullMQ) → Railway Worker ejecuta Playwright
    → engine/healing-engine.ts analiza selectores rotos
    → HealingEvent.create → auto-PR si confidence ≥ 0.95
    → SSE stream → Dashboard en tiempo real
```

### Decisiones de arquitectura evaluadas

| Decisión | Veredicto | Comentario |
|----------|-----------|------------|
| JWT strategy (no DB sessions) | ✅ Correcto | Reduce queries; Vercel serverless-friendly |
| PrismaAdapter + JWT | ⚠️ Atención | Adapter crea Account/Session rows que JWT no usa. Overhead en DB |
| Server Actions en `actions.ts` + API Routes | ❌ Duplicación | Dashboard usa Server Actions, API usa routes. Mismos queries, doble mantenimiento |
| Motor determinístico v2 + AI service | ✅ Buena separación | Engine es fallback sin API; AI es premium |
| Redis para todo (rate-limit, queue, SSE, cache) | ⚠️ Single point of failure | Redis down = queue + rate-limit + SSE rotos. Fallbacks existen pero incompletos |
| 62 rutas API | ⚠️ Excesivo | Muchas rutas demo/debugging que no son producción |

### Responsabilidades mezcladas

| Problema | Archivos | Recomendación |
|----------|----------|---------------|
| `actions.ts` es un monolito de 501 líneas | [src/lib/actions.ts](src/lib/actions.ts) | Splitear en `actions/projects.ts`, `actions/test-runs.ts`, `actions/healing.ts` |
| Triple definición de planes | `stripe.ts` PLANS + `payment/types.ts` PLAN_META + `api/plans/route.ts` inline | Consolidar en `payment/types.ts` como SSoT |
| Doble `formatRelativeTime` | `actions.ts` (español) + `api.ts` (inglés) | Mover a `utils.ts` con soporte i18n |
| Rate limit en 3 lugares | `rate-limit.ts` + `http-rate-limiter.ts` + inline en waitlist | Migrar waitlist a usar `httpRateLimit()` |

### Convenciones Next.js no respetadas

1. **Metadata duplicada**: `page.tsx` y `layout.tsx` definen OG metadata diferente (inglés vs español)
2. **`redirects()` vacío** en `next.config.ts` — no aporta nada, eliminar
3. **`@auth/prisma-adapter` v2** instalado pero nunca importado — confunde dependencias

---

## [2] 💻 CONSULTOR — Revisión de Implementación

### Server Actions — `actions.ts` (501 líneas)

```typescript
// PROBLEMA: Duplica toda la lógica de las API routes
export async function getProjects() { ... }     // ≈ GET /api/projects
export async function createProject() { ... }   // ≈ POST /api/projects
export async function executeTestRun() { ... }  // ≈ POST /api/projects/[id]/run
export async function getHealingEvents() { ... } // ≈ GET /api/healing-events
export async function getDashboardStats() { ... } // ≈ GET /api/dashboard
```

**Impacto:** Cada cambio de lógica requiere actualizarlo en 2 lugares.
**Fix:** Migrar dashboard pages a usar `api.ts` (client-side fetcher) o extraer la lógica compartida a services.

### Auth Route — Calidad del handler

```typescript
// ANTES (problema): no captura errores del handler
return (handler as any)(req, resolvedCtx)

// AHORA (mejorado en este commit): try/catch + logging
try {
  return await (handler as any)(req, resolvedCtx)
} catch (err) {
  console.error(`[Auth] Handler error on ${req.method} /${route}:`, err)
  throw err
}
```

### PrismaClient Singleton — Correcto
```typescript
// db.ts — implementación limpia con connection_limit
export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: appendConnectionLimit(process.env.DATABASE_URL),
})
```

### Redis — Correcto con fallbacks
```typescript
// redis.ts — lazy init, build-time safe, exponential backoff, reconnect on READONLY
```

### Calidad general del código

| Aspecto | Estado | Nota |
|---------|--------|------|
| TypeScript strict | ✅ | `noImplicitAny: true`, `strict: true`, `ignoreBuildErrors: false` |
| Error handling | ✅ Mayormente | Sentry integration, try/catch en server actions |
| Input validation | ✅ | Zod en env.ts, manual en actions, `repo-validation.ts` |
| Auth middleware | ✅ | `withAuth` protege `/dashboard/*`, API routes self-auth |
| Security headers | ✅ | CSP, HSTS, X-Frame-Options, X-XSS-Protection |

---

## [3] 🕵️ DETECTIVE — Bugs y Errores Encontrados

### Bug #1: OAuthCallback falla en producción 🔴

**Síntoma:** GitHub redirige al usuario a autorizar, pero el callback falla con `OAuthCallback`.
**Hipótesis (por probabilidad):**

| # | Hipótesis | Evidencia a favor | Evidencia en contra |
|---|-----------|-------------------|---------------------|
| 1 | `NEXTAUTH_URL` no configurado en Vercel | Variable no es requerida en `env.ts`; NextAuth necesita para verificar CSRF state | Vercel auto-detecta via `VERCEL_URL` |
| 2 | Callback URL en GitHub OAuth App no coincide | Error es específicamente en callback, no en signin | — |
| 3 | `NEXTAUTH_SECRET` incorrecto o no configurado | Sin secret, JWT firma falla silenciosamente | Usuario reportó que lo configuró |

**Causa raíz más probable:** `NEXTAUTH_URL` faltante. Sin ella, NextAuth genera state tokens con una URL base que no coincide con la URL de callback real.
**Fix:** Agregar `NEXTAUTH_URL=https://healify-sigma.vercel.app` en Vercel.
**Endpoint diagnóstico:** `GET /api/auth/check` (creado en este commit).

### Bug #2: Redis completamente caído 🔴

**Síntoma:** `/api/health` → `{"redis":{"status":"error","error":"Stream isn't writeable and enableOfflineQueue options is false"}}`
**Impacto:**
- BullMQ jobs no se crean → test runs quedan en PENDING eternamente
- SSE streams no funcionan → LiveConsole muerto
- Rate limiting fallback permite todo (seguridad reducida)

**Causa raíz:** `REDIS_URL` apunta a un Redis de Railway caído o sin plan activo.
**Fix:** Verificar el servicio Redis en Railway y restaurar la URL.

### Bug #3: E2E global.setup.ts falla 🟡

**Síntoma:** `TimeoutError: page.waitForURL: Timeout 30000ms exceeded` — página devuelve `{"error":"Unauthorized"}`
**Causa:** El setup intenta navegar a una ruta protegida sin sesión válida. Es un problema de configuración local, no un bug de producción.

### Bug #4: `security-utils.ts` solo se usa en tests 🟡

**Síntoma:** `encrypt()`/`decrypt()` AES-256-GCM implementadas pero nunca invocadas en producción.
**Impacto:** `ENCRYPTION_KEY` env var validada como opcional pero nunca usada.
**Fix:** O integrar en producción (encriptar API keys, tokens) o documentar como placeholder futuro.

### Bug #5: Session model inútil con JWT strategy 🟡

**Síntoma:** Prisma schema tiene model `Session` con `sessionToken`, pero JWT strategy nunca escribe sesiones en DB.
**Impacto:** Tabla `sessions` existe vacía. PrismaAdapter intenta escribir pero JWT intercepta.
**Fix:** Dejar por compatibilidad (NextAuth lo requiere en el adapter), pero documentar.

---

## [4] 🔴 CRÍTICO — Code Review Senior

### Corrección

| Item | Nivel | Detalle |
|------|-------|---------|
| Auth callback roto en prod | 🔴 Bloqueante | Nadie puede loguearse. Ver Bug #1 |
| Redis caído bloquea core flow | 🔴 Bloqueante | Sin Redis no hay test runs |
| `actions/stripe.ts` dead code | 🟡 Importante | Confunde a devs; importa de `lib/stripe.ts` que también es dead |
| `billing/portal` bypassa `getSessionUser()` | 🟡 Importante | Inconsistencia de auth; importa `getServerSession` directo |
| `storage.ts` sin imports | 🟡 Importante | Código muerto en lib/, sugiere feature incompleta |

### Seguridad

| Item | Nivel | Detalle |
|------|-------|---------|
| CSP bien configurada | ✅ | `default-src 'self'`, frameSrc limitado a Stripe/Loom |
| HSTS con preload | ✅ | `max-age=63072000; includeSubDomains; preload` |
| API keys hash-at-rest | ✅ | SHA-256 en `api-key-service.ts`, prefix solo para display |
| `NEXTAUTH_SECRET` en env.ts | ✅ | Validado como required en producción |
| Rate limiting fallback fail-open | ⚠️ | Si Redis cae, todo el rate limiting se desactiva — aceptable para availability pero risk de abuse |
| `/api/seed` sin protección extra | ⚠️ | Solo requiere session, no rol ADMIN explícito — verificar |

### Tipos TypeScript

| Item | Nivel | Detalle |
|------|-------|---------|
| `any` cast en auth handler | 🟢 Sugerencia | `(handler as any)(req, resolvedCtx)` — cast necesario por NextAuth typing bug |
| `OAuthProfileProjection` type manual | 🟢 Sugerencia | Correcto; NextAuth no exporta profile types |

### Legibilidad

| Item | Nivel | Detalle |
|------|-------|---------|
| `actions.ts` 501 líneas | 🟡 Importante | Demasiado largo; splitear por dominio |
| Comentarios en español consistentes | ✅ | Coherente con el equipo |
| Naming conventions | ✅ | camelCase, PascalCase components, snake_case DB fields |

### Performance

| Item | Nivel | Detalle |
|------|-------|---------|
| `connection_limit=5` en Prisma | ✅ | Previene pool exhaustion en serverless |
| Redis `lazyConnect: true` | ✅ | No bloquea el import |
| No hay `next/dynamic` en dashboard | 🟡 | Charts (recharts) cargan síncrono; lazy load reduciría TTI |

### Veredicto: **NO listo para producción** hasta resolver:
1. Auth login (NEXTAUTH_URL)
2. Redis connectivity
3. Eliminar dead code que confunde

---

## [5] 🧪 ESCUDO — Plan de Testing

### Estado actual de tests

| Capa | Archivos | Tests | Estado |
|------|----------|-------|--------|
| Unit (Vitest) | 18 | 264 passed, 1 todo | ✅ Sólido |
| E2E (Playwright) | 5 specs | — | ❌ Requiere auth local |
| Integration | 0 | — | ❌ Falta |
| Visual regression | 0 | — | ❌ Falta |

### Capa 1 — Happy Path (lo que debería funcionar)

| ID | Test | Prioridad |
|----|------|-----------|
| HP-1 | GitHub OAuth login → redirect a dashboard | 🔴 |
| HP-2 | Crear proyecto → aparece en lista | 🔴 |
| HP-3 | Trigger test run → job en BullMQ → estado cambia a RUNNING | 🔴 |
| HP-4 | Healing event auto-fix → PR creado | 🟡 |
| HP-5 | Dashboard carga métricas correctas | 🟡 |

### Capa 2 — Edge Cases

| ID | Test | Prioridad |
|----|------|-----------|
| EC-1 | Login con email null (GitHub sin email público) | 🔴 |
| EC-2 | Crear proyecto cuando plan limit alcanzado | 🟡 |
| EC-3 | Doble-click en "Ejecutar test" (race condition) | 🟡 |
| EC-4 | Proyecto sin repositorio → run falla gracefully | 🟡 |

### Capa 3 — Errores Esperados

| ID | Test | Prioridad |
|----|------|-----------|
| ER-1 | Redis caído → test run retorna 503, no 500 | 🔴 |
| ER-2 | DB timeout → Sentry capture + user-friendly error | 🟡 |
| ER-3 | AI service falla → fallback a motor determinístico | 🟡 |
| ER-4 | Stripe webhook con signature inválida → 401 | 🟡 |

### Capa 4 — Regresión

| ID | Test | Prioridad |
|----|------|-----------|
| RG-1 | Cambios en schema.prisma no rompen auth flow | 🔴 |
| RG-2 | Update de NextAuth no rompe JWT callbacks | 🟡 |
| RG-3 | Cambios en `rate-limit.ts` no bloquean auth | 🟡 |

### Smoke Test de 5 minutos (pre-deploy)

1. **Login** → `https://healify-sigma.vercel.app/auth/signin` → click GitHub → dashboard
2. **Health** → `GET /api/health` → DB y Redis OK
3. **Dashboard** → `/dashboard` carga sin errores en console
4. **Crear proyecto** → nombre + repo → aparece en lista
5. **API check** → `GET /api/auth/check` → todas las vars ✅

---

## [6] ⚡ OPTIMIZADOR — Performance

### Bundle analysis

| Issue | Impacto | Fix |
|-------|---------|-----|
| `recharts` (350KB) carga síncrono en dashboard | FCP +800ms en mobile | `next/dynamic(() => import('recharts'), { ssr: false })` |
| `framer-motion` (120KB) en landing | TTI afectado | Lazy load secciones below-the-fold |
| `@mdxeditor/editor` en deps (570KB) | Bundle bloat | ¿Se usa? No encontré imports — posible dead dep |
| `@sentry/nextjs` + source maps upload | Build time +30s | Aceptable para error tracking |
| Doble toaster: `@radix-ui/react-toast` + `sonner` | 2 toast systems, ~40KB extra | Consolidar en uno solo |

### Database queries

| Query | Ubicación | Issue | Fix |
|-------|-----------|-------|-----|
| `getProjects()` con include testRuns | `actions.ts:24` | Carga TODOS los testRuns del último | ✅ Ya tiene `take: 1` |
| `getDashboardStats()` | `actions.ts` | Múltiples queries secuenciales | Usar `Promise.all()` para paralelizar |
| Sin indexes para `healingEvents.createdAt` | schema.prisma | Queries de analytics pueden ser lentas | ✅ Ya tiene `@@index([status, createdAt])` |

### Serverless cold starts

| Optimization | Estado |
|--------------|--------|
| `connection_limit=5` Prisma | ✅ Implementado |
| Redis `lazyConnect: true` | ✅ Implementado |
| `standalone` output mode | ✅ Implementado |
| Font preload con `display: swap` | ✅ Implementado |

### Recomendación de mayor impacto/esfuerzo

**Lazy load recharts + framer-motion** → reduciría el JS bundle del dashboard en ~470KB → FCP mejora ~1s en 3G.

---

## [7] 📚 NARRADOR — Documentación

### Documentos existentes

| Documento | Estado | Necesita update |
|-----------|--------|-----------------|
| [README.md](README.md) | ✅ Completo | Agregar note sobre Claude Code API faltante |
| [AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | ✅ | Desactualizado — no refleja fixes post-audit |
| [AUDIT_REPORT_2026-02-21.md](docs/AUDIT_REPORT_2026-02-21.md) | ✅ | Punto en el tiempo, está bien |
| [AUTH_TROUBLESHOOTING.md](docs/AUTH_TROUBLESHOOTING.md) | ✅ | Agregar OAuthCallback fix (NEXTAUTH_URL) |
| [STRIPE_SETUP.md](docs/STRIPE_SETUP.md) | ⚠️ | Stripe es legacy — payment es MercadoPago ahora |
| [RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) | ✅ | OK |

### Documentación faltante

| Necesidad | Prioridad | Descripción |
|-----------|-----------|-------------|
| `PAYMENT_SETUP.md` | 🔴 | MercadoPago setup (reemplaza STRIPE_SETUP) |
| `API_REFERENCE.md` | 🟡 | Las 62 rutas documentadas (OpenAPI existe pero `/api/openapi` es la SSoT) |
| `ARCHITECTURE.md` | 🟡 | Diagrama del flujo de datos completo (CI → healing → PR) |
| `ENV_VARS.md` | 🔴 | Lista completa de todas las env vars necesarias con descripción |
| Inline JSDoc en `actions.ts` | 🟡 | 501 líneas sin un solo JSDoc |

### Variables de entorno — inventario completo

| Variable | Requerida | Usado por |
|----------|-----------|-----------|
| `DATABASE_URL` | ✅ Sí | Prisma/Neon |
| `NEXTAUTH_SECRET` | ✅ Sí | NextAuth JWT signing |
| `NEXTAUTH_URL` | ⚠️ Debería ser required | NextAuth OAuth callbacks |
| `GITHUB_CLIENT_ID` / `GITHUB_ID` | ✅ Sí | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` / `GITHUB_SECRET` | ✅ Sí | GitHub OAuth |
| `GOOGLE_CLIENT_ID` | ⚠️ Opcional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⚠️ Opcional | Google OAuth |
| `REDIS_URL` | ⚠️ Crítico en prod | BullMQ, rate-limit, SSE |
| `RESEND_API_KEY` | Opcional | Welcome email, weekly reports |
| `ENCRYPTION_KEY` | Opcional | `security-utils.ts` (no usado en prod) |
| `STRIPE_SECRET_KEY` | ⚠️ Legacy | Solo webhook handler |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ Legacy | Solo webhook handler |
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ Pagos | Checkout + webhook |
| `MERCADOPAGO_WEBHOOK_SECRET` | ✅ Pagos | Webhook validation |
| `AWS_S3_BUCKET` + `AWS_REGION` + keys | Opcional | Snapshots S3 (storage.ts dead) |
| `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Opcional | Error tracking |
| `NEXT_PUBLIC_APP_URL` | Opcional | URL base client-side |
| `CRON_SECRET` | ⚠️ Prod | Cron job auth |

---

## [8] 🌱 JR. PRODIGIO — Ideas y Mejoras Futuras

### Ideas de mejora UX (impacto alto, esfuerzo bajo)

1. **Onboarding wizard interactivo** — En vez del banner actual, un wizard paso-a-paso que guíe: conectar repo → primer run → ver healing. Hoy `OnboardingBanner.tsx` existe pero no se importa.
2. **Toast de celebración al primer healing** — Cuando el primer selector se autocura, mostrar un confetti + "Tu primer test se curó solo 🎉" con CTA para compartir.
3. **Dark/Light mode** — El landing es 100% dark. Agregar toggle con `next-themes` (ya instalado).

### Ideas de mejora técnica

1. **Migrar `actions.ts` monolito a services** — Extraer `ProjectService`, `TestRunService`, `HealingService`. Las API routes y server actions llaman al mismo service.
2. **Integración de Claude Code API** — Reemplazar `z-ai-web-dev-sdk` → Claude Code para análisis de selectores. Prompt system ya existe en `ai/prompts.ts`.
3. **Circuit breaker para Redis** — En vez de fail-open silencioso, implementar un circuit breaker (e.g., `opossum`) que muestre degraded mode en la UI.

### Features relacionadas (siguiente sprint)

1. **Slack bot bidireccional** — Hoy solo envía notificaciones. Agregar `/healify run my-project` para trigger desde Slack.
2. **GitHub App (no OAuth App)** — Permisos granulares, instalación por org, webhooks automáticos. Elimina setup manual.
3. **Comparador visual de screenshots** — Las screenshots se guardan pero no se muestran. Implementar before/after overlay.

### Pregunta incómoda

> **¿Qué porcentaje de la codebase es realmente necesario para el MVP?**
> Hay 62 rutas API, 3 sistemas de pago (Stripe legacy + MercadoPago + LemonSqueezy enum), analytics avanzados, badges SVG, weekly reports por email, cron jobs... pero el login ni siquiera funciona todavía.
> ¿No habría que consolidar al core (auth → projects → run → heal → dashboard) y eliminar todo lo demás hasta que el happy path funcione de punta a punta?

---

## 📋 TABLA DE REDUNDANCIAS — Eliminar o Consolidar

| # | Qué | Archivo(s) | Acción | Impacto |
|---|-----|-----------|--------|---------|
| 1 | `@auth/prisma-adapter` v2 | [package.json](package.json) dep | **Eliminar** del `package.json` | -5 transitive deps |
| 2 | `src/lib/stripe.ts` | [stripe.ts](src/lib/stripe.ts) (67 líneas) | **Eliminar** — dead code, payments migó a MercadoPago | Limpia confusión |
| 3 | `src/lib/actions/stripe.ts` | [actions/stripe.ts](src/lib/actions/stripe.ts) (61 líneas) | **Eliminar** — zero imports, depende de stripe.ts | Dead code |
| 4 | `src/lib/storage.ts` | [storage.ts](src/lib/storage.ts) (57 líneas) | **Eliminar** — zero imports en producción | AWS deps idle |
| 5 | `src/components/BackgroundSpace.tsx` | [BackgroundSpace.tsx](src/components/BackgroundSpace.tsx) | **Eliminar** — never imported | Dead component |
| 6 | `src/components/DashboardPreview.tsx` | [DashboardPreview.tsx](src/components/DashboardPreview.tsx) | **Verificar** — puede estar en landing | Check before delete |
| 7 | `src/components/OnboardingBanner.tsx` | [OnboardingBanner.tsx](src/components/OnboardingBanner.tsx) | **Conservar** — planned feature | Documentar como TODO |
| 8 | `src/components/ROICalculator.tsx` | [ROICalculator.tsx](src/components/ROICalculator.tsx) | **Verificar** — puede ser futuro | Check before delete |
| 9 | Doble `formatRelativeTime` | [actions.ts](src/lib/actions.ts) + [api.ts](src/lib/api.ts) | **Consolidar** en `utils.ts` | DRY |
| 10 | Triple definición de PLANS | `stripe.ts` + `payment/types.ts` + `api/plans/route.ts` | **Consolidar** en `payment/types.ts` | Una sola fuente |
| 11 | Rate limiter en waitlist (inline) | [waitlist/route.ts](src/app/api/waitlist/route.ts) | **Migrar** a usar `httpRateLimit()` | Consistencia |
| 12 | `billing/portal` bypassa `getSessionUser()` | [billing/portal/route.ts](src/app/api/billing/portal/route.ts) | **Refactorizar** a `getSessionUser()` | Auth consistency |
| 13 | Doble toaster (Radix + Sonner) | [layout.tsx](src/app/layout.tsx) — ambos importados | **Elegir uno** (recomiendo Sonner) | -40KB bundle |
| 14 | `@mdxeditor/editor` (570KB) | [package.json](package.json) dep | **Verificar** uso — no encontré imports | Posible dead dep |
| 15 | `next.config.ts` redirects vacío | [next.config.ts](next.config.ts) | **Eliminar** el bloque vacío | Limpieza |
| 16 | `STRIPE_SETUP.md` desactualizado | [docs/STRIPE_SETUP.md](docs/STRIPE_SETUP.md) | **Deprecar** o reemplazar con `PAYMENT_SETUP.md` | Evita confusión |
| 17 | Metadata OG duplicada (inglés en layout, español en page) | [layout.tsx](src/app/layout.tsx) + [page.tsx](src/app/page.tsx) | **Unificar** en español | SEO consistency |
| 18 | UI primitivos sin uso (6) | `aspect-ratio`, `collapsible`, `drawer`, `hover-card`, `radio-group`, `resizable` | **Conservar** — shadcn/ui generados, costo cero | No action |

---

## 🎯 PRIORIDADES — Plan de Acción

### Sprint inmediato (resolver antes de cualquier otra cosa)

| Prioridad | Tarea | Bloqueante |
|-----------|-------|------------|
| P0 | Configurar `NEXTAUTH_URL` en Vercel | Sin esto, nadie puede loguearse |
| P0 | Restaurar Redis en Railway | Sin esto, no hay test runs |
| P0 | Verificar callback URL en GitHub OAuth App | Puede ser la causa del OAuthCallback |

### Sprint de limpieza (post-auth fix)

| Prioridad | Tarea | Esfuerzo |
|-----------|-------|----------|
| P1 | Eliminar items #1-5 de la tabla de redundancias | 30 min |
| P1 | Consolidar `formatRelativeTime` y PLANS (#9, #10) | 1 hr |
| P1 | Refactorizar `billing/portal` auth (#12) | 15 min |
| P2 | Splitear `actions.ts` en modules | 2 hr |
| P2 | Lazy load recharts + framer-motion | 1 hr |
| P2 | Elegir un toaster y eliminar el otro (#13) | 30 min |

### Sprint de Claude Code API

| Prioridad | Tarea | Esfuerzo |
|-----------|-------|----------|
| P1 | Integrar Claude Code API como AI engine | 4 hr |
| P1 | Actualizar `ai/prompts.ts` para Claude | 1 hr |
| P2 | A/B test: motor determinístico vs Claude vs ZAI | 4 hr |

---

*Generado automáticamente siguiendo el ciclo de 8 roles de SKILLS.md*
*Revisión completa del proyecto Healify — 5 de marzo de 2026*
