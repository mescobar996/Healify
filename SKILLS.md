---

## 🔍 Revisiones completas del proyecto (Auditoría 360°)

¿Necesitas una visión global de tu proyecto para identificar áreas de mejora? Puedes pedirle a Copilot que realice una **revisión integral** y genere un informe detallado con recomendaciones accionables. Esta auditoría combina múltiples skills para evaluar el estado actual desde todos los ángulos.

### 🎯 Objetivo
Obtener un diagnóstico completo del proyecto (código, arquitectura, UX, seguridad, rendimiento, procesos) y un plan de mejoras priorizado.

### 👥 Roles involucrados
- Product Manager
- Arquitecto de software / Tech Lead
- UX/UI Designer
- Security Specialist
- DevOps Engineer
- QA Engineer
- (opcional) Data Analyst

### 🤖 Prompt base para auditoría integral
> "Actúa como un equipo de consultoría senior especializado en SaaS. Realiza una **revisión completa de mi proyecto** (descríbelo brevemente o pega fragmentos clave). Quiero un informe estructurado que cubra:
> 1. **Arquitectura y escalabilidad**: puntos débiles, acoplamiento, deuda técnica.
> 2. **Calidad del código**: buenas prácticas, patrones, testabilidad.
> 3. **Experiencia de usuario (UX/UI)**: usabilidad, consistencia, accesibilidad.
> 4. **Seguridad**: vulnerabilidades potenciales, autenticación, manejo de datos sensibles.
> 5. **Rendimiento**: tiempos de carga, optimizaciones frontend/backend, base de datos.
> 6. **Procesos y DevOps**: CI/CD, monitorización, despliegue.
> 7. **Métricas de negocio**: alineación con objetivos, oportunidades de crecimiento.
>
> Para cada área, proporciona:
> - Hallazgos concretos (basados en la información que te doy).
> - Recomendaciones accionables (con prioridad: alta/media/baja).
> - Ejemplos de código o configuraciones si aplica.
>
> Finalmente, sintetiza un **plan de acción** con los próximos pasos recomendados."

### 📄 Ejemplo de estructura de informe que puedes esperar

**Resumen ejecutivo**  
- Estado general del proyecto (verde/amarillo/rojo)  
- Principales riesgos y oportunidades  

**1. Arquitectura y escalabilidad**  
- Hallazgo: El monolito actual dificulta el despliegue independiente.  
- Recomendación (alta): Dividir en microservicios empezando por el módulo de pagos.  
- Detalle técnico: Propuesta de eventos y API Gateway.  

**2. Calidad del código**  
- Hallazgo: Falta de pruebas unitarias en servicios críticos.  
- Recomendación (media): Alcanzar 70% de cobertura en lógica de negocio usando Jest.  
- Ejemplo: Cómo testear un caso de uso con mocking.  

**3. Experiencia de usuario**  
- Hallazgo: El flujo de onboarding tiene 7 pasos, alta tasa de abandono.  
- Recomendación (alta): Reducir a 3 pasos, añadir barra de progreso.  
- Sugerencia de diseño: Wireframe rápido.  

**4. Seguridad**  
- Hallazgo: Las claves API están en el frontend.  
- Recomendación (alta): Moverlas a backend, usar variables de entorno.  
- Buenas prácticas: Cifrado en tránsito y reposo.  

**5. Rendimiento**  
- Hallazgo: Las consultas a la tabla de usuarios no están indexadas.  
- Recomendación (media): Añadir índices compuestos y caché con Redis.  
- SQL de ejemplo.  

**6. Procesos y DevOps**  
- Hallazgo: No hay pipeline de pruebas automáticas.  
- Recomendación (alta): Configurar GitHub Actions para ejecutar tests en cada PR.  
- YAML de ejemplo.  

**7. Métricas de negocio**  
- Hallazgo: No se trackean eventos clave (registro, suscripción).  
- Recomendación (media): Implementar analytics con Segment o Mixpanel.  
- Código de ejemplo para trackear.  

**Plan de acción priorizado**  
- Sprint 1: Seguridad + onboarding (alta prioridad)  
- Sprint 2: Pruebas + pipeline CI/CD  
- Sprint 3: Optimización de consultas y caché  
- Próximos: Microservicios (planificación)  

### 🛠️ Cómo usar este informe
1. Proporciona a Copilot toda la información relevante: descripción del proyecto, enlaces al repositorio (si es público), fragmentos de código, capturas de pantalla, o incluso el contenido de archivos clave (package.json, configuración, etc.).
2. Ejecuta el prompt y obtén el informe.
3. Revisa cada recomendación y adáptala a tu contexto.
4. Convierte las tareas de alta prioridad en issues o historias de usuario en tu gestor de proyectos.
5. Utiliza los skills individuales para abordar cada área (por ejemplo, activa el skill de Security para implementar las mejoras de seguridad).

### 💡 Ejemplo práctico de solicitud
> "Adjunto mi archivo `package.json`, `server.js` y la estructura de carpetas. Realiza una revisión completa de mi proyecto Node.js/Express + React. Enfócate en seguridad, rendimiento y buenas prácticas. Dame un informe detallado con prioridades."