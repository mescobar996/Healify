# Plan — Probe que atraviesa shadow DOM e iframes (gaps G1 + G2)

**Origen:** `.claude/research/competitive-gaps.md` § TOP 3 ①
**Goal:** que `BROWSER_PROBE_SCRIPT` vea los elementos que viven dentro de un `shadowRoot` abierto y dentro de iframes same-origin, y que el motor sepa distinguir "está acá" de "está adentro de un iframe".
**Restricción:** cero dependencias, ES5 dentro del string del probe, sin red.

## Problema

`BROWSER_PROBE_SCRIPT` hace `document.querySelectorAll('button, a, input, ...')`. Eso:

- **No atraviesa shadow DOM.** En una app con web components (Salesforce Lightning, Ionic, Lit, Vaadin) devuelve `[]` o casi. `domContextFromProbeResult` entonces devuelve `undefined`, `analyzeAndHeal` corre sin `htmlContext` y toda sugerencia sale `verified: false`. El usuario no ve un error: ve una degradación silenciosa.
- **No entra a iframes.** Mismo efecto para checkouts embebidos, widgets de pago, editores WYSIWYG.

Afecta a **3 de los 4 adapters** (Selenium, WebdriverIO, Cypress). Playwright no lo sufre porque su snapshot ya pierce shadow DOM.

## Diseño

### `reporter-core/src/browser-probe.ts`
Reescribir el cuerpo del script como un walker recursivo:

```
scan(root, framePath, depth):
  para cada elemento de root.querySelectorAll('*'):
    si es candidato (button/a/input/textarea/select/[role]) -> push {role, name, frame}
    si el.shadowRoot                                        -> scan(el.shadowRoot, framePath, depth+1)
    si es iframe/frame y contentDocument es accesible       -> scan(doc, framePath + descriptor, depth+1)
```

- **Topes duros:** `MAX_DEPTH = 12`, `MAX_NODES = 3000`. Una página patológica no puede colgar el probe.
- **Cross-origin:** `el.contentDocument` tira `SecurityError`; se envuelve en `try/catch` y se ignora. Sin esto el probe entero moriría por un iframe de ads.
- **`closed` shadow roots:** inaccesibles por spec. No se intenta.
- **Descriptor de iframe:** `iframe#id` → `iframe[name=x]` → `iframe[src=...]` → `iframe[i]`. Anidados con ` > `. Se sanea (sin `]`, `"`, saltos de línea) porque viaja dentro de `[frame=...]`.
- **Orden:** sigue siendo orden de documento, así que los tests existentes de Selenium/WebdriverIO no se mueven.
- Se elimina el array `seen` + `indexOf` (era O(n²) y `querySelectorAll` nunca devuelve duplicados).

### `reporter-core/src/page-snapshot.ts`
- `PageElement.frame?: string` — presente solo si el elemento está dentro de un iframe.
- `formatPageElements`: emite `- button "Pagar" [frame=iframe#checkout]`.
- `parsePageSnapshot`: lee `[frame=...]` (los snapshots de Playwright no usan ese atributo, así que no hay colisión).
- `bestElementFor` / `bestNameFor`: **dos pasadas** — primero solo elementos top-level; si ahí no hay ganador claro, se reintenta incluyendo los de iframes. Un elemento del documento principal siempre le gana a uno embebido.

### `reporter-core/src/healing-engine.ts`
- `applyPageEvidence`: si el elemento ganador tiene `frame`, la sugerencia sigue siendo `verified` (existe de verdad) pero baja a `confidence 0.88` y la explicación dice explícitamente que hace falta entrar al frame. Un `role('button', {name:'Pagar'})` a nivel top no encuentra nada si el botón vive en un iframe: callarlo sería peor que no sugerir.

## Archivos

| Archivo | Cambio |
|---|---|
| `reporter-core/src/browser-probe.ts` | walker recursivo shadow DOM + iframe |
| `reporter-core/src/page-snapshot.ts` | campo `frame`, formato, parseo, preferencia top-level |
| `reporter-core/src/healing-engine.ts` | nota + confianza para el ganador embebido |
| `reporter-core/src/__tests__/browser-probe.test.ts` | tests del script en jsdom-like fake |
| `reporter-core/src/__tests__/page-snapshot.test.ts` | tests de `frame` |
| `reporter-core/src/__tests__/healing-engine.test.ts` | test del caso iframe |

## Verificación

- [ ] El probe encuentra un botón dentro de un `shadowRoot` abierto.
- [ ] El probe encuentra un botón dentro de un shadow root anidado (2 niveles).
- [ ] El probe encuentra un botón dentro de un iframe same-origin y lo marca con `frame`.
- [ ] Un iframe cross-origin (getter que tira) no rompe el resto del scan.
- [ ] `MAX_DEPTH` corta la recursión.
- [ ] Un elemento top-level le gana a uno homónimo dentro de un iframe.
- [ ] `npm test` sigue verde (538 + nuevos).
