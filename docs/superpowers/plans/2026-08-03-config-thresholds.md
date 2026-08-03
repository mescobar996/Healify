# Plan — Umbrales configurables y `healify.config.js` (gaps G4 + G5)

**Origen:** `.claude/research/competitive-gaps.md` § TOP 3 ③
**Goal:** paridad de DX con el `healenium.properties` que todo tutorial del rubro muestra
(`score-cap`, `heal-enabled`, `recovery-tries`), sin backend ni properties de Java.
**Restricción:** cero dependencias, carga síncrona (los adapters corren en callbacks sincrónicos).

## Problema

Dos cosas, y la segunda es peor que la primera:

1. **Los umbrales están hardcodeados.** `HEALED_THRESHOLD = 0.9` y `REVIEW_THRESHOLD = 0.8` viven
   como constantes de módulo en `local-mode.ts`. Un equipo conservador no puede exigir 0.95 antes
   de dejar que `fix` toque un archivo; uno agresivo no puede bajar a 0.85. Tampoco hay forma de
   apagar Healify para una corrida sin desinstalarlo (el `-Dheal-enabled=false` de Healenium).
2. **La config existente casi no se usa.** `loadConfig()` solo lo llama `explain`. Los adapters
   (Playwright, Cypress) llaman `runLocalHealing()`, que **nunca recibe la config** — o sea que
   `customTestIds` y `customSynonyms`, documentados como config del proyecto, no tienen ningún
   efecto sobre el reporte real. Es un bug silencioso, no una feature faltante.

## Diseño

### `reporter-core/src/config.ts`

Campos nuevos en `HealifyConfig`, con el equivalente de Healenium al lado:

| Campo | Default | Healenium |
|---|---|---|
| `healEnabled` | `true` | `heal-enabled` |
| `minConfidence` | `0.90` | `score-cap` |
| `reviewConfidence` | `0.80` | — |
| `maxAlternatives` | `3` | `recovery-tries` |

- **Orden de carga:** `healify.config.js` → `healify.config.cjs` → `healify.config.json` →
  `package.json#healify`. Gana el primero que exista y parsee.
- **`.js`/`.cjs` son CommonJS** (`module.exports = {...}`), cargados con `createRequire` para que
  funcione igual en el bundle ESM y en el CJS. Un `.js` que resulte ser ESM tira `ERR_REQUIRE_ESM`;
  se captura y se sigue con el siguiente candidato en vez de romper la corrida.
- **Overrides por env** — el análogo directo del `-Dheal-enabled=false` de Healenium, que es lo
  que se usa en CI para desactivar sin tocar archivos:
  `HEALIFY_HEAL_ENABLED`, `HEALIFY_MIN_CONFIDENCE`, `HEALIFY_REVIEW_CONFIDENCE`,
  `HEALIFY_MAX_ALTERNATIVES`. Pisan lo que diga el archivo.
- **`resolveThresholds(config)`**: aplica defaults y sanea. Un valor fuera de `[0,1]`, no numérico
  o con `reviewConfidence > minConfidence` se corrige en vez de romper — misma política que toda
  la config hoy: Healify funciona con config parcial o mal escrita.

### `reporter-core/src/healing-engine.ts`
`HealRequest.maxAlternatives` — reemplaza el `slice(1, 4)` hardcodeado.

### `reporter-core/src/local-mode.ts`
`runLocalHealing(input, config?)`:
- `healEnabled: false` → el caso sale `unresolved` con una explicación que dice por qué, sin correr
  el motor. Se sigue reportando el fallo: apagar el healing no es apagar el reporte.
- Pasa `customTestIds`/`customSynonyms`/`maxAlternatives` al motor — **arregla el bug de que la
  config del proyecto nunca llegaba al análisis**.
- Los umbrales salen de la config resuelta.

### Adapters
`test-runner` (Playwright) y `cypress-plugin` cargan la config una vez y se la pasan a
`runLocalHealing`. Sin esto el feature no se ve en el reporte, que es donde importa.

## Archivos

| Archivo | Cambio |
|---|---|
| `reporter-core/src/config.ts` | campos nuevos, loader `.js`/`.cjs`, env, `resolveThresholds` |
| `reporter-core/src/local-mode.ts` | segundo parámetro `config` |
| `reporter-core/src/healing-engine.ts` | `maxAlternatives` |
| `reporter-core/src/index.ts` | exports nuevos |
| `test-runner/src/reporter.ts` | carga y pasa la config |
| `cypress-plugin/src/plugin.ts` | carga y pasa la config |
| `reporter-core/src/__tests__/config.test.ts` | nuevo |
| `reporter-core/src/__tests__/local-mode.test.ts` | tests de umbrales |

## Verificación

- [ ] `minConfidence: 0.95` deja en `review` algo que con el default sería `healed`.
- [ ] `reviewConfidence` mueve la frontera `review` / `unresolved`.
- [ ] `healEnabled: false` no corre el motor y explica por qué.
- [ ] `HEALIFY_HEAL_ENABLED=false` pisa el archivo.
- [ ] `HEALIFY_MIN_CONFIDENCE` pisa el archivo; un valor basura se ignora.
- [ ] `maxAlternatives` recorta la lista de alternativas.
- [ ] `healify.config.js` (CJS) se lee; un `.js` que es ESM no rompe.
- [ ] `reviewConfidence > minConfidence` se sanea.
- [ ] `customTestIds` del archivo de config llega al reporte (regresión del bug).
- [ ] Sin config, todo el comportamiento es idéntico al de antes.
