# Feature #8 — Historial de curaciones (MVP)

## Status: APPROVED — Ready for Implementation Plan

*Reemplaza la versión anterior de este documento (mismo archivo). La versión original
asumía código que no existe en el repo real (`cli/src/commands/fix.ts`, `cli/src/config.ts`)
y proponía un alcance mucho mayor al que pedía `ROADMAP.md` #8 (config subsystem, 3
formatos de salida, 5 trends, `gitCommit` por línea). Esta versión corrige esos supuestos
contra el código real y recorta el alcance a un MVP, decidido explícitamente con el
usuario tras una ronda de brainstorming.*

---

## Problema

Hoy cada corrida de `healify fix` es efímera: no hay forma de responder "¿qué selectores
se rompen repetidamente?" o "¿este selector ya se rompió antes?". `healify-report.json` se
pisa en cada corrida, no queda ningún rastro entre corridas.

---

## Qué NO incluye este MVP (y por qué)

- **Sin sistema de config** (`healify config set ...`). No existe hoy ningún `config.ts`
  ni comando `config` en el CLI real — construirlo sería una feature aparte, no algo que
  ya está ahí para "tocar".
- **Sin `gitCommit` por línea**. Solo existe `isGitDirty()` (mira si hay cambios sin
  commitear), no hay captura de hash de commit en ningún lado del código actual.
- **Sin `runId`, `fixMethod`, `project`, `framework` por línea**. No aportan nada sin un
  sistema de retención/config detrás, que no existe en este MVP.
- **Sin export HTML/JSON, sin `--since`, sin retención/poda automática**. A ~300
  bytes/línea (estimado en la versión anterior de este spec), el archivo tarda en volverse
  un problema real. Se agrega si el uso real lo pide, no antes.

Todo esto queda anotado en `ROADMAP.md` como posible ampliación futura de #8, no se pierde
la idea, solo no se construye todavía.

---

## Almacenamiento

`.healify/history.jsonl` en la raíz del proyecto consumidor. Append-only, una línea JSON
por cada caso (`LocalCaseResult`) de cada corrida real de `fix`. Se recomienda agregar
`.healify/` al `.gitignore` del proyecto consumidor (historial local de esa máquina, mismo
criterio que ya se usa con `test-results/`).

**Esquema por línea:**
```json
{
  "timestamp": "2026-07-23T18:50:00.000Z",
  "testFile": "e2e/login.spec.ts",
  "testName": "user can login",
  "selector": "#btn-old",
  "status": "healed",
  "fixedSelector": "role('button', { name: 'Login' })",
  "selectorType": "ROLE",
  "confidence": 0.92
}
```

Campos tomados 1:1 de `LocalCaseResult` (`reporter-core/src/local-mode.ts`) — no hace
falta inventar ni derivar nada nuevo, salvo el `timestamp` de captura.

---

## Cuándo se graba

Se engancha en `runFix()` (`cli/src/index.ts`), el único punto real que ya parsea un
`LocalRun` completo desde `report.json`. Justo después de leerlo, **si `!dryRun`**, se
graban **todos** los `run.cases` — healed, review y unresolved, no solo lo que `fix()`
pudo aplicar automáticamente. Así "selector recurrente" refleja selectores rotos reales,
no solo los auto-aplicables.

`--dry-run` **nunca** graba. El `gh-action` corre `fix --dry-run` en cada PR (potencialmente
varias veces por PR) — si eso grabara, el historial se llenaría de ruido de CI no
representativo de corridas reales de un dev. `--force` no cambia este comportamiento
(sigue grabando igual que sin `--force`).

Si escribir el archivo falla (permisos, disco lleno), se loguea un warning y `fix` sigue
funcionando normal — el historial es un complemento, nunca debe bloquear el flujo
principal de `fix`.

---

## Comando `healify history`

Sin flags para este MVP. Lee `.healify/history.jsonl`, calcula 2 vistas, imprime tablas en
terminal (mismo estilo que `printOutcomes`/`printInitReport` en `index.ts`).

**Top recurrentes**: agrupa por `selector` (string exacto), cuenta apariciones en todo el
historial, ordena desc, muestra top 10. Selectores candidatos obvios para agregarles un
`data-testid` estable.

