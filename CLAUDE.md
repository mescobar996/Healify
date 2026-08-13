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

## Skills de Auditoría Instalados (TOP last30days)

| Skill | Stars | Updated | Para qué sirve | Comando | Repo |
|-------|-------|---------|----------------|---------|------|
| code-review-excellence | 38,442 | 2026-07-22 | Mejores prácticas de code review: feedback constructivo, bugs tempranos, mentoring | "code review", "review standards" | wshobson/agents |
| open-code-review | 18,232 | 2026-08-03 | Code review con IA sobre cambios Git vía CLI `ocr` (alibaba) | "review this PR/commit/diff" | alibaba/open-code-review |
| security-audit | 2,730 | 2026-07-06 | Auditoría de seguridad real (web/API/CLI/libs), issues explotables, no teóricos | "security audit", "find security bugs" | cloudflare/security-audit-skill |
| owasp-security | 317 | 2026-07-28 | OWASP Top 10:2025, ASVS 5.0, LLM Top 10, Agentic AI; por-language quirks | "security review", "implement auth" | agamm/claude-code-owasp |
| code-review (port OpenCode) | 455 | 2026-08-03 | Review de PR/diff multi-agente con confidence filtering | "review this PR", "audit changes" | waybarrios/opencode-power-pack |

**Skills pre-existentes** (instaladas antes, sin repo >100⭐): security-reviewer, code-reviewer, deep-review, performance-audit, architecture-review.

## Skills de Escritura y Contenido (instaladas 2026-08-13)

| Skill/Herramienta | Qué es | Cuándo usarla en Healify |
|---|---|---|
| humanizer | Skill de edición (solo Markdown, sin ejecutable) que quita patrones de texto generado por IA | OBLIGATORIO en todo texto que hable del proyecto: README (EN/ES), docs/, CHANGELOG, landing, mensajes de CLI, issues/PRs. Escribir primero, humanizar antes de commitear docs |
| caveman | Skill de comunicación tersa (modo a pedido) | Cuando el usuario pida "caveman mode" / "less tokens": respuestas cortas, sustancia técnica intacta, código verbatim |
| markitdown | CLI Python (`markitdown` vía uv tool) que convierte PDF/DOCX/XLSX/PPTX/HTML a Markdown | Cuando haya que traer contenido de documentos externos a `docs/` o `specs/` (ej. una spec en Word o un PDF de referencia) |

Regla: humanizer aplica SOLO al texto que habla del producto (docs, README, landing, CHANGELOG). El código, tests y mensajes de commit no se pasan por humanizer.

### Regla de Auditoría (/audit-perfect)

Cada vez que el usuario diga **/audit-perfect**, correr en orden:
1. `blindspot`-style architecture pass → `code-review` (opencode-power-pack) para diff/PR
2. `security-audit` (cloudflare) → `owasp-security` (agamm) para severidad/OWASP
3. `code-review-excellence` (wshobson) → `performance-audit` para pulido

Generar reporte en `.claude/audits/<YYYY-MM-DD>-perfect.md` con fecha, separando Críticos / Mayores / Menores. `/audit` sigue usando deep-review → security-reviewer → code-reviewer.
