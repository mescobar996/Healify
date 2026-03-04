# 📱 Mobile Skill Hub — Guía de Copilot para Experiencia Móvil

> **Cómo usar este archivo:**
> 1. Identificá la tarea móvil que necesitás resolver.
> 2. Elegí el skill más adecuado.
> 3. Copiá el prompt y pegalo en tu IDE / chat de Copilot.
> 4. Reemplazá los `[corchetes]` con tu contexto real.
> 5. Iterá hasta obtener el resultado esperado.

**Stack de referencia:** Next.js 14+ (App Router) · React · Tailwind CSS · Supabase · Vercel · TypeScript

---

## 📋 Índice rápido

| # | Skill | Cuándo usarlo |
|---|-------|---------------|
| 1 | 🖌️ Mobile UX/UI Designer | Diseño táctil, navegación, patrones móvil |
| 2 | 🎨 Frontend Responsive | Componentes adaptables, media queries, Tailwind |
| 3 | ⚡ Mobile Performance | Bundle, Web Vitals, imágenes, lazy loading |
| 4 | 🧪 Mobile QA Tester | Pruebas en dispositivos, táctil, red, accesibilidad |
| 5 | 📦 PWA Architect | App instalable, offline, service workers |
| 6 | 📱 React Native / Flutter | App nativa multiplataforma (si aplica) |
| 🔗 | Skills Combinados | Tareas que requieren múltiples roles |
| 🔍 | Auditoría Móvil | Diagnóstico completo de experiencia móvil |

---

## 👤 Skills Individuales

### 1. 🖌️ Mobile UX/UI Designer

**Cuándo usarlo:** Diseñás interfaces para pantallas táctiles, navegación móvil o micro-interacciones.

**Stack:** Figma · Tailwind CSS · shadcn/ui

**Prompt base:**
> "Actuá como diseñador UX/UI especializado en mobile-first con 6 años de experiencia en SaaS.
> Mi proyecto usa: Tailwind CSS con paleta [describí colores/tokens], componentes [shadcn/ui u otro].
> Necesito rediseñar: [descripción, ej: el dashboard principal para móvil].
> Dame:
> - Patrones de navegación: bottom navigation vs menú hamburguesa (justificá la elección).
> - Tamaños mínimos de targets táctiles según guías Apple (44px) y Google (48px).
> - Adaptación de [tablas / formularios / listas complejas] a vistas móviles.
> - Estados de cada componente: default / hover / focus / disabled / error.
> - Copy sugerido para CTAs y mensajes de error en pantallas pequeñas."

**Ejemplo de uso:** Adaptar dashboard de pagos a móvil, rediseñar flujo de checkout en 375px.

---

### 2. 🎨 Frontend Developer (Responsive/Adaptive)

**Cuándo usarlo:** Implementás componentes que deben adaptarse a todos los tamaños de pantalla.

**Stack:** Next.js 14+ App Router · React · Tailwind CSS · TypeScript

**Prompt base:**
> "Sos frontend senior con Next.js 14+ App Router, React y Tailwind CSS.
> Necesito convertir [descripción del componente, ej: tabla de planes de pago] en una vista responsive que:
> - En desktop (≥1024px): muestre la vista completa actual.
> - En tablet (≤768px): convierta filas en tarjetas apiladas.
> - En móvil (≤480px): muestre solo campos esenciales con botón 'ver más'.
> Requisitos:
> - Mobile-first: escribí los estilos base para móvil y sobreescribí para pantallas grandes.
> - Tailwind puro (sin CSS externo salvo que sea estrictamente necesario).
> - TypeScript con tipos correctos.
> - Accesible: aria-labels, roles, navegación por teclado.
> Pegá el código actual si tenés: [código]."

**Ejemplo de uso:** Tabla de planes responsive, currency selector adaptable, checkout mobile-first.

---

### 3. ⚡ Mobile Performance Specialist

**Cuándo usarlo:** Optimizás tiempos de carga, reducís bundle size o mejorás Core Web Vitals.

**Stack:** Next.js · Vercel Analytics · Lighthouse · next/image · next/dynamic

**Prompt base:**
> "Actuá como especialista en rendimiento móvil para apps Next.js deployadas en Vercel.
> Mi situación: [describí, ej: FCP de 3.2s en 4G, bundle inicial de 2MB].
> Código/config relevante: [pegá package.json o fragmentos clave].
> Necesito:
> - Reducir el bundle inicial en al menos 30% (code splitting por rutas con next/dynamic).
> - Optimizar imágenes con next/image: tamaños, formatos (WebP/AVIF), densidades (1x/2x/3x).
> - Estrategia de precarga de recursos críticos (fonts, LCP image).
> - Lazy loading correcto para contenido fuera del viewport inicial.
> - Qué medir antes y después (métrica específica + herramienta).
> Dame plan detallado con código de ejemplo y config de Next.js donde aplique."

