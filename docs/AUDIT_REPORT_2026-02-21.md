# 🔍 REPORTE MAESTRO DE AUDITORÍA — HEALIFY
**Fecha:** 21/02/2026 | **Auditores:** QA Senior + CTO + Frontend + Cliente Real

---

## 🎯 RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| **Score general** | 72/100 |
| **Consistencia visual** | 85% |
| **Funcionalidad operativa** | ~65% |
| **Issues** | 🔴 CRÍTICO: 2 | 🟠 ALTO: 3 | 🟡 MEDIO: 4 | 🟢 BAJO: 3 |

**Top 5 urgentes a resolver HOY:**
1. **HEAL-001** — Botón "Watch Demo" busca `#demo-section` que NO existe → scroll falla
2. **HEAL-002** — baseUrl en layout usa `healify.dev` en vez de `healify-sigma.vercel.app`
3. **HEAL-003** — Pricing: header solo tiene "← Volver", falta link a Pricing para consistencia
4. **HEAL-004** — Typo en layout: `export const   viewport` (doble espacio)
5. **HEAL-005** — Variables de entorno en Vercel: verificar NEXTAUTH_*, DATABASE_URL, STRIPE_*

---

## 👤 VOZ DEL CLIENTE

"Entré al sitio y vi un diseño oscuro con efectos de luz. El logo V con </> se ve bien. Hice clic en 'Get Started Free' y me llevó al login de GitHub — funcionó. Después del login llegué al dashboard y vi métricas, gráficos y una lista de tests. Hice clic en 'Watch Demo' esperando un video o algo... y la página hizo un scroll raro o nada. No entendí qué pasó. En Pricing los planes se ven bien, el botón 'Sign in to start' me llevó al login. Los links del footer (Documentation, GitHub, Support) funcionan. La página 404 tiene un diseño coherente con el resto. En general el sitio se ve profesional y consistente, pero el botón Watch Demo me confundió."

---

## 🗺️ MAPA DE CONSISTENCIA VISUAL

| Ruta | Logo | Navbar Glass | Orbs BG | Footer OK | Score |
|------|------|-------------|---------|-----------|-------|
| / | ✅ | ✅ | ✅ | ✅ | 5/5 |
| /pricing | ✅ | ✅ | ✅ (orbs propios) | ❌ (sin footer) | 4/5 |
| /dashboard | ✅ | ✅ | ✅ | N/A | 5/5 |
| /dashboard/projects | ✅ | ✅ | ✅ | N/A | 5/5 |
| /dashboard/tests | ✅ | ✅ | ✅ | N/A | 5/5 |
| /dashboard/tests/[id] | ✅ | ✅ | ✅ | N/A | 5/5 |
| /dashboard/healing/[id] | ✅ | ✅ | ✅ | N/A | 5/5 |
| /dashboard/settings | ✅ | ✅ | ✅ | N/A | 5/5 |
| 404 | ✅ | N/A | ✅ (orbs propios) | N/A | 5/5 |

**Notas:**
- BackgroundSpace está en layout raíz → orbs visibles en TODAS las rutas
- Pricing tiene orbs propios adicionales + no tiene footer (diseño intencional)
- Dashboard layout tiene HealifyLogo en sidebar + header mobile

---

## 🔴 ISSUES CRÍTICOS

### HEAL-001 — Botón "Watch Demo" sin destino real
- **Perfil:** QA + Cliente
- **Archivo:** `src/app/page.tsx` líneas 166-172
- **Descripción:** El onClick busca `document.getElementById('demo-section')` pero NO existe ningún elemento con ese id en la página. El fallback es `signIn()` — confuso para el usuario.
- **Impacto:** Dead scroll, UX confusa.
- **Fix:** Agregar `id="demo-section"` al contenedor del DashboardPreview.

### HEAL-002 — baseUrl incorrecta en producción
- **Perfil:** CTO
- **Archivo:** `src/app/layout.tsx` línea 31
- **Descripción:** `baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healify.dev"` — en producción Vercel la URL real es `healify-sigma.vercel.app`.
- **Impacto:** Meta tags OG, sitemap, canonical URL apuntan a dominio incorrecto.
- **Fix:** Cambiar fallback a `"https://healify-sigma.vercel.app"`.

---

## 🟠 ISSUES ALTOS

### HEAL-003 — Pricing sin footer
- **Perfil:** Frontend
- **Descripción:** /pricing no tiene footer con links (Documentation, Support). Inconsistente con landing.
- **Impacto:** Usuario en pricing no puede acceder a docs/soporte sin volver.
- **Fix:** Agregar footer mínimo a pricing o considerar aceptable si es diseño intencional.

