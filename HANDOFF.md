# HANDOFF — Healify — 2026-07-23 (actualizado, post 0.6.0)

Documento único para dar contexto completo a otra IA/sesión. Cubre 2 proyectos
separados: **Healify** (la herramienta) y **sgo-pzbp** (proyecto real donde se probó).

---

## 1. Qué es Healify

Herramienta **local, heurística (NO es IA), sin red** que detecta selectores rotos de
Playwright/Cypress/Selenium y propone alternativas más estables (`data-testid` > `name` >
`aria-label`/rol > texto visible > clase). Pattern-matching sobre el texto del selector y
del mensaje de error — nunca analiza el DOM real, nunca verifica que la sugerencia exista.
Público objetivo: QA sin experiencia en código.

Repo: `C:\Proyectos\QA\Healify` — remoto `https://github.com/mescobar996/Healify.git`,
rama `main`. Monorepo npm workspaces.

## 2. Estado de versiones (0.6.0 en código, pendiente de publicar)

| Paquete | Versión en código (0.6.0) | Versión en npm | Privado |
|---|---|---|---|
| `@healify/cli` | 0.6.0 | 0.5.1 (desactualizado) | no |
| `@healify/test-runner` (Playwright) | 0.6.0 | 0.5.0 (desactualizado) | no |
| `@healify/cypress-plugin` | 0.6.0 | 0.5.0 (desactualizado) | no |
| `@healify/selenium-plugin` | 0.6.0 | 0.1.0 (desactualizado) | no |
| `reporter-core` | 0.6.0 | — | sí, bundleado dentro de los otros 4 |

**IMPORTANTE — falta publicar 0.6.0.** Los 5 paquetes bundlean `reporter-core` (el fix del
Bug A de esta sesión vive ahí) — hay que republicar los 5, no solo `cli`. Comandos:
```bash
cd C:\Proyectos\QA\Healify
npm publish --workspace=@healify/test-runner
npm publish --workspace=@healify/cypress-plugin
npm publish --workspace=@healify/selenium-plugin
npm publish --workspace=@healify/cli
```
**Yo (la IA) nunca corro `npm publish`** — el usuario lo hace desde su propia terminal.

## 3. Arquitectura — archivos clave

```
reporter-core/src/
  healing-engine.ts       # toda la heurística: qué selector proponer y con qué confianza
  selector-extractor.ts   # extrae el selector de un mensaje de error
  local-mode.ts           # clasifica healed (>=0.9) / review (>=0.8) / unresolved
  local-report.ts         # genera healify-report.html/json + printSummary()
  dictionaries/en.json, es.json  # ACTIONS/FIELDS bilingües (ej. "ingresar" -> "Ingresar")

test-runner/src/reporter.ts      # integración Playwright (Reporter API)
cypress-plugin/src/plugin.ts     # integración Cypress (after:spec/after:run)
selenium-plugin/src/wrap.ts      # integración Selenium (Proxy sobre WebDriver, cura en vivo)

cli/src/
  commands/init.ts    # detecta/configura (3 casos, ver sección 4) — YA NO genera tests
  commands/doctor.ts  # diagnóstico read-only
  scaffold.ts          # templates de config real (sin ningún test)
  detect.ts             # detección de framework/baseURL/TS-JS/module type
  prompt.ts             # prompt sync sin dependencias nuevas
  fix.ts                 # aplica sugerencias healed directo en archivos de test
  index.ts               # entrypoint del binario (bin: healify)

CHANGELOG.md            # historial completo — 0.5.0/0.5.1 (init universal + 2 bugs) y
                         # 0.6.0 (sacar demos + 2 bugs de auditoría)
docs/audit-0.5.0.md      # auditoría de la sesión de init universal
CONTEXT_HANDOFF.md       # bitácora local (gitignored, NO está en git) — cronología completa
```

## 4. `init` — CÓMO ES HOY (0.6.0): configura, NUNCA genera tests

Decisión explícita del usuario, revertida de un diseño anterior (0.5.0/0.5.1) que sí
generaba demos: **`init` no crea ningún archivo de test, nunca**. Solo deja la config real
conectada. 3 casos:

