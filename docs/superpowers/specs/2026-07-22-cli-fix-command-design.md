# `@healify/cli fix` — aplicar sugerencias del reporte local, design spec

**Fecha:** 2026-07-22
**Estado:** Aprobado, pendiente de implementación

## 0. Contexto

Healify (`@healify/test-runner`, `@healify/cypress-plugin`) corre una heurística local
(pattern-matching de texto, no IA ni análisis de DOM en vivo) y genera
`healify-report.html`/`.json` con selectores rotos y sus sugerencias. Hoy el usuario tiene
que copiar cada sugerencia a mano al archivo de test. Este spec define un comando de CLI
que cierra ese loop: lee el reporte ya generado y aplica las sugerencias de confianza alta
directamente sobre el código fuente del usuario, de forma conservadora y reversible.

No reemplaza el reporte HTML — lo complementa. El HTML sigue siendo la fuente de verdad
para revisar; el CLI es la acción sobre lo que ya se revisó (o se decidió confiar).

## 1. Alcance

Nuevo workspace `cli/` en el monorepo (hoy no existe — se creó y se borró vacío en
sesiones anteriores, esto es una recreación real, no un rescate de código viejo). Se
publica como paquete npm independiente `@healify/cli`, con un binario `healify`.

**Dentro de alcance:** un solo subcomando, `fix`, que opera sobre un `healify-report.json`
ya generado por una corrida previa de Playwright/Cypress.

**Fuera de alcance (explícitamente, no en esta iteración):** modo interactivo con
confirmación caso por caso, comando de "undo" propio (se resuelve con `git checkout`/`git
revert`, no hace falta reinventarlo), soporte para reportes con formato distinto al que ya
genera `local-report.ts`, cualquier integración con CI/PRs (esa es la dirección C que
quedó afuera de esta ronda).

## 2. Interfaz de línea de comandos

```bash
npx @healify/cli fix                       # busca ./healify-report.json
npx @healify/cli fix ruta/al/reporte.json   # ruta explícita
npx @healify/cli fix --dry-run              # muestra qué haría, no escribe nada
npx @healify/cli fix --force                # ignora el chequeo de git working tree sucio
```

Combinable: `--dry-run --force` es válido (simula ignorando el chequeo de git, útil para
ver qué pasaría en un archivo con cambios sin commitear sin arriesgar nada).

## 3. Algoritmo, por caso del reporte

Solo se consideran casos con `status === 'healed'` (≥90% de confianza, mismo umbral que ya
existe en `reporter-core/src/local-mode.ts` — no se inventa una escala nueva). Los casos
`review`/`unresolved` nunca se tocan; se cuentan en el resumen final como pendientes de
revisión manual.

Para cada caso `healed`:

1. **Chequeo de git** (salvo `--force` o `--dry-run`): correr `git status --porcelain
   -- <testFile>`. Si devuelve algo (cambios sin commitear en ese archivo específico), se
   salta el archivo completo con aviso — nunca se mezcla un cambio del CLI con trabajo en
   curso sin que el usuario lo pida explícitamente.
2. **Lectura y conteo de ocurrencias**: leer el contenido de `testFile`, contar cuántas
   veces aparece el string exacto de `selector` (comparación literal por substring, NO
   regex — evita problemas de escaping con selectores que contienen caracteres especiales
   de regex).
3. **Decisión por conteo:**
   - `0` ocurrencias → el archivo cambió desde que se generó el reporte (o el selector
     nunca estuvo ahí tal cual) — se salta, aviso "ya no se encontró en el archivo".
   - `1` ocurrencia → reemplazo literal (`split(selector).join(fixedSelector)` o
     equivalente), se escribe el archivo.
   - `2+` ocurrencias → ambiguo, no se adivina cuál — se salta con aviso indicando cuántas
     veces aparece.
4. Acumular el resultado (aplicado / saltado + motivo) para el resumen final.

Un mismo archivo puede recibir varios reemplazos si tiene varios casos `healed` — se
procesan todos antes de pasar al siguiente archivo, una sola escritura por archivo (no
una escritura por selector) para minimizar I/O y evitar que un reemplazo invalide el
offset de otro.

## 4. Salida en consola

```
Healify fix — healify-report.json

✓ e2e/checkout.spec.ts — #add-to-cart-btn → [data-testid="add-to-cart"]
✓ e2e/checkout.spec.ts — #promo-code-apply → button:has-text('Aplicar cupón')
⚠ e2e/login.spec.ts — saltado: 'button.submit' aparece 3 veces, ambiguo
⚠ e2e/cart.spec.ts — saltado: cambios sin commitear (usá --force para ignorar)

2 selectores aplicados · 2 saltados · 1 caso "review" sin tocar (ver healify-report.html)
```

Código de salida: `0` si no hubo errores de ejecución (saltar casos ambiguos/con git sucio
NO es un error, es el comportamiento conservador esperado). Código de salida `1` solo si
el archivo de reporte no existe, no es JSON válido, o falla una escritura de archivo por
permisos/IO.

## 5. Estructura de archivos

```
cli/
├── package.json       # @healify/cli, bin: { healify: "dist/index.js" }
├── tsconfig.json
├── src/
│   ├── index.ts        # parseo de argv, dispatch a subcomandos
│   ├── fix.ts           # el algoritmo de la sección 3
│   └── git-check.ts     # wrapper de `git status --porcelain`
└── src/__tests__/
    ├── fix.test.ts       # algoritmo de reemplazo con archivos temporales, sin git real
    └── fix.integration.test.ts  # flujo completo: reporte falso + archivo falso → CLI → verificar resultado
```

Depende de `reporter-core` solo por el tipo `LocalRun`/`LocalCaseResult` (import de tipos,
no de lógica — el CLI no vuelve a correr la heurística, solo lee el JSON ya generado).

## 6. Testing

- **Unitarios** (`fix.test.ts`): conteo de ocurrencias (0/1/2+), reemplazo literal con
  selectores que contienen caracteres especiales de regex (`.`, `[`, `]`, `(`, `)`),
  detección de git sucio (mockeando el wrapper de git, no un repo real).
- **Integración** (`fix.integration.test.ts`): directorio temporal real con un
  `healify-report.json` de mentira y un archivo `.spec.ts` de mentira → correr `fix` de
  punta a punta → verificar el contenido final del archivo y la salida en consola.
- Se agrega `cli` al workspace en `package.json` raíz — sus tests corren automáticamente
  con `npm test` desde la raíz (ya delegado a `--workspaces --if-present`).

## 7. Riesgos conocidos, aceptados a propósito

- Si dos casos `healed` del mismo archivo tienen selectores que se solapan como substrings
  (ej. `'#btn'` y `'#btn-guardar'`), el reemplazo del más corto podría alterar
  accidentalmente al más largo si se aplica primero. Mitigación: ordenar los reemplazos
  de un mismo archivo de más largo a más corto antes de aplicarlos. Documentado acá para
  que el implementador no lo pase por alto, pero no amerita una estrategia más compleja
  (AST, etc.) para este alcance.
- El chequeo de git asume que el usuario corre el CLI dentro de un repo git. Si no lo es,
  `git status` falla — se trata igual que "no se pudo verificar, aviso y seguir" en vez de
  bloquear todo el comando (el usuario sin git es minoría, pero no debería quedar sin
  poder usar la herramienta).
