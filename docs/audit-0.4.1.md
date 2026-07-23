# Auditoría autónoma 0.4.0 → 0.4.1 — 2026-07-23

Corrida en modo autónomo (FIX ALL + LOGS + README) sobre Healify y `C:\Proyectos\sgo-pzbp`.
Todo lo que sigue fue verificado corriendo el binario real, no solo compilando o leyendo
código — cada hallazgo tiene su repro y su verificación post-fix.

## Bugs encontrados y arreglados

### 1. `doctor` rompía en proyectos Selenium-only

**Repro:** proyecto con solo `selenium-webdriver` + `@healify/selenium-plugin` instalados.
`doctor` mostraba `❌ healify-report.json existe` con sugerencia de "corré tus tests" — pero
Selenium cura en vivo (wrap del `WebDriver`, sin hook de fin de corrida) y **nunca** genera
ese archivo. Era un check que jamás podía pasar.

**Fix:** `cli/src/commands/doctor.ts` — si Selenium es el único framework detectado, el
check de `healify-report.json` se reemplaza por uno informativo:
`ℹ️ Selenium cura en vivo, no genera reporte` (`ok: true, info: true`). Si convive con
Playwright/Cypress, el check de reporte se mantiene porque esos sí lo generan. Se agregó
el campo `info?: boolean` a `DoctorCheck` para que `index.ts` imprima `ℹ️` en vez de `✅/❌`.

**Verificado:** antes/después con el binario real contra un proyecto Selenium-only y contra
`sgo-pzbp` (ver sección 5). 3 tests nuevos en `doctor.test.ts`.

### 2. `--help` ejecutaba el comando de verdad

**Repro:** `node dist/index.js init --help` en un proyecto con Playwright — en vez de
mostrar ayuda, corrió `init` completo: instaló `@healify/test-runner` de verdad e intentó
editar `playwright.config.ts`. Confirmado corriendo el binario real dos veces (una sin
framework, una con) — la segunda corrida mostró que sí instala/edita.

**Fix:** `cli/src/index.ts` — `main()` ahora chequea `--help`/`-h` en cualquier posición de
`argv` **antes** de despachar a `init`/`doctor`/`fix`, y corta con `printHelp()`.

**Verificado:** `init --help`, `doctor --help` con un framework real presente → solo
imprimen ayuda, el config queda intacto (diff confirmado).

### 3. Inconsistencia `npx healify` vs `npx @healify/cli`

No es un bug funcional — probé ambas formas y las dos resuelven correctamente una vez que
`@healify/cli` está instalado como devDependency (`npx healify` usa el `bin: {"healify":
"dist/index.js"}` del `package.json`). Pero el README raíz ya usaba consistentemente
`npx @healify/cli <comando>` y `cli/README.md` + los mensajes de `fix:` del propio código
usaban la forma corta `npx healify <comando>` — inconsistente entre sí. Alineado todo a
`npx @healify/cli` (más explícito para alguien que recién instala).

**Tocado:** `cli/README.md`, `cli/src/commands/doctor.ts`, `cli/src/index.ts` (el mensaje
de error de "no detectamos framework"), y el test que verificaba el string literal viejo.

### 4. README raíz: ejemplo de `doctor` ficticio

El README (ya actualizado por vos con el enfoque QA) mostraba un ejemplo de salida de
`doctor` con un prompt interactivo `[y/n]` (`→ ¿Querés que lo agregue? [y/n]`) que **no
existe** — `doctor` no es interactivo, solo diagnostica y sugiere el comando de fix.
Reemplazado por el output real del binario (`npx @healify/cli doctor` contra un proyecto
Playwright recién creado, sin nada instalado).

### 5. Badge y conteo de tests desactualizado

El README decía 135 tests. Con los 3 tests nuevos de `doctor.test.ts` (Selenium-only), el
total real es **138**. Actualizado el badge y las dos menciones en texto.

## Qué NO era un bug (verificado, no solo asumido)

- **`init` duplicando reporters:** probé corriendo `init` dos veces seguidas contra un
  proyecto Playwright real y uno Cypress real. En ambos casos, la segunda corrida es
  no-op (`✅ ya estaba instalado` / `✅ el config ya tenía Healify configurado`) y el
  archivo de config queda con **una sola** mención del marcador (`grep -c` = 1 en
  Playwright, `HealifyCypressPlugin` aparece 2 veces en Cypress = 1 import + 1 llamada,
  correcto). No hacía falta ningún fix acá.
- **`fix --dry-run` sin reporte:** no crashea con stack trace — sale con
  `No se pudo leer healify-report.json: ENOENT: ...` y exit code 1, tal como documenta el
  README. Comportamiento correcto tal cual estaba.

## `npm run build` + `npm run verify`

| | Antes de esta auditoría | Después |
|---|---|---|
| Build (5 workspaces) | ✅ verde | ✅ verde |
| Tests | 135 (30+8+7+61+29) | **138** (30+8+7+**64**+29) |

