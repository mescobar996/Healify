# Adapters multi-lenguaje

Healify es un motor heurístico (`reporter-core`), no un servicio — hasta acá, solo
invocable desde JS/TS vía los cuatro paquetes npm. `@healify/cli` expone ese mismo motor
como dos comandos que hablan JSON por stdin/stdout, así que **cualquier lenguaje que pueda
spawnear un subproceso lo puede usar**, sin reescribir un pedazo de la heurística.

C# no tiene paquete publicado (NuGet) — es un **adapter de referencia**: código real,
copiable, que adaptás a tu proyecto (mismo espíritu que
`healify.selenium.example.ts`/`healify.wdio.example.ts` en la versión JS). **Python y Java sí
son paquetes reales** — `pip install healify-selenium` y el groupId
`io.github.mescobar996:healify-selenium` en Maven Central.

| Lenguaje | Dónde | Verificado |
|---|---|---|
| Python | [`pip install healify-selenium`](../../python/healify-selenium/) | ✅ Selenium 4.46 + Chrome real, de punta a punta — incluido el wheel empaquetado, instalado en un venv limpio |
| Java | Maven: `io.github.mescobar996:healify-selenium:0.1.0` ([`java/healify-selenium/`](../../java/healify-selenium/)) | ✅ Publicado real en Maven Central (namespace `io.github.mescobar996` verificado, firmado con GPG). Compila real contra selenium-java 4.27; el puente a `healify heal` se probó real. El `ChromeDriver` en vivo no se pudo correr en la sesión donde se escribió el código por un bug de red del JDK 17 de esa máquina (`java.net.http` roto en ese sandbox, no algo de Selenium ni de Healify) — la publicación en sí (compilación, firma, deploy) sí se verificó de punta a punta |
| C# | [`csharp/HealifySeleniumWrapper.cs`](csharp/HealifySeleniumWrapper.cs) (copiar y adaptar) | ✅ .NET 8 SDK portable + Selenium.WebDriver 4.27 + Chrome real, de punta a punta |

### Java: `pom.xml`

```xml
<dependency>
  <groupId>io.github.mescobar996</groupId>
  <artifactId>healify-selenium</artifactId>
  <version>0.1.0</version>
</dependency>
```

## El contrato: `healify heal` y `healify probe-script`

### `healify probe-script`

Sin entrada. Imprime un script JS que corre **dentro del browser** (no en tu lenguaje) —
correlo una vez con el `execute_script`/equivalente de tu driver:

```bash
npx @healify/cli probe-script
```

Devuelve `{ role: string, name: string }[]` de los elementos interactivos de la página —
mismo criterio de nombre accesible en toda la escalera (aria-label → texto visible →
placeholder → value) que usa el resto del motor.

### `healify heal`

JSON por stdin, JSON por stdout. Es el motor entero: heurística, verificación contra la
página, repertorio — todo del lado del servidor, vos solo mandás lo que tu driver ya sabe.

**Entrada:**

```json
{
  "selector": "#comprar-ahora-a1b2c3",
  "testFile": "tests/test_checkout.py",
  "pageElements": [{ "role": "button", "name": "Comprar" }]
}
```

- `selector` (obligatorio): el selector que se rompió, ya convertido a CSS o XPath por tu
  adapter (no un `By`/locator nativo de tu lenguaje — eso lo tenés que traducir vos, ver los
  adapters de referencia para el criterio: `By.id` → `#valor`, `By.className` → `.valor`, etc.).
- `testFile` (opcional): scopea el repertorio a este archivo. Sin esto, el repertorio
  matchea por selector solo.
- `pageElements` (opcional): el array que devolvió `probe-script` al correr en el browser.
  Sin esto, la heurística queda a ciegas para esta llamada (igual puede resolver desde el
  repertorio si hay una curación verificada previa para este mismo selector+archivo).

**Salida (éxito):**

```json
{
  "fixedSelector": "role('button', { name: 'Comprar' })",
  "confidence": 0.97,
  "verified": true,
  "fromRepertoire": false,
  "needsReview": false,
  "explanation": "...",
  "selectorType": "ROLE",
  "locator": {
    "strategy": "xpath",
    "value": "//button[normalize-space(.)='Comprar'] | ..."
  }
}
```

`locator` es la parte pensada para no-JS: ya viene resuelto a algo que tu driver puede
ejecutar tal cual, sin que tengas que entender la sintaxis `role(...)` de Playwright.
`strategy` es `"css"`, `"xpath"` o `"unsupported"` (nada confiable para reintentar — tratalo
como si `heal` no hubiera encontrado nada).

**Salida (error):**

```json
{ "error": "descripción del problema" }
```
Exit code 1. JSON malformado en la entrada, o una excepción interna del motor — nunca un
crash silencioso.

### El repertorio se consulta del lado del servidor

`heal` lee `.healify/history.jsonl` del directorio donde corre (`cwd` del subproceso) en
cada invocación — vos no necesitás saber su formato ni su ubicación. Si el mismo selector,
en el mismo `testFile`, ya se curó y **se confirmó contra la página real** en una corrida
anterior (de cualquier lenguaje: JS, Python, Java...), `heal` reusa esa corrección aunque
esta llamada no mande `pageElements`.

Si tu adapter también graba en `.healify/history.jsonl` (los tres de referencia lo hacen,
opcional vía un flag), tus curaciones confirmadas quedan disponibles para cualquier otro
lenguaje que corra contra el mismo repo. El formato de cada línea (JSONL, un objeto por
línea) es el mismo `HistoryEntry` que usa `reporter-core/src/repertoire.ts` — podés ver el
shape exacto ahí, o copiarlo de cualquiera de los tres adapters.

## Escribir un adapter para otro lenguaje

No hace falta que exista uno de referencia para arrancar. El contrato de arriba es
completo — lo mínimo que necesitás:

1. Al fallar tu equivalente de `find_element`, convertí el locator nativo de tu framework a
   un string CSS o XPath (ver `_locator_to_selector`/`locatorToSelector`/`LocatorToSelector`
   en Python/Java/C# para el criterio con `By.id`/`By.className`/etc.).
2. Corré `probe-script` una vez (cacheado), ejecutalo con tu `execute_script` equivalente.
3. Armá el JSON de entrada, mandalo por stdin a `healify heal`.
4. Con la respuesta, reintentá con `locator.strategy`/`locator.value`.
5. Opcional: grabá en `.healify/history.jsonl` para sumar al repertorio compartido.

Alcance deliberado de los tres adapters: envuelven solo el equivalente de `find_element`
(no cada método de interacción — mismo alcance acotado que `selenium-plugin` en JS), y no
generan `healify-report.html/json/md` — eso queda para una integración más completa, más
adelante.
