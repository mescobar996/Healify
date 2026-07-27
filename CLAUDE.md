Proyecto: Healify
Descripción: Reporter local y gratuito para Playwright, Cypress, Selenium y WebdriverIO que sugiere selectores alternativos cuando un test falla. Stack: TypeScript, Node.js, npm workspaces (Monorepo), Vitest.
Estructura del Monorepo
/reporter-core # Motor heurístico y config compartida (privado, core logic) /test-runner # Adapter para Playwright (@healify/test-runner) /cypress-plugin # Adapter para Cypress (@healify/cypress-plugin) /selenium-plugin # Adapter para Selenium (@healify/selenium-plugin) /webdriverio-plugin # Adapter para WebdriverIO (@healify/webdriverio-plugin) /cli # Herramienta CLI (fix, init, doctor) /gh-action # GitHub Action standalone (no se publica en npm) /docs # Specs, manual de usuario y documentación
Reglas Estrictas de Desarrollo

* Identidad del Motor: Es una HEURÍSTICA (pattern-matching), NO es IA. Nunca inflar sus capacidades.
* Arquitectura: Es 100% local y sin red. El "modo nube" fue eliminado.
* Cero Inventos: `init` NUNCA genera tests de prueba ni selectores falsos. Solo configura.
* Límites de la IA: NUNCA ejecutar `npm publish` ni `git push`. El usuario lo hace manualmente. Darle los comandos exactos.
* Verificación: Probar de verdad con el binario/reporte real, no asumir que funciona solo porque los tests pasan.

Flujo de Trabajo con la IA

1. Ignora `archive/saas-full` y `docs/superpowers/plans` (ya excluidos en `.claudeignore`).
2. Para verificar el estado global, usa `npm run verify` (imprime un resumen limpio).
3. Si necesitas ver el historial reciente o bugs pasados, pide leer `CONTEXT_HANDOFF.md` explícitamente.
4. Devuelve solo el código modificado o nuevo, no repitas código intacto.