Sin tests rotos en ningún momento — los 3 nuevos son cobertura agregada por el fix de
`doctor`, no reparación de algo que estaba roto.

## `npm audit`

Por workspace (`--omit=dev`, dependencias de producción): **0 vulnerabilidades en los 5**.
Nada de esto llega al tarball publicado (ya verificado en sesiones anteriores que `dist/`
solo tiene JS compilado, sin `node_modules`).

Desde la raíz (todas las dependencias, incluyendo dev): 6 vulnerabilidades, las 6 en
devDependencies de testing/build, ninguna alcanzable desde el código publicado:

| Paquete | Origen | Resuelto |
|---|---|---|
| lodash | `cypress` → `cypress-plugin` | ✅ `npm audit fix` (sin `--force`) |
| picomatch | `vitest`/`vite` (los 5 workspaces) | ✅ `npm audit fix` |
| postcss | `vitest` → `vite` | ✅ `npm audit fix` |
| vite | `vitest` (dev-only, no corremos `vitest --ui`) | ✅ `npm audit fix` |
| vitest | propio devDependency, `^4.0.18` en los 5 | ✅ `npm audit fix` |
| esbuild | usado en el `build` script de los 4 paquetes publicables | ❌ pendiente, ver abajo |

**esbuild no se tocó**: el fix requiere `npm audit fix --force` (bump breaking 0.27.3 →
0.28.1) y esbuild está en el script de `build` de `test-runner`/`cypress-plugin`/`cli`/
`selenium-plugin` — un bump breaking ahí podría cambiar el output del bundle. Regla
explícita de la tarea: no forzarlo sin avisar. **Pendiente de tu decisión.**

## package.json — consistencia de versiones

| Paquete | Versión | Privado |
|---|---|---|
| `reporter-core` | 0.4.0 | sí |
| `test-runner` | 0.4.0 | no |
| `cypress-plugin` | 0.4.0 | no |
| `cli` | **0.4.1** (único con cambios de comportamiento) | no |
| `selenium-plugin` | 0.1.0 (intacto) | no |

Todos los 5 tienen scripts `build`/`test`. `cli` tiene el `bin` correcto
(`{"healify": "dist/index.js"}`). No faltaba ningún script ni bin.

## sgo-pzbp — estado real

- `npm i -D @healify/cli@0.4.0 @healify/selenium-plugin@0.1.0`: ya estaban instalados
  exactos (`up to date`), confirmado con `npm ls`.
- `npx @healify/cli doctor` (versión **publicada**, 0.4.0) todavía muestra el bug viejo —
  el fix de esta auditoría vive en el build local, no publicado. Corriendo el **build
  local sin publicar** (`node .../cli/dist/index.js doctor` con cwd en `sgo-pzbp`) da
  `ℹ️ Selenium cura en vivo, no genera reporte` — confirma que el fix funciona en el
  proyecto real, apenas se publique 0.4.1 se refleja también vía `npx`.
- **No hay ningún `new Builder()`/`forBrowser()` en el código fuente de `sgo-pzbp`** (`grep`
  en `src/`, 0 resultados). El proyecto es una app Vite/React con tests unitarios de
  Vitest — Selenium no forma parte de su testing real, los paquetes de Healify están
  instalados pero completamente desconectados (mismo hallazgo que la sesión anterior).
  **No agregué infraestructura de e2e nueva a su repo real** sin que me lo pidas
  explícitamente — habría sido un cambio grande y no solicitado a un proyecto de
  producción (nuevos scripts, dependencia de ChromeDriver, archivos de test nuevos).
- En cambio, verifiqué el mecanismo con un script descartable **fuera** de `sgo-pzbp`
  (borrado al terminar), reusando sus paquetes ya instalados y un ChromeDriver real:
  selector roto `div[data-testid="checkout-cta"].active` contra un botón real con
  `data-testid="checkout-cta"` → Healify propuso `[data-testid='checkout-cta']` con
  **confidence 0.96**, tipo `healed`, y el `.click()` final **funcionó de verdad** tras
  la curación en vivo. Prueba end-to-end real de que `selenium-plugin` funciona
  correctamente usando exactamente las versiones que `sgo-pzbp` tiene instaladas.

**Qué toqué en `sgo-pzbp`:** nada en su código fuente. Solo confirmé que las versiones
instaladas ya eran las correctas (`npm i` fue no-op).

## Qué falta para `npm publish`

Solo `@healify/cli` tiene cambios reales de esta auditoría. Comando exacto:

```bash
cd C:\Proyectos\QA\Healify
npm publish --workspace=@healify/cli
```

`test-runner`, `cypress-plugin` y `reporter-core` no cambiaron en esta auditoría — no hace
falta republicarlos. `selenium-plugin` tampoco.

## Commit

Un solo commit atómico: `fix: 0.4.1 audit autonomo doctor selenium + README QA sync`.
Sin push, sin publish — a la espera de tu OK.
