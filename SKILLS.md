# 🧠 Skills Hub — Guía de Copilot para tu SaaS

> **Cómo usar este archivo:**
> 1. Identificá el área de trabajo que necesitás.
> 2. Elegí el skill correspondiente.
> 3. Copiá el prompt y pegalo en tu IDE / chat de Copilot.
> 4. Reemplazá los `[corchetes]` con tu contexto real.
> 5. Iterá hasta obtener el resultado esperado.

**Stack de referencia:** Next.js 14+ (App Router) · React · Tailwind CSS · Supabase · Vercel · TypeScript

---

## 📋 Índice rápido

| # | Skill | Cuándo usarlo |
|---|-------|---------------|
| 1 | 📦 Product Manager | Features, user stories, roadmap |
| 2 | 🏗️ Arquitecto / Tech Lead | Estructura, escalabilidad, deuda técnica |
| 3 | 🎨 Frontend Developer | Componentes React, UI, estado cliente |
| 4 | ⚙️ Backend Developer | API routes, lógica servidor, integraciones |
| 5 | 🔒 Security Specialist | Auth, env vars, RLS, vulnerabilidades |
| 6 | 🚀 DevOps Engineer | Deploy Vercel, CI/CD, entornos |
| 7 | 🧪 QA Engineer | Casos de prueba, regresión, bugs |
| 8 | 🖌️ UX/UI Designer | Flujos, usabilidad, accesibilidad |
| 9 | 📊 Data Analyst | Queries SQL, métricas, analytics |
| 🔍 | Auditoría 360° | Revisión integral del proyecto |

---

## 👤 Skills Individuales

### 1. 📦 Product Manager

**Cuándo usarlo:** Necesitás definir qué construir, en qué orden y por qué.

**Prompt base:**
> "Actuá como un Product Manager senior especializado en SaaS con 5 años de experiencia.
> Mi proyecto es: [descripción — stack, usuarios objetivo, modelo de negocio].
> Necesito:
> - User stories para [feature] en formato: 'Como [usuario], quiero [acción], para [beneficio]'.
> - Criterios de aceptación claros y testeables (Gherkin si aplica).
> - Priorización MoSCoW del backlog.
> - Edge cases o riesgos de producto que no estoy viendo.
> Output en markdown listo para Notion o Linear."

---

### 2. 🏗️ Arquitecto de Software / Tech Lead

**Cuándo usarlo:** Decisiones estructurales, deuda técnica, escalabilidad.

**Prompt base:**
> "Actuá como Arquitecto de Software con experiencia en Next.js 14+ App Router, Supabase y Vercel.
> Estructura del proyecto: [árbol de carpetas o descripción].
> Analizá:
> - Separación de responsabilidades (UI / lógica / datos).
> - Patrones recomendados para [feature, ej: sistema de pagos dual LemonSqueezy + MercadoPago].
> - Deuda técnica visible y plan para pagarla sin romper funcionalidad.
> - Escalabilidad para [X usuarios o volumen].
> Justificá cada decisión con trade-offs."

---

### 3. 🎨 Frontend Developer

**Cuándo usarlo:** Componentes React, UI, estado en cliente.

**Prompt base:**
> "Sos frontend senior con React, Next.js 14+ App Router y Tailwind CSS.
> Tarea: [descripción, ej: componente CurrencySelector que muestre USD/ARS].
> Requisitos:
> - TypeScript con tipos explícitos.
> - Tailwind para estilos (sin CSS externo salvo necesidad).
> - Estado: [useState / Context / Zustand — elegí uno].
> - Accesible: aria-labels, roles, teclado.
> - Mobile-first.
> Código completo listo para copiar, con comentarios en lógica no obvia."

---

### 4. ⚙️ Backend Developer

**Cuándo usarlo:** API routes, server logic, integraciones externas.

**Prompt base:**
> "Sos backend senior con Next.js App Router (route handlers), Supabase y TypeScript.
> Implementar: [descripción, ej: webhook de LemonSqueezy que actualice subscriptions en Supabase].
> Requisitos:
> - Validación de firma (HMAC o header secret).
> - Manejo de errores con respuestas HTTP correctas (200/400/500).
> - Tipos TypeScript para el payload.
> - Idempotencia: evitar reprocesamiento del mismo evento.
> - Logging para debug en producción.
> Incluí tipos necesarios y helpers recomendados."

---

### 5. 🔒 Security Specialist

**Cuándo usarlo:** Auth, secrets, protección de endpoints, datos sensibles.

**Prompt base:**
> "Actuá como especialista en seguridad web para Next.js + Supabase.
> Código a revisar: [pegá el código o describí la feature].
> Verificá:
> - ¿Alguna variable NEXT_PUBLIC_ expone un secret que no debería?
> - ¿Los middleware de Next.js y RLS policies de Supabase están bien configurados?
> - ¿Hay API routes sin protección que requieren auth?
> - ¿Riesgo de injection o datos malformados?
> - ¿Dependencias con CVEs conocidos?
> Para cada hallazgo: riesgo (🔴 Alto / 🟡 Medio / 🟢 Bajo), causa raíz y fix con código."