**Ejemplo de uso:** Optimizar carga del dashboard, mejorar LCP del landing, reducir JS en checkout.

---

### 4. 🧪 Mobile QA & UX Tester

**Cuándo usarlo:** Validás que la app funciona correctamente en dispositivos móviles reales y emulados.

**Stack:** Chrome DevTools Device Emulation · BrowserStack · Lighthouse · Supabase Logs · Vercel Logs

**Prompt base:**
> "Actuá como QA Engineer especializado en experiencia móvil para apps Next.js.
> Feature/página a testear: [descripción, ej: flujo completo de checkout con MercadoPago en ARS].
> Necesito un plan de pruebas móvil que incluya:
> - Dispositivos objetivo: [iPhone SE 375px / iPhone 14 390px / Android gama media 360px / iPad 768px].
> - Casos de prueba para interacciones táctiles (tap, swipe, pinch, scroll horizontal).
> - Pruebas en diferentes condiciones de red: 4G (simulado en DevTools) / 3G lento / offline.
> - Checklist de accesibilidad móvil: contraste WCAG AA, tamaño de fuente, VoiceOver/TalkBack.
> - Casos de regresión: ¿qué funcionalidad existente podría haberse roto?
> Formato: tabla markdown [ID | Caso | Dispositivo | Pasos | Resultado esperado | Prioridad]."

**Ejemplo de uso:** Validar flujo de pagos en móvil, testear currency selector en distintos tamaños.

---

### 5. 📦 PWA Architect

**Cuándo usarlo:** Querés convertir tu web en una app instalable con soporte offline y notificaciones.

**Stack:** Next.js · Service Workers · Web App Manifest · Workbox · next-pwa

**Prompt base:**
> "Actuá como arquitecto PWA con experiencia en Next.js.
> Mi proyecto: [descripción breve].
> Necesito convertirlo en una PWA. Dame:
> - Configuración del manifest.json: nombre, iconos en múltiples resoluciones (192px/512px), tema, orientación.
> - Service Worker con Workbox que cachee: assets estáticos, respuestas de API (estrategia stale-while-revalidate).
> - Manejo de modo offline: qué mostrar cuando no hay conexión.
> - Sincronización en segundo plano para acciones pendientes (formularios, pagos iniciados).
> - Configuración de next-pwa en next.config.js.
> - Auditoría Lighthouse PWA: qué debe pasar para score > 80.
> Código completo y pasos en orden."

**Ejemplo de uso:** Hacer que el dashboard funcione offline, instalar la app desde el browser.

---

### 6. 📱 React Native / Flutter Developer

**Cuándo usarlo:** Desarrollás una app nativa multiplataforma separada del proyecto web.

**Stack:** React Native + Expo · Flutter + BLoC · Firebase · Redux Toolkit

**Prompt base (React Native / Expo):**
> "Sos desarrollador React Native + Expo senior con 4 años de experiencia.
> Necesito crear [descripción de pantalla/feature, ej: pantalla de selección de plan de pago].
> Requisitos:
> - TypeScript con tipos correctos.
> - Integración con API REST existente en [URL/descripción del endpoint].
> - Autenticación mediante token JWT (guardado con SecureStore de Expo).
> - Estado con Redux Toolkit.
> - Soporte iOS y Android.
> Dame código completo: componentes, estilos (StyleSheet), lógica y manejo de errores."

**Prompt base (Flutter):**
> "Como desarrollador Flutter con 3 años de experiencia, creá [descripción].
> Usá BLoC para estado y conexión a API REST. El widget debe ser reutilizable y manejar estados de loading, error y éxito."

**Ejemplo de uso:** Pantalla de login nativa, lista de subscripciones con pull-to-refresh.

---

## 🔗 Skills Combinados

| Tarea | Skills necesarios | Prompt combinado |
|-------|-------------------|------------------|
| **Lanzar versión mobile-first del SaaS** | UX/UI + Frontend Responsive + Mobile QA | "Actuá como equipo de diseño + desarrollo + QA. Quiero lanzar versión mobile-first de mi SaaS. Definí el flujo crítico (login → dashboard → acción principal) y entregame: diseños adaptados con Tailwind, código de componentes clave (Next.js + TypeScript) y plan de pruebas en dispositivos." |
| **Optimizar rendimiento móvil general** | Mobile Performance + Frontend + PWA | "Como equipo de performance, revisá bundle, imágenes (next/image), tiempo de interacción y experiencia offline. Dame informe con acciones priorizadas y código de ejemplo para Next.js + Vercel." |
| **Auditoría de accesibilidad móvil** | Mobile QA + UX/UI + Frontend | "Realizá auditoría de accesibilidad móvil completa. Verificá: contraste WCAG AA, tamaño de targets táctiles (≥44px), compatibilidad VoiceOver/TalkBack, navegación por teclado externo. Dame checklist de mejoras con código Tailwind." |
| **Convertir web en PWA instalable** | PWA Architect + Frontend + Performance | "Como equipo PWA, convertí mi Next.js app en PWA instalable con offline. Dame: manifest, service worker con Workbox, config de next-pwa y optimizaciones para que el bundle inicial pese menos de 500KB." |

