[← Documentation](README.md) · [Healify](../README.md) · [Español](configuration.es.md)

---

# Configuration

> Optional: Healify works with nothing configured. Here's what you can tune when you need to.

Config is read from `healify.config.js` → `healify.config.cjs` → `healify.config.json` → the
`healify` key in `package.json` (first one that exists wins).

```js
// healify.config.js  (CommonJS)
module.exports = {
  healEnabled: true,        // turn healing off without uninstalling anything
  minConfidence: 0.90,      // minimum confidence for a case to come out "healed" (what fix applies)
  reviewConfidence: 0.80,   // below this, "unresolved"
  maxAlternatives: 3,       // how many alternatives the engine keeps
  customTestIds: ['data-qa-id'],
  customSynonyms: { actions: { buy: 'Buy now' } },
}
```

| Option | Default | What it does |
|---|---|---|
| `healEnabled` | `true` | `false` still reports failures but proposes no fixes. |
| `minConfidence` | `0.90` | Threshold for `healed`. Raise it to make `fix` more conservative. |
| `reviewConfidence` | `0.80` | Boundary between `review` and `unresolved`. Can never exceed `minConfidence`. |
| `maxAlternatives` | `3` | Alternatives kept besides the main one. |
| `customTestIds` | — | Your team's own `data-*` attributes, on top of the 5 built-in ones. |
| `customSynonyms` | — | Your own actions/fields, on top of the built-in EN/ES dictionaries. |

Environment variables override the file — handy for a one-off CI job without touching the repo:

```bash
HEALIFY_HEAL_ENABLED=false npx playwright test
```

`HEALIFY_HEAL_ENABLED`, `HEALIFY_MIN_CONFIDENCE`, `HEALIFY_REVIEW_CONFIDENCE`,
`HEALIFY_MAX_ALTERNATIVES`. A value that doesn't parse is ignored and the file's value stands.