### HEAL-004 — Typo en viewport
- **Perfil:** CTO
- **Archivo:** `src/app/layout.tsx` línea 75
- **Descripción:** `export const   viewport` — doble espacio.
- **Fix:** `export const viewport`

### HEAL-005 — Variables de entorno en Vercel
- **Perfil:** CTO
- **Descripción:** Sin verificación directa. Las siguientes DEBEN estar configuradas:
  - NEXTAUTH_SECRET, NEXTAUTH_URL
  - GITHUB_ID, GITHUB_SECRET
  - DATABASE_URL
  - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (para checkout)
- **Fix:** Documentar en README y verificar en Vercel Dashboard.

---

## 🟡 ISSUES MEDIOS

### HEAL-006 — /api/seed requiere auth pero está expuesto
- **Perfil:** CTO
- **Archivo:** `src/app/api/seed/route.ts`
- **Descripción:** Requiere sesión, pero en producción no debería ser accesible públicamente. Considerar deshabilitar en prod.
- **Fix:** Agregar check `if (process.env.NODE_ENV === 'production') return 404`

### HEAL-007 — Settings usa mock data
- **Perfil:** CTO
- **Archivo:** `src/app/dashboard/settings/page.tsx`
- **Descripción:** userData y apiKeys son constantes mock. No hay persistencia real.
- **Impacto:** Cambios en perfil no se guardan.
- **Fix:** Conectar a API real cuando exista.

### HEAL-008 — Search en dashboard header no funcional
- **Perfil:** QA
- **Archivo:** `src/app/dashboard/layout.tsx`
- **Descripción:** Botón "Buscar..." es decorativo, no abre modal ni redirige.
- **Fix:** Implementar búsqueda o ocultar hasta que exista.

### HEAL-009 — Notificaciones en dropdown son estáticas
- **Perfil:** QA
- **Archivo:** `src/app/dashboard/layout.tsx`
- **Descripción:** Array hardcodeado de notificaciones.
- **Fix:** Conectar a API de notificaciones real.

---

## 🟢 MEJORAS

### HEAL-010 — Agregar loading.tsx en rutas principales
### HEAL-011 — error.tsx global con diseño Healify
### HEAL-012 — Lighthouse audit (Performance, SEO, A11y)

---

## ✅ CHECKLIST MAESTRO

| # | Elemento | Ruta | Visual | Funcional | Cliente | Prioridad |
|---|----------|------|--------|-----------|---------|-----------|
| 1 | Botón "Get Started Free" | / | ✅ | ✅ signIn | ✅ | — |
| 2 | Botón "Watch Demo" | / | ✅ | ❌ scroll a nada | ❌ | 🔴 |
| 3 | Botón "Sign In" | / navbar | ✅ | ✅ | ✅ | — |
| 4 | Link "Pricing" | / navbar | ✅ | ✅ → /pricing | ✅ | — |
| 5 | Footer links | / | ✅ | ✅ (wiki, github, mailto) | ✅ | — |
| 6 | HealifyLogo | Todas | ✅ | ✅ | ✅ | — |
| 7 | BackgroundSpace orbs | Todas | ✅ | ✅ | ✅ | — |
| 8 | Página 404 | /ruta-inexistente | ✅ | ✅ | ✅ | — |
| 9 | baseUrl metadata | layout | ⚠️ | ❌ healify.dev | — | 🟠 |
| 10 | Dashboard sidebar links | /dashboard/* | ✅ | ✅ | ✅ | — |
| 11 | Pricing checkout | /pricing | ✅ | ⚠️ requiere Stripe | ⚠️ | — |
| 12 | Dashboard API | /api/dashboard | — | ✅ mock si no DB | ✅ | — |

---

## 💻 FIXES — CÓDIGO COMPLETO

### Fix HEAL-001 — Watch Demo scroll a demo-section

**Archivo:** `src/app/page.tsx`

Agregar `id="demo-section"` al contenedor del DashboardPreview (línea ~182):

```tsx
<motion.div
  id="demo-section"  // ← AGREGAR
  initial={{ opacity: 0, y: 60, scale: 0.9 }}
  ...
```

### Fix HEAL-002 — baseUrl producción

**Archivo:** `src/app/layout.tsx` línea 31

```ts
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healify-sigma.vercel.app";
```

### Fix HEAL-004 — Typo viewport

**Archivo:** `src/app/layout.tsx` línea 75

```ts
export const viewport: Viewport = {
```
