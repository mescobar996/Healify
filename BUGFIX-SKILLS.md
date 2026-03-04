# 🔧 BUGFIX-SKILLS — Correcciones Post-Auditoría

> **Cuándo usar este archivo:**
> Después de ejecutar una auditoría (360° o móvil) y tener un listado de hallazgos.
> Este archivo te guía para aplicar correcciones de forma ordenada, segura y verificable, sin introducir nuevos bugs en el proceso.

**Stack de referencia:** Next.js 14+ · React · Tailwind · Supabase · Vercel · TypeScript

---

## 🗺️ Flujo de trabajo recomendado
```
Informe de auditoría
       ↓
1. Clasificar hallazgos por prioridad y categoría
       ↓
2. Crear rama git por categoría (no todo junto)
       ↓
3. Aplicar fix con skill correspondiente
       ↓
4. Verificar con checklist de la categoría
       ↓
5. Mergear y pasar al siguiente
       ↓
Deploy final + smoke test
```

---

## 📋 Paso 1 — Clasificar los hallazgos

Antes de tocar código, organizá todos los hallazgos de la auditoría en esta tabla:

| ID | Hallazgo | Categoría | Prioridad | Afecta producción ahora |
|----|----------|-----------|-----------|------------------------|
| B-01 | [descripción] | Seguridad | 🔴 Alta | Sí / No |
| B-02 | [descripción] | Rendimiento | 🟡 Media | No |

**Orden de atención recomendado:**
1. 🔴 Seguridad (secrets, auth, RLS)
2. 🔴 Bugs que rompen funcionalidad en producción
3. 🟡 Rendimiento y UX críticos
4. 🟡 Calidad de código / refactor
5. 🟢 Mejoras menores y deuda técnica

---

## 🔧 Skills de Corrección por Categoría

### 🔴 CAT-1: Seguridad

**Prompt base:**
> "Actuá como Security Engineer para Next.js + Supabase.
> Tengo este hallazgo de auditoría: [pegá el hallazgo exacto].
> El código actual es: [pegá el código problemático].
> Necesito:
> - Fix concreto y mínimo que resuelva el problema sin afectar funcionalidad.
> - Explicación de por qué el código anterior era vulnerable.
> - Verificación: ¿cómo confirmo que el fix funcionó?
> - ¿Hay algún efecto secundario que deba testear?
> Prioridad: no romper la autenticación ni el flujo de pagos."

**Checklist de verificación post-fix:**
- [ ] La variable/secret ya no es accesible desde el cliente (verificar DevTools → Network)
- [ ] Las RLS policies probadas con un usuario sin privilegios
- [ ] El endpoint protegido devuelve 401 sin token válido
- [ ] No se rompió ninguna funcionalidad existente (smoke test)

---

### 🔴 CAT-2: Bugs Funcionales

**Prompt base:**
> "Actuá como desarrollador senior en Next.js + Supabase debuggeando un bug de producción.
> Hallazgo de auditoría: [descripción del bug].
> Síntoma observado: [qué pasa exactamente — error en consola, comportamiento incorrecto, etc.].
> Código relevante: [pegá el código donde ocurre].
> Contexto adicional: [stack trace, logs, pasos para reproducir].
> Necesito:
> - Diagnóstico: ¿cuál es la causa raíz?
> - Fix mínimo que resuelva el bug sin refactorizar todo.
> - Casos de prueba para confirmar que está resuelto.
> - ¿Qué más podría estar afectado por este mismo problema?"

**Checklist de verificación post-fix:**
- [ ] El bug ya no es reproducible siguiendo los pasos originales
- [ ] El happy path sigue funcionando
- [ ] No aparecieron nuevos errores en consola
- [ ] El fix funciona en móvil si el bug era visible en ambas plataformas

---

### 🟡 CAT-3: Rendimiento

**Prompt base:**
> "Actuá como Performance Engineer para una app Next.js + Supabase deployada en Vercel.
> Hallazgo: [descripción, ej: query sin índice que tarda 3s en tabla de subscriptions].
> Código/query actual: [pegá].
> Necesito:
> - Fix concreto: [query optimizada / índice / cambio de rendering strategy / etc.].
> - Impacto estimado en performance (cuánto mejora).
> - Cómo medir el antes y después (herramienta + métrica específica).
> - ¿El fix requiere migración de DB o solo cambio de código?"

**Checklist de verificación post-fix:**
- [ ] Medición antes/después con Vercel Analytics o Lighthouse
- [ ] La query tiene el índice y lo usa (EXPLAIN ANALYZE en Supabase)
- [ ] No regresión en otras queries o componentes relacionados
- [ ] Bundle size no aumentó (si fue un cambio de dependencias)

---

### 🟡 CAT-4: UX/UI

**Prompt base:**
> "Actuá como Frontend Developer + UX Designer para Next.js + Tailwind.
> Hallazgo de auditoría: [descripción del problema de UX, ej: botones de checkout muy pequeños en móvil].
> Componente actual: [pegá el código].
> Necesito:
> - Fix de UI mínimo y enfocado (no rediseñar todo).
> - Que el cambio sea mobile-first y no rompa el diseño en desktop.
> - Código Tailwind correcto con los nuevos estilos.
> - Si el problema es de flujo: propuesta de los pasos necesarios para simplificarlo."