**Re-rotos**: selectores con más de una aparición en el historial, donde la aparición más
antigua tiene `status: 'healed'`. Esto es una **aproximación**, no una medición exacta:
el historial no sabe si `fix()` realmente aplicó ese selector al archivo (podría haber
sido saltado por `ambiguous`/`dirty-git`/`not-substitutable`) — solo sabe que el motor lo
curó con confianza suficiente. Se documenta así en el código y en el output del comando,
no se presenta como más preciso de lo que es.

Si `.healify/history.jsonl` no existe todavía (nunca se corrió `fix` sin `--dry-run`), el
comando lo informa explícitamente en vez de fallar con un error de archivo no encontrado.

---

## Arquitectura

### Archivos nuevos
```
cli/src/history.ts              # appendHistory(run, cwd), readHistory(cwd),
                                 # computeTopRecurrent(entries), computeRebroken(entries)
cli/src/commands/history.ts     # comando CLI: lee, calcula, imprime
cli/src/__tests__/history.test.ts
cli/src/__tests__/history-command.test.ts
```
Un solo archivo para la lógica (no una carpeta `history/` con 4 archivos como proponía la
versión anterior) — el alcance recortado no lo justifica. Sigue el mismo patrón que
`commands/init.ts`/`commands/doctor.ts` ya establecido en el repo.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `cli/src/index.ts` | `runFix()`: llama `appendHistory(run, cwd)` si `!dryRun`, después de leer el reporte. Nuevo dispatch para el comando `history` en `main()`. `printHelp()` documenta `history`. |

---

## Flujo de datos

```
test run → healify-report.json (LocalRun)
    ↓
healify fix [--ast] report.json     (sin --dry-run)
    ↓
runFix() parsea el LocalRun
    ↓
appendHistory(run, cwd)  ← NUEVO, antes de fix()/fixAst()
    ↓
.healify/history.jsonl (append, 1 línea por run.cases[i])
    ↓
healify history   ← lee, agrupa, imprime top recurrentes + re-rotos
```

---

## Testing

| Test | Aprox. |
|---|---|
| `appendHistory`: escribe N líneas, no pisa lo existente, no falla si `.healify/` no existe (lo crea), no revienta `fix` si falla la escritura | ~5 |
| `readHistory`: lee líneas válidas, ignora líneas corruptas sin reventar, vacío si el archivo no existe | ~3 |
| `computeTopRecurrent`: cuenta y ordena bien, top 10, empates | ~3 |
| `computeRebroken`: detecta el caso simple, no marca selectores que solo aparecen una vez, no marca los que nunca fueron `healed` en su primera aparición | ~3 |
| `runFix()`: graba en corrida real, NO graba en `--dry-run`, sigue funcionando si `appendHistory` falla | ~3 |
| Comando `history`: tabla con datos, mensaje cuando no hay historial todavía | ~2 |

Total aproximado: ~19 tests nuevos.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Archivo crece sin límite | No mitigado en este MVP — a ~300 bytes/línea no es un problema real todavía. Si lo fuera, se agrega retención después, con datos reales de cuánto crece. |
| Escritura concurrente corrompe el JSONL | Mismo supuesto que ya usa el resto del CLI: proceso único, sin considerar multi-proceso concurrente. |
| Selectores con datos sensibles | Solo se guardan strings de selector — mismo dato que ya vive en `healify-report.json`, no es información nueva expuesta. |
| `--dry-run` del gh-action ensucia el historial | Resuelto por diseño: `--dry-run` nunca graba. |

---

## Criterios de aceptación

- [ ] `healify fix report.json` (sin `--dry-run`) graba todos los `run.cases` en `.healify/history.jsonl`
- [ ] `healify fix --dry-run report.json` NO graba nada
- [ ] `healify history` muestra top 10 recurrentes y re-rotos en tabla de terminal
- [ ] `healify history` sin historial previo informa el estado en vez de fallar
- [ ] Build + verify completos en verde, `npm audit` en 0 vulnerabilidades

---

*Corregido y recortado a MVP: 2026-07-23, tras brainstorming con el usuario.*
*Siguiente paso: invocar writing-plans para el plan de implementación.*
