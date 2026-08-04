[← Documentación](README.md) · [Healify](../README.md)

---

# Configuración

> Opcional: Healify funciona sin configurar nada. Acá está qué podés ajustar cuando lo necesites.

Opcional. Healify funciona sin nada configurado. Se lee de `healify.config.js` → `healify.config.cjs` → `healify.config.json` → la key `healify` de `package.json` (gana el primero que exista).

```js
// healify.config.js  (CommonJS)
module.exports = {
  healEnabled: true,        // apagá el sanado sin desinstalar nada
  minConfidence: 0.90,      // confianza mínima para que un caso salga "healed" (lo que fix aplica)
  reviewConfidence: 0.80,   // debajo de esto, "unresolved"
  maxAlternatives: 3,       // cuántas alternativas guarda el motor
  customTestIds: ['data-qa-id'],
  customSynonyms: { actions: { comprar: 'Comprar ahora' } },
}
```

| Opción | Default | Qué hace |
|---|---|---|
| `healEnabled` | `true` | `false` reporta los fallos pero no propone correcciones. |
| `minConfidence` | `0.90` | Umbral de `healed`. Subilo para que `fix` sea más conservador. |
| `reviewConfidence` | `0.80` | Frontera `review` / `unresolved`. Nunca puede superar a `minConfidence`. |
| `maxAlternatives` | `3` | Alternativas además de la principal. |
| `customTestIds` | — | Atributos `data-*` propios del equipo, además de los 5 built-in. |
| `customSynonyms` | — | Acciones/campos propios, además de los diccionarios EN/ES. |

Las variables de entorno pisan el archivo — útil para un job de CI puntual, sin tocar el repo:

```bash
HEALIFY_HEAL_ENABLED=false npx playwright test
```

`HEALIFY_HEAL_ENABLED`, `HEALIFY_MIN_CONFIDENCE`, `HEALIFY_REVIEW_CONFIDENCE`, `HEALIFY_MAX_ALTERNATIVES`. Un valor que no parsea se ignora y queda lo del archivo.
