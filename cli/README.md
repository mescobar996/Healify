# @healify/cli

Aplica las sugerencias de un `healify-report.json` (generado por `@healify/test-runner` o
`@healify/cypress-plugin`) directo en tus archivos de test. Cierra el loop entre
"Healify te sugirió un fix" y "el fix ya está en tu código", sin copiar y pegar a mano.

## Instalación

```bash
npm install --save-dev @healify/cli
```

## Uso

```bash
npx healify fix                       # busca ./healify-report.json
npx healify fix ruta/al/reporte.json   # ruta explícita
npx healify fix --dry-run              # muestra qué haría, no escribe nada
npx healify fix --force                # ignora el chequeo de git working tree sucio
```

Salida típica:

```
Healify fix — healify-report.json

✓ e2e/checkout.spec.ts — #add-to-cart-btn → [data-testid="add-to-cart"]
⚠ e2e/login.spec.ts — saltado: 'button.submit' aparece más de una vez, ambiguo
⚠ e2e/cart.spec.ts — saltado: cambios sin commitear (usá --force para ignorar)

1 selector aplicado · 2 salteados · 1 caso "review" sin tocar (ver healify-report.html)
```

## Qué toca y qué no

Solo aplica casos con **confianza ≥90%** (`status: 'healed'` en el reporte) — el mismo
umbral que ya usa `reporter-core` para decidir "esto es lo bastante confiable para no
pedir revisión". Los casos `review`/`unresolved` nunca se tocan: quedan para que los
revises a mano en `healify-report.html`.

Conservador a propósito, nunca adivina:

| Situación | Qué hace |
|---|---|
| El selector aparece 0 veces en el archivo | Salta, avisa "ya no se encontró" |
| El selector aparece 2+ veces | Salta, avisa "ambiguo" — no elige cuál |
| El archivo tiene cambios sin commitear en git | Salta, avisa (a menos que uses `--force` o `--dry-run`) |
| La sugerencia es tipo `role('button', { name: 'X' })` | Salta — es texto legible para el reporte, no un valor de selector pegable; aplicarlo tal cual corrompería el archivo |

## Licencia

MIT
