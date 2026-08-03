Proyecto: Healify
Descripción: Heal local y gratuito de selectores rotos para Playwright, Cypress, Selenium y WebdriverIO — con verificación real contra el DOM en los cuatro (Cypress vía `cy.healifyGet`, opt-in) — más un puente CLI (`healify heal`/`probe-script`) para automatizar en Python/Java/C#. IA local opcional via Ollama para explicaciones en lenguaje natural. Stack: TypeScript, Node.js, npm workspaces (Monorepo), Vitest.
Estructura del Monorepo
/reporter-core # Motor heurístico, sondeo DOM, repertorio y config compartida (privado, core logic) /test-runner # Adapter para Playwright (@healify/test-runner) /cypress-plugin # Adapter para Cypress (@healify/cypress-plugin) — reporte pasivo + support.ts para cy.healifyGet en vivo /selenium-plugin # Adapter para Selenium (@healify/selenium-plugin) /webdriverio-plugin # Adapter para WebdriverIO (@healify/webdriverio-plugin) /cli # Herramienta CLI (fix, init, doctor, history, heal, probe-script, ai) /ai-local # IA local via Ollama (@healify/ai-local) /docker # Docker Compose para Ollama + Open WebUI /python/healify-ai # Paquete Python para IA local /gh-action # GitHub Action standalone (no se publica en npm) /docs/adapters # Adapters de referencia Python/Java/C# (código para copiar, NO paquetes publicados) /docs/ai # Documentación de IA local /docs # Specs, manual de usuario y documentación
Reglas Estrictas de Desarrollo

* Identidad del Motor: Es una HEURÍSTICA + verificación contra el DOM real, NO es IA. Nunca inflar sus capacidades.
* IA Local (Opcional): La integración con Ollama es OPCIONAL. El motor heurístico SIEMPRE funciona sin IA. La IA es un complemento, no un reemplazo.
* Arquitectura: Es 100% local y sin red. El "modo nube" fue eliminado. El puente multi-lenguaje es subproceso local (stdin/stdout), no un servidor.
* Cero Inventos: `init` NUNCA genera tests de prueba ni selectores falsos. Solo configura.
* Límites de la IA: NUNCA ejecutar `npm publish` ni `git push`. El usuario lo hace manualmente. Darle los comandos exactos.
* Verificación: Probar de verdad con el binario/reporte real, no asumir que funciona solo porque los tests pasan.

Flujo de Trabajo con la IA

1. Ignora `archive/saas-full` y `docs/superpowers/plans` (ya excluidos en `.claudeignore`).
2. Para verificar el estado global, usa `npm run verify` (imprime un resumen limpio).
3. Si necesitas ver el historial reciente o bugs pasados, pide leer `CONTEXT_HANDOFF.md` explícitamente.
4. Devuelve solo el código modificado o nuevo, no repitas código intacto.
5. Comandos AI: `healify ai setup|status|explain|chat|models` — requieren Ollama corriendo.

## Skills de Auditoría Instalados

| Skill | Para qué sirve | Cuándo usarlo |
|-------|----------------|---------------|
| security-reviewer | Identifica vulnerabilidades de seguridad, genera reportes con severidad (OWASP, SAST, secrets) | Cuando pedís "security review", "audit de seguridad", "chequear vulnerabilidades" |
| code-reviewer | Revisión de código: bugs, code smells, N+1 queries, problemas de arquitectura | Cuando pedís "code review", "revisar PR", "chequear calidad" |
| deep-review | Pipeline multi-etapa: corre revisión paralela de correctness, security, performance, architecture | Cuando pedís "deep review", "audit completo", "revisión pre-merge" |
| performance-audit | Detecta cuellos de botella: N+1 queries, memory leaks, rendering innecesario | Cuando pedís "check performance", "find bottlenecks", "optimize" |
| architecture-review | Evalúa SOLID, coupling, cohesion, patrones de diseño | Cuando pedís "review architecture", "check design patterns", "evaluate structure" |

### Regla de Auditoría

Cada vez que el usuario diga **/audit**, correr en orden:
1. `deep-review` — Revisión completa del código
2. `security-reviewer` — Auditoría de seguridad
3. `code-reviewer` — Revisión de calidad

Generar reporte en `.claude/audits/` con timestamp.