- **CASO A — nada detectado**: pregunta qué framework armar (Playwright/Cypress/Selenium,
  default Playwright — prompt vía `fs.readSync` sobre el fd 0, sin dependencias nuevas),
  instala el paquete y crea **solo el config** (`playwright.config.*`, o
  `cypress.config.*` + `cypress/support/e2e.*` — ese support file sí es real, Cypress lo
  exige; o `healify.selenium.example.ts`, documentación de referencia que nunca se
  ejecuta).
- **CASO B — framework instalado, sin config**: crea el config automáticamente, sin
  preguntar (bug real encontrado en `sgo-pzbp`: `@playwright/test` instalado,
  `playwright.config.ts` nunca existió).
- **CASO C — config sin Healify**: solo inyecta el marcador (sin cambios).

Mensaje final honesto: *"✅ Config lista. Escribí tu primer test en e2e/ ... cuando un
selector se rompa vas a tener healify-report.html."* — nunca implica que ya hay algo
armado para correr.

`baseURL` se detecta del script `"dev"` de `package.json` (`vite --port=3000`) antes que
de `vite.config.*` — en un proyecto Vite real el puerto casi nunca está en el config file.

## 5. Por qué se sacaron los demos (contexto importante para no repetir el error)

0.5.0/0.5.1 generaban, para cada framework, un test con un selector **inventado** roto a
propósito (`demo-boton-roto-healify`, `boton-viejo-12345678`) solo para mostrar un primer
`healify-report.html`. Probándolo en `sgo-pzbp` real, el usuario sintió que se le mostraba
algo falso ("siento que me mentís o me das vueltas"). **Regla desde ahora: nada de
selectores/tests inventados, nunca.** Si algo es una demo/simulación, decirlo clarísimo
ANTES de que el usuario lo corra, no después de que pregunte varias veces.

## 6. Bugs reales encontrados y arreglados en esta sesión (todos verificados con binario
real, no solo tests)

1. **`extractSelectorFromError` nunca extraía un `data-testid` completo** — el regex de
   comillas excluía ambos tipos de comilla, cortaba en la comilla interna de
   `locator('[data-testid="x"]')`. Status `'unresolved'` siempre para TESTID (0.95, el
   caso de mayor confianza). Arreglado con backreference de comilla.
2. **Demo de Selenium colisionaba con el descubrimiento de tests de Playwright** —
   `*.test.ts` dentro de `e2e/` se cargaba como test de Playwright y se autoejecutaba.
   (Esto quedó resuelto Y DESPUÉS irrelevante — el demo completo se sacó en 0.6.0).
3. **`healing-engine.ts`: clases CSS-in-JS compuestas no se detectaban como volátiles** —
   `.btn.css-1a2b3c4d5e` (multi-clase pegada) o `.container > .css-1a2b3c4d` (combinador)
   nunca entraban a la detección de clase volátil (solo miraba el string completo desde
   el inicio). Sin selector alternativo, caía al fallback genérico `visible=...`.
   Arreglado: busca el patrón volátil en cualquier token de clase del selector, y se
   agregó una estrategia nueva que propone conservar solo los tokens estables (ej.
   `.wrapper.css-1a2b3c4d5e` → `.wrapper`).
4. **`cli/src/fix.ts`: podía reemplazar un selector dentro de un comentario** — si el
   selector roto quedaba mencionado solo en un `// comentario` y ya no existía en el
   código real, `fix` lo reemplazaba ahí igual, reportando `applied` con confianza total
   sin cambiar nada funcional. Arreglado: los comentarios (línea completa `//` y bloques
   `/* */`) se enmascaran antes de contar/ubicar el reemplazo.

Total: **164 tests** verdes (38 reporter-core + 8 test-runner + 7 cypress-plugin + 82 cli
+ 29 selenium-plugin), 5 workspaces, `npm audit` → 0 vulnerabilidades.

## 7. `sgo-pzbp` — estado real actual (proyecto del usuario, NO de Healify)