---

## 📱 Checklist de Verificación Móvil

Usá esta lista antes de cada deploy para asegurar que la experiencia móvil no regresionó.

### Diseño y UX
- [ ] Targets táctiles ≥ 44px (Apple) / 48px (Google) — verificar con DevTools
- [ ] Espaciado suficiente entre elementos clicables (mínimo 8px entre targets)
- [ ] Navegación adaptada (bottom nav o menú simplificado, no mega-menús)
- [ ] Fuentes legibles sin zoom (tamaño base ≥ 16px en móvil)
- [ ] Formularios con `type` correcto en inputs: `email`, `tel`, `number`, `search`
- [ ] Layout en landscape no se rompe (probado en DevTools)
- [ ] Gestos estándar implementados si aplican (swipe, pull-to-refresh)

### Rendimiento
- [ ] First Contentful Paint (FCP) < 1.8s en 4G (Lighthouse móvil)
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Time to Interactive (TTI) < 3s en dispositivo gama media
- [ ] Bundle inicial < 500KB (ideal) / < 1MB (aceptable) — verificar en Vercel
- [ ] Imágenes con `next/image`: tamaños correctos, formato WebP/AVIF habilitado
- [ ] Lazy loading activo para imágenes y componentes fuera del viewport

### Técnico (Next.js específico)
- [ ] Viewport meta tag presente en layout root: `width=device-width, initial-scale=1`
- [ ] Breakpoints de Tailwind usados consistentemente (sm/md/lg/xl)
- [ ] `next/image` en lugar de `<img>` para todas las imágenes relevantes
- [ ] `next/dynamic` con `ssr: false` para componentes pesados solo del cliente
- [ ] Probado en dispositivos reales además de emulador de DevTools

### PWA (si aplica)
- [ ] `manifest.json` con iconos, nombre, tema, orientación
- [ ] Service worker registrado y activo (verificar en DevTools → Application)
- [ ] HTTPS obligatorio (Vercel lo maneja por defecto)
- [ ] Auditoría Lighthouse PWA score > 80

---

## 🔍 Auditoría Completa de Experiencia Móvil

Usá este prompt para un diagnóstico global antes de un lanzamiento o cuando detectás problemas en móvil sin causa clara.

> ⚠️ **Después de la auditoría:** Usá **BUGFIX-SKILLS.md** para aplicar las correcciones de forma ordenada sin introducir nuevos errores.

### Prompt base para auditoría móvil integral

> "Actuá como consultor especializado en experiencia móvil para SaaS (Next.js + Vercel).
> Mi proyecto: [descripción + pegá fragmentos de código, estructura de carpetas, resultado de Lighthouse si tenés].
>
> Realizá una auditoría completa que cubra:
>
> **1. Diseño responsive:** ¿Se adapta correctamente a 375px, 390px, 768px y 1280px? ¿Hay desbordamientos o superposiciones?
> **2. Usabilidad táctil:** ¿Targets suficientemente grandes? ¿Navegación cómoda con una mano?
> **3. Rendimiento en redes móviles:** FCP, LCP, TTI, peso del bundle, uso correcto de next/image.
> **4. Funcionalidad offline / PWA:** ¿Soporta modo offline? ¿Es instalable?
> **5. Accesibilidad móvil:** Contraste WCAG AA, VoiceOver/TalkBack, zoom, tamaño de fuente.
> **6. Compatibilidad:** Diferencias iOS vs Android, problemas comunes en tablets.
>
> Para cada área:
> - ✅ Hallazgos concretos basados en lo que te compartí.
> - ⚡ Prioridad: 🔴 Alta / 🟡 Media / 🟢 Baja.
> - 💻 Código o configuración de ejemplo (Next.js / Tailwind / next/image / etc.).
>
> Al final: **plan de acción** con sprints sugeridos."

### Estructura del informe esperada
```
## Resumen ejecutivo
- Estado móvil: 🟡 Amarillo / 🔴 Rojo / 🟢 Verde
- Top 3 problemas críticos
- Top 3 oportunidades de mejora

## 1. Diseño responsive → hallazgos + fixes
## 2. Usabilidad táctil → ...
## 3. Rendimiento → ...
## 4. PWA/Offline → ...
## 5. Accesibilidad → ...
## 6. Compatibilidad → ...

## Plan de acción
- Sprint 1: críticos de UX y responsive
- Sprint 2: performance + PWA básica
- Sprint 3: accesibilidad + pruebas en dispositivos reales
```

---

*Este archivo complementa **SKILLS.md** (skills generales) y **BUGFIX-SKILLS.md** (correcciones post-auditoría).*
*Usá los tres en conjunto para un ciclo de desarrollo completo: construir → auditar → corregir.*