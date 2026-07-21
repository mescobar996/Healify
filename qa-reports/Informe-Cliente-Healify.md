# Informe de Usuario Final — Healify
**Fecha:** 2026-07-20
**Entorno probado:** https://healify-sigma.vercel.app (producción, sin autenticarse — sin cuenta creada)
**Rol del evaluador:** Cliente potencial / visitante evaluando la herramienta

---

## 1. Resumen ejecutivo

Healify se presenta bien: propuesta de valor clara ("tests que se curan solos"), demo interactiva sin registro, documentación técnica completa y un flujo de precios transparente en ARS con conversión a USD. La experiencia de navegación pública (landing, docs, pricing, login) es fluida y sin errores visibles. No se probó el producto autenticado (dashboard) porque requiere OAuth con GitHub/Google — no está autorizado crear cuentas ni iniciar sesión en nombre del usuario sin su confirmación explícita.

## 2. Recorrido realizado

| Página | Resultado |
|---|---|
| `/` (landing) | ✅ Carga rápida, hero claro, contadores animados (500+ equipos, 10K+ tests curados, 98% precisión, 90% tiempo ahorrado) |
| Demo interactiva ("Autocuración + PR", "Flaky retry", "Bug detectado") | ✅ Los 3 escenarios cambian correctamente el contenido del terminal simulado |
| `/pricing` | ✅ 4 planes (Gratis, Starter $73.500 ARS, Pro $148.500 ARS "más popular", Enterprise $748.500 ARS), conversión a USD visible, FAQ colapsable |
| Botón "Dashboard" sin sesión iniciada | ✅ Redirige correctamente a la pantalla de login (protección de ruta funciona) |
| Login | ✅ Ofrece "Continuar con GitHub" y "Continuar con Google", link de vuelta al inicio, aviso de Términos/Privacidad |
| `/docs` | ✅ Muy completa: quickstart, instalación por gestor de paquetes, config por framework (Playwright/Cypress/Vitest/Selenium), referencia de API con ejemplos `curl`, integración CI (GitHub Actions/GitLab), integración Jira, códigos de error, config de webhook |
| Ruta inexistente (404) | ✅ Página 404 con identidad de marca ("Selector Not Found", "Confianza: 0%") — detalle de producto bien pensado |

## 3. Hallazgos

### 🟡 Menor — Estadísticas de la landing no son fijas
Los contadores "500+ equipos / 10K+ tests curados / 98% / 90%" variaron entre cargas de página (se observaron valores distintos como 341+, 6K+, 57%, 48% en una recarga). Si son ilustrativos/demo está bien, pero si se muestran como métricas reales de la empresa, un visitante podría notar la inconsistencia si recarga la página dos veces seguidas.

### 🟡 Menor — Llamado a un endpoint de analíticas sin autenticar devuelve error silencioso
Al navegar la landing sin sesión, el navegador dispara una petición a `/api/analytics/events` que responde `401 Unauthorized`. No es visible para el usuario ni rompe nada, pero indica tracking que se pierde en visitantes anónimos (ver informe dev).

### ✅ Puntos fuertes destacados
- Consistencia de marca hasta en la página de error 404.
- Documentación de integración con ejemplos copiables y explicaciones de qué hace cada flag (`captureDOM: true` mejora ~30% la precisión, por ejemplo).
- Transparencia de precios en moneda local con tasa de conversión aclarada.
- Demo pública sin fricción (sin pedir registro) — reduce la barrera de evaluación para un QA/dev evaluando la herramienta.

## 4. No evaluado (fuera de alcance de esta pasada)
- Flujo autenticado completo (dashboard, conexión de repo real, generación real de una curación) — requiere login OAuth real, que no se ejecutó sin tu confirmación.
- Checkout de pago con MercadoPago.
- Comportamiento del video demo ("Video próximamente" — actualmente es un placeholder, no un video real).

## 5. Conclusión como cliente
La superficie pública del producto transmite confianza y está lista para evaluación por un equipo de QA/desarrollo. La fricción principal para "probar antes de registrarse" está bien resuelta con la demo interactiva. Si querés, el siguiente paso natural sería que confirmes el login con GitHub/Google para evaluar el dashboard real end-to-end.