Repo: `C:\Proyectos\sgo-pzbp` (app Vite/React, Prefectura Naval Argentina — gestión de
tareas/visitas técnicas/novedades). Login vive en `/login`, con OAuth de Google
(`src/pages/Login.tsx`) — el botón real dice "Ingresar con Google", sin `data-testid`.

Archivos que Healify dejó ahí, todos **reales** (ya no quedan demos):
- `playwright.config.ts` — config real, `baseURL: 'http://localhost:3000'` (matchea el
  script `dev` real: `"dev": "vite --port=3000 --host=0.0.0.0"`)
- `healify.selenium.example.ts` — documentación de referencia (nunca se ejecuta)
- `e2e/login.spec.ts` — **el primer test e2e real de la app**, verificado pasando de
  verdad: `expect(page.getByRole('button', { name: /ingresar con google/i })).toBeVisible()`

Se demostró la cura real (sin dejar ningún test roto permanente): un test temporal con
`page.click('#btn-ingresar')` (un ID plausible que un QA podría probar antes de tener
`data-testid`, no existe en el componente real) falló de verdad y Healify propuso
`role('button', { name: 'Ingresar' })` (confidence 0.89, status `review`) — matchea el
botón real por texto (Playwright hace substring match en `name`). El diccionario bilingüe
(`ingresar` → `Ingresar`) hizo el trabajo. Test temporal borrado después de confirmar.

`doctor` da 4/5 ✅ — el único ❌ es "healify-report.json existe", **esperado y correcto**:
el test real pasa, así que no hay reporte todavía (recién se genera si algo falla). No es
un problema, es el estado sano de un proyecto sin selectores rotos.

**Conflicto de entorno encontrado (no es un bug de Healify):** en esta máquina, Obsidian
tiene un listener propio en `127.0.0.1:3000` que compite con el `vite --port=3000` real de
`sgo-pzbp` — Windows prioriza el bind específico (127.0.0.1) de Obsidian sobre el bind
wildcard (0.0.0.0) de vite, así que las requests a `localhost:3000`/`127.0.0.1:3000` a
veces caen en Obsidian en vez del dev server real. Si el usuario corre `npx playwright
test` y el test falla con contenido rarísimo en la página, **antes de asumir que es un bug
de la app, verificar quién responde en el puerto**:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess
```
Si Obsidian aparece ahí, cerrar Obsidian o correr `sgo-pzbp` en otro puerto (`vite
--port=3005`, ajustando `playwright.config.ts` a mano para esa corrida) antes de testear.

Estado de `git status` en `sgo-pzbp` (además de lo de arriba): `package.json`/
`package-lock.json` modificados por cambios previos AJENOS del usuario (no tocar), y
`migrations/015_notifications_update_policy.sql` sin trackear, también ajeno.

## 8. Reglas/contexto de la sesión (para que la próxima IA no las rompa)

- **Nunca correr `npm publish`/manejar 2FA** — el usuario siempre publica desde su propia
  terminal. Dar los comandos exactos, nunca ejecutarlos.
- **Nunca hacer `git push` sin que el usuario lo pida explícitamente** en cada ocasión.
- **Nada de selectores/tests inventados como si fueran reales** — ver sección 5. Si algo
  es ilustrativo/simulado, decirlo antes de que se ejecute.
- Estilo de trabajo "caveman": cambios mínimos, sin sobre-ingeniería, siempre verificar
  con el binario/reporte real, no solo con tests unitarios pasando.
- El usuario (Matías) es Suboficial PNA + estudiante de QA (UNTREF) — no es programador
  de formación, pero sigue instrucciones técnicas bien cuando se le explican claro.

## 9. Qué falta / próximos pasos posibles

- **Publicar 0.6.0** (los 5 paquetes, en el orden de la sección 2) — pendiente del OK del
  usuario.
- `git push` de Healify — pendiente (commiteado en local, no pusheado todavía a menos que
  se pida explícitamente).
- `sgo-pzbp` tiene ahora 1 test e2e real (login). Buen próximo paso: agregar más tests
  reales de otras pantallas (tareas, visitas técnicas) cuando el usuario quiera.
- Nada más pendiente del lado del código de Healify: build limpio, 164 tests verdes, 0
  vulnerabilidades.