**Checklist de verificación post-fix:**
- [ ] Target táctil ≥ 44px verificado en DevTools (modo móvil)
- [ ] Contraste WCAG AA: ratio ≥ 4.5:1 para texto normal
- [ ] Probado en pantalla de 375px (iPhone SE) y 390px (iPhone 14)
- [ ] El cambio no afecta el layout en desktop (≥1024px)

---

### 🟡 CAT-5: Calidad de Código / Refactor

**Prompt base:**
> "Actuá como Tech Lead revisando código para refactorizar de forma segura.
> Hallazgo: [descripción, ej: lógica duplicada en 3 componentes, falta tipado TypeScript].
> Código actual: [pegá].
> Necesito:
> - Refactor mínimo que resuelva el problema sin cambiar el comportamiento.
> - Si hay que crear un helper/hook/utility: nombre, firma y ubicación recomendada.
> - Verificar que TypeScript no tenga errores después del cambio.
> - ¿Hay tests existentes que deban actualizarse?"

**Checklist de verificación post-fix:**
- [ ] `tsc --noEmit` sin errores
- [ ] ESLint sin warnings nuevos
- [ ] Comportamiento idéntico al código anterior (no se introdujeron cambios de lógica)
- [ ] El código nuevo es más legible para un colega que no lo conoce

---

### 🟢 CAT-6: DevOps / Configuración

**Prompt base:**
> "Actuá como DevOps Engineer para Vercel + GitHub.
> Hallazgo: [descripción, ej: no hay CI pipeline, falta variable de entorno en staging].
> Configuración actual: [pegá si aplica — vercel.json, .github/workflows, etc.].
> Necesito:
> - Fix de configuración mínimo y concreto.
> - Pasos para aplicarlo sin downtime.
> - Cómo verificar que está funcionando post-deploy."

**Checklist de verificación post-fix:**
- [ ] Build en Vercel exitoso después del cambio
- [ ] Variables de entorno presentes en el entorno correcto (Production/Preview)
- [ ] CI corre en el PR y reporta correctamente
- [ ] No hay errores en Vercel Function Logs post-deploy

---

## 🚀 Paso 2 — Verificación Final Pre-Deploy

Después de aplicar todos los fixes, ejecutá esta auditoría rápida antes de mergear a main y hacer deploy a producción.

**Prompt de verificación final:**
> "Actuá como QA Engineer haciendo smoke testing pre-deploy.
> Fixes aplicados en este ciclo: [listá los hallazgos que corregiste].
> Stack: Next.js + Supabase + Vercel.
> Generame un checklist de smoke testing específico para estos cambios, cubriendo:
> - Happy paths de las features afectadas.
> - Casos límite de cada fix aplicado.
> - Verificaciones de regresión en funcionalidades relacionadas.
> - Qué revisar en producción en los primeros 15 minutos post-deploy."

### Checklist de smoke test mínimo (universal)

**Autenticación:**
- [ ] Login funciona con usuario existente
- [ ] Registro crea usuario correctamente en Supabase
- [ ] Logout cierra sesión y redirige correctamente
- [ ] Las rutas protegidas redirigen a login si no hay sesión

**Flujo de pagos (si aplica):**
- [ ] Botón de checkout abre correctamente (LemonSqueezy o MercadoPago)
- [ ] El webhook procesa una transacción de prueba sin errores en logs
- [ ] El estado del usuario se actualiza en DB post-pago

**UI general:**
- [ ] Sin errores en consola del navegador (F12 → Console)
- [ ] Sin requests fallidos en Network tab
- [ ] Responsive: probado en 375px y 1280px

**Vercel:**
- [ ] Build exitoso sin warnings críticos
- [ ] Funciones serverless sin errores en Vercel Logs
- [ ] Variables de entorno todas presentes

---

## 📝 Plantilla de registro de fixes

Usá esto para llevar un registro de lo que aplicaste en cada ciclo:
```markdown
## Ciclo de fixes — [fecha]

### Hallazgos corregidos
| ID | Descripción | Categoría | Fix aplicado | Verificado |
|----|-------------|-----------|--------------|------------|
| B-01 | ... | Seguridad | ... | ✅ / ❌ |

### Hallazgos postergados (con justificación)
| ID | Descripción | Motivo de postergación | Sprint objetivo |
|----|-------------|----------------------|-----------------|

### Regresiones detectadas durante el proceso
| Descripción | Causa | Cómo se resolvió |
|-------------|-------|-----------------|

### Notas para la próxima auditoría
- ...
```

---

*Este archivo es el paso 3 del flujo: Auditoría → Clasificación → **Fixes ordenados** → Deploy.*
*Volvé a **SKILLS.md** para el próximo ciclo de desarrollo.*
```

---

Y el **MOBILE-SKILLS.md** tiene cambios más menores — principalmente alinear el stack y el checklist técnico con Next.js (`next/image` para lazy loading, viewport tag correcto, etc.). Si querés te paso también la versión mejorada o con los cambios que tiene está bien.

Los tres archivos funcionan así en secuencia:
```
SKILLS.md → desarrollo diario
MOBILE-SKILLS.md → cuando trabajás UX/performance móvil
Auditoría 360° (dentro de SKILLS) → revisión completa
BUGFIX-SKILLS.md → aplicar los resultados de la auditoría