---

### 6. 🚀 DevOps Engineer

**Cuándo usarlo:** Deploy, env vars, CI/CD, debug de builds.

**Prompt base:**
> "Actuá como DevOps Engineer especializado en Vercel y Next.js.
> Situación: [describí, ej: variables de MercadoPago pendientes, necesito redeploy].
> Guíame en:
> - Variables 'Production only' vs 'All environments' en Vercel Dashboard.
> - Verificar build antes del deploy (errores por env vars faltantes).
> - Configuración de dominios/rewrites si aplica.
> - [Opcional] GitHub Actions para CI: lint + type-check + tests.
> Pasos ordenados, comandos exactos, qué verificar después de cada uno."

---

### 7. 🧪 QA Engineer

**Cuándo usarlo:** Casos de prueba, validación pre-deploy, búsqueda de regresiones.

**Prompt base:**
> "Actuá como QA Engineer con experiencia en React/Next.js.
> Feature a testear: [descripción, ej: checkout LemonSqueezy USD con webhook de confirmación].
> Necesito:
> - Casos positivos (happy path completo).
> - Casos negativos (errores esperados, inputs inválidos, timeouts).
> - Casos de regresión (¿qué podría haberse roto?).
> - Pruebas de integración (webhook → DB → UI).
> - Smoke testing checklist pre-merge a main.
> Formato: tabla markdown [ID | Descripción | Precondición | Pasos | Resultado esperado | Prioridad]."

---

### 8. 🖌️ UX/UI Designer

**Cuándo usarlo:** Flujos, usabilidad, consistencia visual, accesibilidad.

**Prompt base:**
> "Actuá como diseñador UX/UI especializado en SaaS con foco en conversión.
> Proyecto: Tailwind CSS, paleta [colores/tokens], componentes [shadcn/ui u otro].
> Necesito: [descripción, ej: mejorar flujo de selección de plan USD/ARS].
> Dame:
> - Análisis del flujo actual y friction points.
> - Propuesta de mejora con justificación de UX.
> - Especificaciones: tamaños, espaciados, estados (default/hover/focus/disabled/error).
> - Copy para CTAs, placeholders y mensajes de error.
> - Accesibilidad: contraste WCAG AA, ARIA roles, targets táctiles ≥44px."

---

### 9. 📊 Data Analyst

**Cuándo usarlo:** Queries SQL, analytics de uso, métricas de negocio.

**Prompt base:**
> "Actuá como Data Analyst con experiencia en Supabase (PostgreSQL) y métricas SaaS.
> Necesito: [descripción, ej: conversión de planes por moneda en los últimos 30 días].
> Esquema relevante: [pegá tablas o descripción de columnas clave].
> Dame:
> - Query SQL optimizada con comentarios.
> - Índices recomendados si puede ser lenta.
> - Visualización recomendada (tipo de gráfico y por qué).
> - 2-3 métricas relacionadas que debería medir."

---

## 🔍 Auditoría 360° — Revisión Integral del Proyecto

Usá este skill antes de un deploy importante, al terminar una fase, o cuando algo falla sin causa obvia.

> ⚠️ **Después de la auditoría:** Abrí **BUGFIX-SKILLS.md** para aplicar correcciones de forma ordenada sin introducir nuevos errores.

### Prompt base para auditoría integral

> "Actuá como equipo de consultoría senior en SaaS (Next.js + Supabase + Vercel).
> Revisá mi proyecto con esta información:
> [pegá: descripción, estructura de carpetas, package.json, fragmentos clave, errores actuales]
>
> Informe estructurado en 7 áreas:
>
> **1. Arquitectura y escalabilidad:** ¿Mantenible? ¿Acoplamiento? ¿Escala a 10x?
> **2. Calidad del código:** Buenas prácticas App Router, TypeScript, refactor seguro.
> **3. UX/UI:** Flujo principal, consistencia, accesibilidad básica.
> **4. Seguridad:** Secrets, Auth + RLS, validación de inputs.
> **5. Rendimiento:** Rendering strategy, queries DB, bundle size.
> **6. DevOps:** Env vars, CI/CD, monitoreo de errores.
> **7. Métricas de negocio:** Eventos clave medidos, oportunidades de growth.
>
> Para cada área:
> - ✅ Hallazgos concretos
> - ⚡ Prioridad: 🔴 Alta / 🟡 Media / 🟢 Baja
> - 💻 Código o config de ejemplo
>
> Al final: plan de acción con sprints sugeridos."

### Estructura del informe esperada

---

*Ver también: **MOBILE-SKILLS.md** · **BUGFIX-SKILLS.md***