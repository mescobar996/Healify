# @healify/mcp

Servidor [MCP](https://modelcontextprotocol.io) de Healify. Le deja a un agente preguntar si un
selector es frágil y por qué falló un test, con respuestas deterministas calculadas en tu máquina.

## Por qué existe

Ya hay un MCP server oficial de Playwright para que un agente maneje un browser. Este es el
complemento, no el reemplazo.

La falla documentada de los agentes que manejan browsers es que **clickean con exceso de
confianza el primer elemento que matchea** y se inventan lo que no pueden ver. Healify aporta lo
contrario: una respuesta que se puede auditar, sacada de heurística determinista y de archivos
que ya están en el disco.

De ahí la regla que ordena todo el servidor: **sin haber visto la página, no se propone un nombre
concreto**. Un agente que recibe `role('button', { name: 'Submit' })` inventado lo aplica sin
dudar, y el resultado es un test que sigue roto y encima parece arreglado.

## Instalación

```bash
npm i -D @healify/mcp
```

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "healify": {
      "command": "npx",
      "args": ["-y", "@healify/mcp"],
      "cwd": "/ruta/a/tu/proyecto/de/tests"
    }
  }
}
```

El `cwd` importa: las herramientas que leen archivos (`healify-report.json`,
`.healify/history.jsonl`) lo hacen desde ahí.

No abre puertos, no habla con la red y no pide ninguna credencial.

## Herramientas

### `healify_analyze_selector`

Clasifica qué tan frágil es un selector. Responde **por qué se va a romper**, no con qué
reemplazarlo.

```json
{ "selector": "#btn-a1b2c3d4" }
```

```json
{
  "selector": "#btn-a1b2c3d4",
  "selectorType": "CSS",
  "fragile": true,
  "detectedIssue": "Dynamic ID detected - will break on next build",
  "verifiedReplacementAvailable": false,
  "note": "Análisis estático, sin ver la página..."
}
```

`verifiedReplacementAvailable` es siempre `false` acá, a propósito. Para un reemplazo verificado
hay que correr los tests y leer el reporte con `healify_report_summary`.

### `healify_diagnose_failure`

Por qué falló un test, a partir de su mensaje de error: `selector`, `assertion`, `timing`,
`navigation`, `runtime` o `unknown`.

```json
{ "errorMessage": "expect(page.locator('#total')).toHaveText('99')\nExpected: \"99\"\nReceived: \"12\"" }
```

```json
{
  "cause": "assertion",
  "selectorHealingApplies": false,
  "rationale": "El test falló en una aserción: el elemento se encontró, lo que no coincidió fue el valor..."
}
```

Sirve para que un agente no salga a buscar un selector nuevo cuando el problema es otro.

### `healify_report_summary`

Lee un `healify-report.json` y devuelve los selectores rotos con su corrección, marcando cuáles
son seguros de aplicar.

```json
{
  "testName": "agrega al carrito",
  "verified": true,
  "confidence": 0.97,
  "suggestedSelector": "role('button', { name: 'Agregar' })",
  "safeToApply": true
}
```

`safeToApply` combina dos condiciones: la corrección se confrontó contra la página real
(`verified`) y superó el umbral de confianza (`status: healed`). Un caso en `review` puede ser
correcto, pero necesita ojo humano — típicamente porque el test es intermitente.

### `healify_chronic_selectors`

Los selectores que se vienen rompiendo una y otra vez, con la recomendación de qué hacer.

```json
{
  "selector": "#add-to-cart",
  "breakages": 5,
  "spanDays": 21,
  "recommendation": "Se rompió 5 veces en 21 días. En vez de volver a parchear el selector, agregale un data-testid estable al elemento."
}
```

## Cero dependencias

El protocolo MCP sobre stdio está implementado en este paquete: JSON-RPC 2.0 delimitado por
saltos de línea, cuatro mensajes. No trae `@modelcontextprotocol/sdk` ni ninguna otra dependencia
de runtime, igual que el resto de Healify.

---

MIT · Parte de [Healify](https://github.com/mescobar996/Healify)
