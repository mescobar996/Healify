# Plan — `healify fix` que encuentra el selector en page objects (gap G3)

**Origen:** `.claude/research/competitive-gaps.md` § TOP 3 ②
**Goal:** que `fix` deje de saltear el 100% de las curaciones en proyectos con Page Object Model.
**Restricción:** cero dependencias (walker propio, nada de `glob`/`fast-glob`), sin red, conservador por default.

## Problema

`fix()` agrupa los casos por `case.testFile` y busca el selector **solo dentro de ese archivo**.
En cualquier proyecto con POM —la arquitectura estándar de e2e— el selector no vive en el spec,
vive en `pages/login.page.ts`:

```ts
// e2e/login.spec.ts        <- testFile que reporta el fallo
await loginPage.submit()

// pages/login.page.ts      <- donde REALMENTE está el selector
readonly submitBtn = '#login-btn-a1b2c3'
```

Resultado hoy: `⚠ e2e/login.spec.ts — saltado: ya no se encontró en el archivo`, para todos los
casos. La feature más visible de Healify (`fix`) es inservible en la mitad de los proyectos, y el
mensaje de error hace parecer que el reporte está desactualizado.

Es exactamente lo que Healenium resuelve con un plugin de IntelliJ + un backend Postgres.
Acá alcanza con un walker de directorios acotado.

## Diseño

### `cli/src/pom.ts` (nuevo)
`collectCodeFiles(roots, options)` — walker iterativo, determinista (entradas ordenadas):

- Extensiones: `.ts .tsx .js .jsx .mts .cts .mjs .cjs`.
- Directorios excluidos: `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`, `.next`,
  `.nuxt`, `.cache`, `.turbo`, `.healify`, `test-results`, `playwright-report`, `vendor`,
  `__pycache__`, y todo directorio oculto.
- Topes: `maxDepth = 8`, `maxFiles = 3000`. Un monorepo gigante degrada a "no encontré", nunca
  a colgarse.
- Errores de `readdir` (permisos, symlink roto) se ignoran por entrada, no abortan el scan.

### `cli/src/fix.ts`
Cuando el selector aparece **0 veces** en `testFile`, en vez de rendirse:

1. Lista los archivos de código del proyecto (una sola vez por corrida de `fix`, cacheado).
2. Descarta los que ya son `testFile` de algún caso de esta corrida — esos los maneja el loop
   principal, contarlos dos veces perdería ediciones.
3. Se queda con los que contienen el selector **exactamente una vez** (sobre el contenido con
   comentarios enmascarados, mismo criterio que hoy).
4. **0 archivos** → `not-found` (igual que antes). **2+ archivos** → `ambiguous`: no adivinamos
   en cuál. **1 archivo** → se aplica ahí.

- El chequeo de git sucio y `--dry-run`/`--force` valen igual para el page object.
- El outcome `applied` gana `appliedIn?: string`: el reporte dice en qué archivo se tocó de
  verdad, sin cambiar `testFile` (la clave `testFile::selector` la usa el armado del PR).
- Se escribe al final, desde un mapa de contenidos en memoria, para que dos selectores que caen
  en el mismo page object no se pisen.
- Flag `--no-pom` para apagarlo.

## Archivos

| Archivo | Cambio |
|---|---|
| `cli/src/pom.ts` | nuevo — walker de archivos de código |
| `cli/src/fix.ts` | fallback a page objects + `appliedIn` |
| `cli/src/commands/fix-pr.ts` | flag `--no-pom`, mostrar `appliedIn` |
| `cli/src/index.ts` | ayuda del flag |
| `cli/src/__tests__/pom.test.ts` | nuevo |
| `cli/src/__tests__/fix.test.ts` | tests del fallback |

## Verificación

- [ ] Selector que solo existe en un page object → se aplica ahí y el log dice dónde.
- [ ] Selector en dos page objects → `ambiguous`, no se toca nada.
- [ ] Selector en ningún lado → `not-found` (comportamiento de siempre).
- [ ] `--dry-run` no escribe el page object.
- [ ] Page object con cambios sin commitear → `dirty-git`.
- [ ] Dos selectores distintos que caen en el mismo page object → los dos se aplican.
- [ ] Una mención solo en un comentario no cuenta.
- [ ] `node_modules` no se recorre.
- [ ] `--no-pom` restaura el comportamiento anterior.
