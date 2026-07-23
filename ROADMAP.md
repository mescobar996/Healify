# ROADMAP: Healify, ideas de features y ajustes (post 0.6.0)

Lista de ideas concretas, ninguna implementada todavía. Cada una nace de un hueco o
límite real encontrado en esta sesión o documentado en el propio código, no son
inventadas. Están ordenadas de más chica/segura a más grande/riesgosa. Al final hay un
meta-prompt listo para pasarle a cualquier IA (esta u otra) y arrancar una de estas sin
perder contexto.

---

## Ajustes chicos (bajo riesgo, 1 sesión o menos)

### 1. `doctor` detecta el gotcha de semver caret que ya mordió dos veces
En esta sesión, `npm install --save-dev @healify/cli` no trajo la versión nueva porque
`package.json` tenía `^0.4.1` (el caret en paquetes `0.x` te encierra en ese minor).
`doctor` podría comparar la versión instalada en `node_modules` contra el rango declarado
en `package.json` y avisar explícito: *"tenés ^0.4.1 declarado, un `npm install` sin
versión no te va a subir de minor, usá `@latest` a mano"*. No necesita red, es comparar
dos strings que ya tiene disponibles.

### 2. Selenium: método `flush()` para generar reporte
Ya está anotado como pendiente en `selenium-plugin/README.md` ("se evalúa agregar un
método `flush()` en una versión futura"). Hoy Selenium solo cura en vivo, no deja un
`healify-report.json` acumulado como Playwright/Cypress. Un `flush()` opcional que el
usuario llame al final de su suite podría escribir el mismo formato de reporte a partir
de los eventos que ya emite `onEvent`.

### 3. `init` detecta conflictos de puerto antes de escribir el config
El bug real de esta sesión (Obsidian compitiendo por el puerto 3000 de `sgo-pzbp`) se
encontró recién corriendo el test, no en `init`. `init` podría, después de detectar el
`baseURL`, hacer un chequeo liviano (una request HTTP corta) y avisar si algo ya responde
ahí de forma sospechosa (o simplemente confirmar "nadie responde en el puerto todavía,
acordate de levantar tu app"). No bloquea nada, es solo una advertencia útil.

---

## Features medianas (una feature bien acotada, con su propio diseño)

### 4. Diccionario de sinónimos configurable por proyecto
Hoy `ACTIONS`/`FIELDS` (los mapeos como `"ingresar" → "Ingresar"`) están fijos en
`reporter-core/src/dictionaries/*.json`, dentro del propio paquete. Un proyecto con
vocabulario propio (términos navales, de gestión, etc.) no puede extenderlo sin tocar el
código de Healify. Una opción: un `healify.config.json` opcional en la raíz del proyecto
consumidor, con un objeto de sinónimos adicionales que se mergean con los dictionaries
built-in antes de correr `analyzeAndHeal()`.

### 5. Soporte para más frameworks (WebdriverIO, Puppeteer, TestCafe)
Mismo patrón que `selenium-plugin` (wrap del driver real, sin tocar el motor
compartido). Cada uno es un paquete nuevo relativamente chico una vez que existe el
patrón de `selenium-plugin` como referencia. Prioridad sugerida: WebdriverIO primero (es
el más pedido en la comunidad de QA automation).

### 6. GitHub Action empaquetada
Una action que corra `doctor` y `fix --dry-run` en cada PR y comente el resultado
(selectores rotos detectados, sugerencias, sin aplicar nada solo). Reduce fricción para
equipos que ya tienen CI armado, hoy el usuario tiene que armar los steps a mano.

---

## Features grandes (cambio de arquitectura o alcance, requieren diseño propio)

### 7. `fix` con reescritura estructural para sugerencias ROLE/TEXT
Hoy, cualquier sugerencia tipo `role('button', { name: 'X' })` se salta con
`not-substitutable` porque no es un valor de selector pegable. Está documentado a
propósito en la tabla "Qué toca y qué no" de `cli/README.md`. Para aplicar esas
sugerencias automáticamente hace falta reescribir la llamada completa
(`page.click('#x')` → `page.getByRole('button', { name: 'X' }).click()`), un cambio
estructural, no textual. Requeriría parsear el archivo con un AST real (ej. `ts-morph`)
en vez de reemplazo de texto, mucho más riesgo de romper código real si no se hace con
cuidado. Sería el cambio de mayor impacto en cuánto puede aplicar `fix` solo, pero
también el de mayor riesgo.

### 8. Reporte histórico (no solo el último run)
Hoy `healify-report.html`/`.json` se pisa en cada corrida. Guardar un historial (¿cuántos
selectores se rompieron por semana? ¿cuáles se repiten?) daría una métrica real de salud
de los tests a lo largo del tiempo. Cambia el modelo de "reporte de una corrida" a
"reporte acumulado". Hay que pensar bien el formato de almacenamiento antes de escribir
código (¿un archivo por corrida? ¿un JSON que crece? ¿SQLite local?).

### 9. Extensión de VSCode
Mostrar el `healify-report.html` inline en el editor, o un comando rápido "Healify: fix
this file" sin salir a la terminal. Baja el piso de entrada para QA que preferiría no
tocar la terminal en absoluto, coherente con el público objetivo (QA sin experiencia en
código), pero es un proyecto aparte con su propio ciclo de publicación (VSCode
Marketplace).

---

## Qué NO hacer (ya decidido, no reabrir sin una razón real nueva)

- **Nada de selectores/tests inventados en `init`**, se sacó en 0.6.0 explícitamente
  porque el usuario sintió que era engañoso. No revivir esta idea aunque parezca útil
  para "mostrar valor rápido".
- **Nada de modo nube/API key**, se eliminó por completo en una sesión anterior. Healify
  es 100% local a propósito, es parte de la identidad del producto.
- **Nada de verificar el DOM real**, el motor es heurística de texto a propósito, no
  analiza el DOM ni usa IA. Cambiar esto sería un producto distinto, no una mejora.

---

## Meta-prompt para arrancar una de estas ideas (con esta IA u otra)

Copiá y pegá esto, completando la feature elegida:

```
Leé primero C:\Proyectos\QA\Healify\HANDOFF.md completo (contexto del proyecto, estado
actual, reglas de la sesión) y C:\Proyectos\QA\Healify\ROADMAP.md (de donde sale este
pedido - buscá la sección "<NÚMERO Y NOMBRE DE LA FEATURE>").

Quiero implementar: <NÚMERO Y NOMBRE DE LA FEATURE, pegado tal cual del ROADMAP>

Reglas no negociables (ya estaban vigentes en la sesión anterior):
- Nada de selectores/tests inventados como si fueran reales - si necesitás demostrar algo,
  hacelo contra código/DOM real o decilo clarísimo antes de que yo lo corra.
- Nunca corras npm publish ni toques 2FA - dame los comandos exactos, yo los corro.
- Nunca hagas git push sin que yo lo pida explícitamente en esta conversación.
- Estilo caveman: cambios mínimos, sin sobre-ingeniería, no agregues nada que no pedí.
- Verificación real antes de decir que algo funciona: build real, tests reales, y si
  aplica, corrida real contra un proyecto real (no solo tests unitarios en verde).
- Antes de escribir código: entendé el diseño actual leyendo los archivos relevantes
  (mapeados en HANDOFF.md sección 3), proponeme un diseño corto, y esperá mi OK antes de
  implementar si la feature es mediana o grande (secciones "medianas"/"grandes" del
  ROADMAP). Las de la sección "chicos" las podés implementar directo si son claramente de
  bajo riesgo.

Al terminar: actualizá CHANGELOG.md, bumpeá versión si corresponde, corré build+verify
completos, y actualizá HANDOFF.md con lo que cambió para la próxima sesión.
```
